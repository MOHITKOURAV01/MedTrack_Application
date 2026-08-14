package com.medtrack.service;

import com.medtrack.auth.model.User;
import com.medtrack.auth.repository.UserRepository;
import com.medtrack.auth.service.EmailService;
import com.medtrack.model.EquipmentOrder;
import com.medtrack.model.Hospital;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.repository.HospitalRepository;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Where {@code POST /api/orders/{id}/invoice/email} actually sends the invoice.
 *
 * <p>The recipient used to be {@code order.createdBy}, which is not an address column:
 * {@code OrderService.placeOrder} writes the user's display name there. Every invoice for an order
 * raised from the hospital order screen was therefore addressed to something like
 * {@code Dr Anita Rao}, {@code MimeMessageHelper.setTo} rejected it, {@code EmailServiceImpl} logged
 * the rejection and swallowed it, and the endpoint still answered {@code 200 OK}. The fallback,
 * {@code admin@hospital.com}, was worse than the failure - a placeholder belonging to no tenant, so
 * the one case that did deliver delivered a hospital's costed invoice to a stranger.</p>
 *
 * <p>These tests fix the resolution order against the two labels an order really carries and pin
 * down that an unresolvable order fails loudly rather than reporting a send that never happened.</p>
 */
@ExtendWith(MockitoExtension.class)
class InvoiceEmailRecipientTest {

    private static final Long ORDER_ID = 7L;
    private static final byte[] PDF = new byte[] {1, 2, 3};

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
    private HospitalRepository hospitalRepository;
    @Mock
    private SupplierAccessGuard supplierAccessGuard;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, equipmentRepository, purchaseOrderPdf,
                supplierInvoicePdf, emailService, userRepository, hospitalRepository, supplierAccessGuard);

        // The endpoint is supplier-only, so every call resolves the order through the supplier path.
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "supplier@alpha.test", null, List.of(new SimpleGrantedAuthority("ROLE_SUPPLIER"))));
        lenient().when(supplierAccessGuard.resolveCallerId(any())).thenReturn(99L);
        lenient().when(supplierInvoicePdf.generate(any(EquipmentOrder.class))).thenReturn(PDF);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // The bug: createdBy holds a display name
    // ------------------------------------------------------------------

    /**
     * The regression this change exists for. {@code placeOrder} stored the display name, so the old
     * implementation handed {@code "Dr Anita Rao"} to the mail layer as an address.
     */
    @Test
    void anOrderWhoseCreatedByIsADisplayNameIsResolvedThroughTheOrganisation() {
        givenOrder("Dr Anita Rao", "Central Hospital");
        when(userRepository.findHospitalUsersByOrganization("Central Hospital"))
                .thenReturn(List.of(hospitalUser("anita@central.test")));

        orderService.emailInvoice(ORDER_ID);

        verify(emailService).sendInvoiceEmail("anita@central.test", "ORD-7", PDF);
    }

    @Test
    void aDisplayNameIsNeverPassedToTheMailLayerAsAnAddress() {
        givenOrder("Dr Anita Rao", "Central Hospital");
        when(userRepository.findHospitalUsersByOrganization("Central Hospital"))
                .thenReturn(List.of(hospitalUser("anita@central.test")));

        orderService.emailInvoice(ORDER_ID);

        verify(emailService, never()).sendInvoiceEmail(eqIgnoringCase("Dr Anita Rao"), anyString(), any());
    }

    // ------------------------------------------------------------------
    // Resolution order
    // ------------------------------------------------------------------

    /**
     * {@code ProcurementService.acceptQuote} already writes the buyer's email into {@code createdBy},
     * so those orders resolve exactly and never fall through to a label match.
     */
    @Test
    void anEmailInCreatedByIsUsedDirectlyWhenItResolvesToAUser() {
        givenOrder("buyer@central.test", "Central Hospital");
        when(userRepository.findByEmail("buyer@central.test"))
                .thenReturn(Optional.of(hospitalUser("buyer@central.test")));

        orderService.emailInvoice(ORDER_ID);

        verify(emailService).sendInvoiceEmail("buyer@central.test", "ORD-7", PDF);
        verify(userRepository, never()).findHospitalUsersByOrganization(anyString());
    }

    @Test
    void anEmailInCreatedByThatMatchesNoUserFallsThroughToTheHospitalLabel() {
        givenOrder("departed@central.test", "Central Hospital");
        when(userRepository.findByEmail("departed@central.test")).thenReturn(Optional.empty());
        when(userRepository.findHospitalUsersByOrganization("Central Hospital"))
                .thenReturn(List.of(hospitalUser("anita@central.test")));

        orderService.emailInvoice(ORDER_ID);

        verify(emailService).sendInvoiceEmail("anita@central.test", "ORD-7", PDF);
    }

    /**
     * {@code acceptQuote} writes the {@code Hospital} profile name into {@code hospital} while
     * {@code placeOrder} writes {@code User.organization}. Nothing ties the two strings together, so
     * both readings have to be tried - the same disagreement
     * {@code EquipmentOrderRepository.HOSPITAL_IDENTITY_MATCH} works around in the other direction.
     */
    @Test
    void aHospitalLabelThatIsAProfileNameRatherThanAnOrganisationStillResolves() {
        givenOrder("Dr Anita Rao", "Central Hospital NHS Trust");
        when(userRepository.findHospitalUsersByOrganization("Central Hospital NHS Trust"))
                .thenReturn(List.of());
        when(hospitalRepository.findByNameIgnoreCaseAndTrimmed("Central Hospital NHS Trust"))
                .thenReturn(List.of(hospitalProfile(hospitalUser("anita@central.test"))));

        orderService.emailInvoice(ORDER_ID);

        verify(emailService).sendInvoiceEmail("anita@central.test", "ORD-7", PDF);
    }

    // ------------------------------------------------------------------
    // Failing loudly instead of reporting a send that did not happen
    // ------------------------------------------------------------------

    @Test
    void anOrderThatResolvesToNoAccountFailsInsteadOfEmailingAPlaceholder() {
        givenOrder("Dr Anita Rao", "Ghost Clinic");
        when(userRepository.findHospitalUsersByOrganization("Ghost Clinic")).thenReturn(List.of());
        when(hospitalRepository.findByNameIgnoreCaseAndTrimmed("Ghost Clinic")).thenReturn(List.of());

        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> orderService.emailInvoice(ORDER_ID));

        assertTrue(failure.getMessage().contains("ORD-7"));
        assertTrue(failure.getMessage().contains("was not sent"));
        verify(emailService, never()).sendInvoiceEmail(anyString(), anyString(), any());
    }

    /** The old code sent to {@code admin@hospital.com}, a domain owned by nobody in the deployment. */
    @Test
    void anOrderWithNoCreatedByAtAllNoLongerFallsBackToAPlaceholderAddress() {
        givenOrder(null, null);

        assertThrows(IllegalStateException.class, () -> orderService.emailInvoice(ORDER_ID));

        verify(emailService, never()).sendInvoiceEmail(anyString(), anyString(), any());
    }

    /**
     * An organisation naming several accounts is ambiguous. Picking one would mean sending a costed
     * invoice to whichever colleague sorted first, which is the failure this resolution exists to
     * prevent, so it is reported as unresolvable instead.
     */
    @Test
    void anAmbiguousOrganisationIsNotResolvedToAGuess() {
        givenOrder("Dr Anita Rao", "Central Hospital");
        when(userRepository.findHospitalUsersByOrganization("Central Hospital"))
                .thenReturn(List.of(hospitalUser("anita@central.test"), hospitalUser("raj@central.test")));

        assertThrows(IllegalStateException.class, () -> orderService.emailInvoice(ORDER_ID));

        verify(emailService, never()).sendInvoiceEmail(anyString(), anyString(), any());
    }

    /** A profile with no linked user account cannot yield an address, and must not NPE. */
    @Test
    void aHospitalProfileWithNoLinkedUserIsReportedAsUnresolvable() {
        givenOrder("Dr Anita Rao", "Orphaned Hospital");
        when(userRepository.findHospitalUsersByOrganization("Orphaned Hospital")).thenReturn(List.of());
        when(hospitalRepository.findByNameIgnoreCaseAndTrimmed("Orphaned Hospital"))
                .thenReturn(List.of(hospitalProfile(null)));

        assertThrows(IllegalStateException.class, () -> orderService.emailInvoice(ORDER_ID));

        verify(emailService, never()).sendInvoiceEmail(anyString(), anyString(), any());
    }

    /**
     * The PDF is generated after the address is known. Rendering an invoice nobody can receive is
     * wasted work, and it kept the failure looking like a mail problem rather than a data one.
     */
    @Test
    void theInvoiceIsNotRenderedWhenThereIsNowhereToSendIt() {
        givenOrder(null, "Ghost Clinic");
        when(userRepository.findHospitalUsersByOrganization("Ghost Clinic")).thenReturn(List.of());
        when(hospitalRepository.findByNameIgnoreCaseAndTrimmed("Ghost Clinic")).thenReturn(List.of());

        assertThrows(IllegalStateException.class, () -> orderService.emailInvoice(ORDER_ID));

        verify(supplierInvoicePdf, never()).generate(any(EquipmentOrder.class));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void givenOrder(String createdBy, String hospital) {
        EquipmentOrder order = EquipmentOrder.builder()
                .id(ORDER_ID)
                .orderCode("ORD-7")
                .equipmentId("EQ-1")
                .equipmentName("Ventilator")
                .quantity(1)
                .createdBy(createdBy)
                .hospital(hospital)
                .build();
        when(orderRepository.findByIdAndSupplierId(ORDER_ID, 99L)).thenReturn(Optional.of(order));
    }

    private static User hospitalUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setName("Hospital Staff");
        user.setRole("hospital");
        return user;
    }

    private static Hospital hospitalProfile(User user) {
        Hospital hospital = new Hospital();
        hospital.setUser(user);
        return hospital;
    }

    private static String eqIgnoringCase(String expected) {
        return org.mockito.ArgumentMatchers.argThat(expected::equalsIgnoreCase);
    }
}
