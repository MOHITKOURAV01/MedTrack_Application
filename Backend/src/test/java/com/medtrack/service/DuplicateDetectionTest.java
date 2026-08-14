package com.medtrack.service;

import com.medtrack.auth.model.AccountStatus;
import com.medtrack.auth.model.User;
import com.medtrack.auth.repository.UserRepository;
import com.medtrack.auth.service.KafkaEventPublisher;
import com.medtrack.dto.DuplicateGroupResponse;
import com.medtrack.dto.DuplicateMatch;
import com.medtrack.exception.ResourceNotFoundException;
import com.medtrack.model.DepreciationMethod;
import com.medtrack.model.Equipment;
import com.medtrack.model.EquipmentCategory;
import com.medtrack.model.EquipmentDisposal;
import com.medtrack.model.EquipmentDisposalMethod;
import com.medtrack.model.EquipmentDisposalStatus;
import com.medtrack.model.EquipmentLifecycleAction;
import com.medtrack.model.EquipmentLifecycleActionType;
import com.medtrack.model.EquipmentLifecycleStatus;
import com.medtrack.model.EquipmentStatus;
import com.medtrack.model.Hospital;
import com.medtrack.model.MaintenanceStatus;
import com.medtrack.model.MaintenanceTask;
import com.medtrack.model.MaintenanceWorkOrder;
import com.medtrack.model.MaintenanceWorkOrderPriority;
import com.medtrack.model.MaintenanceWorkOrderStatus;
import com.medtrack.model.MaintenanceWorkOrderType;
import com.medtrack.model.EquipmentAudit;
import com.medtrack.model.SlaState;
import com.medtrack.model.WarrantyCoverageType;
import com.medtrack.analytics.model.IncidentSeverity;
import com.medtrack.analytics.model.RiskEvaluationEvent;
import com.medtrack.analytics.model.SecurityIncident;
import com.medtrack.analytics.model.SoftwareTelemetryLog;
import com.medtrack.analytics.repository.RiskEvaluationEventRepository;
import com.medtrack.analytics.repository.SecurityIncidentRepository;
import com.medtrack.analytics.repository.SoftwareTelemetryLogRepository;
import com.medtrack.repository.EquipmentDisposalRepository;
import com.medtrack.repository.EquipmentLifecycleActionRepository;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.repository.HospitalRepository;
import com.medtrack.repository.EquipmentAuditRepository;
import com.medtrack.repository.MaintenanceTaskRepository;
import com.medtrack.repository.MaintenanceWorkOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Duplicate detection & tag reconciliation (issue #746), exercised through
 * {@link DuplicateDetectionService} end to end.
 */
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration",
        "spring.datasource.url=jdbc:h2:mem:duplicate-detection-tests;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "app.data-initializer.enabled=false"
})
@Transactional
@DisplayName("duplicate detection and reconciliation")
class DuplicateDetectionTest {

    @MockitoBean
    private KafkaEventPublisher kafkaEventPublisher;

    @Autowired
    private DuplicateDetectionService duplicateDetectionService;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @Autowired
    private EquipmentLifecycleActionRepository lifecycleRepository;

    @Autowired
    private MaintenanceTaskRepository taskRepository;

    @Autowired
    private MaintenanceWorkOrderRepository workOrderRepository;

    @Autowired
    private EquipmentAuditRepository equipmentAuditRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private EquipmentDisposalRepository disposalRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SoftwareTelemetryLogRepository telemetryLogRepository;

    @Autowired
    private SecurityIncidentRepository securityIncidentRepository;

    @Autowired
    private RiskEvaluationEventRepository riskEvaluationEventRepository;

    private String username;
    private Hospital hospital;

    @BeforeEach
    void setUp() {
        username = "duplicates-owner-" + UUID.randomUUID();

        User owner = userRepository.save(User.builder()
                .name("Duplicates Owner")
                .username(username)
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("irrelevant-but-at-least-six")
                .role("hospital")
                .phone("+1 (555) 000-0004")
                .organization("Duplicates Trust")
                .accountStatus(AccountStatus.ACTIVE)
                .build());

        hospital = hospitalRepository.save(Hospital.builder()
                .name("Duplicates Trust")
                .location("Test City")
                .user(owner)
                .build());
    }

    private Equipment asset(String code, String serial, String name, String model) {
        return equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode(code)
                .serialNumber(serial)
                .name(name)
                .model(model)
                .department("Radiology")
                .category(EquipmentCategory.IMAGING)
                .status(EquipmentStatus.ACTIVE)
                .quantity(1)
                .hospital(hospital)
                .build());
    }

    @Test
    @DisplayName("entry-time check flags a typo-variant serial but not an unrelated asset")
    void checkFlagsNearDuplicatesOnly() {
        Equipment mri = asset("EQ-DUP-1", "MRI-1001", "MRI Scanner", "Siemens X1");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, null, null, "MRI 1001", null);

        assertEquals(1, matches.size());
        DuplicateMatch match = matches.get(0);
        assertEquals(mri.getId(), match.getId());
        assertEquals("SERIAL_NUMBER", match.getMatchedOn());
        assertTrue(match.getSimilarity() >= 0.8,
                "the normalised difference between 'MRI-1001' and 'MRI 1001' is only a hyphen");

        List<DuplicateMatch> unrelated = duplicateDetectionService.checkForDuplicates(
                username, null, null, null, "VENT-9999-X", null);
        assertTrue(unrelated.isEmpty(), "a non-matching serial must not warn");
    }

    @Test
    @DisplayName("editing excludes the asset's own record from the warning")
    void checkExcludesTheRecordBeingEdited() {
        Equipment mri = asset("EQ-DUP-2", "MRI-1002", "MRI Scanner", "Siemens X1");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, mri.getId(), null, null, "MRI-1002", null);

        assertTrue(matches.isEmpty(), "an asset must not warn about itself while editing");
    }

    @Test
    @DisplayName("reconciliation groups assets sharing serial, code or name+model")
    void reconciliationGroupsLikelyDuplicates() {
        // Same physical scanner entered twice with different codes but the same serial.
        asset("EQ-DUP-3", "MRI-1003", "MRI Scanner", "Siemens X1");
        asset("EQ-DUP-4", "MRI-1003", "MRI Scanner", "Siemens X1");
        asset("EQ-DUP-5", "VENT-2001", "Ventilator", "GE Vent 900");

        List<DuplicateGroupResponse> groups = duplicateDetectionService.findDuplicateGroups(username);

        assertEquals(1, groups.size());
        assertEquals("SERIAL_NUMBER", groups.get(0).getMatchedOn());
        assertEquals(2, groups.get(0).getAssets().size());
    }

    @Test
    @DisplayName("merging combines stock, carries history to the survivor and archives the duplicate")
    void mergeKeepsOneRecordWithFullHistory() {
        Equipment first = asset("EQ-DUP-6", "MRI-1006", "MRI Scanner", "Siemens X1");
        Equipment second = asset("EQ-DUP-7", "MRI-1006", "MRI Scanner", "Siemens X1");

        lifecycleRepository.save(EquipmentLifecycleAction.builder()
                .equipment(second)
                .hospital(hospital)
                .actionType(EquipmentLifecycleActionType.TRANSFER)
                .status(EquipmentLifecycleStatus.COMPLETED)
                .requestedBy(username)
                .build());

        Equipment survivor = duplicateDetectionService.mergeDuplicates(first.getId(), second.getId(), username);

        assertEquals(first.getId(), survivor.getId());
        assertEquals(2, survivor.getQuantity(), "unit counts of the two records must combine");

        List<EquipmentLifecycleAction> history =
                lifecycleRepository.findByEquipmentIdAndHospitalIdOrderByRequestedAtDesc(first.getId(), hospital.getId());
        assertFalse(history.isEmpty(), "lifecycle history must move onto the surviving record");

        List<DuplicateGroupResponse> groups = duplicateDetectionService.findDuplicateGroups(username);
        assertTrue(groups.isEmpty(), "after the merge no duplicate group may remain");
    }

    @Test
    @DisplayName("merging preserves missing metadata and updates maintenance tasks and disposal records")
    void mergePreservesMetadataAndReassignsTasksAndDisposals() {
        Equipment survivor = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-KEEP-1")
                .name("Ultrasound Machine")
                .department("Radiology")
                .status(EquipmentStatus.ACTIVE)
                .quantity(1)
                .hospital(hospital)
                .build());

        Equipment duplicate = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-MERGE-1")
                .name("Ultrasound Machine")
                .model("Philips EPIQ 7")
                .serialNumber("SN-US-7788")
                .department("Cardiology")
                .purchaseCost(new BigDecimal("150000.00"))
                .usefulLifeYears(7)
                .warrantyExpiry(LocalDate.now().plusYears(2))
                .custodian("Dr. Smith")
                .status(EquipmentStatus.ACTIVE)
                .quantity(2)
                .hospital(hospital)
                .build());

        disposalRepository.save(EquipmentDisposal.builder()
                .equipment(duplicate)
                .hospital(hospital)
                .disposalMethod(EquipmentDisposalMethod.SCRAP)
                .status(EquipmentDisposalStatus.PENDING_APPROVAL)
                .requestedBy(username)
                .build());

        taskRepository.save(MaintenanceTask.builder()
                .taskCode("MNT-TASK-1")
                .equipmentId(duplicate.getEquipmentCode())
                .equipment(duplicate.getName())
                .equipmentRecord(duplicate)
                .hospitalId(hospital.getId())
                .maintenanceType("Routine")
                .priority("Normal")
                .deadline(LocalDate.now().plusDays(10))
                .status(MaintenanceStatus.SCHEDULED)
                .slaState(SlaState.UPCOMING)
                .build());

        Equipment merged = duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);

        assertEquals("SN-US-7788", merged.getSerialNumber());
        assertEquals("Philips EPIQ 7", merged.getModel());
        assertEquals("Radiology", merged.getDepartment(), "Existing non-null survivor department is retained");
        assertEquals(new BigDecimal("150000.00"), merged.getPurchaseCost());
        assertEquals(7, merged.getUsefulLifeYears());
        assertEquals("Dr. Smith", merged.getCustodian());
        assertEquals(3, merged.getQuantity());

        List<EquipmentDisposal> disposals = disposalRepository.findByEquipmentIdAndHospitalIdOrderByRequestedAtDesc(
                survivor.getId(), hospital.getId());
        assertEquals(1, disposals.size(), "Disposal record must be reassigned to the survivor");

        List<MaintenanceTask> tasks = taskRepository.findByHospitalId(hospital.getId());
        assertEquals(1, tasks.size());
        MaintenanceTask updatedTask = tasks.get(0);
        assertEquals(survivor.getId(), updatedTask.getEquipmentRecord().getId());
        assertEquals(survivor.getEquipmentCode(), updatedTask.getEquipmentId());
        assertEquals(survivor.getName(), updatedTask.getEquipment());
    }

    @Test
    @DisplayName("merging rejects retired, disposed, or archived equipment")
    void mergeRejectsInvalidStatusOrArchivedEquipment() {
        Equipment first = asset("EQ-DUP-8", "MRI-1008", "MRI Scanner", "Siemens X1");
        Equipment retired = asset("EQ-DUP-9", "MRI-1009", "MRI Scanner", "Siemens X1");
        retired.setStatus(EquipmentStatus.RETIRED);
        equipmentRepository.saveAndFlush(retired);

        assertThrows(IllegalArgumentException.class, () ->
                duplicateDetectionService.mergeDuplicates(first.getId(), retired.getId(), username));

        Equipment archived = asset("EQ-DUP-10", "MRI-1010", "MRI Scanner", "Siemens X1");
        archived.setDeleted(true);
        equipmentRepository.saveAndFlush(archived);

        assertThrows(ResourceNotFoundException.class, () ->
                duplicateDetectionService.mergeDuplicates(first.getId(), archived.getId(), username));
    }

    @Test
    @DisplayName("merging rejects invalid asset arguments such as null or identical IDs")
    void mergeRejectsIdenticalOrNullAssetIds() {
        Equipment first = asset("EQ-DUP-11", "MRI-1011", "MRI Scanner", "Siemens X1");

        assertThrows(IllegalArgumentException.class, () ->
                duplicateDetectionService.mergeDuplicates(null, first.getId(), username));
        assertThrows(IllegalArgumentException.class, () ->
                duplicateDetectionService.mergeDuplicates(first.getId(), null, username));
        assertThrows(IllegalArgumentException.class, () ->
                duplicateDetectionService.mergeDuplicates(first.getId(), first.getId(), username));
    }

    @Test
    @DisplayName("merging preserves extended warranty, location, and depreciation contract attributes")
    void mergePreservesAllExtendedWarrantyAndLocationFields() {
        Equipment survivor = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-KEEP-EXT")
                .name("ECG Monitor")
                .department("ICU")
                .status(EquipmentStatus.ACTIVE)
                .quantity(2)
                .hospital(hospital)
                .build());

        Equipment duplicate = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-MERGE-EXT")
                .name("ECG Monitor")
                .department("ICU")
                .warrantyProvider("GE Healthcare")
                .warrantyContractNumber("WARR-998877")
                .warrantyStartDate(LocalDate.now().minusMonths(6))
                .warrantyExpiry(LocalDate.now().plusMonths(18))
                .warrantyCoverageType(WarrantyCoverageType.FULL_PARTS_AND_LABOR)
                .warrantyTerms("24/7 priority support included")
                .depreciationMethod(DepreciationMethod.DECLINING_BALANCE)
                .roomLocation("Room 402")
                .wardLocation("North Wing")
                .minimumStock(15)
                .status(EquipmentStatus.ACTIVE)
                .quantity(3)
                .hospital(hospital)
                .build());

        Equipment merged = duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);

        assertEquals("GE Healthcare", merged.getWarrantyProvider());
        assertEquals("WARR-998877", merged.getWarrantyContractNumber());
        assertEquals(LocalDate.now().minusMonths(6), merged.getWarrantyStartDate());
        assertEquals(LocalDate.now().plusMonths(18), merged.getWarrantyExpiry());
        assertEquals(WarrantyCoverageType.FULL_PARTS_AND_LABOR, merged.getWarrantyCoverageType());
        assertEquals("24/7 priority support included", merged.getWarrantyTerms());
        assertEquals(DepreciationMethod.STRAIGHT_LINE, merged.getDepreciationMethod());
        assertEquals("Room 402", merged.getRoomLocation());
        assertEquals("North Wing", merged.getWardLocation());
        assertEquals(10, merged.getMinimumStock());
        assertEquals(5, merged.getQuantity());
    }

    @Test
    @DisplayName("merging retains existing non-null metadata on survivor asset")
    void mergeRetainsExistingSurvivorMetadataWhenAlreadySet() {
        Equipment survivor = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-KEEP-EXISTING")
                .name("Defibrillator")
                .model("Zoll R Series")
                .serialNumber("SN-KEEP-1111")
                .department("Emergency")
                .warrantyProvider("Zoll Medical")
                .minimumStock(8)
                .status(EquipmentStatus.ACTIVE)
                .quantity(1)
                .hospital(hospital)
                .build());

        Equipment duplicate = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-MERGE-EXISTING")
                .name("Defibrillator")
                .model("Zoll X Series")
                .serialNumber("SN-MERGE-2222")
                .department("Cardiology")
                .warrantyProvider("Other Vendor")
                .minimumStock(20)
                .status(EquipmentStatus.ACTIVE)
                .quantity(1)
                .hospital(hospital)
                .build());

        Equipment merged = duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);

        assertEquals("Zoll R Series", merged.getModel(), "Survivor model must not be overwritten");
        assertEquals("SN-KEEP-1111", merged.getSerialNumber(), "Survivor serial number must not be overwritten");
        assertEquals("Emergency", merged.getDepartment(), "Survivor department must not be overwritten");
        assertEquals("Zoll Medical", merged.getWarrantyProvider(), "Survivor warranty provider must not be overwritten");
        assertEquals(8, merged.getMinimumStock(), "Survivor minimum stock must not be overwritten");
        assertEquals(2, merged.getQuantity(), "Quantities must still be combined");
    }

    @Test
    @DisplayName("merging carries the duplicate's work orders onto the survivor")
    void mergeReassignsMaintenanceWorkOrders() {
        Equipment survivor = asset("EQ-WO-KEEP", "SN-WO-KEEP", "MRI Scanner", "Siemens Magnetom");
        Equipment duplicate = asset("EQ-WO-MERGE", "SN-WO-MERGE", "MRI Scanner", "Siemens Magnetom");

        workOrderRepository.saveAndFlush(MaintenanceWorkOrder.builder()
                .workOrderCode("WO-000901")
                .hospitalId(hospital.getId())
                .equipment(duplicate)
                .title("Coil replacement")
                .maintenanceType(MaintenanceWorkOrderType.CORRECTIVE)
                .priority(MaintenanceWorkOrderPriority.HIGH)
                .status(MaintenanceWorkOrderStatus.IN_PROGRESS)
                .dueDate(LocalDate.now().plusDays(3))
                .createdAt(LocalDateTime.now())
                .createdBy(username)
                .deleted(false)
                .build());

        // The survivor starts with none of its own, so anything it ends up with came from the merge.
        assertTrue(workOrderRepository
                        .findAllByHospitalIdAndEquipmentIdOrderByCreatedAtDesc(hospital.getId(), survivor.getId())
                        .isEmpty(),
                "Precondition: the survivor has no work orders of its own");

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        List<MaintenanceWorkOrder> carried = workOrderRepository
                .findAllByHospitalIdAndEquipmentIdOrderByCreatedAtDesc(hospital.getId(), survivor.getId());
        assertEquals(1, carried.size(),
                "The duplicate's work order must follow the asset onto the survivor");
        assertEquals("WO-000901", carried.get(0).getWorkOrderCode());
        assertEquals(MaintenanceWorkOrderStatus.IN_PROGRESS, carried.get(0).getStatus(),
                "An in-flight work order stays in flight; the merge only changes which asset it points at");

        assertTrue(workOrderRepository
                        .findAllByHospitalIdAndEquipmentIdOrderByCreatedAtDesc(hospital.getId(), duplicate.getId())
                        .isEmpty(),
                "Nothing may be left pointing at the archived duplicate");
    }

    @Test
    @DisplayName("merging carries the duplicate's audit trail onto the survivor")
    void mergeReassignsEquipmentAudits() {
        Equipment survivor = asset("EQ-AUD-KEEP", "SN-AUD-KEEP", "Infusion Pump", "Braun Infusomat");
        Equipment duplicate = asset("EQ-AUD-MERGE", "SN-AUD-MERGE", "Infusion Pump", "Braun Infusomat");

        equipmentAuditRepository.saveAndFlush(EquipmentAudit.builder()
                .equipmentId(duplicate.getId())
                .hospital(hospital)
                .username(username)
                .action("UPDATE")
                .changedFields("department")
                .previousValue("Radiology")
                .newValue("Cardiology")
                .timestamp(LocalDateTime.now())
                .build());

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        assertEquals(1,
                equipmentAuditRepository.findByEquipmentIdOrderByTimestampDesc(survivor.getId()).size(),
                "The audit trail is the reason the duplicate is archived rather than deleted, so it "
                        + "has to end up on the record that survives");
        assertTrue(equipmentAuditRepository.findByEquipmentIdOrderByTimestampDesc(duplicate.getId()).isEmpty(),
                "Nothing may be left pointing at the archived duplicate");
    }

    @Test
    @DisplayName("every foreign key into equipment is covered by the merge")
    void mergeCoversEveryTableThatReferencesEquipment() {
        // Reads the foreign keys the schema actually declares rather than a hand-kept list, so a
        // new table referencing equipment fails here the moment it is added instead of silently
        // stranding its rows on an archived asset - which is exactly how maintenance_work_orders
        // came to be missing.
        // Reads the columns the schema actually declares rather than a hand-kept list, so a new
        // table referencing equipment fails here the moment it is added instead of silently
        // stranding its rows on an archived asset - which is exactly how maintenance_work_orders
        // came to be missed.
        //
        // Restricted to numeric columns on purpose. maintenance_tasks.equipment_id and
        // equipment_orders.equipment_id are VARCHAR copies of the asset code rather than keys;
        // rewriting a delivered purchase order's recorded asset code is not something a duplicate
        // merge should do.
        @SuppressWarnings("unchecked")
        List<Object[]> columns = entityManager.createNativeQuery("""
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'PUBLIC'
                  AND column_name LIKE '%EQUIPMENT%ID'
                  AND data_type IN ('BIGINT', 'INTEGER')
                """).getResultList();

        Set<String> declared = new LinkedHashSet<>();
        for (Object[] row : columns) {
            String table = String.valueOf(row[0]).toLowerCase(Locale.ROOT);
            String column = String.valueOf(row[1]).toLowerCase(Locale.ROOT);
            // maintenance_tasks is reassigned by reassignTaskMetadata, which also refreshes the
            // denormalised asset code and name it carries, so it is not in CHILD_REASSIGNMENTS.
            if ("maintenance_tasks".equals(table)) {
                continue;
            }
            declared.add(table + "." + column);
        }

        String covered = String.join(" ", DuplicateDetectionService.CHILD_REASSIGNMENTS)
                .toLowerCase(Locale.ROOT);
        Set<String> uncovered = new LinkedHashSet<>();
        for (String reference : declared) {
            String table = reference.substring(0, reference.indexOf('.'));
            String column = reference.substring(reference.indexOf('.') + 1);
            if (!covered.contains("update " + table + " set " + column + " =")) {
                uncovered.add(reference);
            }
        }

        assertTrue(uncovered.isEmpty(),
                "These columns reference equipment but no merge statement moves them onto the "
                        + "survivor, so their rows would be stranded on the archived duplicate: "
                        + uncovered);
        assertFalse(declared.isEmpty(), "Expected the schema to declare columns referencing equipment");
    }

    @Test
    @DisplayName("merging reassigns software telemetry logs from duplicate onto survivor")
    void mergeReassignsSoftwareTelemetryLogs() {
        Equipment survivor = asset("EQ-TEL-KEEP", "SN-TEL-KEEP", "Patient Monitor", "Mindray BeneVision");
        Equipment duplicate = asset("EQ-TEL-MERGE", "SN-TEL-MERGE", "Patient Monitor", "Mindray BeneVision");
        User user = hospital.getUser();

        SoftwareTelemetryLog log1 = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(duplicate)
                .actionType("DEVICE_DIAGNOSTIC")
                .success(true)
                .timestamp(LocalDateTime.now())
                .ipAddress("192.168.1.100")
                .endpointAccessed("/api/v1/telemetry/diagnostics")
                .executionTimeMs(145)
                .build());

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        SoftwareTelemetryLog reassignedLog = telemetryLogRepository.findById(log1.getLogId()).orElseThrow();
        assertNotNull(reassignedLog.getEquipment(), "Telemetry log should have non-null equipment");
        assertEquals(survivor.getId(), reassignedLog.getEquipment().getId(),
                "Software telemetry log must be reassigned from duplicate to survivor asset");
    }

    @Test
    @DisplayName("merging reassigns security incidents from duplicate onto survivor")
    void mergeReassignsSecurityIncidents() {
        Equipment survivor = asset("EQ-SEC-KEEP", "SN-SEC-KEEP", "Infusion Pump", "Alaris 8015");
        Equipment duplicate = asset("EQ-SEC-MERGE", "SN-SEC-MERGE", "Infusion Pump", "Alaris 8015");
        User user = hospital.getUser();

        SoftwareTelemetryLog telemetry = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(duplicate)
                .actionType("DEVICE_DIAGNOSTIC")
                .success(true)
                .timestamp(LocalDateTime.now())
                .build());

        RiskEvaluationEvent riskEvent = riskEvaluationEventRepository.saveAndFlush(RiskEvaluationEvent.builder()
                .telemetryLog(telemetry)
                .finalCbrsScore(85.5f)
                .riskLevel(com.medtrack.analytics.model.RiskLevel.HIGH)
                .policyEnforcementTaken(com.medtrack.analytics.model.PolicyEnforcement.MONITOR)
                .evaluationTimestamp(LocalDateTime.now())
                .build());

        SecurityIncident incident = securityIncidentRepository.saveAndFlush(SecurityIncident.builder()
                .riskEvent(riskEvent)
                .user(user)
                .equipment(duplicate)
                .incidentType("UNAUTHORIZED_FIRMWARE_MODIFICATION")
                .severity(IncidentSeverity.HIGH)
                .status(com.medtrack.analytics.model.IncidentStatus.OPEN)
                .detectedAt(LocalDateTime.now())
                .build());

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        SecurityIncident reassignedIncident = securityIncidentRepository.findById(incident.getIncidentId()).orElseThrow();
        assertNotNull(reassignedIncident.getEquipment(), "Security incident should have non-null equipment");
        assertEquals(survivor.getId(), reassignedIncident.getEquipment().getId(),
                "Security incident must be reassigned from duplicate to survivor asset");
    }

    @Test
    @DisplayName("merging preserves multiple telemetry logs and security incidents across merged assets")
    void mergePreservesMultipleTelemetryLogsAndIncidentsAcrossMergedAssets() {
        Equipment survivor = asset("EQ-MULTI-KEEP", "SN-MULTI-KEEP", "Ventilator", "Puritan Bennett 980");
        Equipment duplicate = asset("EQ-MULTI-MERGE", "SN-MULTI-MERGE", "Ventilator", "Puritan Bennett 980");
        User user = hospital.getUser();

        SoftwareTelemetryLog log1 = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(duplicate)
                .actionType("BOOT_SEQUENCE")
                .success(true)
                .timestamp(LocalDateTime.now().minusHours(2))
                .build());

        SoftwareTelemetryLog log2 = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(survivor)
                .actionType("CALIBRATION")
                .success(true)
                .timestamp(LocalDateTime.now().minusHours(1))
                .build());

        RiskEvaluationEvent riskEvent = riskEvaluationEventRepository.saveAndFlush(RiskEvaluationEvent.builder()
                .telemetryLog(log1)
                .finalCbrsScore(92.0f)
                .riskLevel(com.medtrack.analytics.model.RiskLevel.CRITICAL)
                .policyEnforcementTaken(com.medtrack.analytics.model.PolicyEnforcement.RESTRICT)
                .evaluationTimestamp(LocalDateTime.now().minusDays(1))
                .build());

        SecurityIncident incident = securityIncidentRepository.saveAndFlush(SecurityIncident.builder()
                .riskEvent(riskEvent)
                .user(user)
                .equipment(duplicate)
                .incidentType("NETWORK_ANOMALY")
                .severity(IncidentSeverity.CRITICAL)
                .status(com.medtrack.analytics.model.IncidentStatus.OPEN)
                .detectedAt(LocalDateTime.now().minusDays(1))
                .build());

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        SoftwareTelemetryLog updatedLog1 = telemetryLogRepository.findById(log1.getLogId()).orElseThrow();
        SoftwareTelemetryLog updatedLog2 = telemetryLogRepository.findById(log2.getLogId()).orElseThrow();
        SecurityIncident updatedIncident = securityIncidentRepository.findById(incident.getIncidentId()).orElseThrow();

        assertEquals(survivor.getId(), updatedLog1.getEquipment().getId());
        assertEquals(survivor.getId(), updatedLog2.getEquipment().getId());
        assertEquals(survivor.getId(), updatedIncident.getEquipment().getId());
    }

    @Test
    @DisplayName("merging retains historical incident and telemetry metadata integrity")
    void mergeRetainsHistoricalIncidentAndTelemetryAuditIntegrity() {
        Equipment survivor = asset("EQ-META-KEEP", "SN-META-KEEP", "ECG Machine", "GE MAC 2000");
        Equipment duplicate = asset("EQ-META-MERGE", "SN-META-MERGE", "ECG Machine", "GE MAC 2000");
        User user = hospital.getUser();

        LocalDateTime logTime = LocalDateTime.now().minusDays(3);
        SoftwareTelemetryLog log = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(duplicate)
                .actionType("FIRMWARE_UPDATE")
                .previousActionType("DIAGNOSTIC_RUN")
                .success(true)
                .timestamp(logTime)
                .ipAddress("10.0.0.45")
                .endpointAccessed("/api/v1/device/firmware")
                .executionTimeMs(320)
                .build());

        duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        SoftwareTelemetryLog resultLog = telemetryLogRepository.findById(log.getLogId()).orElseThrow();
        assertEquals(survivor.getId(), resultLog.getEquipment().getId());
        assertEquals("FIRMWARE_UPDATE", resultLog.getActionType());
        assertEquals("DIAGNOSTIC_RUN", resultLog.getPreviousActionType());
        assertEquals("10.0.0.45", resultLog.getIpAddress());
        assertEquals("/api/v1/device/firmware", resultLog.getEndpointAccessed());
        assertEquals(320, resultLog.getExecutionTimeMs());
    }

    @Test
    @DisplayName("merging assets with no telemetry logs or security incidents completes cleanly")
    void mergeHandlesNullAndEmptyTelemetryLogsGracefully() {
        Equipment survivor = asset("EQ-EMPTY-KEEP", "SN-EMPTY-KEEP", "Defibrillator", "Zoll R Series");
        Equipment duplicate = asset("EQ-EMPTY-MERGE", "SN-EMPTY-MERGE", "Defibrillator", "Zoll R Series");

        Equipment result = duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        assertNotNull(result);
        assertEquals(survivor.getId(), result.getId());
        assertTrue(equipmentRepository.findByIdAndHospitalId(duplicate.getId(), hospital.getId()).isEmpty());
    }

    @Test
    @DisplayName("merging sequentially consolidates telemetry logs and security incidents on final survivor")
    void mergeReassignsTelemetryLogsAndSecurityIncidentsAcrossMultipleDuplicateMergedChain() {
        Equipment first = asset("EQ-CHAIN-1", "SN-CHAIN-1", "Syringe Pump", "BD Alaris");
        Equipment second = asset("EQ-CHAIN-2", "SN-CHAIN-2", "Syringe Pump", "BD Alaris");
        Equipment survivor = asset("EQ-CHAIN-3", "SN-CHAIN-3", "Syringe Pump", "BD Alaris");
        User user = hospital.getUser();

        SoftwareTelemetryLog log1 = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(first)
                .actionType("BATTERY_TEST")
                .success(true)
                .timestamp(LocalDateTime.now().minusDays(5))
                .build());

        RiskEvaluationEvent risk1 = riskEvaluationEventRepository.saveAndFlush(RiskEvaluationEvent.builder()
                .telemetryLog(log1)
                .finalCbrsScore(75.0f)
                .riskLevel(com.medtrack.analytics.model.RiskLevel.MODERATE)
                .policyEnforcementTaken(com.medtrack.analytics.model.PolicyEnforcement.MONITOR)
                .evaluationTimestamp(LocalDateTime.now().minusDays(3))
                .build());

        SecurityIncident incident1 = securityIncidentRepository.saveAndFlush(SecurityIncident.builder()
                .riskEvent(risk1)
                .user(user)
                .equipment(second)
                .incidentType("LATE_NIGHT_ACCESS")
                .severity(IncidentSeverity.MEDIUM)
                .status(com.medtrack.analytics.model.IncidentStatus.OPEN)
                .detectedAt(LocalDateTime.now().minusDays(3))
                .build());

        duplicateDetectionService.mergeDuplicates(second.getId(), first.getId(), username);
        entityManager.clear();

        duplicateDetectionService.mergeDuplicates(survivor.getId(), second.getId(), username);
        entityManager.clear();

        SoftwareTelemetryLog finalLog = telemetryLogRepository.findById(log1.getLogId()).orElseThrow();
        SecurityIncident finalIncident = securityIncidentRepository.findById(incident1.getIncidentId()).orElseThrow();

        assertEquals(survivor.getId(), finalLog.getEquipment().getId(),
                "Telemetry log from initial asset must be migrated through the chain to final survivor");
        assertEquals(survivor.getId(), finalIncident.getEquipment().getId(),
                "Security incident from initial asset must be migrated through the chain to final survivor");
    }

    @Test
    @DisplayName("merging fails when assets belong to different hospitals")
    void mergeFailsWhenTargetEquipmentBelongsToDifferentHospital() {
        Equipment survivor = asset("EQ-HOSP-1", "SN-HOSP-1", "Ultrasound", "GE Logiq");

        Hospital otherHospital = hospitalRepository.saveAndFlush(Hospital.builder()
                .name("Other Hospital " + UUID.randomUUID())
                .location("City Hospital")
                .user(userRepository.saveAndFlush(User.builder()
                        .name("Other User")
                        .username("other-user-" + UUID.randomUUID())
                        .email("other-" + UUID.randomUUID() + "@hospital.com")
                        .password("hashed_password")
                        .phone("+15551234567")
                        .organization("Other Org")
                        .accountStatus(AccountStatus.ACTIVE)
                        .createdAt(LocalDateTime.now())
                        .build()))
                .build());

        Equipment duplicateOtherHospital = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-HOSP-2")
                .serialNumber("SN-HOSP-2")
                .name("Ultrasound")
                .model("GE Logiq")
                .department("Radiology")
                .status(EquipmentStatus.ACTIVE)
                .hospital(otherHospital)
                .deleted(false)
                .build());

        assertThrows(ResourceNotFoundException.class, () ->
                duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicateOtherHospital.getId(), username));
    }

    @Test
    @DisplayName("merging rejects identical keep and merge asset IDs")
    void mergePreventsSelfMergeOfEquipmentRecord() {
        Equipment survivor = asset("EQ-SELF-1", "SN-SELF-1", "Infusion Pump", "Fresenius Kabi");

        assertThrows(IllegalArgumentException.class, () ->
                duplicateDetectionService.mergeDuplicates(survivor.getId(), survivor.getId(), username));
    }

    @Test
    @DisplayName("merging transfers all missing metadata and reassigns child telemetry simultaneously")
    void mergeTransfersAllMissingMetadataAndReassignsChildTelemetry() {
        Equipment survivor = Equipment.builder()
                .equipmentCode("EQ-META-TRANS-1")
                .name("Infusion Pump")
                .department("Radiology")
                .hospital(hospital)
                .status(EquipmentStatus.ACTIVE)
                .deleted(false)
                .build();
        survivor = equipmentRepository.saveAndFlush(survivor);

        Equipment duplicate = Equipment.builder()
                .equipmentCode("EQ-META-TRANS-2")
                .name("Infusion Pump")
                .model("Alaris 8015")
                .serialNumber("SN-META-TRANS")
                .department("ICU")
                .custodian("Nurse Jackie")
                .hospital(hospital)
                .status(EquipmentStatus.ACTIVE)
                .deleted(false)
                .build();
        duplicate = equipmentRepository.saveAndFlush(duplicate);
        User user = hospital.getUser();

        SoftwareTelemetryLog log = telemetryLogRepository.saveAndFlush(SoftwareTelemetryLog.builder()
                .user(user)
                .equipment(duplicate)
                .actionType("PUMP_CALIBRATION")
                .success(true)
                .timestamp(LocalDateTime.now())
                .build());

        Equipment merged = duplicateDetectionService.mergeDuplicates(survivor.getId(), duplicate.getId(), username);
        entityManager.clear();

        assertEquals("Alaris 8015", merged.getModel());
        assertEquals("SN-META-TRANS", merged.getSerialNumber());
        assertEquals("Radiology", merged.getDepartment());
        assertEquals("Nurse Jackie", merged.getCustodian());

        SoftwareTelemetryLog reassignedLog = telemetryLogRepository.findById(log.getLogId()).orElseThrow();
        assertEquals(merged.getId(), reassignedLog.getEquipment().getId());
    }

    // ------------------------------------------------------------------
    // The NAME_MODEL rule looks at the model
    //
    // matchAgainst took `model` as a parameter and never read it, so the rule scored the name alone
    // while still calling itself NAME_MODEL and still applying a threshold chosen for a combined
    // comparison. Hospitals name assets by device type, so it fired on every second pump.
    // ------------------------------------------------------------------

    @Test
    @DisplayName("two different models of the same device type are not a duplicate")
    void differentModelsSharingANameAreNotDuplicates() {
        asset("AST-77310", "9F41K2ZQ", "Ventilator", "Hamilton C6");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, "Ventilator", "Evita V300", "TR8W0XB3", "BQZ-40289");

        assertTrue(matches.isEmpty(),
                "a shared device-type name with an unrelated model is not evidence of a duplicate");
    }

    /**
     * The specific claim in the bug report: the old rule returned {@code exact: true} for these two,
     * because a shared name scored 1.0 on its own.
     */
    @Test
    @DisplayName("a shared name with a different model is never reported as an exact match")
    void aSharedNameIsNeverAnExactMatchOnItsOwn() {
        asset("AST-51204", "K7PM3WD1", "Infusion Pump", "Alaris GP");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, "Infusion Pump", "Braun Infusomat", "ZX90QJF6", "BQZ-18866");

        assertTrue(matches.stream().noneMatch(DuplicateMatch::isExact),
                "two different pumps must never be reported as the same asset");
    }

    @Test
    @DisplayName("the same device typed twice with a typo is still flagged on name and model")
    void aTypoAcrossNameAndModelStillMatches() {
        Equipment original = asset("EQ-NM-5", "SN-MRI-1", "MRI Scanner", "Signa HDxt");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, "MRI Scaner", "Signa HDxt", "SN-MRI-2", "EQ-NM-6");

        assertEquals(1, matches.size(), "a one-character typo in the name is exactly what this catches");
        assertEquals(original.getId(), matches.get(0).getId());
        assertEquals("NAME_MODEL", matches.get(0).getMatchedOn());
    }

    @Test
    @DisplayName("an identical name and model is still an exact match")
    void anIdenticalNameAndModelIsExact() {
        asset("EQ-NM-7", "SN-XRAY-1", "X-Ray Unit", "Ysio Max");

        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, "X-Ray Unit", "Ysio Max", "SN-XRAY-2", "EQ-NM-8");

        assertEquals(1, matches.size());
        assertTrue(matches.get(0).isExact(), "same name and same model is the case the rule is for");
        assertEquals("NAME_MODEL", matches.get(0).getMatchedOn());
    }

    /**
     * Requiring a model on both sides is the same precondition {@code findDuplicateGroups} applies
     * when it buckets on {@code name|model}. Without it the two views contradicted each other: the
     * entry-time warning called a pair an exact duplicate that the reconciliation list did not
     * consider a duplicate at all.
     */
    @Test
    @DisplayName("an asset with no model recorded raises no name/model warning")
    void anAbsentModelYieldsNoNameModelOpinion() {
        asset("AST-30915", "M2VC8NH4", "Defibrillator", null);

        List<DuplicateMatch> onExistingWithoutModel = duplicateDetectionService.checkForDuplicates(
                username, null, "Defibrillator", "Lifepak 20", "WQ73PLB9", "BQZ-62471");
        assertTrue(onExistingWithoutModel.isEmpty(),
                "the stored asset records no model, so there is nothing to compare a model against");

        asset("AST-84402", "J5RT1YG8", "Defibrillator", "Lifepak 20");
        List<DuplicateMatch> onIncomingWithoutModel = duplicateDetectionService.checkForDuplicates(
                username, null, "Defibrillator", null, "XN46DKS2", "BQZ-95038");
        assertTrue(onIncomingWithoutModel.stream()
                        .noneMatch(match -> "NAME_MODEL".equals(match.getMatchedOn())),
                "the asset being entered records no model either");
    }

    /** Serial number and asset code matching are untouched by this and must keep working. */
    @Test
    @DisplayName("serial and asset-code matching still fire for assets with no model")
    void identifierMatchingIsUnaffected() {
        Equipment stored = asset("EQ-NM-13", "SN-CT-7001", "CT Scanner", null);

        List<DuplicateMatch> bySerial = duplicateDetectionService.checkForDuplicates(
                username, null, "CT Scanner", null, "SN CT 7001", null);
        assertEquals(1, bySerial.size());
        assertEquals("SERIAL_NUMBER", bySerial.get(0).getMatchedOn());
        assertEquals(stored.getId(), bySerial.get(0).getId());

        List<DuplicateMatch> byCode = duplicateDetectionService.checkForDuplicates(
                username, null, null, null, null, "EQ NM 13");
        assertEquals(1, byCode.size());
        assertEquals("ASSET_CODE", byCode.get(0).getMatchedOn());
    }

    /**
     * The two views have to agree. This is the pair from the bug report, checked from both ends.
     */
    @Test
    @DisplayName("the entry-time warning and the reconciliation list agree about name/model")
    void bothViewsAgreeOnWhatANameModelDuplicateIs() {
        asset("AST-11207", "H3QW7ZB5", "Ventilator", "Hamilton C6");
        asset("BQZ-73391", "P8LF2XN6", "Ventilator", "Evita V300");

        List<DuplicateGroupResponse> groups = duplicateDetectionService.findDuplicateGroups(username);
        assertTrue(groups.isEmpty(), "the reconciliation view does not consider these a duplicate");

        // A third ventilator, different again from both stored models.
        List<DuplicateMatch> matches = duplicateDetectionService.checkForDuplicates(
                username, null, "Ventilator", "Servo-u", "VD59TKM3", "CRY-40718");
        assertTrue(matches.isEmpty(), "and now neither does the entry-time warning");
    }
}
