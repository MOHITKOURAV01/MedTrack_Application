package com.medtrack.service;

import com.medtrack.auth.model.User;
import com.medtrack.auth.repository.UserRepository;
import com.medtrack.dto.DuplicateGroupResponse;
import com.medtrack.dto.DuplicateMatch;
import com.medtrack.exception.ResourceNotFoundException;
import com.medtrack.model.Equipment;
import com.medtrack.model.Hospital;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.repository.HospitalRepository;
import com.medtrack.util.StringSimilarity;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.medtrack.model.EquipmentStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Duplicate detection & reconciliation (issue #746).
 *
 * <p>The same physical device gets registered twice when the second entry differs from the first
 * by a typo, stray space or case difference that a strict-uniqueness check cannot see. This
 * service normalises identifiers before comparing them (see {@link StringSimilarity}) so those
 * near-ties surface as warnings at entry time and as a reconciliation list afterwards, and it
 * merges confirmed duplicates by combining stock, carrying history over to the surviving record
 * and archiving the duplicate.</p>
 */
@Service
@RequiredArgsConstructor
public class DuplicateDetectionService {

    /**
     * Every table that points at an equipment record, and how a merge moves its rows onto the
     * surviving asset.
     *
     * <p>Kept as one list rather than a run of inline calls so the set is visible in a single place
     * and so {@code DuplicateDetectionTest} can assert against it. A table missing from here is not
     * a cosmetic gap: {@code mergeDuplicates} archives the duplicate, and archived records fall out
     * of every query through the {@code deleted = false} restriction, so rows left behind become
     * unreachable from both assets. That is how the whole work-order history of a merged asset came
     * to disappear once the work-order module was added without this list being extended.</p>
     *
     * <p>{@code maintenance_tasks} is handled separately by {@link #reassignTaskMetadata} because it
     * also carries denormalised copies of the equipment code and name.</p>
     *
     * <p>Package-private so the test in this package can check it against the foreign keys the
     * schema actually declares, which is what turns "someone remembered" into "the build noticed".</p>
     */
    static final List<String> CHILD_REASSIGNMENTS = List.of(
            "UPDATE equipment_lifecycle_actions SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE equipment_location_history SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE equipment_disposals SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE maintenance_work_orders SET equipment_id = :keep WHERE equipment_id = :merge",
            // A preventive-maintenance rule scoped to one asset would otherwise stay on the
            // archived duplicate, and the surviving record would quietly stop being scheduled.
            "UPDATE maintenance_policy_rules SET equipment_record_id = :keep "
                    + "WHERE equipment_record_id = :merge",
            "UPDATE equipment_audit SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE equipment_audit_log SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE software_telemetry_logs SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE security_incidents SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE equipment SET replacement_equipment_id = :keep WHERE replacement_equipment_id = :merge",
            "UPDATE equipment_lifecycle_actions SET replacement_equipment_id = :keep "
                    + "WHERE replacement_equipment_id = :merge",
            "UPDATE software_telemetry_logs SET equipment_id = :keep WHERE equipment_id = :merge",
            "UPDATE security_incidents SET equipment_id = :keep WHERE equipment_id = :merge");

    private static final double SERIAL_THRESHOLD = 0.75;
    private static final double CODE_THRESHOLD = 0.75;

    /**
     * The bar a name/model pair has to clear. Higher than the identifier thresholds because a name
     * and a model are descriptive rather than unique - plenty of genuinely distinct assets are
     * close on both - so the evidence has to be stronger before it is called a duplicate. See
     * {@link #nameModelSimilarity}, which is what this is now actually applied to.
     */
    private static final double NAME_MODEL_THRESHOLD = 0.8;
    private static final double EXACT_SIMILARITY = 0.999;

    private final EquipmentRepository equipmentRepository;
    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;

    private Hospital getHospitalForUser(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username or email is required");
        }
        String identifier = username.trim();
        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier.toLowerCase(java.util.Locale.ROOT)))
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));
        return hospitalRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Hospital profile not found for user"));
    }

    /**
     * Checks an asset being created/edited against the hospital's inventory. The caller's own id
     * (when editing) is excluded so an asset never warns about itself.
     */
    @Transactional(readOnly = true)
    public List<DuplicateMatch> checkForDuplicates(String username, Long excludeId,
                                                   String name, String model,
                                                   String serialNumber, String equipmentCode) {
        if (isBlank(name) && isBlank(model) && isBlank(serialNumber) && isBlank(equipmentCode)) {
            return List.of();
        }
        Hospital hospital = getHospitalForUser(username);
        List<DuplicateMatch> matches = new ArrayList<>();
        for (Equipment existing : equipmentRepository.findByHospitalId(hospital.getId())) {
            if (excludeId != null && excludeId.equals(existing.getId())) {
                continue;
            }
            DuplicateMatch match = matchAgainst(existing, name, model, serialNumber, equipmentCode);
            if (match != null) {
                matches.add(match);
            }
        }
        matches.sort(Comparator.comparing(DuplicateMatch::getSimilarity).reversed());
        return matches;
    }

    private DuplicateMatch matchAgainst(Equipment existing, String name, String model,
                                        String serialNumber, String equipmentCode) {
        double best = 0.0;
        String matchedOn = null;

        if (!isBlank(serialNumber) && !isBlank(existing.getSerialNumber())) {
            double sim = StringSimilarity.similarity(serialNumber, existing.getSerialNumber());
            if (sim > best) {
                best = sim;
                matchedOn = "SERIAL_NUMBER";
            }
        }
        if (!isBlank(equipmentCode) && !isBlank(existing.getEquipmentCode())) {
            double sim = StringSimilarity.similarity(equipmentCode, existing.getEquipmentCode());
            if (sim > best) {
                best = sim;
                matchedOn = "ASSET_CODE";
            }
        }
        Double nameModelSimilarity = nameModelSimilarity(name, model, existing);
        if (nameModelSimilarity != null && nameModelSimilarity > best) {
            best = nameModelSimilarity;
            matchedOn = "NAME_MODEL";
        }
        if (best == 0.0 || best < thresholdFor(matchedOn)) {
            return null;
        }
        return DuplicateMatch.builder()
                .id(existing.getId())
                .equipmentCode(existing.getEquipmentCode())
                .name(existing.getName())
                .model(existing.getModel())
                .serialNumber(existing.getSerialNumber())
                .department(existing.getDepartment())
                .exact(best >= EXACT_SIMILARITY)
                .similarity(Math.round(best * 1000.0) / 1000.0)
                .matchedOn(matchedOn)
                .build();
    }

    /**
     * How alike two assets are on name <em>and</em> model, or {@code null} when the pair cannot be
     * compared that way at all.
     *
     * <p>The rule this replaces scored the name alone while still calling itself {@code NAME_MODEL}
     * and still applying {@link #NAME_MODEL_THRESHOLD}, a bar chosen for a combined comparison.
     * {@code model} was taken as a parameter and never read. Hospitals name assets by device type,
     * so a Hamilton C6 and a Dräger Evita V300 - both named {@code Ventilator}, different serials,
     * different asset codes, plainly different machines - scored {@code 1.0} and came back marked
     * {@code exact}. The warning fired on every second infusion pump and defibrillator in the
     * inventory, and a warning that is usually wrong stops being read, which costs the real
     * duplicates it exists to catch.</p>
     *
     * <p>The score is the <em>lower</em> of the two similarities, not their average. A duplicate is
     * a pair that matches on both parts: {@code MRI Scanner / Signa HDxt} against
     * {@code MRI Scaner / Signa HDxt} is a typo and still scores high, while a shared name with an
     * unrelated model collapses to the model's low score and falls out. Averaging would let a
     * perfect name carry a mismatched model over the bar, which is the behaviour being fixed.</p>
     *
     * <p>{@code null} - no name/model opinion - when either side is missing a name or a model. That
     * is deliberately the same precondition {@link #findDuplicateGroups} applies when it buckets on
     * {@code name|model}, so the entry-time warning and the reconciliation list now agree about what
     * a name/model duplicate is instead of contradicting each other. Assets with no model recorded
     * are still matched on serial number and asset code, which are the identifiers that actually
     * identify.</p>
     */
    private Double nameModelSimilarity(String name, String model, Equipment existing) {
        if (isBlank(name) || isBlank(model)
                || isBlank(existing.getName()) || isBlank(existing.getModel())) {
            return null;
        }
        return Math.min(
                StringSimilarity.similarity(name, existing.getName()),
                StringSimilarity.similarity(model, existing.getModel()));
    }

    private double thresholdFor(String matchedOn) {
        if ("SERIAL_NUMBER".equals(matchedOn)) {
            return SERIAL_THRESHOLD;
        }
        if ("ASSET_CODE".equals(matchedOn)) {
            return CODE_THRESHOLD;
        }
        return NAME_MODEL_THRESHOLD;
    }

    /**
     * Groups the whole inventory into probable duplicate clusters by normalised serial number,
     * normalised asset code, or name+model. Buckets with a single member are not duplicates and
     * are omitted. Clusters that overlap (the same pair matching on serial *and* name+model) are
     * unioned so each set of records appears exactly once.
     */
    @Transactional(readOnly = true)
    public List<DuplicateGroupResponse> findDuplicateGroups(String username) {
        Hospital hospital = getHospitalForUser(username);
        List<Equipment> inventory = equipmentRepository.findByHospitalId(hospital.getId());

        Map<String, List<Equipment>> bySerial = new LinkedHashMap<>();
        Map<String, List<Equipment>> byCode = new LinkedHashMap<>();
        Map<String, List<Equipment>> byNameModel = new LinkedHashMap<>();

        for (Equipment equipment : inventory) {
            if (!isBlank(equipment.getSerialNumber())) {
                bySerial.computeIfAbsent(StringSimilarity.normalize(equipment.getSerialNumber()),
                                key -> new ArrayList<>())
                        .add(equipment);
            }
            if (!isBlank(equipment.getEquipmentCode())) {
                byCode.computeIfAbsent(StringSimilarity.normalize(equipment.getEquipmentCode()),
                                key -> new ArrayList<>())
                        .add(equipment);
            }
            if (!isBlank(equipment.getName()) && !isBlank(equipment.getModel())) {
                byNameModel.computeIfAbsent(
                                StringSimilarity.normalize(equipment.getName()) + "|"
                                        + StringSimilarity.normalize(equipment.getModel()),
                                key -> new ArrayList<>())
                        .add(equipment);
            }
        }

        List<DuplicateGroupResponse> groups = new ArrayList<>();
        collectGroups(groups, bySerial, "SERIAL_NUMBER");
        collectGroups(groups, byCode, "ASSET_CODE");
        collectGroups(groups, byNameModel, "NAME_MODEL");
        return unionOverlapping(groups);
    }

    private void collectGroups(List<DuplicateGroupResponse> groups,
                               Map<String, List<Equipment>> buckets,
                               String matchedOn) {
        for (List<Equipment> bucket : buckets.values()) {
            if (bucket.size() > 1) {
                groups.add(DuplicateGroupResponse.builder()
                        .matchedOn(matchedOn)
                        .assets(bucket)
                        .build());
            }
        }
    }

    /**
     * Unions clusters that share at least one record, so the same duplicate pair never appears
     * twice under different match reasons. The reason of the first cluster is kept.
     */
    private List<DuplicateGroupResponse> unionOverlapping(List<DuplicateGroupResponse> groups) {
        List<DuplicateGroupResponse> merged = new ArrayList<>();
        for (DuplicateGroupResponse group : groups) {
            List<DuplicateGroupResponse> overlapping = merged.stream()
                    .filter(existing -> sharesAsset(existing, group))
                    .collect(java.util.stream.Collectors.toList());
            if (overlapping.isEmpty()) {
                merged.add(group);
                continue;
            }
            DuplicateGroupResponse target = overlapping.get(0);
            merged.removeAll(overlapping);
            Map<Long, Equipment> byId = new LinkedHashMap<>();
            for (DuplicateGroupResponse overlappingGroup : overlapping) {
                for (Equipment equipment : overlappingGroup.getAssets()) {
                    byId.put(equipment.getId(), equipment);
                }
            }
            for (Equipment equipment : group.getAssets()) {
                byId.putIfAbsent(equipment.getId(), equipment);
            }
            target.setAssets(new ArrayList<>(byId.values()));
            merged.add(target);
        }
        return merged;
    }

    private boolean sharesAsset(DuplicateGroupResponse group, DuplicateGroupResponse other) {
        for (Equipment asset : group.getAssets()) {
            for (Equipment candidate : other.getAssets()) {
                if (asset.getId().equals(candidate.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Merges {@code mergeId} into {@code keepId}: unit counts are combined, missing metadata is
     * preserved from the duplicate, every history record (lifecycle actions, location assignments,
     * disposals, maintenance tasks with updated denormalized fields, replacement links) is
     * reassigned to the surviving record, and the duplicate is archived rather than hard-deleted
     * so the audit trail survives.
     */
    @Transactional
    public Equipment mergeDuplicates(Long keepId, Long mergeId, String username) {
        if (keepId == null || mergeId == null || keepId.equals(mergeId)) {
            throw new IllegalArgumentException("Two different asset ids are required for a merge");
        }
        Hospital hospital = getHospitalForUser(username);
        Equipment keep = equipmentRepository.findByIdAndHospitalId(keepId, hospital.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found or you don't have access"));
        Equipment merge = equipmentRepository.findByIdAndHospitalId(mergeId, hospital.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found or you don't have access"));

        validateMergeableAssets(keep, merge);

        int keepQuantity = keep.getQuantity() == null ? 0 : keep.getQuantity();
        int mergeQuantity = merge.getQuantity() == null ? 0 : merge.getQuantity();
        keep.setQuantity(keepQuantity + mergeQuantity);

        transferMissingMetadata(keep, merge);

        for (String statement : CHILD_REASSIGNMENTS) {
            reassign(statement, keepId, mergeId);
        }
        reassignTaskMetadata(keepId, mergeId, keep.getEquipmentCode(), keep.getName());

        Equipment savedKeep = equipmentRepository.save(keep);

        merge.setDeleted(true);
        merge.setDeletedAt(LocalDateTime.now());
        merge.setDeletedBy(username);
        equipmentRepository.save(merge);

        entityManager.flush();
        entityManager.clear();

        return equipmentRepository.findById(keepId).orElse(savedKeep);
    }

    private void validateMergeableAssets(Equipment keep, Equipment merge) {
        if (Boolean.TRUE.equals(keep.getDeleted()) || Boolean.TRUE.equals(merge.getDeleted())) {
            throw new IllegalArgumentException("Cannot merge archived or soft-deleted equipment records");
        }
        if (isRetiredOrDisposed(keep) || isRetiredOrDisposed(merge)) {
            throw new IllegalArgumentException("Retired or disposed equipment records cannot be merged");
        }
    }

    private boolean isRetiredOrDisposed(Equipment equipment) {
        return equipment.getStatus() == EquipmentStatus.RETIRED
                || equipment.getStatus() == EquipmentStatus.DISPOSED;
    }

    /**
     * Preserves metadata during a duplicate merge by copying non-null attributes from the duplicate
     * record onto the surviving record whenever the surviving record lacks those attributes.
     */
    private void transferMissingMetadata(Equipment keep, Equipment merge) {
        if (isBlank(keep.getSerialNumber()) && !isBlank(merge.getSerialNumber())) {
            keep.setSerialNumber(merge.getSerialNumber().trim());
        }
        if (isBlank(keep.getModel()) && !isBlank(merge.getModel())) {
            keep.setModel(merge.getModel().trim());
        }
        if (isBlank(keep.getDepartment()) && !isBlank(merge.getDepartment())) {
            keep.setDepartment(merge.getDepartment().trim());
        }
        if (keep.getCategory() == null && merge.getCategory() != null) {
            keep.setCategory(merge.getCategory());
        }
        if (keep.getPurchaseDate() == null && merge.getPurchaseDate() != null) {
            keep.setPurchaseDate(merge.getPurchaseDate());
        }
        if (keep.getWarrantyExpiry() == null && merge.getWarrantyExpiry() != null) {
            keep.setWarrantyExpiry(merge.getWarrantyExpiry());
        }
        if (keep.getPurchaseCost() == null && merge.getPurchaseCost() != null) {
            keep.setPurchaseCost(merge.getPurchaseCost());
        }
        if (keep.getUsefulLifeYears() == null && merge.getUsefulLifeYears() != null) {
            keep.setUsefulLifeYears(merge.getUsefulLifeYears());
        }
        if (keep.getDepreciationMethod() == null && merge.getDepreciationMethod() != null) {
            keep.setDepreciationMethod(merge.getDepreciationMethod());
        }
        if (isBlank(keep.getWarrantyProvider()) && !isBlank(merge.getWarrantyProvider())) {
            keep.setWarrantyProvider(merge.getWarrantyProvider().trim());
        }
        if (isBlank(keep.getWarrantyContractNumber()) && !isBlank(merge.getWarrantyContractNumber())) {
            keep.setWarrantyContractNumber(merge.getWarrantyContractNumber().trim());
        }
        if (keep.getWarrantyStartDate() == null && merge.getWarrantyStartDate() != null) {
            keep.setWarrantyStartDate(merge.getWarrantyStartDate());
        }
        if (keep.getWarrantyCoverageType() == null && merge.getWarrantyCoverageType() != null) {
            keep.setWarrantyCoverageType(merge.getWarrantyCoverageType());
        }
        if (isBlank(keep.getWarrantyTerms()) && !isBlank(merge.getWarrantyTerms())) {
            keep.setWarrantyTerms(merge.getWarrantyTerms().trim());
        }
        if (keep.getLocation() == null && merge.getLocation() != null) {
            keep.setLocation(merge.getLocation());
        }
        if (isBlank(keep.getCustodian()) && !isBlank(merge.getCustodian())) {
            keep.setCustodian(merge.getCustodian().trim());
        }
        if (isBlank(keep.getRoomLocation()) && !isBlank(merge.getRoomLocation())) {
            keep.setRoomLocation(merge.getRoomLocation().trim());
        }
        if (isBlank(keep.getWardLocation()) && !isBlank(merge.getWardLocation())) {
            keep.setWardLocation(merge.getWardLocation().trim());
        }
        if (keep.getMinimumStock() == null && merge.getMinimumStock() != null) {
            keep.setMinimumStock(merge.getMinimumStock());
        }
    }

    private void reassign(String sql, Long keepId, Long mergeId) {
        entityManager.createNativeQuery(sql)
                .setParameter("keep", keepId)
                .setParameter("merge", mergeId)
                .executeUpdate();
    }

    private void reassignTaskMetadata(Long keepId, Long mergeId, String keepCode, String keepName) {
        entityManager.createNativeQuery(
                "UPDATE maintenance_tasks SET equipment_record_id = :keep, equipment_id = :keepCode, equipment = :keepName WHERE equipment_record_id = :merge")
                .setParameter("keep", keepId)
                .setParameter("keepCode", keepCode != null ? keepCode : "")
                .setParameter("keepName", keepName != null ? keepName : "")
                .setParameter("merge", mergeId)
                .executeUpdate();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}