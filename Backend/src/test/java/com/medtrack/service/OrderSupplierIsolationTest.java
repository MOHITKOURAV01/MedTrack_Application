package com.medtrack.service;

import com.medtrack.auth.repository.UserRepository;
import com.medtrack.auth.service.EmailService;
import com.medtrack.exception.ResourceNotFoundException;
import com.medtrack.model.EquipmentOrder;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderSupplierIsolationTest {

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
    private EquipmentOrder assignedOrder;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, equipmentRepository, purchaseOrderPdf,
                supplierInvoicePdf, emailService, userRepository, hospitalRepository, supplierAccessGuard);
        supplier = authentication("supplier@alpha.test", "SUPPLIER");
        assignedOrder = EquipmentOrder.builder()
                .id(11L)
                .orderCode("ORD-ALPHA")
                .equipmentId("EQ-VENT")
                .equipmentName("Ventilator")
                .quantity(2)
                .hospital("Central Hospital")
                .createdBy("buyer@central.test")
                .status("PENDING")
                .shippingStatus("Processing")
                .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void supplierListingUsesOnlyTheResolvedSupplierAssignment() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        PageRequest pageable = PageRequest.of(0, 20);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findBySupplierId(41L, pageable))
                .thenReturn(new PageImpl<>(List.of(assignedOrder), pageable, 1));

        assertEquals(List.of(assignedOrder), orderService.getAllOrders(null, pageable).getContent());

        verify(orderRepository).findBySupplierId(41L, pageable);
        verify(orderRepository, never()).findAll(any(PageRequest.class));
        verify(orderRepository, never()).findByHospital(any(), any(PageRequest.class));
    }

    @Test
    void supplierScorecardUsesOnlyTheResolvedSupplierHistory() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findBySupplierId(41L)).thenReturn(List.of(assignedOrder));

        assertEquals(1, orderService.getSupplierMetrics().getTotalOrders());

        verify(orderRepository).findBySupplierId(41L);
        verify(orderRepository, never()).findAll();
    }

    @Test
    void supplierCanReadAnAssignedOrder() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(11L, 41L)).thenReturn(Optional.of(assignedOrder));

        assertEquals(assignedOrder, orderService.getOrderById(11L));
    }

    @Test
    void foreignOrUnassignedOrderIsHiddenFromSupplier() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(99L, 41L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> orderService.getOrderById(99L));

        verify(orderRepository, never()).findById(99L);
    }

    @Test
    void foreignInvoiceCannotBeGenerated() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(99L, 41L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> orderService.generateInvoicePdf(99L));

        verifyNoInteractions(supplierInvoicePdf);
    }

    @Test
    void foreignInvoiceEmailCannotBeTriggered() {
        SecurityContextHolder.getContext().setAuthentication(supplier);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(99L, 41L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> orderService.emailInvoice(99L));

        verifyNoInteractions(supplierInvoicePdf, emailService);
    }

    @Test
    void assignedSupplierCanUpdateOrderStatus() {
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(11L, 41L)).thenReturn(Optional.of(assignedOrder));
        when(orderRepository.save(assignedOrder)).thenReturn(assignedOrder);

        EquipmentOrder updated = orderService.updateOrderStatus(11L, "Shipped", "On the way", supplier);

        assertEquals("Shipped", updated.getShippingStatus());
        assertEquals("DISPATCHED", updated.getStatus());
        assertEquals("On the way", updated.getSupplierNotes());
        verify(orderRepository).save(assignedOrder);
    }

    @Test
    void supplierCannotUpdateForeignOrUnassignedOrder() {
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findByIdAndSupplierId(99L, 41L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> orderService.updateOrderStatus(99L, "Delivered", null, supplier));

        verify(orderRepository, never()).save(any());
    }

    private Authentication authentication(String email, String role) {
        return new UsernamePasswordAuthenticationToken(
                email, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
}
