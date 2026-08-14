package com.medtrack.supplier.service;

import com.medtrack.exception.DuplicateTrackingNumberException;
import com.medtrack.exception.InvalidStatusTransitionException;
import com.medtrack.exception.ResourceNotFoundException;
import com.medtrack.model.EquipmentOrder;
import com.medtrack.model.ShippingStatus;
import com.medtrack.repository.EquipmentOrderRepository;
import com.medtrack.repository.SupplierQuoteRepository;
import com.medtrack.supplier.dto.BulkDeliveryConfirmationRequest;
import com.medtrack.supplier.dto.BulkShipmentConfirmationRequest;
import com.medtrack.supplier.dto.CreateShipmentRequest;
import com.medtrack.supplier.dto.ShipmentTrackingResponse;
import com.medtrack.supplier.dto.UpdateShipmentStatusRequest;
import com.medtrack.supplier.model.ShipmentStatus;
import com.medtrack.supplier.model.ShipmentTracking;
import com.medtrack.supplier.repository.ShipmentTrackingRepository;
import com.medtrack.supplier.security.SupplierAccessGuard;
import com.medtrack.supplier.validation.ShipmentRequestValidator;
import com.medtrack.supplier.workflow.ShipmentWorkflowOrchestrator;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShipmentTrackingService {

    private static final Logger log = LoggerFactory.getLogger(ShipmentTrackingService.class);

    private final ShipmentTrackingRepository shipmentTrackingRepository;
    private final EquipmentOrderRepository orderRepository;
    private final SupplierQuoteRepository supplierQuoteRepository;
    private final SupplierAccessGuard supplierAccessGuard;
    private final ShipmentRequestValidator validator;
    private final ShipmentWorkflowOrchestrator orchestrator;

    @Transactional
    public ShipmentTrackingResponse createShipment(CreateShipmentRequest request, Authentication authentication) {
        validator.validateCreateShipmentRequest(request);

        // 1. Verify associated order exists. EquipmentOrder carries a class-level
        // @SQLRestriction("deleted = false"), so an archived order is already invisible here and
        // reports as not found rather than as a shipment target.
        EquipmentOrder order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + request.getOrderId()));

        // 2. Confirm this caller is entitled to fulfil this order before anything is written.
        Long callerId = supplierAccessGuard.resolveCallerId(authentication);
        assertOrderClaimableBy(order, callerId);

        // 3. Prevent duplicate shipment creation for same order
        shipmentTrackingRepository.findByOrderId(request.getOrderId()).ifPresent(s -> {
            throw new IllegalArgumentException(
                    "Shipment tracking already exists for Order ID: " + request.getOrderId());
        });

        // 4. Ensure tracking number uniqueness
        shipmentTrackingRepository.findByShipmentTrackingNumber(request.getShipmentTrackingNumber().trim()).ifPresent(s -> {
            throw new DuplicateTrackingNumberException("Tracking number already in use: " + request.getShipmentTrackingNumber());
        });

        // 5. Create and persist ShipmentTracking. The supplierId is always the resolved
        // caller identity, never the client-supplied request field, so a supplier cannot
        // create a shipment claiming to be a different supplier.
        ShipmentTracking shipment = ShipmentTracking.builder()
                .orderId(request.getOrderId())
                .shipmentTrackingNumber(request.getShipmentTrackingNumber().trim())
                .estimatedDeliveryDate(request.getEstimatedDeliveryDate())
                .shipmentStatus(ShipmentStatus.PENDING)
                .supplierId(callerId)
                .createdAt(LocalDateTime.now())
                .build();

        ShipmentTracking savedShipment = shipmentTrackingRepository.save(shipment);

        // 5. Update order details
        order.setTrackingNo(request.getShipmentTrackingNumber().trim());
        order.setCarrier(request.getCarrier().trim());
        order.setStatus("CONFIRMED");
        order.setShippingStatus("Processing");
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.save(order);

        return mapToResponse(savedShipment);
    }

    @Transactional
    public ShipmentTrackingResponse updateShipmentStatus(Long id, UpdateShipmentStatusRequest request,
            Authentication authentication) {
        validator.validateEntityId(id, "Shipment");
        validator.validateUpdateStatusRequest(request);

        // 1. Retrieve the tracking record
        ShipmentTracking shipment = shipmentTrackingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shipment tracking not found with ID: " + id));

        // Only the assigned supplier or a HOSPITAL admin may update this shipment.
        supplierAccessGuard.assertSelfOrHospitalAdmin(authentication,
                supplierAccessGuard.resolveCallerId(authentication), shipment.getSupplierId());

        // 2. Map and validate status transition
        ShipmentStatus newStatus;
        try {
            newStatus = ShipmentStatus.valueOf(request.getShipmentStatus().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid shipment status value: " + request.getShipmentStatus());
        }

        ShipmentStatus currentStatus = shipment.getShipmentStatus();
        orchestrator.validateStateTransition(currentStatus, newStatus);

        // 3. Update shipment record
        shipment.setShipmentStatus(newStatus);
        if (newStatus == ShipmentStatus.DELIVERED) {
            shipment.setActualDeliveryDate(LocalDateTime.now());
        }
        shipment.setUpdatedAt(LocalDateTime.now());
        ShipmentTracking updatedShipment = shipmentTrackingRepository.save(shipment);

        // 4. Update associated order
        EquipmentOrder order = orderRepository.findById(shipment.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + shipment.getOrderId()));

        if (newStatus == ShipmentStatus.CONFIRMED) {
            order.setStatus("CONFIRMED");
            order.setShippingStatus("Processing");
        } else if (newStatus == ShipmentStatus.SHIPPED) {
            order.setStatus("IN_TRANSIT");
            order.setShippingStatus("Shipped");
            order.setDispatchedAt(LocalDateTime.now());
        } else if (newStatus == ShipmentStatus.DELIVERED) {
            order.setStatus("DELIVERED");
            order.setShippingStatus("Delivered");
            order.setDeliveredAt(LocalDateTime.now());
        }

        if (request.getSupplierNotes() != null) {
            order.setSupplierNotes(request.getSupplierNotes().trim());
        }
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.save(order);

        return mapToResponse(updatedShipment);
    }

    @Transactional
    public List<ShipmentTrackingResponse> bulkConfirmShipments(BulkShipmentConfirmationRequest request,
                                                               Authentication authentication) {
        return request.getShipments().stream()
                .map(shipment -> createShipment(shipment, authentication))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ShipmentTrackingResponse> bulkConfirmDeliveries(BulkDeliveryConfirmationRequest request,
                                                                Authentication authentication) {
        UpdateShipmentStatusRequest updateRequest = UpdateShipmentStatusRequest.builder()
                .shipmentStatus("DELIVERED")
                .supplierNotes("Bulk delivery confirmation")
                .build();

        return request.getShipmentIds().stream()
                .map(id -> updateShipmentStatus(id, updateRequest, authentication))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ShipmentTrackingResponse getShipmentById(Long id, Authentication authentication) {
        validator.validateEntityId(id, "Shipment");
        ShipmentTracking shipment = shipmentTrackingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shipment tracking not found with ID: " + id));
        assertCanView(authentication, shipment);
        return mapToResponse(shipment);
    }

    @Transactional(readOnly = true)
    public ShipmentTrackingResponse getShipmentByTrackingNumber(String trackingNumber, Authentication authentication) {
        validator.validateTrackingNumber(trackingNumber);
        ShipmentTracking shipment = shipmentTrackingRepository.findByShipmentTrackingNumber(trackingNumber.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Shipment tracking not found for tracking number: " + trackingNumber));
        assertCanView(authentication, shipment);
        return mapToResponse(shipment);
    }

    @Transactional(readOnly = true)
    public ShipmentTrackingResponse getShipmentByOrderId(Long orderId, Authentication authentication) {
        validator.validateEntityId(orderId, "Order");
        ShipmentTracking shipment = shipmentTrackingRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Shipment tracking not found for Order ID: " + orderId));
        assertCanView(authentication, shipment);
        return mapToResponse(shipment);
    }

    @Transactional(readOnly = true)
    public Page<ShipmentTrackingResponse> getShipmentsBySupplier(Long supplierId, Pageable pageable, Authentication authentication) {
        validator.validateEntityId(supplierId, "Supplier");
        supplierAccessGuard.assertSelfOrHospitalAdmin(authentication, supplierId);
        return shipmentTrackingRepository.findBySupplierId(supplierId, pageable)
                .map(this::mapToResponse);
    }

    /**
     * Confirms the caller may attach a shipment to this order.
     *
     * <p>Creating a shipment is not a neutral act: it is how an order becomes a supplier's.
     * {@link EquipmentOrder} has no supplier column, and every supplier-scoped read is an existence
     * check over {@code ShipmentTracking} - {@code EquipmentOrderRepository.findBySupplierId},
     * {@code findByIdAndSupplierId} and {@code findBySupplierIdAndDeletedTrue} all resolve a
     * supplier's orders through the shipment rows they own. So the row written a few lines below is
     * the assignment, and until this check existed the method took the order id straight from the
     * request body and asked nothing about it. Any authenticated supplier could name any order id in
     * the deployment and be handed that order: its hospital, equipment, quantities and costs became
     * readable, and {@code OrderService.updateOrderStatus} would then accept status changes on it.</p>
     *
     * <p>Two rules, in the order they are checked:</p>
     *
     * <ol>
     *   <li><b>A terminal order is not open for fulfilment.</b> A {@code Delivered} or
     *       {@code Cancelled} order has finished. Creating a shipment against one resets its
     *       {@code shippingStatus} to {@code Processing} while {@code deliveredAt} stays populated -
     *       the exact inconsistency {@link ShippingStatus#canTransitionTo} exists to prevent on the
     *       other write path. An order whose stored status predates that validation parses as absent
     *       and is treated as non-terminal, matching how {@code OrderService} reads the same column.</li>
     *   <li><b>An awarded order belongs to the supplier it was awarded to.</b> When the order came
     *       out of the procurement flow, the hospital chose a winner and
     *       {@link com.medtrack.repository.SupplierQuoteRepository#findAwardedSupplierIdsByOrderId}
     *       recovers who that was. A caller who is not that supplier is refused.</li>
     * </ol>
     *
     * <p>Orders raised directly through {@code OrderService.placeOrder} carry no award, because that
     * flow never names a supplier. Those stay claimable by the first supplier to ship them, which is
     * the behaviour the direct-order screen depends on - and the duplicate-shipment check below still
     * limits it to one claim. Narrowing that further needs the order itself to record a supplier, and
     * is deliberately left out of this change.</p>
     */
    private void assertOrderClaimableBy(EquipmentOrder order, Long callerId) {
        Optional<ShippingStatus> current = ShippingStatus.current(order);
        if (current.filter(ShippingStatus::isTerminal).isPresent()) {
            throw new IllegalArgumentException("Order " + order.getOrderCode() + " is "
                    + current.get().getLabel() + " and cannot have a new shipment created against it");
        }

        List<Long> awardedSupplierIds =
                supplierQuoteRepository.findAwardedSupplierIdsByOrderId(order.getId());
        if (awardedSupplierIds.isEmpty()) {
            return;
        }
        if (awardedSupplierIds.stream().noneMatch(awarded -> Objects.equals(awarded, callerId))) {
            log.warn("Supplier {} attempted to create a shipment for order {}, which was awarded to {}",
                    callerId, order.getId(), awardedSupplierIds);
            throw new AccessDeniedException(
                    "This order was awarded to a different supplier and cannot be fulfilled by your account");
        }
    }

    private void assertCanView(Authentication authentication, ShipmentTracking shipment) {
        supplierAccessGuard.assertSelfOrHospitalAdmin(authentication,
                supplierAccessGuard.resolveCallerId(authentication), shipment.getSupplierId());
    }

    private ShipmentTrackingResponse mapToResponse(ShipmentTracking shipment) {
        return ShipmentTrackingResponse.builder()
                .id(shipment.getId())
                .orderId(shipment.getOrderId())
                .shipmentTrackingNumber(shipment.getShipmentTrackingNumber())
                .estimatedDeliveryDate(shipment.getEstimatedDeliveryDate())
                .actualDeliveryDate(shipment.getActualDeliveryDate())
                .shipmentStatus(shipment.getShipmentStatus().name())
                .supplierId(shipment.getSupplierId())
                .createdAt(shipment.getCreatedAt())
                .updatedAt(shipment.getUpdatedAt())
                .build();
    }
}
