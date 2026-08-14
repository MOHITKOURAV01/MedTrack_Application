package com.medtrack.supplier.service;

import com.medtrack.model.EquipmentOrder;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.repository.SupplierQuoteRepository;
import com.medtrack.supplier.dto.CreateShipmentRequest;
import com.medtrack.supplier.model.ShipmentStatus;
import com.medtrack.supplier.model.ShipmentTracking;
import com.medtrack.supplier.repository.ShipmentTrackingRepository;
import com.medtrack.supplier.security.SupplierAccessGuard;
import com.medtrack.supplier.validation.ShipmentRequestValidator;
import com.medtrack.supplier.workflow.ShipmentWorkflowOrchestrator;
import com.medtrack.supplier.workflow.WorkflowValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Who is allowed to attach a shipment to an order.
 *
 * <p>Creating a shipment is how an order becomes a supplier's: {@link EquipmentOrder} has no supplier
 * column, so {@code EquipmentOrderRepository.findBySupplierId} and its siblings resolve a supplier's
 * orders purely by the existence of a {@code ShipmentTracking} row pointing at them.
 * {@code createShipment} used to take the order id from the request body and ask nothing else about
 * it, so any authenticated supplier could name any order id in the deployment and be handed that
 * order - its hospital, equipment, quantities and costs - along with the right to drive its status
 * through {@code OrderService.updateOrderStatus}.</p>
 *
 * <p>These tests pin the two rules that now stand between a caller and that claim: an order the
 * hospital awarded to someone else is refused, and an order that has already finished is not open
 * for fulfilment at all.</p>
 */
@ExtendWith(MockitoExtension.class)
class ShipmentOrderOwnershipTest {

    private static final Long AWARDED_SUPPLIER = 10L;
    private static final Long OTHER_SUPPLIER = 77L;
    private static final Long ORDER_ID = 42L;

    @Mock
    private ShipmentTrackingRepository shipmentTrackingRepository;

    @Mock
    private EquipmentOrderRepository orderRepository;

    @Mock
    private SupplierQuoteRepository supplierQuoteRepository;

    @Mock
    private SupplierAccessGuard supplierAccessGuard;

    @Spy
    private ShipmentRequestValidator validator = new ShipmentRequestValidator();

    /**
     * A real orchestrator over a real validator. Only {@code validateStateTransition} is reachable
     * from these tests and it touches none of the repositories, so those stay unset.
     */
    @Spy
    private ShipmentWorkflowOrchestrator orchestrator =
            new ShipmentWorkflowOrchestrator(new WorkflowValidator(), null, null, null);

    @InjectMocks
    private ShipmentTrackingService shipmentTrackingService;

    private final Authentication authentication = mock(Authentication.class);

    // ------------------------------------------------------------------
    // An order the hospital awarded through the procurement flow
    // ------------------------------------------------------------------

    @Test
    void supplierWhoWasNotAwardedTheOrderCannotCreateAShipmentForIt() {
        EquipmentOrder awardedElsewhere = order("Processing");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(awardedElsewhere));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(OTHER_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID))
                .thenReturn(List.of(AWARDED_SUPPLIER));

        AccessDeniedException denied = assertThrows(AccessDeniedException.class,
                () -> shipmentTrackingService.createShipment(request("TRK-INTRUDER"), authentication));

        assertTrue(denied.getMessage().contains("awarded to a different supplier"));

        // Nothing is written: no shipment row means the order never becomes visible to the caller.
        verify(shipmentTrackingRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void theAwardedSupplierCanCreateAShipmentForTheOrder() {
        EquipmentOrder awardedToCaller = order("Processing");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(awardedToCaller));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(AWARDED_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID))
                .thenReturn(List.of(AWARDED_SUPPLIER));
        when(shipmentTrackingRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK-OK")).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        shipmentTrackingService.createShipment(request("TRK-OK"), authentication);

        ArgumentCaptor<ShipmentTracking> saved = ArgumentCaptor.forClass(ShipmentTracking.class);
        verify(shipmentTrackingRepository).save(saved.capture());
        assertEquals(AWARDED_SUPPLIER, saved.getValue().getSupplierId());
        assertEquals(ShipmentStatus.PENDING, saved.getValue().getShipmentStatus());
        verify(orderRepository).save(awardedToCaller);
    }

    /**
     * A request carrying more than one accepted quote is malformed data rather than a legal state,
     * but it must not fail open: a caller who appears anywhere in the awarded set is allowed, and one
     * who does not is still refused.
     */
    @Test
    void anyOfSeveralAwardedSuppliersIsAccepted() {
        EquipmentOrder ambiguouslyAwarded = order("Processing");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(ambiguouslyAwarded));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(OTHER_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID))
                .thenReturn(List.of(AWARDED_SUPPLIER, OTHER_SUPPLIER));
        when(shipmentTrackingRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK-BOTH")).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        shipmentTrackingService.createShipment(request("TRK-BOTH"), authentication);

        verify(shipmentTrackingRepository).save(any(ShipmentTracking.class));
    }

    // ------------------------------------------------------------------
    // An order raised directly, with no procurement chain behind it
    // ------------------------------------------------------------------

    /**
     * {@code OrderService.placeOrder} never names a supplier, so a directly-raised order carries no
     * award and stays claimable by whoever ships it first. The duplicate-shipment check still limits
     * that to a single claim.
     */
    @Test
    void anOrderWithNoAwardBehindItStaysClaimable() {
        EquipmentOrder direct = order("Processing");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(direct));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(OTHER_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID)).thenReturn(List.of());
        when(shipmentTrackingRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK-DIRECT")).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        shipmentTrackingService.createShipment(request("TRK-DIRECT"), authentication);

        ArgumentCaptor<ShipmentTracking> saved = ArgumentCaptor.forClass(ShipmentTracking.class);
        verify(shipmentTrackingRepository).save(saved.capture());
        assertEquals(OTHER_SUPPLIER, saved.getValue().getSupplierId());
    }

    // ------------------------------------------------------------------
    // An order that has already finished
    // ------------------------------------------------------------------

    /**
     * A delivered order is done. Creating a shipment against one used to succeed and then reset its
     * {@code shippingStatus} to {@code Processing} while {@code deliveredAt} stayed populated - the
     * order was simultaneously delivered and not delivered, which is precisely what
     * {@code ShippingStatus.canTransitionTo} refuses on the {@code OrderService} write path.
     */
    @Test
    void aDeliveredOrderCannotHaveANewShipmentCreatedAgainstIt() {
        EquipmentOrder delivered = order("Delivered");
        delivered.setDeliveredAt(LocalDateTime.now().minusDays(2));

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(delivered));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(AWARDED_SUPPLIER);

        IllegalArgumentException rejected = assertThrows(IllegalArgumentException.class,
                () -> shipmentTrackingService.createShipment(request("TRK-LATE"), authentication));

        assertTrue(rejected.getMessage().contains("Delivered"));
        assertEquals("Delivered", delivered.getShippingStatus());
        verify(shipmentTrackingRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void aCancelledOrderCannotHaveANewShipmentCreatedAgainstIt() {
        EquipmentOrder cancelled = order("Cancelled");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(cancelled));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(AWARDED_SUPPLIER);

        IllegalArgumentException rejected = assertThrows(IllegalArgumentException.class,
                () -> shipmentTrackingService.createShipment(request("TRK-DEAD"), authentication));

        assertTrue(rejected.getMessage().contains("Cancelled"));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    /**
     * Rows written before the shipping vocabulary was validated may hold anything at all.
     * {@code ShippingStatus.current} reports those as absent rather than guessing, and an unreadable
     * status must not be mistaken for a terminal one - that would strand the order permanently.
     */
    @Test
    void anUnreadableStoredStatusIsNotTreatedAsTerminal() {
        EquipmentOrder legacy = order("banana");

        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(legacy));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(AWARDED_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID)).thenReturn(List.of());
        when(shipmentTrackingRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK-LEGACY")).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        shipmentTrackingService.createShipment(request("TRK-LEGACY"), authentication);

        verify(shipmentTrackingRepository).save(any(ShipmentTracking.class));
    }

    // ------------------------------------------------------------------
    // Ordering of the checks
    // ------------------------------------------------------------------

    /**
     * The ownership check runs before the duplicate-tracking-number lookup, so a refused caller
     * learns nothing about which tracking numbers are already in use on someone else's order.
     */
    @Test
    void ownershipIsCheckedBeforeAnyOtherLookup() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("Processing")));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(OTHER_SUPPLIER);
        when(supplierQuoteRepository.findAwardedSupplierIdsByOrderId(ORDER_ID))
                .thenReturn(List.of(AWARDED_SUPPLIER));

        assertThrows(AccessDeniedException.class,
                () -> shipmentTrackingService.createShipment(request("TRK-PROBE"), authentication));

        verify(shipmentTrackingRepository, never()).findByOrderId(any());
        verify(shipmentTrackingRepository, never()).findByShipmentTrackingNumber(any());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static EquipmentOrder order(String shippingStatus) {
        EquipmentOrder order = EquipmentOrder.builder()
                .id(ORDER_ID)
                .orderCode("ORD-42")
                .status("PENDING")
                .build();
        order.setShippingStatus(shippingStatus);
        return order;
    }

    private static CreateShipmentRequest request(String trackingNumber) {
        return CreateShipmentRequest.builder()
                .orderId(ORDER_ID)
                .shipmentTrackingNumber(trackingNumber)
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .build();
    }
}
