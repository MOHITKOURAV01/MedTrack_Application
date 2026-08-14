package com.medtrack.repository;

import com.medtrack.model.Equipment;
import com.medtrack.model.EquipmentCategory;
import com.medtrack.model.EquipmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;


import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long>,
        JpaSpecificationExecutor<Equipment> {

    Optional<Equipment> findByEquipmentCode(String equipmentCode);
    Optional<Equipment> findBySerialNumber(String serialNumber);

    // Tenant-specific queries
    List<Equipment> findByHospitalId(Long hospitalId);

    Optional<Equipment> findByIdAndHospitalId(Long id, Long hospitalId);

    // Warranty monitoring queries
    List<Equipment> findByHospitalIdAndWarrantyExpiryBefore(
            Long hospitalId,
            LocalDate date
    );

    List<Equipment> findByHospitalIdAndWarrantyExpiryBetween(
            Long hospitalId,
            LocalDate startDate,
            LocalDate endDate
    );

    List<Equipment> findByHospitalIdAndStatus(
            Long hospitalId,
            EquipmentStatus status
    );

    // Low stock inventory
    @Query("""
            SELECT e
            FROM Equipment e
            WHERE e.hospital.id = :hospitalId
            AND e.quantity <= e.minimumStock
            """)
    List<Equipment> findLowStockEquipment(@Param("hospitalId") Long hospitalId);

    // Analytics aggregation queries
    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.hospital.id = :hospitalId")
    long countByHospitalId(@Param("hospitalId") Long hospitalId);

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.hospital.id = :hospitalId AND e.status = :status")
    long countByHospitalIdAndStatus(@Param("hospitalId") Long hospitalId, @Param("status") EquipmentStatus status);

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.hospital.id = :hospitalId AND e.warrantyExpiry BETWEEN :start AND :end")
    long countByHospitalIdAndWarrantyExpiryBetween(@Param("hospitalId") Long hospitalId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT e.name, e.category FROM Equipment e WHERE e.hospital.id = :hospitalId")
    List<Object[]> findNameAndCategoryByHospitalId(@Param("hospitalId") Long hospitalId);

    @Query("""
    SELECT e.category, COUNT(e)
    FROM Equipment e
    WHERE e.hospital.id = :hospitalId
    GROUP BY e.category
""")
    List<Object[]> countEquipmentByCategory(@Param("hospitalId") Long hospitalId);

    List<Equipment> findByHospitalIdAndDepartmentIgnoreCase(Long hospitalId, String department);

    // Overloaded on purpose: the Pageable variant is a distinct signature, not a duplicate of the
    // unpaged findByHospitalId(Long) declared at the top of this interface.
    Page<Equipment> findByHospitalId(Long hospitalId, Pageable pageable);

    @Query("""
            SELECT e
            FROM Equipment e
            WHERE e.hospital.id = :hospitalId
            AND e.location.id IN :locationIds
            """)
    Page<Equipment> findByHospitalIdAndLocationIn(
            @Param("hospitalId") Long hospitalId,
            @Param("locationIds") Collection<Long> locationIds,
            Pageable pageable
    );

    /**
     * How many live assets are standing at a facility location right now.
     *
     * <p>This is the only correct answer to "is this location occupied".
     * {@code LocationService.deleteLocation} used to ask
     * {@code EquipmentLocationHistoryRepository.countByLocationId} instead, which counts movement
     * records - assets that were <em>ever</em> placed there. That is a different question and it got
     * the answer wrong in both directions: assets placed through the equipment create/edit form
     * write no history row and so did not block the delete, while a location every asset had since
     * moved out of could never be deleted at all.</p>
     *
     * <p>The class-level {@code @SQLRestriction("deleted = false")} applies here, so archived assets
     * do not hold a location hostage; {@link #clearLocationReference(Long)} deals with the pointer
     * they leave behind.</p>
     *
     * @param locationId the facility location to count occupants of
     * @return the number of live assets currently assigned there
     */
    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.location.id = :locationId")
    long countByLocationId(@Param("locationId") Long locationId);

    /**
     * Clears {@code location_id} on every equipment row pointing at the given location, archived rows
     * included.
     *
     * <p>Native because the class-level {@code @SQLRestriction("deleted = false")} hides archived
     * rows from JPQL, and those are exactly the rows this has to reach: an archived asset that keeps
     * pointing at a deleted location comes back broken if it is ever restored.
     * {@code equipment.location_id} carries no foreign key constraint - V15 adds it as a plain
     * nullable column - so nothing in the database would have caught the dangling pointer.</p>
     *
     * @param locationId the facility location being deleted
     * @return the number of rows whose pointer was cleared
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE equipment SET location_id = NULL WHERE location_id = :locationId",
            nativeQuery = true)
    int clearLocationReference(@Param("locationId") Long locationId);

    // Retired view (issue #744): assets that have been decommissioned keep their full history and
    // remain searchable instead of being deleted. The class-level @SQLRestriction("deleted = false")
    // applies to these derived queries, which is exactly what the retired view wants.
    List<Equipment> findByHospitalIdAndStatusIn(Long hospitalId, Collection<EquipmentStatus> statuses);

    Page<Equipment> findByHospitalIdAndStatusIn(Long hospitalId, Collection<EquipmentStatus> statuses, Pageable pageable);

    // countByHospitalId and countByHospitalIdAndStatus are declared above as @Query methods.
    // They were also declared here as derived queries, which is a duplicate method signature
    // and is rejected by javac, so only the @Query declarations are kept.
    //
    // The same applies to findByHospitalId(Long) and findByIdAndHospitalId(Long, Long): both are
    // declared once at the top of this interface and every feature added since reuses those
    // declarations rather than restating them next to its own queries.
    long countByHospitalIdAndWarrantyExpiryBefore(Long hospitalId, LocalDate date);

    List<Equipment> findByHospitalIdAndPurchaseDateBetween(
            Long hospitalId,
            LocalDate startDate,
            LocalDate endDate
    );

    /**
     * Assets whose warranty runs past {@code horizon} - the "comfortably valid" bucket.
     *
     * <p>Rows with no warranty date are excluded on purpose; they are counted separately by
     * {@link #countByHospitalIdAndWarrantyExpiryIsNull(Long)} so that "unknown" is never
     * silently reported as "valid".</p>
     */
    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.hospital.id = :hospitalId AND e.warrantyExpiry > :horizon")
    long countByHospitalIdAndWarrantyExpiryAfter(
            @Param("hospitalId") Long hospitalId,
            @Param("horizon") LocalDate horizon);

    /** Assets with no warranty expiry recorded at all. */
    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.hospital.id = :hospitalId AND e.warrantyExpiry IS NULL")
    long countByHospitalIdAndWarrantyExpiryIsNull(@Param("hospitalId") Long hospitalId);

    // ---------------------------------------------------------------------
    // Warranty-expiry alerting (issue #943)
    // ---------------------------------------------------------------------

    /**
     * Assets across every tenant whose warranty ends inside {@code [start, end]} and which are still
     * part of the operating fleet.
     *
     * <p>Two things are deliberately pushed into the database rather than done in Java. The status
     * exclusion, because an asset that has been retired or disposed of can no longer have its
     * warranty renewed and must not raise an alert; and the date window, because the alert job only
     * ever cares about a fixed 90-day horizon and loading the whole {@code equipment} table to
     * discard almost all of it does not scale past a demo dataset.</p>
     *
     * <p>Pass {@link EquipmentStatus#DECOMMISSIONED} as {@code excludedStatuses}. It is exposed as a
     * parameter rather than hard-coded so the caller's intent is visible at the call site and the
     * query stays usable if a further terminal status is ever added.</p>
     *
     * <p>The class-level {@code @SQLRestriction("deleted = false")} still applies, so archived
     * records are excluded as well.</p>
     */
    @Query("""
            SELECT e
            FROM Equipment e
            WHERE e.warrantyExpiry BETWEEN :start AND :end
            AND e.status NOT IN :excludedStatuses
            AND e.hospital IS NOT NULL
            ORDER BY e.warrantyExpiry ASC, e.id ASC
            """)
    List<Equipment> findAlertableByWarrantyExpiryBetween(
            @Param("start") LocalDate start,
            @Param("end") LocalDate end,
            @Param("excludedStatuses") Collection<EquipmentStatus> excludedStatuses);

    /**
     * The count behind the dashboard's "upcoming warranty expirations" tile.
     *
     * <p>Applies the same eligibility rule as {@link #findAlertableByWarrantyExpiryBetween} so the
     * headline number and the alert feed cannot disagree. {@link
     * #countByHospitalIdAndWarrantyExpiryBetween} is kept for callers that genuinely want every
     * asset regardless of status.</p>
     */
    @Query("""
            SELECT COUNT(e)
            FROM Equipment e
            WHERE e.hospital.id = :hospitalId
            AND e.warrantyExpiry BETWEEN :start AND :end
            AND e.status NOT IN :excludedStatuses
            """)
    long countAlertableByHospitalIdAndWarrantyExpiryBetween(
            @Param("hospitalId") Long hospitalId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end,
            @Param("excludedStatuses") Collection<EquipmentStatus> excludedStatuses);

    // Soft delete - archived records (deleted = true).
    //
    // Native on purpose. Equipment carries a class-level @SQLRestriction("deleted = false") and
    // Hibernate appends that predicate to every HQL and criteria query for the entity, including
    // derived queries. `deleted = true AND deleted = false` is unsatisfiable, so as derived queries
    // these could never return a row: archiving an asset removed it permanently, with no way to
    // list it or restore it. A native query is passed through as written, so the restriction does
    // not apply and the archive view works while the default view still hides archived rows.

    @Query(value = "SELECT * FROM equipment WHERE deleted = TRUE AND hospital_id = :hospitalId",
            countQuery = "SELECT COUNT(*) FROM equipment WHERE deleted = TRUE AND hospital_id = :hospitalId",
            nativeQuery = true)
    Page<Equipment> findByDeletedTrueAndHospitalId(
            @Param("hospitalId") Long hospitalId,
            Pageable pageable);

    @Query(value = "SELECT * FROM equipment WHERE id = :id AND deleted = TRUE", nativeQuery = true)
    Optional<Equipment> findByIdAndDeletedTrue(@Param("id") Long id);

    /**
     * Resolves an archived asset inside a hospital boundary.
     *
     * <p>This remains a native query for the same reason as the other archive queries:
     * {@link org.hibernate.annotations.SQLRestriction} would otherwise add
     * {@code deleted = false}. Including {@code hospital_id} in the database predicate prevents
     * destructive archive operations from ever loading another tenant's record.</p>
     */
    @Query(value = """
            SELECT *
            FROM equipment
            WHERE id = :id
              AND deleted = TRUE
              AND hospital_id = :hospitalId
            """, nativeQuery = true)
    Optional<Equipment> findArchivedByIdAndHospitalId(
            @Param("id") Long id,
            @Param("hospitalId") Long hospitalId);

    // ---------------------------------------------------------------------
    // Preventive-maintenance automation matching queries
    // ---------------------------------------------------------------------

    List<Equipment> findByHospitalIdAndCategory(Long hospitalId, EquipmentCategory category);

    @Query("SELECT e FROM Equipment e "
            + "WHERE e.hospital.id = :hospitalId "
            + "AND (LOWER(e.model) LIKE LOWER(CONCAT('%', :manufacturer, '%')) "
            + "OR LOWER(e.name) LIKE LOWER(CONCAT('%', :manufacturer, '%')))")
    List<Equipment> findByHospitalIdAndManufacturer(
            @Param("hospitalId") Long hospitalId,
            @Param("manufacturer") String manufacturer);
}
