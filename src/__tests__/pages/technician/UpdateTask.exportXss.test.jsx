import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/renderWithProviders";
import UpdateTask from "../../../pages/technician/UpdateTask";

const mockGetTaskById = vi.fn();
const mockUpdateTask = vi.fn();
const mockGetAllSpareParts = vi.fn();

vi.mock("../../../services/MaintenanceService", () => ({
  getTaskById: (...args) => mockGetTaskById(...args),
  updateTask: (...args) => mockUpdateTask(...args),
}));

vi.mock("../../../services/SparePartService", () => ({
  getAllSpareParts: (...args) => mockGetAllSpareParts(...args),
}));

const maliciousTask = {
  id: "T-XSS-1",
  equipment: `<img src=x onerror="alert('eq')">`,
  hospital: `City Hospital <script>alert(1)</script>`,
  priority: `High "onmouseover=alert(2)"`,
  description: `<script>alert("DESC-PWNED")</script>`,
  notes: `<script>alert("NOTES-PWNED")</script>`,
  partsUsed: `<svg onload=alert(3)>, "</span><script>alert(4)</script>`,
  status: "Completed",
  hoursWorked: 2,
  signature: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' onload=alert(5)>`,
};

const maliciousPayloads = [
  `<script>alert("DESC-PWNED")</script>`,
  `<script>alert("NOTES-PWNED")</script>`,
  `City Hospital <script>alert(1)</script>`,
  `High "onmouseover=alert(2)"`,
  `<script>alert(4)</script>`,
  `onload=alert(5)`,
];

function setupFakePrintWindow() {
  const writtenCalls = [];
  const fakePrintWindow = {
    document: {
      open: vi.fn(),
      write: vi.fn((html) => writtenCalls.push(html)),
      close: vi.fn(),
    },
  };
  const openSpy = vi.spyOn(window, "open").mockReturnValue(fakePrintWindow);
  return { fakePrintWindow, writtenCalls, openSpy };
}

beforeEach(() => {
  sessionStorage.clear();
  mockGetTaskById.mockReset();
  mockUpdateTask.mockReset();
  mockGetAllSpareParts.mockReset();
  mockGetAllSpareParts.mockResolvedValue([]);
  vi.restoreAllMocks();
});

describe("UpdateTask :: export PDF reflective XSS protection (#1482)", () => {
  it("escapes every user-controlled field before document.write", async () => {
    mockGetTaskById.mockResolvedValue(maliciousTask);
    const { fakePrintWindow, writtenCalls, openSpy } = setupFakePrintWindow();

    renderWithProviders(
      <UpdateTask onNavigate={() => {}} task={maliciousTask} />,
      { authValue: { user: { id: "tech-1", role: "technician", name: "Tech" } } },
    );

    await waitFor(() => {
      expect(screen.getByText(/Export to PDF/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Export to PDF/));

    expect(openSpy).toHaveBeenCalledWith("", "_blank", "width=850,height=950");
    expect(fakePrintWindow.document.write).toHaveBeenCalledTimes(1);
    expect(fakePrintWindow.document.close).toHaveBeenCalledTimes(1);

    const writtenHtml = writtenCalls[0];

    for (const payload of maliciousPayloads) {
      expect(writtenHtml).not.toContain(payload);
    }

    expect(writtenHtml).toContain("&lt;script&gt;alert(&quot;DESC-PWNED&quot;)&lt;/script&gt;");
    expect(writtenHtml).toContain("&lt;script&gt;alert(&quot;NOTES-PWNED&quot;)&lt;/script&gt;");
    expect(writtenHtml).toContain("City Hospital &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(writtenHtml).toContain("&lt;img src=x onerror=&quot;alert(&#39;eq&#39;)&quot;&gt;");
    expect(writtenHtml).toContain("&lt;svg onload=alert(3)&gt;");
    expect(writtenHtml).not.toContain("<svg onload=alert(3)>");
  });

  it("escapes notes typed into the form before they reach the print window", async () => {
    mockGetTaskById.mockResolvedValue({
      ...maliciousTask,
      notes: "original note",
    });

    const { writtenCalls } = setupFakePrintWindow();

    renderWithProviders(
      <UpdateTask onNavigate={() => {}} task={{ ...maliciousTask, notes: "original note" }} />,
      { authValue: { user: { id: "tech-1", role: "technician", name: "Tech" } } },
    );

    await waitFor(() => {
      expect(screen.getByText(/Export to PDF/)).toBeInTheDocument();
    });

    const notesField = screen.getByPlaceholderText("Add repair notes...");
    fireEvent.change(notesField, {
      target: { value: `<script>alert("FORM-NOTES-PWNED")</script><img src=x onerror=alert(6)>` },
    });

    fireEvent.click(screen.getByText(/Export to PDF/));

    const writtenHtml = writtenCalls[0];
    expect(writtenHtml).not.toContain(`<script>alert("FORM-NOTES-PWNED")</script>`);
    expect(writtenHtml).not.toContain(`<img src=x onerror=alert(6)>`);
    expect(writtenHtml).toContain("&lt;script&gt;alert(&quot;FORM-NOTES-PWNED&quot;)&lt;/script&gt;");
    expect(writtenHtml).toContain("&lt;img src=x onerror=alert(6)&gt;");
  });

  it("still embeds a legitimate PNG signature", async () => {
    // The guard has to reject the SVG without also breaking the feature. This is the exact shape
    // canvas.toDataURL("image/png") produces, which is every signature the app captures itself.
    const pngSignature =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
      "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const task = { ...maliciousTask, signature: pngSignature };
    mockGetTaskById.mockResolvedValue(task);
    const { writtenCalls } = setupFakePrintWindow();

    renderWithProviders(<UpdateTask onNavigate={() => {}} task={task} />, {
      authValue: { user: { id: "tech-1", role: "technician", name: "Tech" } },
    });

    await waitFor(() => {
      expect(screen.getByText(/Export to PDF/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Export to PDF/));

    const writtenHtml = writtenCalls[0];
    expect(writtenHtml).toContain(`<img src="${pngSignature}"`);
    expect(writtenHtml).not.toContain("Signature not rendered");
  });

  it("prints a reason in place of a rejected signature rather than failing the export", async () => {
    mockGetTaskById.mockResolvedValue(maliciousTask);
    const { writtenCalls } = setupFakePrintWindow();

    renderWithProviders(<UpdateTask onNavigate={() => {}} task={maliciousTask} />, {
      authValue: { user: { id: "tech-1", role: "technician", name: "Tech" } },
    });

    await waitFor(() => {
      expect(screen.getByText(/Export to PDF/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Export to PDF/));

    const writtenHtml = writtenCalls[0];
    // The rest of the report is what the engineer came for; a missing sign-off is recorded, not
    // a reason to produce nothing.
    expect(writtenHtml).toContain("Signature not rendered");
    expect(writtenHtml).toContain("Technician Maintenance Notes");
    expect(writtenHtml).not.toContain("<img src=\"data:image/svg+xml");
  });

  it("keeps the report's own safe script block intact while neutralizing payloads", async () => {
    mockGetTaskById.mockResolvedValue(maliciousTask);
    const { writtenCalls } = setupFakePrintWindow();

    renderWithProviders(
      <UpdateTask onNavigate={() => {}} task={maliciousTask} />,
      { authValue: { user: { id: "tech-1", role: "technician", name: "Tech" } } },
    );

    await waitFor(() => {
      expect(screen.getByText(/Export to PDF/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Export to PDF/));

    const writtenHtml = writtenCalls[0];
    expect(writtenHtml).toContain("window.print()");
    expect(writtenHtml.split("<script>").length).toBe(2);
  });
});