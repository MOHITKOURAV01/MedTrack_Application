package com.medtrack.repository;

import com.medtrack.model.SupplierQuote;
import com.medtrack.model.SupplierQuoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierQuoteRepository extends JpaRepository<SupplierQuote, Long> {

    List<SupplierQuote> findByRequestIdOrderBySubmittedAtAsc(Long requestId);

    List<SupplierQuote> findByHospitalIdOrderBySubmittedAtDesc(Long hospitalId);

    List<SupplierQuote> findBySupplierIdOrderBySubmittedAtDesc(Long supplierId);

    Optional<SupplierQuote> findByIdAndHospitalId(Long id, Long hospitalId);

    Optional<SupplierQuote> findByIdAndSupplierId(Long id, Long supplierId);

    List<SupplierQuote> findByRequestIdAndStatusOrderByQuoteAmountAsc(
            Long requestId, SupplierQuoteStatus status);

    /**
     * The suppliers a hospital awarded the given order to, through the procurement flow.
     *
     * <p>{@link com.medtrack.model.EquipmentOrder} carries no supplier column, so the only record of
     * who won an order is the accepted quote behind it:
     * {@code ProcurementService.acceptQuote} marks one {@link SupplierQuote} {@code ACCEPTED} and
     * stamps the new order's id onto the {@link com.medtrack.model.ProcurementRequest}. This walks
     * that chain backwards - order id, request, accepted quote, supplier - so a caller can be checked
     * against the supplier the hospital actually chose.</p>
     *
     * <p>Returns a list rather than an {@code Optional} because nothing in the schema stops a request
     * from carrying two accepted quotes; the caller decides what to do with an ambiguous award rather
     * than having the repository silently pick one.</p>
     *
     * @param orderId the order to resolve the award for
     * @return the supplier ids awarded this order, empty when it did not come from procurement
     */
    @Query("SELECT quote.supplierId FROM SupplierQuote quote "
            + "WHERE quote.status = com.medtrack.model.SupplierQuoteStatus.ACCEPTED "
            + "AND quote.requestId IN ("
            + "SELECT request.id FROM ProcurementRequest request WHERE request.orderId = :orderId)")
    List<Long> findAwardedSupplierIdsByOrderId(@Param("orderId") Long orderId);
}
