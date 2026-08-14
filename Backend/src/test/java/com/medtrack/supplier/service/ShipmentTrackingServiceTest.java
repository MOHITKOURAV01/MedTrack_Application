package com.medtrack.supplier.service;

import com.medtrack.exception.DuplicateTrackingNumberException;
import com.medtrack.exception.InvalidStatusTransitionException;
import com.medtrack.exception.ResourceNotFoundException;
import com.medtrack.model.EquipmentOrder;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.supplier.dto.CreateShipmentRequest;
import com.medtrack.supplier.dto.ShipmentTrackingResponse;
import com.medtrack.supplier.dto.UpdateShipmentStatusRequest;
import com.medtrack.supplier.model.ShipmentStatus;
import com.medtrack.supplier.model.ShipmentTracking;
import com.medtrack.supplier.repository.ShipmentTrackingRepository;
import com.medtrack.supplier.security.SupplierAccessGuard;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ShipmentTrackingServiceTest {

    @Mock
    private ShipmentTrackingRepository shipmentTrackingRepository;

    @Mock
    private EquipmentOrderRepository orderRepository;

    /**
     * Left unstubbed in most tests: Mockito returns an empty list, which is what an order that never
     * went through the procurement flow looks like, and those orders stay claimable by any supplier.
     * {@link ShipmentOrderOwnershipTest} covers the awarded case.
     */
    @Mock
    private com.medtrack.repository.SupplierQuoteRepository supplierQuoteRepository;

    @Mock
    private SupplierAccessGuard supplierAccessGuard;

    @org.mockito.Spy
    private com.medtrack.supplier.validation.ShipmentRequestValidator validator = new com.medtrack.supplier.validation.ShipmentRequestValidator();

    /**
     * A real orchestrator over a real validator, so the transition rules under test are the ones
     * that run in production. Only validateStateTransition is exercised here and it touches none of
     * the repositories, so those are left unset.
     */
    @org.mockito.Spy
    private com.medtrack.supplier.workflow.ShipmentWorkflowOrchestrator orchestrator =
            new com.medtrack.supplier.workflow.ShipmentWorkflowOrchestrator(
                    new com.medtrack.supplier.workflow.WorkflowValidator(), null, null, null);

    @InjectMocks
    private ShipmentTrackingService shipmentTrackingService;

    private final Authentication authentication = mock(Authentication.class);

    @Test
    void createShipment_Success() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .supplierId(10L)
                .build();

        EquipmentOrder order = EquipmentOrder.builder()
                .id(1L)
                .status("PENDING")
                .build();

        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .shipmentStatus(ShipmentStatus.PENDING)
                .supplierId(10L)
                .createdAt(LocalDateTime.now())
                .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(shipmentTrackingRepository.findByOrderId(1L)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK123456")).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class))).thenReturn(shipment);

        ShipmentTrackingResponse response = shipmentTrackingService.createShipment(request, authentication);

        assertNotNull(response);
        assertEquals(5L, response.getId());
        assertEquals("TRK123456", response.getShipmentTrackingNumber());
        assertEquals("PENDING", response.getShipmentStatus());
        assertEquals("CONFIRMED", order.getStatus());
        assertEquals("TRK123456", order.getTrackingNo());
        assertEquals("FedEx", order.getCarrier());

        verify(orderRepository).save(order);
        verify(shipmentTrackingRepository).save(any(ShipmentTracking.class));
    }

    @Test
    void createShipment_OrderNotFound_ThrowsException() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> shipmentTrackingService.createShipment(request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void createShipment_DuplicateShipmentForOrder_ThrowsException() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .build();

        EquipmentOrder order = EquipmentOrder.builder().id(1L).build();
        ShipmentTracking existingShipment = ShipmentTracking.builder().id(5L).orderId(1L).build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(shipmentTrackingRepository.findByOrderId(1L)).thenReturn(Optional.of(existingShipment));

        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void createShipment_DuplicateTrackingNumber_ThrowsException() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .build();

        EquipmentOrder order = EquipmentOrder.builder().id(1L).build();
        ShipmentTracking existingShipment = ShipmentTracking.builder().id(6L).shipmentTrackingNumber("TRK123456").build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(shipmentTrackingRepository.findByOrderId(1L)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK123456")).thenReturn(Optional.of(existingShipment));

        assertThrows(DuplicateTrackingNumberException.class, () -> shipmentTrackingService.createShipment(request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void createShipment_PastDeliveryDate_ThrowsException() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123456")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().minusDays(1)) // Past date
                .build();

        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void createShipment_NullRequest_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(null, authentication));
    }

    @Test
    void createShipment_NullOrInvalidOrderId_ThrowsException() {
        CreateShipmentRequest requestNullOrder = CreateShipmentRequest.builder()
                .orderId(null)
                .shipmentTrackingNumber("TRK123")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(1))
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(requestNullOrder, authentication));

        CreateShipmentRequest requestZeroOrder = CreateShipmentRequest.builder()
                .orderId(0L)
                .shipmentTrackingNumber("TRK123")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(1))
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(requestZeroOrder, authentication));
    }

    @Test
    void createShipment_BlankTrackingNumberOrCarrier_ThrowsException() {
        CreateShipmentRequest requestBlankTracking = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("   ")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(1))
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(requestBlankTracking, authentication));

        CreateShipmentRequest requestBlankCarrier = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123")
                .carrier("   ")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(1))
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(requestBlankCarrier, authentication));
    }

    @Test
    void createShipment_NullEstimatedDeliveryDate_ThrowsException() {
        CreateShipmentRequest requestNullDate = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK123")
                .carrier("FedEx")
                .estimatedDeliveryDate(null)
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.createShipment(requestNullDate, authentication));
    }

    @Test
    void updateShipmentStatus_ToShipped_Success() {
        UpdateShipmentStatusRequest request = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("SHIPPED")
                .supplierNotes("Handed to carrier")
                .build();

        // The shipment, not just the order, has to be CONFIRMED before it can ship:
        // WorkflowValidator only allows PENDING -> CONFIRMED -> SHIPPED -> DELIVERED.
        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .orderId(1L)
                .shipmentStatus(ShipmentStatus.CONFIRMED)
                .build();

        EquipmentOrder order = EquipmentOrder.builder()
                .id(1L)
                .status("CONFIRMED")
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class))).thenReturn(shipment);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ShipmentTrackingResponse response = shipmentTrackingService.updateShipmentStatus(5L, request, authentication);

        assertNotNull(response);
        assertEquals("SHIPPED", response.getShipmentStatus());
        assertEquals("IN_TRANSIT", order.getStatus());
        assertEquals("Shipped", order.getShippingStatus());
        assertEquals("Handed to carrier", order.getSupplierNotes());
        assertNotNull(order.getDispatchedAt());

        verify(shipmentTrackingRepository).save(shipment);
        verify(orderRepository).save(order);
    }

    @Test
    void updateShipmentStatus_ToDelivered_Success() {
        UpdateShipmentStatusRequest request = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("DELIVERED")
                .build();

        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .orderId(1L)
                .shipmentStatus(ShipmentStatus.SHIPPED)
                .build();

        EquipmentOrder order = EquipmentOrder.builder()
                .id(1L)
                .status("IN_TRANSIT")
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class))).thenReturn(shipment);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ShipmentTrackingResponse response = shipmentTrackingService.updateShipmentStatus(5L, request, authentication);

        assertNotNull(response);
        assertEquals("DELIVERED", response.getShipmentStatus());
        assertEquals("DELIVERED", order.getStatus());
        assertEquals("Delivered", order.getShippingStatus());
        assertNotNull(order.getDeliveredAt());
        assertNotNull(shipment.getActualDeliveryDate());

        verify(shipmentTrackingRepository).save(shipment);
        verify(orderRepository).save(order);
    }

    @Test
    void updateShipmentStatus_NullRequestOrBlankStatus_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.updateShipmentStatus(1L, null, authentication));

        UpdateShipmentStatusRequest requestBlankStatus = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("  ")
                .build();
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.updateShipmentStatus(1L, requestBlankStatus, authentication));
    }

    @Test
    void updateShipmentStatus_InvalidTransition_ThrowsException() {
        UpdateShipmentStatusRequest request = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("PENDING") // Cannot transition back from SHIPPED to PENDING
                .build();

        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .shipmentStatus(ShipmentStatus.SHIPPED)
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));

        assertThrows(InvalidStatusTransitionException.class, () -> shipmentTrackingService.updateShipmentStatus(5L, request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void updateShipmentStatus_SameStatus_ThrowsException() {
        UpdateShipmentStatusRequest request = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("SHIPPED") // Same state
                .build();

        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .shipmentStatus(ShipmentStatus.SHIPPED)
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));

        assertThrows(InvalidStatusTransitionException.class, () -> shipmentTrackingService.updateShipmentStatus(5L, request, authentication));
        verify(shipmentTrackingRepository, never()).save(any());
    }

    @Test
    void getShipmentById_Success() {
        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .orderId(1L)
                .shipmentTrackingNumber("TRK123")
                .shipmentStatus(ShipmentStatus.PENDING)
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));

        ShipmentTrackingResponse response = shipmentTrackingService.getShipmentById(5L, authentication);

        assertNotNull(response);
        assertEquals(5L, response.getId());
        assertEquals("TRK123", response.getShipmentTrackingNumber());
    }

    @Test
    void getShipmentById_DeniedForOtherSupplier() {
        ShipmentTracking shipment = ShipmentTracking.builder()
                .id(5L)
                .orderId(1L)
                .supplierId(20L)
                .shipmentStatus(ShipmentStatus.PENDING)
                .build();

        when(shipmentTrackingRepository.findById(5L)).thenReturn(Optional.of(shipment));
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(999L);
        doThrow(new org.springframework.security.access.AccessDeniedException("Not authorized"))
                .when(supplierAccessGuard).assertSelfOrHospitalAdmin(authentication, 999L, 20L);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> shipmentTrackingService.getShipmentById(5L, authentication));
    }

    @Test
    void validateEntityIdsAndTrackingNumbers_InvalidInputs_ThrowException() {
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.getShipmentById(null, authentication));
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.getShipmentById(-1L, authentication));
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.getShipmentByOrderId(0L, authentication));
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.getShipmentByTrackingNumber("  ", authentication));
        assertThrows(IllegalArgumentException.class, () -> shipmentTrackingService.getShipmentsBySupplier(-5L, null, authentication));
    }

    @Test
    void createShipment_StampsResolvedCallerIdNotClientSuppliedSupplierId() {
        CreateShipmentRequest request = CreateShipmentRequest.builder()
                .orderId(1L)
                .shipmentTrackingNumber("TRK999")
                .carrier("FedEx")
                .estimatedDeliveryDate(LocalDateTime.now().plusDays(3))
                .supplierId(999L) // client-supplied value must be ignored
                .build();

        EquipmentOrder order = EquipmentOrder.builder().id(1L).status("PENDING").build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(shipmentTrackingRepository.findByOrderId(1L)).thenReturn(Optional.empty());
        when(shipmentTrackingRepository.findByShipmentTrackingNumber("TRK999")).thenReturn(Optional.empty());
        when(supplierAccessGuard.resolveCallerId(authentication)).thenReturn(10L);
        when(shipmentTrackingRepository.save(any(ShipmentTracking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        shipmentTrackingService.createShipment(request, authentication);

        org.mockito.ArgumentCaptor<ShipmentTracking> captor = org.mockito.ArgumentCaptor.forClass(ShipmentTracking.class);
        verify(shipmentTrackingRepository).save(captor.capture());
        assertEquals(10L, captor.getValue().getSupplierId());
    }
}
