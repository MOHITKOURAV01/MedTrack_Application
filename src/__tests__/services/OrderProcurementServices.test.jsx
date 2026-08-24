import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/orders`, () => HttpResponse.json({ content: [{ id: "ORD-001", status: "PLACED" }], totalElements: 1 })),
  http.get(`${BASE}/api/orders/ORD-001`, () => HttpResponse.json({ id: "ORD-001", status: "PLACED" })),
  http.post(`${BASE}/api/orders`, () => HttpResponse.json({ id: "ORD-NEW", status: "PLACED" })),
  http.put(`${BASE}/api/orders/ORD-001/status`, () => HttpResponse.json({ success: true })),
  http.get(`${BASE}/api/orders/supplier/metrics`, () => HttpResponse.json({ avgLeadTime: 7 })),
  http.post(`${BASE}/api/orders/ORD-001/invoice/email`, () => HttpResponse.json({ sent: true })),
  http.post(`${BASE}/api/procurement/requests`, () => HttpResponse.json({ id: "PR-NEW", status: "PENDING" })),
  http.get(`${BASE}/api/procurement/requests`, () => HttpResponse.json([{ id: "PR-001", status: "APPROVED" }])),
  http.get(`${BASE}/api/procurement/requests/PR-001`, () => HttpResponse.json({ id: "PR-001" })),
  http.post(`${BASE}/api/procurement/requests/PR-001/cancel`, () => HttpResponse.json({ cancelled: true })),
  http.get(`${BASE}/api/procurement/approval-inbox`, () => HttpResponse.json([{ stepId: "AS-001" }])),
  http.get(`${BASE}/api/procurement/policies`, () => HttpResponse.json([{ policyId: "POL-001" }])),
  http.post(`${BASE}/api/procurement/policies`, () => HttpResponse.json({ policyId: "POL-NEW" })),
  http.get(`${BASE}/api/procurement/quotes/mine`, () => HttpResponse.json([{ quoteId: "Q-001" }])),
  http.get(`${BASE}/api/procurement/budget`, () => HttpResponse.json({ totalBudget: 500000, spent: 120000 })),
  http.get(`${BASE}/api/procurement/requests/PR-001/quotes`, () => HttpResponse.json([{ quoteId: "Q-001" }])),
  http.post(`${BASE}/api/procurement/requests/PR-001/quotes/Q-001/accept`, () => HttpResponse.json({ accepted: true })),
  http.get(`${BASE}/api/procurement/requests/PR-001/receiving`, () => HttpResponse.json([{ recordId: "RCV-001" }])),
  http.post(`${BASE}/api/procurement/requests/PR-001/receiving`, () => HttpResponse.json({ recordId: "RCV-NEW" })),
  http.get(`${BASE}/api/procurement/requests/PR-001/invoice-match`, () => HttpResponse.json([{ matchId: "INV-001" }])),
  http.post(`${BASE}/api/procurement/requests/PR-001/invoice-match`, () => HttpResponse.json({ matchId: "INV-NEW" })),
  http.get(`${BASE}/api/procurement/requests/PR-001/audit`, () => HttpResponse.json([{ action: "CREATED" }])),
  http.post(`${BASE}/api/procurement/steps/AS-001/decision`, () => HttpResponse.json({ decided: true })),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getAllOrders, getOrderById, placeOrder, updateOrderStatus, getSupplierMetrics, emailInvoice } from "../../services/OrderService";
import { createProcurementRequest, listProcurementRequests, getProcurementRequest, cancelProcurementRequest, getApprovalInbox, listApprovalPolicies, createApprovalPolicy, decideApprovalStep, listMyQuotes, getBudgetSummary, listQuotesForRequest, acceptQuote, listReceivingRecords, recordReceiving, listInvoiceMatches, recordInvoiceMatch, getProcurementAuditTrail } from "../../services/ProcurementService";

describe("OrderService", () => {
  it("getAllOrders returns paginated orders", async () => {
    const data = await getAllOrders();
    expect(data.content).toHaveLength(1);
    expect(data.content[0].status).toBe("PLACED");
  });
  it("getOrderById returns an order", async () => {
    const data = await getOrderById("ORD-001");
    expect(data.id).toBe("ORD-001");
  });
  it("placeOrder creates an order", async () => {
    const result = await placeOrder({ items: [] });
    expect(result.id).toBe("ORD-NEW");
  });
  it("updateOrderStatus updates status", async () => {
    const result = await updateOrderStatus("ORD-001", "SHIPPED", "On the way");
    expect(result.success).toBe(true);
  });
  it("getSupplierMetrics returns metrics", async () => {
    const data = await getSupplierMetrics();
    expect(data.avgLeadTime).toBe(7);
  });
  it("emailInvoice sends invoice email", async () => {
    const result = await emailInvoice("ORD-001");
    expect(result.sent).toBe(true);
  });
});

describe("ProcurementService", () => {
  it("createProcurementRequest creates request", async () => {
    const result = await createProcurementRequest({ items: [] });
    expect(result.id).toBe("PR-NEW");
  });
  it("listProcurementRequests returns list", async () => {
    const data = await listProcurementRequests();
    expect(data).toHaveLength(1);
  });
  it("getProcurementRequest returns request", async () => {
    const data = await getProcurementRequest("PR-001");
    expect(data.id).toBe("PR-001");
  });
  it("cancelProcurementRequest cancels", async () => {
    const result = await cancelProcurementRequest("PR-001");
    expect(result.cancelled).toBe(true);
  });
  it("getApprovalInbox returns inbox", async () => {
    const data = await getApprovalInbox();
    expect(data).toHaveLength(1);
  });
  it("listApprovalPolicies returns policies", async () => {
    const data = await listApprovalPolicies();
    expect(data).toHaveLength(1);
  });
  it("createApprovalPolicy creates policy", async () => {
    const result = await createApprovalPolicy({ name: "New Policy" });
    expect(result.policyId).toBe("POL-NEW");
  });
  it("decideApprovalStep makes decision", async () => {
    const result = await decideApprovalStep("AS-001", true, "Looks good");
    expect(result.decided).toBe(true);
  });
  it("listMyQuotes returns quotes", async () => {
    const data = await listMyQuotes();
    expect(data).toHaveLength(1);
  });
  it("getBudgetSummary returns budget", async () => {
    const data = await getBudgetSummary();
    expect(data.totalBudget).toBe(500000);
  });
  it("listQuotesForRequest returns quotes", async () => {
    const data = await listQuotesForRequest("PR-001");
    expect(data).toHaveLength(1);
  });
  it("acceptQuote accepts a quote", async () => {
    const result = await acceptQuote("PR-001", "Q-001");
    expect(result.accepted).toBe(true);
  });
  it("listReceivingRecords returns records", async () => {
    const data = await listReceivingRecords("PR-001");
    expect(data).toHaveLength(1);
  });
  it("recordReceiving records delivery", async () => {
    const result = await recordReceiving("PR-001", { items: [] });
    expect(result.recordId).toBe("RCV-NEW");
  });
  it("listInvoiceMatches returns matches", async () => {
    const data = await listInvoiceMatches("PR-001");
    expect(data).toHaveLength(1);
  });
  it("recordInvoiceMatch records match", async () => {
    const result = await recordInvoiceMatch("PR-001", { amount: 5000 });
    expect(result.matchId).toBe("INV-NEW");
  });
  it("getProcurementAuditTrail returns audit trail", async () => {
    const data = await getProcurementAuditTrail("PR-001");
    expect(data).toHaveLength(1);
  });
});
