import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/equipment`, () => HttpResponse.json({ content: [{ id: "EQ-001", name: "MRI Scanner" }], totalElements: 1 })),
  http.get(`${BASE}/api/equipment/EQ-001`, () => HttpResponse.json({ id: "EQ-001", name: "MRI Scanner" })),
  http.post(`${BASE}/api/equipment`, () => HttpResponse.json({ id: "EQ-NEW" })),
  http.delete(`${BASE}/api/equipment/EQ-001`, () => HttpResponse.json({ deleted: true })),
  http.get(`${BASE}/api/equipment/imports/audit`, () => HttpResponse.json([{ importId: "IMP-001" }])),
  http.get(`${BASE}/api/equipment/EQ-001/qr-code`, () => HttpResponse.json({ qrData: "data:image/png;base64,abc" })),
  http.put(`${BASE}/api/equipment/EQ-001`, () => HttpResponse.json({ updated: true })),
  http.get(`${BASE}/api/equipment/EQ-001/lifecycle`, () => HttpResponse.json([{ action: "DEPLOYED" }])),
  http.get(`${BASE}/api/equipment/EQ-001/timeline`, () => HttpResponse.json([{ event: "Created" }])),
  http.get(`${BASE}/api/maintenance`, () => HttpResponse.json({ content: [{ id: "MT-001", title: "PM MRI" }], totalElements: 1 })),
  http.get(`${BASE}/api/maintenance/MT-001`, () => HttpResponse.json({ id: "MT-001", title: "PM MRI" })),
  http.post(`${BASE}/api/maintenance`, () => HttpResponse.json({ id: "MT-NEW" })),
  http.put(`${BASE}/api/maintenance/MT-001`, () => HttpResponse.json({ updated: true })),
  http.delete(`${BASE}/api/maintenance/MT-001`, () => HttpResponse.json({ deleted: true })),
  http.get(`${BASE}/api/maintenance/automation/rules`, () => HttpResponse.json([{ ruleId: "RULE-001" }])),
  http.post(`${BASE}/api/maintenance/automation/rules`, () => HttpResponse.json({ ruleId: "RULE-NEW" })),
  http.get(`${BASE}/api/maintenance/automation/sla`, () => HttpResponse.json({ avgCompliance: 94 })),
  http.post(`${BASE}/api/maintenance/automation/sla/refresh`, () => HttpResponse.json({ refreshed: true })),
  http.get(`${BASE}/api/maintenance/automation/workload`, () => HttpResponse.json([{ technician: "John", tasks: 5 }])),
  http.get(`${BASE}/api/events`, () => HttpResponse.json([{ id: "EVT-001", type: "ALERT" }])),
  http.get(`${BASE}/api/events/unread-counts`, () => HttpResponse.json({ alerts: 3, total: 7 })),
  http.post(`${BASE}/api/events/read`, () => HttpResponse.json({ updated: 2 })),
  http.post(`${BASE}/api/events/read-all`, () => HttpResponse.json({ updated: 5 })),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getAllEquipment, getEquipmentById, addEquipment, deleteEquipment, getEquipmentImportHistory, getEquipmentQrCode, updateEquipment, getEquipmentLifecycle, getEquipmentTimeline } from "../../services/EquipmentService";
import { getAllTasks, getTaskById, scheduleTask, updateTask, deleteTask, listRules, createRule, getSlaSummary, refreshSla, getTechnicianWorkload } from "../../services/MaintenanceService";
import { getEvents, getUnreadCounts, markEventsAsRead, markAllEventsAsRead } from "../../services/EventStreamService";

describe("EquipmentService", () => {
  it("getAllEquipment returns paginated list", async () => {
    const data = await getAllEquipment();
    expect(data.content).toHaveLength(1);
    expect(data.content[0].name).toBe("MRI Scanner");
  });
  it("getEquipmentById returns equipment", async () => {
    const data = await getEquipmentById("EQ-001");
    expect(data.id).toBe("EQ-001");
  });
  it("addEquipment creates equipment", async () => {
    const result = await addEquipment({ name: "New Device" });
    expect(result.id).toBe("EQ-NEW");
  });
  it("deleteEquipment deletes equipment", async () => {
    const result = await deleteEquipment("EQ-001");
    expect(result.deleted).toBe(true);
  });
  it("getEquipmentImportHistory returns history", async () => {
    const data = await getEquipmentImportHistory();
    expect(data).toHaveLength(1);
  });
  it("getEquipmentQrCode returns QR data", async () => {
    const data = await getEquipmentQrCode("EQ-001");
    expect(data.qrData).toBeDefined();
  });
  it("updateEquipment updates equipment", async () => {
    const result = await updateEquipment("EQ-001", { name: "Updated" });
    expect(result.updated).toBe(true);
  });
  it("getEquipmentLifecycle returns lifecycle", async () => {
    const data = await getEquipmentLifecycle("EQ-001");
    expect(data).toHaveLength(1);
  });
  it("getEquipmentTimeline returns timeline", async () => {
    const data = await getEquipmentTimeline("EQ-001");
    expect(data).toHaveLength(1);
  });
});

describe("MaintenanceService", () => {
  it("getAllTasks returns paginated list", async () => {
    const data = await getAllTasks();
    expect(data.content).toHaveLength(1);
    expect(data.content[0].title).toBe("PM MRI");
  });
  it("getTaskById returns task", async () => {
    const data = await getTaskById("MT-001");
    expect(data.id).toBe("MT-001");
  });
  it("scheduleTask creates task", async () => {
    const result = await scheduleTask({ title: "New Task" });
    expect(result.id).toBe("MT-NEW");
  });
  it("updateTask updates task", async () => {
    const result = await updateTask("MT-001", { title: "Updated" });
    expect(result.updated).toBe(true);
  });
  it("deleteTask deletes task", async () => {
    const result = await deleteTask("MT-001");
    expect(result.deleted).toBe(true);
  });
  it("listRules returns rules", async () => {
    const data = await listRules();
    expect(data).toHaveLength(1);
  });
  it("createRule creates rule", async () => {
    const result = await createRule({ name: "New Rule" });
    expect(result.ruleId).toBe("RULE-NEW");
  });
  it("getSlaSummary returns SLA summary", async () => {
    const data = await getSlaSummary();
    expect(data.avgCompliance).toBe(94);
  });
  it("refreshSla refreshes SLA", async () => {
    const result = await refreshSla();
    expect(result.refreshed).toBe(true);
  });
  it("getTechnicianWorkload returns workload", async () => {
    const data = await getTechnicianWorkload();
    expect(data).toHaveLength(1);
    expect(data[0].technician).toBe("John");
  });
});

describe("EventStreamService", () => {
  it("getEvents returns events", async () => {
    const data = await getEvents();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("ALERT");
  });
  it("getUnreadCounts returns counts", async () => {
    const data = await getUnreadCounts();
    expect(data.alerts).toBe(3);
    expect(data.total).toBe(7);
  });
  it("markEventsAsRead marks events read", async () => {
    const result = await markEventsAsRead(["EVT-001"]);
    expect(result.updated).toBe(2);
  });
  it("markAllEventsAsRead marks all read", async () => {
    const result = await markAllEventsAsRead();
    expect(result.updated).toBe(5);
  });
});
