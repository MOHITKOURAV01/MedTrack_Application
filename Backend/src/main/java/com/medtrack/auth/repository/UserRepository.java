package com.medtrack.auth.repository;

import com.medtrack.auth.model.User;
import com.medtrack.auth.model.AccountStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * UserRepository provides data access operations for the {@link User} entity.
 * It extends {@link JpaRepository} to inherit default CRUD operations and pagination support,
 * and declares custom query methods to look up users by their unique email addresses.
 *
 * <p>Annotations used:
 * <ul>
 *   <li>{@code @Repository}: Marks this interface as a Spring-managed repository bean that executes database operations.</li>
 * </ul>
 * </p>
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Retrieves a user from the database matching the specified email address.
     * This query is commonly used during user authentication/login workflows to load the user profile.
     *
     * @param email the email address of the user to search for
     * @return an {@link Optional} containing the matched {@link User} entity if found, or {@link Optional#empty()} if no match exists
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks if a user already exists in the database with the given username.
     *
     * @param username the username to check for existence
     * @return {@code true} if a user record exists with the specified username, {@code false} otherwise
     */
    Optional<User> findByUsername(String username);

    /**
     * Retrieves all active users holding the given role.
     *
     * @param role the role name (hospital, technician, or supplier)
     * @param accountStatus the account status that must be present
     * @return the matching active user records
     */
    List<User> findByRoleAndAccountStatus(String role, AccountStatus accountStatus);

    /**
     * Checks if a user already exists in the database with the given email address.
     * This query is typically used during user registration to ensure email addresses remain globally unique.
     *
     * @param email the email address to check for existence
     * @return {@code true} if a user record exists with the specified email, {@code false} otherwise
     */
    boolean existsByEmail(String email);

    /**
     * Checks if a user already exists in the database with the given username.
     *
     * @param username the username to check for existence
     * @return {@code true} if a user record exists with the specified username, {@code false} otherwise
     */
    boolean existsByUsername(String username);

    /**
     * Retrieves the hospital accounts belonging to the given organisation.
     *
     * <p>Compared case-insensitively and with surrounding whitespace trimmed, because
     * {@code organization} is free text typed at registration and
     * {@link com.medtrack.model.EquipmentOrder#getHospital()} holds a copy of it rather than a
     * foreign key. Restricted to the hospital role so a supplier account that happens to name the
     * same organisation is never mistaken for the buyer.</p>
     *
     * <p>Returns a list because nothing in the schema makes {@code organization} unique - a hospital
     * may legitimately have several staff accounts - so the caller decides what an ambiguous match
     * means rather than the repository picking one.</p>
     *
     * @param organization the organisation label to match
     * @return the hospital users in that organisation, in id order
     */
    @Query("SELECT user FROM User user "
            + "WHERE LOWER(user.role) = 'hospital' "
            + "AND LOWER(TRIM(user.organization)) = LOWER(TRIM(:organization)) "
            + "ORDER BY user.id ASC")
    List<User> findHospitalUsersByOrganization(@Param("organization") String organization);
}
