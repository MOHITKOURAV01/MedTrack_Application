package com.medtrack.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * An audit record of an asset being placed at (or moved within) a facility location (issue #745).
 *
 * <p>Every assignment creates a row here; the asset's current location lives on
 * {@link Equipment#getLocation()}. Newest-first is the natural read order, so the repository
 * orders by {@code created_at} descending.</p>
 */
@Entity
@Table(name = "equipment_location_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EquipmentLocationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "equipment_id", nullable = false)
    private Equipment equipment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id")
    private Hospital hospital;

    /**
     * The location the asset was moved to.
     *
     * <p>{@code @NotFound(IGNORE)} because this row outlives the node it names. A movement record is
     * an audit entry: it has to keep saying that the asset moved on a given date, by a given person,
     * for a given reason, even after the location itself is decommissioned and deleted. The
     * association was previously {@code optional = false}, so a deleted node left every history row
     * for the assets that once sat there unreadable - Hibernate throws
     * {@code EntityNotFoundException} resolving the proxy, and
     * {@code GET /api/locations/equipment/{id}/history} serialises the entity directly, so that
     * surfaced as a 500 on the asset's history tab.</p>
     *
     * <p>{@code location_id} stays {@code NOT NULL} in the schema - every movement is recorded
     * against a location that existed at the time - and simply reads as {@code null} once that
     * location is gone.</p>
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @NotFound(action = NotFoundAction.IGNORE)
    @JoinColumn(name = "location_id", nullable = false)
    private FacilityLocation location;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(length = 500)
    private String notes;

    @Column(name = "moved_by", length = 255)
    private String movedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}