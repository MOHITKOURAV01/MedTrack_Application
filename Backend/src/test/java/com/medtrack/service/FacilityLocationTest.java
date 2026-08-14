package com.medtrack.service;

import com.medtrack.auth.model.AccountStatus;
import com.medtrack.auth.model.User;
import com.medtrack.auth.repository.UserRepository;
import com.medtrack.auth.service.KafkaEventPublisher;
import com.medtrack.model.Equipment;
import com.medtrack.model.EquipmentCategory;
import com.medtrack.model.EquipmentStatus;
import com.medtrack.model.EquipmentLocationHistory;
import com.medtrack.model.FacilityLocation;
import com.medtrack.model.Hospital;
import com.medtrack.model.LocationType;
import com.medtrack.repository.EquipmentLocationHistoryRepository;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.repository.FacilityLocationRepository;
import com.medtrack.repository.HospitalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Facility location tree, hierarchical filtering and per-asset location history (issue #745),
 * exercised end to end through {@link LocationService} and the location-aware equipment queries.
 */
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration",
        "spring.datasource.url=jdbc:h2:mem:location-tree-tests;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "app.data-initializer.enabled=false"
})
@Transactional
@DisplayName("facility location tree and assignment history")
class FacilityLocationTest {

    @MockitoBean
    private KafkaEventPublisher kafkaEventPublisher;

    @Autowired
    private LocationService locationService;

    @Autowired
    private EquipmentService equipmentService;

    @Autowired
    private FacilityLocationRepository locationRepository;

    @Autowired
    private EquipmentLocationHistoryRepository historyRepository;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private UserRepository userRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private String username;
    private Hospital hospital;

    @BeforeEach
    void setUp() {
        username = "location-owner-" + UUID.randomUUID();

        User owner = userRepository.save(User.builder()
                .name("Location Owner")
                .username(username)
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("irrelevant-but-at-least-six")
                .role("hospital")
                .phone("+1 (555) 000-0002")
                .organization("Location Trust")
                .accountStatus(AccountStatus.ACTIVE)
                .build());

        hospital = hospitalRepository.save(Hospital.builder()
                .name("Location Trust")
                .location("Test City")
                .user(owner)
                .build());
    }

    private FacilityLocation node(String name, LocationType type, Long parentId) {
        return locationService.createLocation(FacilityLocation.builder()
                .name(name)
                .locationType(type)
                .parentId(parentId)
                .build(), username);
    }

    private Equipment asset(String code) {
        return equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode(code)
                .name("Asset " + code)
                .department("Radiology")
                .category(EquipmentCategory.IMAGING)
                .status(EquipmentStatus.ACTIVE)
                .hospital(hospital)
                .build());
    }

    @Test
    @DisplayName("a facility - floor - room tree round-trips and carries tenant metadata")
    void treeCanBeCreatedAndRead() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation floor = node("Floor 1", LocationType.FLOOR, facility.getId());
        FacilityLocation room = node("MRI Suite 101", LocationType.ROOM, floor.getId());

        List<FacilityLocation> tree = locationService.getLocationTree(username);

        assertEquals(3, tree.size());
        assertEquals(facility.getId(), floor.getParentId());
        assertEquals(floor.getId(), room.getParentId());
        assertEquals(LocationType.ROOM, room.getLocationType());
    }

    @Test
    @DisplayName("assigning equipment records the current location and an audit entry")
    void assignmentUpdatesLocationAndWritesHistory() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation floor = node("Floor 1", LocationType.FLOOR, facility.getId());
        FacilityLocation room = node("MRI Suite 101", LocationType.ROOM, floor.getId());
        Equipment asset = asset("EQ-LOC-1");

        Equipment assigned = locationService.assignEquipmentToLocation(
                asset.getId(), room.getId(), LocalDate.now(), "initial placement", username);

        assertNotNull(assigned.getLocation());
        assertEquals(room.getId(), assigned.getLocation().getId());

        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(asset.getId(), username);
        assertEquals(1, history.size());
        assertEquals(room.getId(), history.get(0).getLocation().getId());
        assertEquals(username, history.get(0).getMovedBy());
    }

    @Test
    @DisplayName("filtering by a node returns assets placed anywhere beneath it")
    void hierarchicalFilterCoversTheWholeSubtree() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation floor = node("Floor 1", LocationType.FLOOR, facility.getId());
        FacilityLocation roomA = node("MRI Suite 101", LocationType.ROOM, floor.getId());
        FacilityLocation roomB = node("Lab 202", LocationType.ROOM, floor.getId());
        FacilityLocation otherFloor = node("Floor 2", LocationType.FLOOR, facility.getId());
        FacilityLocation roomC = node("ICU 301", LocationType.ROOM, otherFloor.getId());

        Equipment mri = asset("EQ-LOC-2");
        Equipment lab = asset("EQ-LOC-3");
        Equipment icu = asset("EQ-LOC-4");

        locationService.assignEquipmentToLocation(mri.getId(), roomA.getId(), null, null, username);
        locationService.assignEquipmentToLocation(lab.getId(), roomB.getId(), null, null, username);
        locationService.assignEquipmentToLocation(icu.getId(), roomC.getId(), null, null, username);

        Page<Equipment> onFloorOne =
                equipmentService.getAllEquipment(username, floor.getId(), PageRequest.of(0, 20));
        assertEquals(2, onFloorOne.getTotalElements(),
                "a floor filter must include assets in every room beneath it");

        Page<Equipment> acrossFacility =
                equipmentService.getAllEquipment(username, facility.getId(), PageRequest.of(0, 20));
        assertEquals(3, acrossFacility.getTotalElements(),
                "a facility filter must include assets on every floor beneath it");

        Page<Equipment> inIcu =
                equipmentService.getAllEquipment(username, roomC.getId(), PageRequest.of(0, 20));
        assertEquals(1, inIcu.getTotalElements());

        Page<Equipment> unrestricted =
                equipmentService.getAllEquipment(username, null, PageRequest.of(0, 20));
        assertEquals(3, unrestricted.getTotalElements());
    }

    @Test
    @DisplayName("nodes with children or assigned equipment cannot be deleted")
    void deletionIsBlockedForNodesInUse() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation floor = node("Floor 1", LocationType.FLOOR, facility.getId());
        FacilityLocation room = node("MRI Suite 101", LocationType.ROOM, floor.getId());

        assertThrows(IllegalArgumentException.class,
                () -> locationService.deleteLocation(facility.getId(), username),
                "a facility with child floors must not be deletable");
        assertThrows(IllegalArgumentException.class,
                () -> locationService.deleteLocation(floor.getId(), username),
                "a floor with child rooms must not be deletable");

        Equipment asset = asset("EQ-LOC-5");
        locationService.assignEquipmentToLocation(asset.getId(), room.getId(), null, null, username);
        assertThrows(IllegalArgumentException.class,
                () -> locationService.deleteLocation(room.getId(), username),
                "a room with assigned equipment must not be deletable");

        FacilityLocation empty = node("Lobby", LocationType.ROOM, floor.getId());
        locationService.deleteLocation(empty.getId(), username);
        assertTrue(locationService.getLocationTree(username).stream()
                        .noneMatch(node -> node.getId().equals(empty.getId())),
                "an unused node must be deletable");
    }

    @Test
    @DisplayName("another hospital cannot see, reassign to or delete this hospital's nodes")
    void locationsAreTenantIsolated() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation room = node("MRI Suite 101", LocationType.ROOM, facility.getId());
        Equipment asset = asset("EQ-LOC-6");

        User other = userRepository.save(User.builder()
                .name("Other Owner")
                .username("other-location-owner-" + UUID.randomUUID())
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("irrelevant-but-at-least-six")
                .role("hospital")
                .phone("+1 (555) 000-0003")
                .organization("Other Trust")
                .accountStatus(AccountStatus.ACTIVE)
                .build());
        Hospital otherHospital = hospitalRepository.save(Hospital.builder()
                .name("Other Trust")
                .location("Elsewhere")
                .user(other)
                .build());

        assertTrue(locationService.getLocationTree(other.getUsername()).isEmpty(),
                "the tree must be scoped to the caller's hospital");

        assertThrows(Exception.class, () -> locationService.deleteLocation(room.getId(), other.getUsername()),
                "another tenant must not be able to delete this hospital's node");
        assertThrows(Exception.class,
                () -> locationService.assignEquipmentToLocation(asset.getId(), room.getId(), null, null, other.getUsername()),
                "another tenant must not be able to assign equipment to this hospital's node");
    }

    @Test
    @DisplayName("location assignment is rejected when equipment status is RETIRED")
    void locationAssignmentBlockedForRetiredEquipment() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation room = node("Room 101", LocationType.ROOM, facility.getId());

        Equipment retiredAsset = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-RETIRED-1")
                .name("Retired X-Ray Machine")
                .department("Radiology")
                .category(EquipmentCategory.IMAGING)
                .status(EquipmentStatus.RETIRED)
                .hospital(hospital)
                .build());

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> locationService.assignEquipmentToLocation(
                        retiredAsset.getId(),
                        room.getId(),
                        LocalDate.now(),
                        "Attempting to reassign retired equipment",
                        username),
                "assigning a location to a retired asset must throw IllegalArgumentException");

        assertEquals(
                "Retired or disposed equipment cannot be assigned to a location",
                ex.getMessage());
    }

    @Test
    @DisplayName("location assignment is rejected when equipment status is DISPOSED")
    void locationAssignmentBlockedForDisposedEquipment() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation room = node("Room 102", LocationType.ROOM, facility.getId());

        Equipment disposedAsset = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-DISPOSED-1")
                .name("Disposed Ultrasound Scanner")
                .department("Radiology")
                .category(EquipmentCategory.IMAGING)
                .status(EquipmentStatus.DISPOSED)
                .hospital(hospital)
                .build());

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> locationService.assignEquipmentToLocation(
                        disposedAsset.getId(),
                        room.getId(),
                        LocalDate.now(),
                        "Attempting to reassign disposed equipment",
                        username),
                "assigning a location to a disposed asset must throw IllegalArgumentException");

        assertEquals(
                "Retired or disposed equipment cannot be assigned to a location",
                ex.getMessage());
    }

    @Test
    @DisplayName("location assignment is permitted for active or under-maintenance equipment")
    void locationAssignmentAllowedForMaintenanceEquipment() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation workshop = node("Biomed Workshop", LocationType.ROOM, facility.getId());

        Equipment maintenanceAsset = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-MNT-1")
                .name("Defibrillator in Workshop")
                .department("Emergency")
                .category(EquipmentCategory.MONITORING)
                .status(EquipmentStatus.UNDER_MAINTENANCE)
                .hospital(hospital)
                .build());

        Equipment updated = locationService.assignEquipmentToLocation(
                maintenanceAsset.getId(),
                workshop.getId(),
                LocalDate.now(),
                "Moved to workshop for calibration",
                username);

        assertNotNull(updated.getLocation(), "assigned location must not be null");
        assertEquals(workshop.getId(), updated.getLocation().getId(), "location id must match workshop");

        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(maintenanceAsset.getId(), username);
        assertEquals(1, history.size(), "one location history record should be created");
        assertEquals("Moved to workshop for calibration", history.get(0).getNotes());
    }

    @Test
    @DisplayName("location assignment with null effective date defaults to current date")
    void locationAssignmentWithNullEffectiveDateDefaultsToToday() {
        FacilityLocation facility = node("MedTrack West", LocationType.FACILITY, null);
        FacilityLocation room = node("Storage Room", LocationType.ROOM, facility.getId());
        Equipment asset = asset("EQ-NULL-DATE");

        Equipment updated = locationService.assignEquipmentToLocation(
                asset.getId(),
                room.getId(),
                null,
                "Moved without explicit effective date",
                username);

        assertNotNull(updated.getLocation(), "location must be updated");
        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(asset.getId(), username);
        assertEquals(1, history.size(), "history entry should be persisted");
        assertEquals(LocalDate.now(), history.get(0).getEffectiveDate(), "effective date should default to today");
        assertEquals("Moved without explicit effective date", history.get(0).getNotes());
    }

    @Test
    @DisplayName("location history preserves chronological audit entries across multiple moves")
    void locationHistoryPreservesAuditEntries() {
        FacilityLocation facility = node("MedTrack Central", LocationType.FACILITY, null);
        FacilityLocation roomA = node("Room A", LocationType.ROOM, facility.getId());
        FacilityLocation roomB = node("Room B", LocationType.ROOM, facility.getId());
        Equipment asset = asset("EQ-MULTI-MOVE");

        locationService.assignEquipmentToLocation(
                asset.getId(),
                roomA.getId(),
                LocalDate.now().minusDays(10),
                "Initial placement in Room A",
                username);
        locationService.assignEquipmentToLocation(
                asset.getId(),
                roomB.getId(),
                LocalDate.now(),
                "Relocated to Room B",
                username);

        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(asset.getId(), username);
        assertEquals(2, history.size(), "both relocation history entries must be preserved");
        assertEquals(roomB.getId(), history.get(0).getLocation().getId(), "latest move should be first");
        assertEquals(roomA.getId(), history.get(1).getLocation().getId(), "earlier move should be second");
    }

    @Test
    @DisplayName("resolveDescendantIds includes root node and all nested child nodes in hierarchy")
    void resolveDescendantIdsIncludesAllSubtreeNodes() {
        FacilityLocation building = node("Main Building", LocationType.FACILITY, null);
        FacilityLocation floor1 = node("First Floor", LocationType.FLOOR, building.getId());
        FacilityLocation room101 = node("Room 101", LocationType.ROOM, floor1.getId());

        java.util.Set<Long> descendantIds = locationService.resolveDescendantIds(building.getId(), username);

        assertEquals(3, descendantIds.size(), "descendant set should include building, floor, and room");
        assertTrue(descendantIds.contains(building.getId()), "must contain root building id");
        assertTrue(descendantIds.contains(floor1.getId()), "must contain child floor id");
        assertTrue(descendantIds.contains(room101.getId()), "must contain grandchild room id");
    }

    @Test
    @DisplayName("createLocation validates required fields and parent location ownership")
    void createLocationValidatesNameTypeAndParentOwnership() {
        assertThrows(
                IllegalArgumentException.class,
                () -> locationService.createLocation(
                        FacilityLocation.builder().name("   ").locationType(LocationType.ROOM).build(),
                        username),
                "blank name must be rejected");

        assertThrows(
                IllegalArgumentException.class,
                () -> locationService.createLocation(
                        FacilityLocation.builder().name("ICU Room 1").locationType(null).build(),
                        username),
                "null location type must be rejected");

        User otherUser = userRepository.save(User.builder()
                .name("Other Hospital User")
                .username("other-user-" + UUID.randomUUID())
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("password123")
                .role("hospital")
                .phone("+1 (555) 000-0099")
                .organization("Other Hospital")
                .accountStatus(AccountStatus.ACTIVE)
                .build());
        Hospital otherHosp = hospitalRepository.save(Hospital.builder()
                .name("Other Hospital")
                .location("North")
                .user(otherUser)
                .build());
        FacilityLocation otherParent = locationRepository.save(FacilityLocation.builder()
                .name("Other Facility")
                .locationType(LocationType.FACILITY)
                .hospital(otherHosp)
                .createdBy(otherUser.getUsername())
                .build());

        assertThrows(
                com.medtrack.exception.ResourceNotFoundException.class,
                () -> locationService.createLocation(
                        FacilityLocation.builder()
                                .name("Cross Tenant Room")
                                .locationType(LocationType.ROOM)
                                .parentId(otherParent.getId())
                                .build(),
                        username),
                "parent location belonging to another hospital must be rejected");
    }

    @Test
    @DisplayName("updateLocation modifies location details while preserving unchanged fields")
    void updateLocationModifiesDetailsAndPreservesUnchanged() {
        FacilityLocation location = node("Old Name", LocationType.ROOM, null);

        FacilityLocation updated = locationService.updateLocation(
                location.getId(),
                FacilityLocation.builder().name("New Name").build(),
                username);

        assertEquals("New Name", updated.getName(), "name should be updated");
        assertEquals(LocationType.ROOM, updated.getLocationType(), "location type should be preserved");

        FacilityLocation typeUpdated = locationService.updateLocation(
                location.getId(),
                FacilityLocation.builder().locationType(LocationType.FLOOR).build(),
                username);

        assertEquals("New Name", typeUpdated.getName(), "name should remain preserved");
        assertEquals(LocationType.FLOOR, typeUpdated.getLocationType(), "location type should be updated");
    }

    @Test
    @DisplayName("getEquipmentLocationHistory returns empty list when equipment has no location history")
    void getEquipmentLocationHistoryReturnsEmptyListForUnmovedEquipment() {
        Equipment unassignedAsset = asset("EQ-UNASSIGNED-1");

        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(unassignedAsset.getId(), username);

        assertNotNull(history, "returned history list must not be null");
        assertTrue(history.isEmpty(), "history list must be empty for unassigned equipment");
    }

    @Test
    @DisplayName("assignEquipmentToLocation rejects cross-tenant location assignment")
    void assignEquipmentToLocationRejectsCrossTenantLocation() {
        Equipment asset = asset("EQ-CROSS-LOC");

        User otherUser = userRepository.save(User.builder()
                .name("External Owner")
                .username("external-user-" + UUID.randomUUID())
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("password123")
                .role("hospital")
                .phone("+1 (555) 000-0099")
                .organization("External Hospital")
                .accountStatus(AccountStatus.ACTIVE)
                .build());
        Hospital externalHosp = hospitalRepository.save(Hospital.builder()
                .name("External Hospital")
                .location("East")
                .user(otherUser)
                .build());
        FacilityLocation externalLocation = locationRepository.save(FacilityLocation.builder()
                .name("External Ward")
                .locationType(LocationType.WING)
                .hospital(externalHosp)
                .createdBy(otherUser.getUsername())
                .build());

        assertThrows(
                com.medtrack.exception.ResourceNotFoundException.class,
                () -> locationService.assignEquipmentToLocation(
                        asset.getId(),
                        externalLocation.getId(),
                        LocalDate.now(),
                        "Cross tenant move",
                        username),
                "assigning location belonging to another hospital must be rejected");
    }

    @Test
    @DisplayName("assignEquipmentToLocation rejects cross-tenant equipment assignment")
    void assignEquipmentToLocationRejectsCrossTenantEquipment() {
        FacilityLocation location = node("Hospital Ward", LocationType.WING, null);

        User otherUser = userRepository.save(User.builder()
                .name("Other Hospital User")
                .username("other-owner-" + UUID.randomUUID())
                .email(UUID.randomUUID() + "@medtrack.test")
                .password("password123")
                .role("hospital")
                .phone("+1 (555) 000-0099")
                .organization("Other Health System")
                .accountStatus(AccountStatus.ACTIVE)
                .build());
        Hospital otherHosp = hospitalRepository.save(Hospital.builder()
                .name("Other Health System")
                .location("West")
                .user(otherUser)
                .build());

        Equipment otherEquipment = equipmentRepository.saveAndFlush(Equipment.builder()
                .equipmentCode("EQ-OTHER-HOSP")
                .name("Other Hospital Monitor")
                .department("ICU")
                .category(EquipmentCategory.MONITORING)
                .status(EquipmentStatus.ACTIVE)
                .hospital(otherHosp)
                .build());

        assertThrows(
                com.medtrack.exception.ResourceNotFoundException.class,
                () -> locationService.assignEquipmentToLocation(
                        otherEquipment.getId(),
                        location.getId(),
                        LocalDate.now(),
                        "Attempting cross-tenant equipment assignment",
                        username),
                "assigning location to equipment belonging to another hospital must be rejected");
    }

    // ------------------------------------------------------------------
    // Deleting a node asks what is standing there, not what once was
    //
    // deleteLocation used to count rows in equipment_location_history, which answers a different
    // question - the assets that were *ever* placed at a node - and so was wrong in both directions.
    // ------------------------------------------------------------------

    /**
     * The dangerous direction. {@code EquipmentService.addEquipment} sets {@code equipment.location}
     * straight from the submitted {@code locationId} and writes no history row, so an asset placed
     * through the equipment form left the history table empty for its node. The old guard saw
     * nothing there and deleted the location out from under live equipment - and
     * {@code equipment.location_id} carries no foreign key constraint, so the database did not stop
     * it either.
     */
    @Test
    @DisplayName("a node holding equipment placed through the equipment form cannot be deleted")
    void deletionIsBlockedForEquipmentPlacedWithoutAHistoryRow() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation room = node("Store Room", LocationType.ROOM, facility.getId());

        Equipment placedByForm = new Equipment();
        placedByForm.setEquipmentCode("EQ-FORM-1");
        placedByForm.setName("Infusion Pump");
        placedByForm.setDepartment("Radiology");
        placedByForm.setCategory(EquipmentCategory.MONITORING);
        placedByForm.setStatus(EquipmentStatus.ACTIVE);
        placedByForm.setLocationId(room.getId());
        Equipment saved = equipmentService.addEquipment(placedByForm, username);

        assertEquals(room.getId(), saved.getLocation().getId());
        assertTrue(historyRepository.findByEquipmentIdOrderByCreatedAtDesc(saved.getId()).isEmpty(),
                "the equipment form writes no movement record - that is what made this reachable");

        assertThrows(IllegalArgumentException.class,
                () -> locationService.deleteLocation(room.getId(), username),
                "a node holding a live asset must not be deletable, however the asset got there");

        assertTrue(locationService.getLocationTree(username).stream()
                        .anyMatch(candidate -> candidate.getId().equals(room.getId())),
                "the node must still be there after the refused delete");
    }

    /**
     * The other direction. A movement log keeps the row for the node an asset has left, so a node
     * every asset had moved out of counted as occupied forever and could never be tidied up.
     */
    @Test
    @DisplayName("a node every asset has moved out of can be deleted")
    void deletionIsAllowedOnceTheLastAssetHasMovedOn() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation wardA = node("Ward A", LocationType.ROOM, facility.getId());
        FacilityLocation wardB = node("Ward B", LocationType.ROOM, facility.getId());

        Equipment asset = asset("EQ-MOVED-1");
        locationService.assignEquipmentToLocation(asset.getId(), wardA.getId(), null, "in", username);
        locationService.assignEquipmentToLocation(asset.getId(), wardB.getId(), null, "out", username);

        assertEquals(2, historyRepository.countByLocationId(wardA.getId())
                        + historyRepository.countByLocationId(wardB.getId()),
                "both moves stay on the record");
        assertEquals(1, historyRepository.countByLocationId(wardA.getId()),
                "Ward A keeps its movement record even though nothing is there now");

        locationService.deleteLocation(wardA.getId(), username);

        assertTrue(locationService.getLocationTree(username).stream()
                        .noneMatch(candidate -> candidate.getId().equals(wardA.getId())),
                "an emptied node must be deletable");
    }

    /**
     * History outlives the node it names. It is an audit record: it has to keep saying that the
     * asset moved on a given date, by a given person, for a given reason, after the location is
     * gone. The association reads as null rather than failing to load, which is what
     * {@code @NotFound(IGNORE)} on {@code EquipmentLocationHistory.location} buys - without it the
     * asset's history tab returned a 500 for every asset that had ever passed through the node.
     */
    @Test
    @DisplayName("movement history stays readable after its location is deleted")
    void historySurvivesTheDeletionOfTheLocationItNames() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation wardA = node("Ward A", LocationType.ROOM, facility.getId());
        FacilityLocation wardB = node("Ward B", LocationType.ROOM, facility.getId());

        Equipment asset = asset("EQ-MOVED-2");
        locationService.assignEquipmentToLocation(
                asset.getId(), wardA.getId(), LocalDate.now().minusDays(3), "commissioned", username);
        locationService.assignEquipmentToLocation(
                asset.getId(), wardB.getId(), LocalDate.now(), "ward closure", username);

        locationService.deleteLocation(wardA.getId(), username);
        entityManager.flush();
        entityManager.clear();

        List<EquipmentLocationHistory> history =
                locationService.getEquipmentLocationHistory(asset.getId(), username);

        assertEquals(2, history.size(), "no movement record may be lost with the node");
        assertTrue(history.stream().anyMatch(entry -> "commissioned".equals(entry.getNotes())),
                "the reason the asset was placed in the deleted ward must still be readable");
        assertTrue(history.stream().anyMatch(entry -> entry.getLocation() == null),
                "the entry for the deleted ward reads as no location rather than failing to load");
        assertTrue(history.stream().anyMatch(entry -> entry.getLocation() != null
                        && entry.getLocation().getId().equals(wardB.getId())),
                "the surviving ward is still resolved normally");
    }

    /**
     * An archived asset must not hold a node hostage - that would be the same trap the history check
     * was - but the pointer it leaves behind is cleared on the way out, so restoring it later does
     * not bring back a reference to a location that no longer exists.
     */
    @Test
    @DisplayName("an archived asset neither blocks the delete nor keeps a dangling location pointer")
    void archivedEquipmentDoesNotBlockDeletionAndItsPointerIsCleared() {
        FacilityLocation facility = node("MedTrack General", LocationType.FACILITY, null);
        FacilityLocation room = node("Decommissioned Suite", LocationType.ROOM, facility.getId());

        Equipment asset = asset("EQ-ARCHIVED-1");
        locationService.assignEquipmentToLocation(asset.getId(), room.getId(), null, null, username);

        asset.setDeleted(true);
        equipmentRepository.saveAndFlush(asset);
        entityManager.clear();

        locationService.deleteLocation(room.getId(), username);
        entityManager.flush();
        entityManager.clear();

        // Native, because the class-level @SQLRestriction("deleted = false") hides archived rows
        // from every JPQL read.
        Object storedLocationId = entityManager
                .createNativeQuery("SELECT location_id FROM equipment WHERE id = :id")
                .setParameter("id", asset.getId())
                .getSingleResult();

        assertNull(storedLocationId,
                "an archived asset must not keep pointing at a location that has been deleted");
    }
}