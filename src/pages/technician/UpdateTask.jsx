import { useState, useEffect, useRef } from "react";
import { updateTask, getTaskById } from "../../services/MaintenanceService";
import { getAllSpareParts } from "../../services/SparePartService";
import { useAuth } from "../../context/AuthContext";
import { escapeHtml } from "../../utils/escapeHtml";
import { safeImageSrc, describeUnsafeImageSrc } from "../../utils/safeImageSrc";

export default function UpdateTask({ onNavigate, task: initialTask }) {
  const { user } = useAuth();

  // The route is parameterised (`update-task/:id`), so a deep link arrives as a bare id string,
  // while older in-app navigation passed the whole task object. Both resolve to the same id, and
  // the full record is always fetched from the backend.
  const initialTaskId = typeof initialTask === "string" ? initialTask : initialTask?.id;
  const hasInitialObject = !!initialTask && typeof initialTask === "object";

  const [task, setTask] = useState(hasInitialObject ? initialTask : null);
  const [taskIdInput, setTaskIdInput] = useState(initialTaskId || "");
  const [searchId, setSearchId] = useState(initialTaskId || "");
  const [loading, setLoading] = useState(Boolean(initialTaskId));
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    status: initialTask?.status || "In Progress",
    notes: initialTask?.notes || "",
    parts: initialTask?.partsUsed ? initialTask.partsUsed.split(", ") : [],
    hours: initialTask?.hoursWorked || "",
    image: null,
    recurrencePeriodDays: initialTask?.recurrencePeriodDays || "0",
  });

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [part, setPart] = useState("");
  const [preview, setPreview] = useState(null);

  const isTechnician = user?.role?.toLowerCase() === "technician";
  const [availableParts, setAvailableParts] = useState([]);

  useEffect(() => {
    getAllSpareParts()
      .then((data) => setAvailableParts(data))
      .catch((err) => console.error("Error fetching parts catalog:", err));
  }, []);

  useEffect(() => {
    if (initialTaskId) {
      fetchTaskDetails(initialTaskId);
    }
  }, [initialTaskId]);

  useEffect(() => {
    if (task) {
      setForm({
        status: task.status || "In Progress",
        notes: task.notes || "",
        parts: task.partsUsed ? task.partsUsed.split(", ") : [],
        hours: task.hoursWorked || "",
        image: null,
        recurrencePeriodDays: task.recurrencePeriodDays || "0",
      });
      setTaskIdInput(task.id || "");
    }
  }, [task]);

  const fetchTaskDetails = async (id) => {
    try {
      setLoading(true);
      setError(null);
      setDone(false);

      const data = await getTaskById(id);
      setTask(data);
    } catch (err) {
      console.error("Error fetching task:", err);
      setError(
        err.response?.data?.message || `Maintenance task not found with id: ${id}`
      );
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();

    if (taskIdInput.trim()) {
      const id = taskIdInput.trim();
      setSearchId(id);
      fetchTaskDetails(id);
    }
  };

  const addPart = () => {
    if (!part.trim()) return;

    setForm((prev) => ({
      ...prev,
      parts: [...prev.parts, part.trim()],
    }));

    setPart("");
  };

  const removePart = (index) => {
    setForm((prev) => ({
      ...prev,
      parts: prev.parts.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const upload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setForm((prev) => ({
      ...prev,
      image: file,
    }));

    setPreview(URL.createObjectURL(file));
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0f172a"; // slate-900 line color
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleExportPdf = () => {
    if (!task) return;

    let signatureImgHtml = "";
    const canvas = canvasRef.current;
    let sigSrc = task.signature;
    if (!sigSrc && canvas) {
      const ctx = canvas.getContext("2d");
      const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      if (buffer.some(color => color !== 0)) {
        sigSrc = canvas.toDataURL("image/png");
      }
    }

    // escapeHtml is not enough for a URL in an attribute: the parser entity-decodes the value
    // before the image loader sees it, so an escaped `data:image/svg+xml,<svg onload=...>` is
    // still a live SVG document, and this print window is same-origin with the app. The scheme
    // and media type are what decide, so the URL goes through the allowlist first.
    const safeSig = safeImageSrc(sigSrc);

    if (safeSig) {
      signatureImgHtml = `<div style="margin-top: 20px;">
        <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Technician Digital Signature Sign-Off</p>
        <img src="${escapeHtml(safeSig)}" style="max-width: 220px; max-height: 80px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; background: #ffffff;" alt="Signature" />
      </div>`;
    } else if (sigSrc) {
      // Omitting the image must not fail the export - the rest of the report is what the
      // biomedical engineer came for, and the missing sign-off is itself worth recording.
      signatureImgHtml = `<div style="margin-top: 20px;">
        <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Technician Digital Signature Sign-Off</p>
        <p style="font-size: 12px; color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 10px; margin: 0;">Signature not rendered - ${escapeHtml(describeUnsafeImageSrc(sigSrc))}.</p>
      </div>`;
    }

    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    const hoursLabel = form.hours
      ? `${form.hours} Hours`
      : task.hoursWorked
        ? `${task.hoursWorked} Hours`
        : "N/A";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Maintenance_Report_${escapeHtml(task.id || "Document")}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #ffffff; }
          .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo { font-size: 24px; font-weight: 900; color: #2563eb; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
          .report-meta { text-align: right; font-size: 12px; color: #475569; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
          .box-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
          .val { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; background: #dbeafe; color: #1e40af; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
          .parts-list { display: flex; flex-wrap: wrap; gap: 8px; }
          .part-tag { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
          .notes { background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">MEDTRACK GLOBAL</div>
            <div class="subtitle">Technician Maintenance & Compliance Inspection Log</div>
          </div>
          <div class="report-meta">
            <div><strong>Report ID:</strong> RPT-${escapeHtml(task.id || "000")}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Target Asset / Equipment</div>
            <p class="val">${escapeHtml(task.equipment || task.equipmentName || "N/A")}</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Task ID: ${escapeHtml(task.id)}</p>
          </div>
          <div class="box">
            <div class="box-title">Hospital / Facility</div>
            <p class="val">${escapeHtml(task.hospital || "N/A")}</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Priority: ${escapeHtml(task.priority || "Normal")}</p>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Current Status</div>
            <span class="badge">${escapeHtml(form.status || task.status || "In Progress")}</span>
          </div>
          <div class="box">
            <div class="box-title">Invested Labor Time</div>
            <p class="val">${escapeHtml(hoursLabel)}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Original Maintenance Description</div>
          <p style="font-size: 13px; color: #475569; font-style: italic; margin: 0;">${escapeHtml(task.description || "No description provided.")}</p>
        </div>

        <div class="section">
          <div class="section-title">Technician Maintenance Notes</div>
          <div class="notes">${escapeHtml(form.notes || task.notes || "No maintenance notes recorded.")}</div>
        </div>

        <div class="section">
          <div class="section-title">Replacement Parts Installed</div>
          ${
            form.parts && form.parts.length > 0
              ? `<div class="parts-list">${form.parts.map(p => `<span class="part-tag">${escapeHtml(p)}</span>`).join("")}</div>`
              : `<p style="font-size: 12px; color: #64748b; font-style: italic;">No parts required for this maintenance task.</p>`
          }
        </div>

        ${signatureImgHtml}

        <div class="footer">
          Confidential Clinical Equipment Record &bull; Generated by MedTrack Technician Portal &bull; ISO 13485 Compliant Audit Trail
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isTechnician || !task?.id) return;

    try {
      setSyncing(true);
      setError(null);

      let signatureData = null;
      if (form.status === "Completed") {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
          const isBlank = !buffer.some(color => color !== 0);
          if (isBlank) {
            setError("Technician signature is required to complete this task.");
            setSyncing(false);
            return;
          }
          signatureData = canvas.toDataURL("image/png");
        }
      }

      const payload = {
        status: form.status,
        notes: form.notes,
        partsUsed: form.parts.join(", "),
        hoursWorked: form.hours ? parseFloat(form.hours) : null,
        signature: signatureData,
        recurrencePeriodDays: parseInt(form.recurrencePeriodDays, 10) || 0,
      };

      await updateTask(task.id, payload);

      setDone(true);

      setTimeout(() => {
        onNavigate("tasks");
      }, 2000);
    } catch (err) {
      console.error("Error updating task:", err);
      setError("Failed to submit update. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => onNavigate("tasks")}
          className="mb-6 text-slate-400 hover:text-white font-bold transition-colors"
        >
          ← Back to Assignments
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6">
          <h1 className="text-3xl font-black mb-2">Maintenance Report</h1>
          <p className="text-slate-400 mb-6">
            Search and update assigned maintenance task records.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={taskIdInput}
              onChange={(e) => setTaskIdInput(e.target.value)}
              placeholder="Enter task ID"
              className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
            />

            <button
              type="submit"
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all"
            >
              Search
            </button>
          </form>
        </div>

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center">
            <p className="text-slate-300 font-bold">Querying task registry...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-950/40 border border-red-800 rounded-3xl p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-black mb-2">Task Record Not Found</h2>
            <p className="text-red-300 font-semibold">{error}</p>
          </div>
        )}

        {task && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-2 bg-card text-slate-900 rounded-3xl p-8 space-y-6"
            >
              {done ? (
                <div className="p-6 bg-emerald-50 text-emerald-700 rounded-2xl font-bold">
                  Update complete. Your report has been synced to the database.
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-bold">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Current Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      disabled={!isTechnician}
                      className="w-full p-4 bg-slate-50 border rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Needs Part">Needs Part</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                   <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Time Invested Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.hours}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          hours: e.target.value,
                        }))
                      }
                      disabled={!isTechnician}
                      className="w-full p-4 bg-slate-50 border rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Preventive Maintenance Recurrence
                    </label>
                    <select
                      value={form.recurrencePeriodDays}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          recurrencePeriodDays: e.target.value,
                        }))
                      }
                      disabled={!isTechnician}
                      className="w-full p-4 bg-slate-50 border rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                    >
                      <option value="0">One-Time (No Recurrence)</option>
                      <option value="30">Every 30 Days (Monthly)</option>
                      <option value="90">Every 90 Days (Quarterly)</option>
                      <option value="180">Every 180 Days (Bi-Annual)</option>
                      <option value="365">Every 365 Days (Annual)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Maintenance Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      disabled={!isTechnician}
                      rows="5"
                      placeholder="Add repair notes..."
                      className="w-full p-4 bg-slate-50 border rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                      Replacement Parts
                    </label>

                    <div className="flex gap-2">
                      <select
                        value={part}
                        onChange={(e) => setPart(e.target.value)}
                        disabled={!isTechnician || task?.status === "COMPLETED"}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                      >
                        <option value="">-- Select a part from catalog --</option>
                        {availableParts.map(p => (
                          <option key={p.id} value={p.partNumber} disabled={p.stockLevel <= 0}>
                            {p.partNumber} - {p.description} (Stock: {p.stockLevel})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addPart}
                        disabled={!isTechnician || task?.status === "COMPLETED" || !part}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.parts.map((partName, index) => (
                        <span
                          key={`${partName}-${index}`}
                          className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2"
                        >
                          {partName}

                          {isTechnician && (
                            <button
                              type="button"
                              onClick={() => removePart(index)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {form.status === "Completed" && (
                    <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500">
                          Technician Signature Sign-Off (Required)
                        </label>
                        <button
                          type="button"
                          onClick={clearSignature}
                          className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold border-none rounded-md cursor-pointer transition-colors"
                        >
                          Clear Pad
                        </button>
                      </div>
                      <canvas
                        ref={canvasRef}
                        width={500}
                        height={140}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full bg-white border border-slate-300 rounded-xl cursor-crosshair shadow-inner"
                      />
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Sign inside the box using mouse pointer or touch screen.
                      </span>
                    </div>
                  )}

                  {isTechnician ? (
                    <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                      <button
                        type="submit"
                        disabled={syncing}
                        className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all text-lg disabled:opacity-50"
                      >
                        {syncing ? "Syncing..." : "Publish Report"}
                      </button>

                      <label className="flex items-center gap-3 text-slate-500 hover:text-slate-800 cursor-pointer font-bold">
                        Attach Photo
                        <input
                          type="file"
                          className="hidden"
                          onChange={upload}
                          accept="image/*"
                        />
                      </label>

                      {preview && (
                        <img
                          src={preview}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-blue-200"
                          alt="Preview"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl text-sm font-bold border border-amber-200">
                      ⚠️ You are in read-only mode. Only technicians are
                      authorized to publish reports.
                    </div>
                  )}
                </>
              )}
            </form>

            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8">
              <h2 className="text-xl font-black mb-6">System Context</h2>

              <div className="space-y-5">
                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Task ID
                  </span>
                  <p className="font-bold">{task.id}</p>
                </div>

                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Target Asset
                  </span>
                  <p className="font-bold">
                    {task.equipment || task.equipmentName || "N/A"}
                  </p>
                </div>

                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Facility
                  </span>
                  <p className="font-bold text-slate-300">
                    {task.hospital || "N/A"}
                  </p>
                </div>

                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Priority
                  </span>
                  <p className="font-bold text-slate-300">
                    {task.priority || "Normal"}
                  </p>
                </div>

                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Original Issue
                  </span>
                  <p className="text-sm text-slate-400 italic font-medium leading-relaxed">
                    {task.description || "No description provided."}
                  </p>
                </div>

                {task.signature && (
                  <div>
                    <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                      Technician Signature Sign-off
                    </span>
                    {safeImageSrc(task.signature) ? (
                      <img
                        src={safeImageSrc(task.signature)}
                        alt="Technician Signature"
                        className="w-full max-w-[200px] h-auto object-contain bg-white border border-slate-700 p-2 rounded-xl mt-1"
                      />
                    ) : (
                      // Same guard as the export. React escapes text but not a src attribute, so
                      // this binding was the second way the same value reached an image loader.
                      <p className="mt-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                        Signature not shown - {describeUnsafeImageSrc(task.signature)}.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    <span>📄</span> Export to PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!task && !loading && !error && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center">
            <p className="text-slate-400 font-bold">
              Search for a maintenance task ID to update its report.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}