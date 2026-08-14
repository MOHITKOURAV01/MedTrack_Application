package com.medtrack.service;

import com.medtrack.auth.model.User;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The order archive is the one part of the order module that reads soft-deleted rows, and it has to
 * do it with native SQL because {@link EquipmentOrder} carries a class-level
 * {@code @SQLRestriction("deleted = false")}. Native means Hibernate contributes nothing - including
 * no tenant handling - so these tests pin down that every archive path carries its own owner
 * predicate.
 *
 * <p>Before this was fixed, restore and permanent delete resolved an archived order by id alone and
 * the supplier branch of the listing returned the archive of the entire deployment.</p>
 */
@ExtendWith(MockitoExtension.class)
class OrderArchiveTenantScopeTest {

    private static final String OWNER = "Central Hospital";

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
    private EquipmentOrder archivedOrder;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, equipmentRepository, purchaseOrderPdf,
                supplierInvoicePdf, emailService, userRepository, hospitalRepository, supplierAccessGuard);
        archivedOrder = EquipmentOrder.builder()
                .id(11L)
                .orderCode("ORD-ALPHA")
                .equipmentId("EQ-VENT")
                .equipmentName("Ventilator")
                .quantity(2)
                .hospital(OWNER)
                .createdBy("buyer@central.test")
                .status("PENDING")
                .shippingStatus("Processing")
                .deleted(true)
                .deletedAt(LocalDateTime.now().minusDays(3))
                .deletedBy("buyer@central.test")
                .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // Restore
    // ------------------------------------------------------------------

    @Test
    void owningHospitalCanRestoreItsOwnArchivedOrder() {
        authenticateHospital("buyer@central.test", OWNER);
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, OWNER))
                .thenReturn(Optional.of(archivedOrder));
        when(orderRepository.save(archivedOrder)).thenReturn(archivedOrder);

        EquipmentOrder restored = orderService.restoreOrder(11L, "buyer@central.test");

        assertFalse(restored.getDeleted(), "restoring clears the soft-delete flag");
        assertNull(restored.getDeletedAt());
        assertNull(restored.getDeletedBy());
        verify(orderRepository).findByIdAndHospitalAndDeletedTrue(11L, OWNER);
    }

    @Test
    void anotherHospitalCannotRestoreThisHospitalsArchivedOrder() {
        authenticateHospital("admin@riverside.test", "Riverside Hospital");
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, "Riverside Hospital"))
                .thenReturn(Optional.empty());

        // Reported as not found rather than forbidden: a distinct response would confirm that the
        // id belongs to a real order in some other tenant.
        assertThrows(ResourceNotFoundException.class,
                () -> orderService.restoreOrder(11L, "admin@riverside.test"));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void restoreIsStillRefusedAfterTheNinetyDayWindow() {
        authenticateHospital("buyer@central.test", OWNER);
        archivedOrder.setDeletedAt(LocalDateTime.now().minusDays(91));
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, OWNER))
                .thenReturn(Optional.of(archivedOrder));

        assertThrows(IllegalStateException.class,
                () -> orderService.restoreOrder(11L, "buyer@central.test"));

        verify(orderRepository, never()).save(any());
    }

    @Test
    void supplierCannotRestoreAnArchivedOrder() {
        authenticateSupplier();

        assertThrows(AccessDeniedException.class,
                () -> orderService.restoreOrder(11L, "supplier@alpha.test"));

        verify(orderRepository, never()).findByIdAndHospitalAndDeletedTrue(anyLong(), any());
        verify(orderRepository, never()).save(any());
    }

    // ------------------------------------------------------------------
    // Permanent delete
    // ------------------------------------------------------------------

    @Test
    void owningHospitalCanPurgeItsOwnArchivedOrderAfterNinetyDays() {
        authenticateHospital("buyer@central.test", OWNER);
        archivedOrder.setDeletedAt(LocalDateTime.now().minusDays(120));
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, OWNER))
                .thenReturn(Optional.of(archivedOrder));

        orderService.permanentlyDeleteOrder(11L);

        verify(orderRepository).delete(archivedOrder);
    }

    @Test
    void anotherHospitalCannotPurgeThisHospitalsArchivedOrder() {
        authenticateHospital("admin@riverside.test", "Riverside Hospital");
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, "Riverside Hospital"))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> orderService.permanentlyDeleteOrder(11L));

        verify(orderRepository, never()).delete(any(EquipmentOrder.class));
    }

    @Test
    void purgeIsStillRefusedInsideTheNinetyDayWindow() {
        authenticateHospital("buyer@central.test", OWNER);
        when(orderRepository.findByIdAndHospitalAndDeletedTrue(11L, OWNER))
                .thenReturn(Optional.of(archivedOrder));

        assertThrows(IllegalStateException.class, () -> orderService.permanentlyDeleteOrder(11L));

        verify(orderRepository, never()).delete(any(EquipmentOrder.class));
    }

    @Test
    void supplierCannotPurgeAnArchivedOrder() {
        authenticateSupplier();

        assertThrows(AccessDeniedException.class, () -> orderService.permanentlyDeleteOrder(11L));

        verify(orderRepository, never()).delete(any(EquipmentOrder.class));
    }

    // ------------------------------------------------------------------
    // Listing
    // ------------------------------------------------------------------

    @Test
    void hospitalArchiveListingIsScopedToTheCallersHospital() {
        authenticateHospital("buyer@central.test", OWNER);
        PageRequest pageable = PageRequest.of(0, 20);
        when(orderRepository.findByHospitalAndDeletedTrue(OWNER, pageable))
                .thenReturn(new PageImpl<>(List.of(archivedOrder), pageable, 1));

        assertEquals(List.of(archivedOrder), orderService.getArchivedOrders(pageable).getContent());

        verify(orderRepository).findByHospitalAndDeletedTrue(OWNER, pageable);
    }

    @Test
    void supplierArchiveListingIsScopedToTheirOwnAssignments() {
        Authentication supplier = authenticateSupplier();
        PageRequest pageable = PageRequest.of(0, 20);
        when(supplierAccessGuard.resolveCallerId(supplier)).thenReturn(41L);
        when(orderRepository.findBySupplierIdAndDeletedTrue(41L, pageable))
                .thenReturn(new PageImpl<>(List.of(archivedOrder), pageable, 1));

        assertEquals(List.of(archivedOrder), orderService.getArchivedOrders(pageable).getContent());

        verify(orderRepository).findBySupplierIdAndDeletedTrue(41L, pageable);
        verify(orderRepository, never()).findByHospitalAndDeletedTrue(any(), any(PageRequest.class));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void authenticateHospital(String email, String organization) {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                email, null, List.of(new SimpleGrantedAuthority("ROLE_HOSPITAL")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        User user = new User();
        user.setEmail(email);
        user.setOrganization(organization);
        lenient().when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
    }

    private Authentication authenticateSupplier() {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "supplier@alpha.test", null, List.of(new SimpleGrantedAuthority("ROLE_SUPPLIER")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        return authentication;
    }
}
