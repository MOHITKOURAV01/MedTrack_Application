package com.medtrack.service;

import com.medtrack.auth.repository.UserRepository;
import com.medtrack.auth.service.EmailService;
import com.medtrack.model.EquipmentOrder;
import com.medtrack.model.ShippingStatus;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.supplier.security.SupplierAccessGuard;
import com.medtrack.util.PurchaseOrderPdf;
import com.medtrack.util.SupplierInvoicePdf;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code PUT /api/orders/{id}/status} took the new status as a bare request parameter and wrote it,
 * unvalidated, into both {@code status} and {@code shippingStatus} - two columns documenting two
 * different vocabularies. Every consumer downstream compares those columns by string, so a typo, a
 * different case or a value from the wrong vocabulary put the order permanently outside every
 * delivered count and every spend figure, with no error anywhere.
 *
 * <p>These tests pin the vocabulary, the transitions and the timestamps - particularly the dispatch
 * date the previous implementation invented when an order was delivered without ever having been
 * marked as shipped.</p>
 */
@ExtendWith(MockitoExtension.class)
class OrderStatusTransitionTest {

    @Mock
    private EquipmentOrderRepository orderRepository;
    @Mock
    private EquipmentRepository equipmentRepository;
    @Mock
    private PurchaseOrderPdf purchaseOrderPdf;
    @Mock
    private SupplierInvoicePdf supplierInvoicePdf;
    @Mock
    private EmailService emailService;
    @Mock
    private UserRepository userRepository;

    @Mock
    private com.medtrack.repository.HospitalRepository hospitalRepository;
    @Mock
    private SupplierAccessGuard supplierAccessGuard;

    private OrderService orderService;
    private Authentication supplier;
    private EquipmentOrder order;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, equipmentRepository, purchaseOrderPdf,
                supplierInvoicePdf, emailService, userRepository, hospitalRepository, supplierAccessGuard);
        supplier = new UsernamePasswordAuthenticationToken(
                "supplier@alpha.test", null, List.of(new SimpleGrantedAuthority("ROLE_SUPPLIER")));
        order = EquipmentOrder.builder()
                .id(11L)
                .orderCode("ORD-ALPHA")
                .equipmentId("EQ-VENT")
                .equipmentName("Ventilator")
                .quantity(2)
                .hospital("Central Hospital")
                .status("PENDING")
                .shippingStatus("Processing")
                .orderDate(LocalDateTime.now().minusDays(4))
                .build();
        lenient().when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        lenient().when(orderRepository.findByIdAndSupplierId(11L, 41L)).thenReturn(Optional.of(order));
        lenient().when(orderRepository.save(any(EquipmentOrder.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // Vocabulary
    // ------------------------------------------------------------------

    @Test
    void aMisspeltStatusIsRejectedInsteadOfStored() {
        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class,
                () -> orderService.updateOrderStatus(11L, "Deliverd", null, supplier));

        // One typo used to put the order outside every delivered count for good.
        assertTrue(thrown.getMessage().contains("Processing, Shipped, Delivered, Cancelled"),
                thrown.getMessage());
        verify(orderRepository, never()).save(any());
        assertEquals("Processing", order.getShippingStatus());
    }

    @Test
    void aBlankStatusIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> orderService.updateOrderStatus(11L, "  ", null, supplier));
        assertThrows(IllegalArgumentException.class,
                () -> orderService.updateOrderStatus(11L, null, null, supplier));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void caseAndAliasesAreNormalisedToTheCanonicalLabel() {
        EquipmentOrder updated = orderService.updateOrderStatus(11L, "dispatched", null, supplier);

        // "Dispatched" was accepted by the previous implementation, so it stays accepted - but it
        // is stored as the one label the frontend and every downstream comparison expect.
        assertEquals("Shipped", updated.getShippingStatus());
    }

    @Test
    void theTwoColumnsGetTheirOwnVocabularies() {
        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Shipped", "on the way", supplier);

        // Both used to be assigned the caller's raw string, so `status` - the column
        // countOrdersByStatusAndSupplierId filters on - filled with shipping-status values.
        assertEquals("Shipped", updated.getShippingStatus());
        assertEquals("DISPATCHED", updated.getStatus());
        assertEquals("on the way", updated.getSupplierNotes());
    }

    // ------------------------------------------------------------------
    // Transitions
    // ------------------------------------------------------------------

    @Test
    void aDeliveredOrderCannotGoBackToProcessing() {
        order.setShippingStatus("Delivered");
        order.setStatus("DELIVERED");
        order.setDeliveredAt(LocalDateTime.now().minusDays(1));

        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class,
                () -> orderService.updateOrderStatus(11L, "Processing", null, supplier));

        assertTrue(thrown.getMessage().contains("final"), thrown.getMessage());
        // The old behaviour left deliveredAt populated on an order that was no longer delivered.
        assertNotNull(order.getDeliveredAt());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void aCancelledOrderCannotBeRevived() {
        order.setShippingStatus("Cancelled");
        order.setStatus("CANCELLED");

        assertThrows(IllegalArgumentException.class,
                () -> orderService.updateOrderStatus(11L, "Shipped", null, supplier));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void resendingTheCurrentStatusIsNotAnError() {
        // The supplier dropdown fires on change; a repeat should be a no-op, not a 400.
        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Processing", null, supplier);

        assertEquals("Processing", updated.getShippingStatus());
    }

    @Test
    void anOrderWithAnUnreadableStoredStatusCanStillBeMovedOn() {
        // Rows written before this validation existed may hold anything at all. Refusing to accept
        // a correction would strand them in whatever state the old code let through.
        order.setShippingStatus("banana");

        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Shipped", null, supplier);

        assertEquals("Shipped", updated.getShippingStatus());
    }

    // ------------------------------------------------------------------
    // Timestamps
    // ------------------------------------------------------------------

    @Test
    void dispatchStampsTheDispatchDateAndAssignsTrackingOnce() {
        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Shipped", null, supplier);

        assertNotNull(updated.getDispatchedAt());
        assertNotNull(updated.getTrackingNo());
        assertNotNull(updated.getCarrier());

        LocalDateTime firstDispatch = updated.getDispatchedAt();
        String tracking = updated.getTrackingNo();
        orderService.updateOrderStatus(11L, "Shipped", "still on the way", supplier);

        assertEquals(firstDispatch, updated.getDispatchedAt(), "a repeat must not re-stamp dispatch");
        assertEquals(tracking, updated.getTrackingNo());
    }

    @Test
    void deliveryWithNoRecordedDispatchDoesNotInventOne() {
        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Delivered", null, supplier);

        assertNotNull(updated.getDeliveredAt());
        // The previous implementation wrote LocalDateTime.now().minusDays(2) here, which made every
        // unreported dispatch look like a tidy two-day delivery on the supplier's scorecard.
        assertNull(updated.getDispatchedAt());
    }

    @Test
    void deliveryAfterDispatchKeepsTheRealDispatchDate() {
        LocalDateTime dispatched = LocalDateTime.now().minusDays(3);
        order.setShippingStatus("Shipped");
        order.setStatus("DISPATCHED");
        order.setDispatchedAt(dispatched);

        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Delivered", null, supplier);

        assertEquals(dispatched, updated.getDispatchedAt());
        assertNotNull(updated.getDeliveredAt());
        assertEquals("DELIVERED", updated.getStatus());
    }

    // ------------------------------------------------------------------
    // Metrics
    // ------------------------------------------------------------------

    @Test
    void cancelledOrdersAreNotCountedAsOutstandingWork() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(orderRepository.findBySupplierId(41L)).thenReturn(List.of(
                orderWith("Processing", null),
                orderWith("Shipped", null),
                orderWith("Cancelled", null),
                orderWith("Delivered", LocalDateTime.now().minusDays(1))));

        var metrics = orderService.getSupplierMetrics();

        assertEquals(4, metrics.getTotalOrders());
        // Processing + Shipped. "Anything that is not Delivered" used to count the cancelled one
        // as work the supplier still owed, forever.
        assertEquals(2, metrics.getPendingOrders());
        assertEquals(1, metrics.getShippedOrders());
        assertEquals(1, metrics.getDeliveredOrders());
    }

    @Test
    void aSupplierWithNoDeliveriesDoesNotOpenOnAPerfectScore() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(orderRepository.findBySupplierId(41L)).thenReturn(List.of(orderWith("Processing", null)));

        var metrics = orderService.getSupplierMetrics();

        // Was 100.0: a brand-new supplier's scorecard reported a perfect on-time rate before they
        // had shipped anything.
        assertEquals(0.0, metrics.getOnTimeRate());
        assertEquals(0.0, metrics.getAverageDeliveryDays());
    }

    // ------------------------------------------------------------------
    // The vocabulary itself
    // ------------------------------------------------------------------

    @Test
    void theStatusVocabularyParsesWhatCallersActuallySend() {
        assertEquals(Optional.of(ShippingStatus.PROCESSING), ShippingStatus.parse("pending"));
        assertEquals(Optional.of(ShippingStatus.SHIPPED), ShippingStatus.parse("IN_TRANSIT"));
        assertEquals(Optional.of(ShippingStatus.CANCELLED), ShippingStatus.parse(" canceled "));
        assertEquals(Optional.empty(), ShippingStatus.parse("banana"));
        assertEquals(Optional.empty(), ShippingStatus.parse(""));
        assertEquals(Optional.empty(), ShippingStatus.parse(null));
    }

    private EquipmentOrder orderWith(String shippingStatus, LocalDateTime deliveredAt) {
        return EquipmentOrder.builder()
                .id(99L)
                .orderCode("ORD-" + shippingStatus)
                .equipmentId("EQ-1")
                .equipmentName("Ventilator")
                .quantity(1)
                .hospital("Central Hospital")
                .status("PENDING")
                .shippingStatus(shippingStatus)
                .orderDate(LocalDateTime.now().minusDays(5))
                .deliveredAt(deliveredAt)
                .build();
    }
}
