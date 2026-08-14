package com.medtrack.repository;

import com.medtrack.model.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, Long> {

    /**
     * Find a hospital profile by the associated user's ID.
     * @param userId the ID of the authenticated user
     * @return an Optional containing the Hospital if found
     */
    Optional<Hospital> findByUserId(Long userId);

    /**
     * Finds hospital profiles by their display name, case-insensitively and ignoring surrounding
     * whitespace.
     *
     * <p>{@link com.medtrack.model.EquipmentOrder#getHospital()} is a free-text label rather than a
     * foreign key, and the two writers disagree about what goes in it:
     * {@code OrderService.placeOrder} stores {@code User.organization} while
     * {@code ProcurementService.acceptQuote} stores this profile name. Resolving an order back to the
     * account that raised it therefore has to try both, which is what
     * {@link com.medtrack.auth.repository.UserRepository#findHospitalUsersByOrganization} and this
     * method are for. {@code EquipmentOrderRepository.HOSPITAL_IDENTITY_MATCH} performs the same
     * either-or match in the opposite direction.</p>
     *
     * <p>A list rather than an {@code Optional}: nothing constrains the name to be unique, so an
     * ambiguous match is the caller's decision to make.</p>
     *
     * @param name the profile name to match
     * @return the matching hospital profiles, in id order
     */
    @Query("SELECT hospital FROM Hospital hospital "
            + "WHERE LOWER(TRIM(hospital.name)) = LOWER(TRIM(:name)) "
            + "ORDER BY hospital.id ASC")
    List<Hospital> findByNameIgnoreCaseAndTrimmed(@Param("name") String name);
}
