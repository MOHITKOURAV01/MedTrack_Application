package com.medtrack.service;

import com.medtrack.auth.model.User;
import com.medtrack.auth.repository.UserRepository;
import com.medtrack.model.Equipment;
import com.medtrack.model.EquipmentOrder;
import com.medtrack.model.EquipmentStatus;
import com.medtrack.model.Hospital;
import com.medtrack.model.ShippingStatus;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.repository.EquipmentRepository;
import com.medtrack.repository.HospitalRepository;
import com.medtrack.supplier.security.SupplierAccessGuard;
import com.medtrack.util.PurchaseOrderPdf;
import com.medtrack.dto.PlaceOrderRequest;
import com.medtrack.dto.SupplierMetricsDto;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.medtrack.exception.ResourceNotFoundException;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

import com.medtrack.util.SupplierInvoicePdf;
import com.medtrack.auth.service.EmailService;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final EquipmentOrderRepository orderRepository;
    private final EquipmentRepository equipmentRepository;
    private final PurchaseOrderPdf purchaseOrderPdf;
    private final SupplierInvoicePdf supplierInvoicePdf;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final SupplierAccessGuard supplierAccessGuard;

    public byte[] generateInvoicePdf(Long id) {
        EquipmentOrder order = getOrderById(id);
        return supplierInvoicePdf.generate(order);
    }

    /**
     * Emails the commercial invoice to the hospital account that raised the order.
     *
     * <p>The recipient used to be {@code order.getCreatedBy()}, which is not an address column.
     * {@link #placeOrder} writes the user's <em>display name</em> into it and only falls back to the
     * email when the name is missing, so for every order raised from the hospital order screen the
     * invoice was addressed to something like {@code Dr Anita Rao}. {@code MimeMessageHelper.setTo}
     * rejects that, {@code EmailServiceImpl} catches the rejection and logs it, and the controller
     * still answered {@code 200 OK} - the supplier was told an invoice had been sent that never
     * left. The old fallback was worse than the failure: {@code admin@hospital.com} is a placeholder
     * that belongs to no tenant here, so whenever it was reached the invoice really was delivered,
     * to a stranger, carrying the hospital's order code, equipment and costs.</p>
     *
     * <p>The address is now resolved from the user records instead of from a free-text label, and a
     * failure to resolve one is an error rather than a silent no-op.</p>
     *
     * @param id the order to invoice
     * @throws IllegalStateException if no deliverable hospital address can be resolved for the order
     */
    public void emailInvoice(Long id) {
        EquipmentOrder order = getOrderById(id);
        String recipient = resolveInvoiceRecipient(order);
        byte[] pdf = supplierInvoicePdf.generate(order);
        emailService.sendInvoiceEmail(recipient, order.getOrderCode(), pdf);
        log.info("Invoice emailed | orderId={} | orderCode={} | recipient={}",
                id, order.getOrderCode(), recipient);
    }

    /**
     * Works out where an order's invoice should be sent.
     *
     * <p>Nothing on {@link EquipmentOrder} is a foreign key to the buyer, so this reconstructs the
     * link from the two labels the order does carry, in order of how directly each identifies an
     * account:</p>
     *
     * <ol>
     *   <li>{@code createdBy}, when it holds an address that resolves to a user.
     *       {@code ProcurementService.acceptQuote} writes {@code hospital.user().getEmail()} there,
     *       so procurement-raised orders are already exact.</li>
     *   <li>{@code hospital} read as an organisation, which is what {@link #placeOrder} writes.</li>
     *   <li>{@code hospital} read as a hospital profile name, which is what
     *       {@code acceptQuote} writes. Both readings are tried because the two writers disagree,
     *       the same disagreement {@code EquipmentOrderRepository.HOSPITAL_IDENTITY_MATCH} works
     *       around when resolving in the other direction.</li>
     * </ol>
     *
     * <p>An organisation or profile name matching more than one account is not resolved to a guess:
     * sending one hospital's costed invoice to the wrong colleague is the failure this method exists
     * to prevent, so an ambiguous match is reported as unresolvable.</p>
     */
    private String resolveInvoiceRecipient(EquipmentOrder order) {
        String createdBy = trimToNull(order.getCreatedBy());
        if (createdBy != null && looksLikeEmailAddress(createdBy)) {
            Optional<User> byEmail = userRepository.findByEmail(createdBy.toLowerCase(Locale.ROOT));
            if (byEmail.isPresent()) {
                return byEmail.get().getEmail();
            }
        }

        String hospitalLabel = trimToNull(order.getHospital());
        if (hospitalLabel != null) {
            List<User> byOrganization = userRepository.findHospitalUsersByOrganization(hospitalLabel);
            if (byOrganization.size() == 1) {
                return byOrganization.get(0).getEmail();
            }

            if (byOrganization.isEmpty()) {
                List<Hospital> byProfileName =
                        hospitalRepository.findByNameIgnoreCaseAndTrimmed(hospitalLabel);
                if (byProfileName.size() == 1 && byProfileName.get(0).getUser() != null) {
                    return byProfileName.get(0).getUser().getEmail();
                }
            }
        }

        log.error("Cannot email invoice for order {} ({}): no hospital address resolves from "
                        + "createdBy='{}' or hospital='{}'",
                order.getId(), order.getOrderCode(), order.getCreatedBy(), order.getHospital());
        throw new IllegalStateException(
                "No hospital email address could be resolved for order " + order.getOrderCode()
                        + ". The invoice was not sent.");
    }

    /**
     * A deliberately loose shape check - one {@code @}, something either side, no whitespace. It
     * only has to separate an address from a person's name well enough to decide which lookup to
     * try; whether the address exists is settled by the repository, not by this.
     */
    private boolean looksLikeEmailAddress(String value) {
        return value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }


    private String getCurrentUserOrganization() {
        return getCurrentHospitalUser().getOrganization();
    }

    /**
     * The authenticated hospital user, resolved once for both identities an order may carry.
     *
     * <p>{@code EquipmentOrder.hospital} is free text and the application writes two different
     * things into it: {@link #placeOrder} writes {@code User.organization}, while
     * {@code ProcurementService.acceptQuote} writes the {@code Hospital} profile name. Nothing ties
     * those two strings together, so filtering on the organisation alone - which is what every read
     * here used to do - hid every order the procurement flow created for the very hospital that
     * raised the request. The repository matches both, which needs the caller's email as well as
     * their organisation.</p>
     */
    private User getCurrentHospitalUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("User not authenticated");
        }
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private User getAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("User not authenticated");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private boolean isSupplier() {
        return isSupplier(getCurrentAuthentication());
    }

    private Authentication getCurrentAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("User is not authenticated");
        }
        return authentication;
    }

    private EquipmentOrder getSupplierOrderById(Long id, Authentication authentication) {
        Long supplierId = supplierAccessGuard.resolveCallerId(authentication);
        return orderRepository.findByIdAndSupplierId(id, supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));
    }

    private boolean isSupplier(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_SUPPLIER".equals(authority.getAuthority()));
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("User not authenticated");
        }
        return authentication.getName();
    }

    /**
     * Returns one page of orders visible to the caller.
     *
     * <p>Suppliers see only orders assigned to them through a shipment record; a hospital user
     * sees only their own organisation's orders.
     * The {@code Pageable} is required: {@link com.medtrack.controller.OrderController} supplies a
     * {@code @PageableDefault}, so callers never have to construct one themselves.</p>
     *
     * @param pageable the page to fetch; must not be {@code null}
     * @return the requested page of orders
     */
    public Page<EquipmentOrder> getAllOrders(String status, Pageable pageable) {
        if (pageable == null) {
            throw new IllegalArgumentException("Pageable is required");
        }
        if (isSupplier()) {
            Long supplierId = supplierAccessGuard.resolveCallerId(getCurrentAuthentication());
            if (status != null && !status.isBlank()) {
                return orderRepository.findBySupplierIdWithStatus(supplierId, status, pageable);
            }
            return orderRepository.findBySupplierId(supplierId, pageable);
        }
        User caller = getCurrentHospitalUser();
        if (status != null && !status.isBlank()) {
            return orderRepository.findVisibleToHospitalUserWithStatus(
                    caller.getOrganization(), caller.getEmail(), status, pageable);
        }
        return orderRepository.findVisibleToHospitalUser(
                caller.getOrganization(), caller.getEmail(), pageable);
    }

    /**
     * Returns every order visible to the caller, unpaged.
     *
     * <p>Kept separate from {@link #getAllOrders(Pageable)} because the supplier scorecard has to
     * aggregate over the caller's whole order history. Paging that call would have computed the
     * on-time rate from whichever page happened to be requested.</p>
     *
     * @return all orders the caller may see
     */
    public List<EquipmentOrder> getAllOrdersUnpaged() {
        if (isSupplier()) {
            Long supplierId = supplierAccessGuard.resolveCallerId(getCurrentAuthentication());
            return orderRepository.findBySupplierId(supplierId);
        }
        User caller = getCurrentHospitalUser();
        return orderRepository.findVisibleToHospitalUser(caller.getOrganization(), caller.getEmail());
    }

    public EquipmentOrder getOrderById(Long id) {
        if (isSupplier()) {
            return getSupplierOrderById(id, getCurrentAuthentication());
        }
        User caller = getCurrentHospitalUser();
        // Scoped in the query rather than loaded and then compared, so an order belonging to
        // another hospital is indistinguishable from an id that does not exist.
        return orderRepository.findVisibleToHospitalUserById(
                        id, caller.getOrganization(), caller.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));
    }

    public EquipmentOrder placeOrder(PlaceOrderRequest request, Authentication authentication) {
        User hospitalUser = getAuthenticatedUser(authentication);
        if (hospitalUser.getOrganization() == null || hospitalUser.getOrganization().isBlank()) {
            throw new IllegalArgumentException("Authenticated user has no hospital organization on record");
        }

        Equipment equipment = equipmentRepository.findByEquipmentCode(request.getEquipmentId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Equipment not found with code: " + request.getEquipmentId()));
        if (equipment.getStatus() == EquipmentStatus.RETIRED || equipment.getStatus() == EquipmentStatus.DISPOSED) {
            throw new IllegalArgumentException("Retired or disposed equipment cannot be ordered as active stock");
        }

        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }

        EquipmentOrder order = EquipmentOrder.builder()
                .orderCode("ORD-" + java.util.UUID.randomUUID())
                .equipmentId(equipment.getEquipmentCode())
                .equipmentName(equipment.getName())
                .quantity(request.getQuantity())
                .notes(request.getNotes())
                .hospital(hospitalUser.getOrganization())
                .createdBy(hospitalUser.getName() != null ? hospitalUser.getName() : hospitalUser.getEmail())
                .build();

        return orderRepository.save(order);
    }

    /**
     * Moves an order to a new shipping state on behalf of the assigned supplier.
     *
     * <p>The status used to be written through unvalidated - to both {@code status} and
     * {@code shippingStatus}, despite those columns documenting different vocabularies - so a typo
     * or a value from the wrong vocabulary put the order permanently outside every
     * {@code "Delivered".equalsIgnoreCase(...)} comparison the KPIs and spend analytics are built
     * on. {@link ShippingStatus} is now the single definition of what is accepted, what is stored in
     * each column, and which moves are legal.</p>
     */
    public EquipmentOrder updateOrderStatus(Long id, String status, String supplierNotes,
                                             Authentication authentication) {
        if (!isSupplier(authentication)) {
            throw new AccessDeniedException("Only suppliers may update order status");
        }
        EquipmentOrder order = getSupplierOrderById(id, authentication);

        ShippingStatus target = ShippingStatus.parse(status)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unsupported order status '" + status + "'. Accepted values: "
                                + ShippingStatus.acceptedLabels()));
        // An order whose stored status predates this validation may hold anything; treat it as no
        // known state rather than guessing, and let the move through.
        Optional<ShippingStatus> currentStatus = ShippingStatus.current(order);
        currentStatus.filter(current -> !current.canTransitionTo(target))
                .ifPresent(current -> {
                    throw new IllegalArgumentException("An order that is " + current.getLabel()
                            + " cannot be moved to " + target.getLabel()
                            + (current.isTerminal() ? "; that state is final" : ""));
                });

        order.setStatus(target.getWorkflowStatus());
        order.setShippingStatus(target.getLabel());
        order.setSupplierNotes(supplierNotes);
        order.setUpdatedAt(LocalDateTime.now());

        if (target == ShippingStatus.SHIPPED) {
            // Only a dispatch stamps a dispatch date, and only the first one.
            if (order.getDispatchedAt() == null) {
                order.setDispatchedAt(LocalDateTime.now());
            }
            if (order.getTrackingNo() == null) {
                order.setTrackingNo("TRK-" + (new SecureRandom().nextInt(900000) + 100000));
            }
            if (order.getCarrier() == null) {
                order.setCarrier("MedExpress Logistics");
            }
        } else if (target == ShippingStatus.DELIVERED) {
            // A delivery with no recorded dispatch used to invent one two days in the past, which
            // is worse than missing data: it is plausible data, and it made every unreported
            // dispatch look like a tidy two-day delivery in the supplier's scorecard.
            order.setDeliveredAt(LocalDateTime.now());
        }

        return orderRepository.save(order);
    }

    public byte[] generatePurchaseOrderPdf(Long id) {
        EquipmentOrder order = getOrderById(id);
        return purchaseOrderPdf.generate(order);
    }

    public void deleteOrder(Long id) {
        EquipmentOrder order = getOrderById(id);
        orderRepository.delete(order);
    }

    /**
     * Archives (soft deletes) an order by setting deleted = true.
     * This is used instead of hard delete for audit compliance.
     */
    @Transactional
    public EquipmentOrder archiveOrder(Long id, String deletedBy) {
        EquipmentOrder order = getOrderById(id);

        order.setDeleted(true);
        order.setDeletedAt(LocalDateTime.now());
        order.setDeletedBy(deletedBy);

        EquipmentOrder savedOrder = orderRepository.save(order);

        log.info("Order archived | user={} | hospital={} | orderId={} | orderCode={}",
                deletedBy, order.getHospital(), id, order.getOrderCode());

        return savedOrder;
    }

    /**
     * Restores an archived order belonging to the caller's hospital.
     *
     * <p>Only available within 90 days of archival. An archived order owned by another hospital is
     * reported as not found rather than as forbidden, so the endpoint cannot be used to find out
     * which order ids exist.</p>
     */
    @Transactional
    public EquipmentOrder restoreOrder(Long id, String username) {
        EquipmentOrder order = getArchivedOrderForCaller(id);

        // Check if 90 days have passed since archival
        if (order.getDeletedAt() != null && order.getDeletedAt().isBefore(LocalDateTime.now().minusDays(90))) {
            throw new IllegalStateException("Order cannot be restored after 90 days");
        }

        order.setDeleted(false);
        order.setDeletedAt(null);
        order.setDeletedBy(null);

        EquipmentOrder savedOrder = orderRepository.save(order);

        log.info("Order restored | user={} | hospital={} | orderId={} | orderCode={}",
                username, order.getHospital(), id, order.getOrderCode());

        return savedOrder;
    }

    /**
     * Gets paginated archived orders visible to the caller.
     *
     * <p>A hospital sees its own archive; a supplier sees only the archived orders they are
     * assigned to through a shipment record, matching how {@link #getAllOrders(Pageable)} scopes
     * the live listing.</p>
     */
    public Page<EquipmentOrder> getArchivedOrders(Pageable pageable) {
        if (isSupplier()) {
            Long supplierId = supplierAccessGuard.resolveCallerId(getCurrentAuthentication());
            return orderRepository.findBySupplierIdAndDeletedTrue(supplierId, pageable);
        }
        return orderRepository.findByHospitalAndDeletedTrue(getCurrentUserOrganization(), pageable);
    }

    /**
     * Permanently deletes an archived order belonging to the caller's hospital.
     * Only callable after 90 days from archival.
     */
    @Transactional
    public void permanentlyDeleteOrder(Long id) {
        EquipmentOrder order = getArchivedOrderForCaller(id);

        // Check if 90 days have passed since archival
        if (order.getDeletedAt() != null && order.getDeletedAt().isAfter(LocalDateTime.now().minusDays(90))) {
            throw new IllegalStateException("Order cannot be permanently deleted until 90 days after archival");
        }

        orderRepository.delete(order);

        log.info("Order permanently deleted | user={} | hospital={} | orderId={} | orderCode={}",
                getCurrentUsername(), order.getHospital(), id, order.getOrderCode());
    }

    /**
     * Resolves one archived order the caller is allowed to act on.
     *
     * <p>The archive queries are native - {@link EquipmentOrder} carries a class-level
     * {@code @SQLRestriction("deleted = false")} that would otherwise hide every archived row - and
     * a native query gets no tenant handling from Hibernate. Restore and permanent delete both went
     * through {@code findByIdAndDeletedTrue(id)}, which scoped on nothing at all, so any hospital
     * account could restore or purge any other hospital's archived order by id. Suppliers have no
     * archive administration at all: the controller restricts both endpoints to {@code ROLE_HOSPITAL}
     * and this method refuses a supplier caller rather than relying on that alone.</p>
     */
    private EquipmentOrder getArchivedOrderForCaller(Long id) {
        if (isSupplier()) {
            throw new AccessDeniedException("Suppliers cannot administer the hospital order archive");
        }
        String hospital = getCurrentUserOrganization();
        return orderRepository.findByIdAndHospitalAndDeletedTrue(id, hospital)
                .orElseThrow(() -> new ResourceNotFoundException("Archived order not found"));
    }

    public SupplierMetricsDto getSupplierMetrics() {
        List<EquipmentOrder> orders = getAllOrdersUnpaged();
        long total = orders.size();

        // "Pending" is outstanding work, which is Processing plus Shipped. It used to be defined as
        // "anything that is not Delivered", so every cancelled order sat in a supplier's pending
        // count forever - as did every order whose status had been written with a typo.
        long pending = countIn(orders, ShippingStatus.outstanding());

        long shipped = countIn(orders, Set.of(ShippingStatus.SHIPPED));

        List<EquipmentOrder> deliveredOrders = orders.stream()
                .filter(order -> is(order, ShippingStatus.DELIVERED))
                .toList();
        long delivered = deliveredOrders.size();

        // Average delivery time over the deliveries that actually carry both timestamps.
        double avgDays = deliveredOrders.stream()
                .filter(order -> order.getOrderDate() != null && order.getDeliveredAt() != null)
                .mapToLong(order -> ChronoUnit.DAYS.between(order.getOrderDate(), order.getDeliveredAt()))
                .average()
                .orElse(0.0);

        // Benchmark SLA: delivered within 7 days of the order date is on time.
        long onTimeCount = deliveredOrders.stream()
                .filter(order -> order.getOrderDate() != null && order.getDeliveredAt() != null)
                .filter(order -> ChronoUnit.DAYS.between(order.getOrderDate(), order.getDeliveredAt()) <= 7)
                .count();

        // No deliveries means no on-time record, which is 0 rather than 100. A brand-new supplier
        // used to open on a perfect scorecard before shipping anything.
        double onTimeRate = delivered > 0 ? (double) onTimeCount * 100.0 / delivered : 0.0;

        // Round average days and onTimeRate to 1 decimal place
        avgDays = Math.round(avgDays * 10.0) / 10.0;
        onTimeRate = Math.round(onTimeRate * 10.0) / 10.0;

        return SupplierMetricsDto.builder()
                .totalOrders(total)
                .pendingOrders(pending)
                .shippedOrders(shipped)
                .deliveredOrders(delivered)
                .averageDeliveryDays(avgDays)
                .onTimeRate(onTimeRate)
                .build();
    }

    private boolean is(EquipmentOrder order, ShippingStatus status) {
        return ShippingStatus.current(order).orElse(null) == status;
    }

    private long countIn(List<EquipmentOrder> orders, Set<ShippingStatus> statuses) {
        return orders.stream()
                .map(ShippingStatus::current)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .filter(statuses::contains)
                .count();
    }
}
