import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Battery, Bell, CheckCircle2, ChevronRight,
  Clock, Cross, Download, Droplets, Eye, FileText, Filter, Fingerprint,
  Gauge, Heart, HeartPulse, Info, Layers, Monitor, PackageCheck, Pause, Play,
  Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Stethoscope, Timer, TrendingDown, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard, MiniStat as Vital } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE = {
  Emergent: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  Urgent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Elective: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

const INITIAL_SCHEDULE = [
  { id: "CL-401", room: "Lab 1", procedure: "PCI — LAD stent", patient: "PT-2291 — R. Vance", priority: "Emergent", operator: "Dr. Alvarez", progress: 38, phase: "Lesion crossing", start: "09:10", duration: 95, contrast: 62, fl: false },
  { id: "CL-402", room: "Lab 2", procedure: "Diagnostic cath — 3-vessel", patient: "PT-2283 — G. Park", priority: "Elective", operator: "Dr. Bhatt", progress: 72, phase: "Post-procedure", start: "08:40", duration: 70, contrast: 88, fl: false },
  { id: "CL-403", room: "Lab 3", procedure: "EP ablation — AF", patient: "PT-2304 — I. Khan", priority: "Urgent", operator: "Dr. Lindqvist", progress: 21, phase: "Mapping", start: "09:30", duration: 150, contrast: 18, fl: true },
  { id: "CL-404", room: "Lab 4", procedure: "TAVR — Edwards S3", patient: "PT-2296 — F. Duarte", priority: "Elective", operator: "Dr. Alvarez", progress: 55, phase: "Valve deployment", start: "08:55", duration: 160, contrast: 145, fl: false },
  { id: "CL-405", room: "Lab 5", procedure: "Pacemaker — DDD implant", patient: "PT-2307 — Y. Tanaka", priority: "Elective", operator: "Dr. Bhatt", progress: 8, phase: "Prep & access", start: "10:05", duration: 85, contrast: 6, fl: false },
  { id: "CL-406", room: "Lab 6", procedure: "Balloon pump — IABP insert", patient: "PT-2288 — H. Bose", priority: "Emergent", operator: "Dr. Osei", progress: 64, phase: "IABP positioning", start: "09:05", duration: 45, contrast: 22, fl: false },
];

const INITIAL_DEVICES = [
  { id: "DV-801", patient: "PT-2291 — R. Vance", device: "DES — Resolute Onyx 3.0×18", type: "Stent", implant: "2026-07-02", model: "RO-3018", mriSafe: true, battery: null, followUp: "12m — CCTA", status: "Active" },
  { id: "DV-802", patient: "PT-2283 — G. Park", device: "ICD — Biotronik Ilivia 7", type: "ICD", implant: "2024-11-18", model: "ILIV7-DT", mriSafe: true, battery: 82, followUp: "3m — clinic", status: "Active" },
  { id: "DV-803", patient: "PT-2304 — I. Khan", device: "CRT-D — Medtronic Cobalt", type: "CRT-D", implant: "2023-03-09", model: "CMT-D", mriSafe: false, battery: 64, followUp: "1m — remote", status: "Active" },
  { id: "DV-804", patient: "PT-2296 — F. Duarte", device: "TAVR — Edwards SAPIEN 3 26mm", type: "Valve", implant: "2026-08-16", model: "S3-26", mriSafe: true, battery: null, followUp: "30d — TTE", status: "Active" },
  { id: "DV-805", patient: "PT-2307 — Y. Tanaka", device: "Pacemaker — Abbott Assurity MRI", type: "PM", implant: "2026-08-16", model: "ASS-MRI", mriSafe: true, battery: 100, followUp: "6w — wound check", status: "Implanted today" },
  { id: "DV-806", patient: "PT-2274 — M. Silva", device: "DES — Xience Sierra 2.5×12", type: "Stent", implant: "2025-12-01", model: "XS-2512", mriSafe: true, battery: null, followUp: "12m — stress echo", status: "Active" },
  { id: "DV-807", patient: "PT-2288 — H. Bose", device: "IABP — Maquet CS300", type: "Temporary", implant: "2026-08-16", model: "CS300", mriSafe: false, battery: null, followUp: "48h — removal", status: "In situ" },
  { id: "DV-808", patient: "PT-2301 — T. Nwosu", device: "Watchman FLX 27mm", type: "LAA closure", implant: "2026-05-20", model: "FLX-27", mriSafe: true, battery: null, followUp: "45d — TEE", status: "Active" },
];

const INITIAL_HEMO = [
  { id: "HM-901", caseId: "CL-401", patient: "PT-2291 — R. Vance", hr: 96, sys: 118, dia: 74, map: 89, spo2: 97, lvedp: 18, co: 5.1, phase: "Lesion crossing", alerts: 0, contrast: 62 },
  { id: "HM-902", caseId: "CL-403", patient: "PT-2304 — I. Khan", hr: 82, sys: 124, dia: 78, map: 93, spo2: 99, lvedp: 12, co: 4.8, phase: "Pulmonary vein mapping", alerts: 1, contrast: 18 },
  { id: "HM-903", caseId: "CL-404", patient: "PT-2296 — F. Duarte", hr: 74, sys: 108, dia: 62, map: 77, spo2: 95, lvedp: 22, co: 3.9, phase: "Valve deployment", alerts: 0, contrast: 145 },
  { id: "HM-904", caseId: "CL-406", patient: "PT-2288 — H. Bose", hr: 104, sys: 92, dia: 55, map: 67, spo2: 91, lvedp: 26, co: 3.2, phase: "IABP positioning", alerts: 2, contrast: 22 },
];

const DEVICE_TYPE_META = {
  Stent: { cls: "bg-cyan-500/10 text-cyan-300 border-cyan-500/40" },
  ICD: { cls: "bg-violet-500/10 text-violet-300 border-violet-500/40" },
  "CRT-D": { cls: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/40" },
  Valve: { cls: "bg-amber-500/10 text-amber-300 border-amber-500/40" },
  PM: { cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" },
  Temporary: { cls: "bg-rose-500/10 text-rose-300 border-rose-500/40" },
  "LAA closure": { cls: "bg-sky-500/10 text-sky-300 border-sky-500/40" },
};

const ROOM_COLORS = {
  "Lab 1": "border-rose-500/40",
  "Lab 2": "border-sky-500/40",
  "Lab 3": "border-amber-500/40",
  "Lab 4": "border-emerald-500/40",
  "Lab 5": "border-violet-500/40",
  "Lab 6": "border-cyan-500/40",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapBand(map) {
  if (map < 65) return { label: "Hypotensive", cls: "text-rose-300 bg-rose-500/10 border-rose-500/40" };
  if (map > 105) return { label: "Elevated", cls: "text-amber-300 bg-amber-500/10 border-amber-500/40" };
  return { label: "Stable", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/40" };
}

function priorityBadge(p) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[p] || PRIORITY_BADGE.Elective}`}>{p}</span>;
}

function deviceBadge(type) {
  const m = DEVICE_TYPE_META[type] || DEVICE_TYPE_META.Stent;
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{type}</span>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CardiologyCathLabHub() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [roomFilter, setRoomFilter] = useState("All");
  const [deviceFilter, setDeviceFilter] = useState("All");
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [hemo, setHemo] = useState(INITIAL_HEMO);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  const { toasts, addToast, removeToast } = useKindToasts();
  const speedRef = useRef(1);
  const pausedRef = useRef(false);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  /* ---------------- simulation tick loop ---------------- */
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      const n = Math.max(1, Math.round(speedRef.current));
      for (let s = 0; s < n; s += 1) {
        setTick((t) => t + 1);
        setSchedule((prev) =>
          prev.map((c) => ({
            ...c,
            progress: Math.min(100, c.progress + 1.2),
            phase: c.progress >= 96 ? "Closing & handover" : c.progress >= 60 && c.progress < 70 ? "Post-deployment" : c.phase,
          }))
        );
        setHemo((prev) =>
          prev.map((h) => ({
            ...h,
            hr: clamp(Math.round(h.hr + (Math.random() * 6 - 3)), 55, 150),
            sys: clamp(Math.round(h.sys + (Math.random() * 8 - 4)), 70, 200),
            dia: clamp(Math.round(h.dia + (Math.random() * 5 - 2.5)), 40, 120),
            spo2: clamp(Math.round(h.spo2 + (Math.random() * 2 - 1)), 82, 100),
            map: clamp(Math.round(h.map + (Math.random() * 5 - 2.5)), 50, 130),
            co: +((h.co + (Math.random() * 0.3 - 0.15))).toFixed(1),
          }))
        );
        setDevices((prev) =>
          prev.map((d) => (d.battery != null ? { ...d, battery: Math.max(0, d.battery - 0.02) } : d))
        );
      }
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- periodic events ---------------- */
  useEffect(() => {
    if (tick === 0) return;
    const r = Math.random();
    if (r < 0.13) {
      const rooms = ["Lab 1", "Lab 2", "Lab 3", "Lab 4", "Lab 5", "Lab 6"];
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const pri = Math.random() < 0.3 ? "Emergent" : Math.random() < 0.7 ? "Urgent" : "Elective";
      setSchedule((prev) => [
        {
          id: `CL-${407 + Math.floor(Math.random() * 90)}`,
          room, procedure: "Diagnostic cath",
          patient: `PT-${2310 + Math.floor(Math.random() * 60)} — Referred Patient`,
          priority: pri, operator: Math.random() < 0.5 ? "Dr. Alvarez" : "Dr. Bhatt",
          progress: 0, phase: "Prep & access", start: "10:30", duration: 60, contrast: 0, fl: false,
        },
        ...prev,
      ]);
      addToast(`New case booked in ${room} (${pri})`, "success");
    }
    if (r > 0.8) {
      setHemo((prev) =>
        prev.map((h) => {
          if (h.map < 70 || h.spo2 < 92) {
            return { ...h, alerts: h.alerts + 1 };
          }
          return h;
        })
      );
      const critical = hemo.filter((h) => h.map < 65 || h.spo2 < 90);
      if (critical.length > 0) {
        addToast(`Hemodynamic alert on ${critical[0].caseId} — MAP ${critical[0].map} mmHg`, "error");
      }
    }
    if (r > 0.9) {
      const pts = ["PT-2312 — M. Novak", "PT-2316 — R. Okafor"];
      const p = pts[Math.floor(Math.random() * pts.length)];
      setDevices((prev) => [
        {
          id: `DV-${809 + Math.floor(Math.random() * 90)}`,
          patient: p, device: "DES — Xience Sierra 2.75×18",
          type: "Stent", implant: "2026-08-16", model: "XS-2718",
          mriSafe: true, battery: null, followUp: "12m — stress echo", status: "Active",
        },
        ...prev,
      ]);
      addToast(`New stent implant registered (${p})`, "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  /* ---------------- derived data ---------------- */
  const stats = useMemo(() => {
    const active = schedule.filter((c) => c.progress < 100).length;
    const emergent = schedule.filter((c) => c.priority === "Emergent").length;
    const avgUtil = Math.round(schedule.reduce((a, c) => a + c.progress, 0) / Math.max(1, schedule.length));
    const ciedsLow = devices.filter((d) => d.battery != null && d.battery < 40).length;
    return { active, emergent, avgUtil, ciedsLow };
  }, [schedule, devices]);

  const filteredSchedule = useMemo(() => {
    const q = search.toLowerCase();
    return schedule.filter((c) => {
      if (priorityFilter !== "All" && c.priority !== priorityFilter) return false;
      if (roomFilter !== "All" && c.room !== roomFilter) return false;
      if (q && !`${c.id} ${c.room} ${c.procedure} ${c.patient} ${c.operator} ${c.phase}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schedule, search, priorityFilter, roomFilter]);

  const filteredDevices = useMemo(() => {
    const q = search.toLowerCase();
    return devices.filter((d) => {
      if (deviceFilter !== "All" && d.type !== deviceFilter) return false;
      if (q && !`${d.id} ${d.patient} ${d.device} ${d.model} ${d.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [devices, search, deviceFilter]);

  const filteredHemo = useMemo(() => {
    const q = search.toLowerCase();
    return hemo.filter((h) => {
      if (priorityFilter !== "All" && priorityFilter === "Emergent" && h.map > 70) return false;
      if (q && !`${h.id} ${h.caseId} ${h.patient} ${h.phase}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [hemo, search, priorityFilter]);

  /* ---------------- actions ---------------- */
  const reset = useCallback(() => {
    setSchedule(INITIAL_SCHEDULE);
    setDevices(INITIAL_DEVICES);
    setHemo(INITIAL_HEMO);
    setTick(0);
    setSearch("");
    setPriorityFilter("All");
    setRoomFilter("All");
    setDeviceFilter("All");
    addToast("Simulation reset to baseline", "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "schedule"
      ? [["Case", "Room", "Procedure", "Patient", "Priority", "Operator", "Progress%", "Phase", "Contrast(ml)"]].concat(
          filteredSchedule.map((c) => [c.id, c.room, c.procedure, c.patient, c.priority, c.operator, c.progress, c.phase, c.contrast])
        )
      : activeTab === "devices"
        ? [["Device", "Patient", "Device", "Type", "Implant", "Model", "MRI-safe", "Battery%", "Follow-up", "Status"]].concat(
            filteredDevices.map((d) => [d.id, d.patient, d.device, d.type, d.implant, d.model, d.mriSafe, d.battery ?? "—", d.followUp, d.status])
          )
        : [["Monitor", "Case", "Patient", "HR", "SYS", "DIA", "MAP", "SpO2", "LVEDP", "CO", "Phase"]].concat(
            filteredHemo.map((h) => [h.id, h.caseId, h.patient, h.hr, h.sys, h.dia, h.map, h.spo2, h.lvedp, h.co, h.phase])
          );
    downloadCsv(`cardiology-${activeTab}.csv`, rows, "text/csv;charset=utf-8;");
    addToast("CSV exported", "success");
  }, [activeTab, filteredSchedule, filteredDevices, filteredHemo, addToast]);

  const completeCase = (id) => {
    setSchedule((prev) => prev.map((c) => (c.id === id ? { ...c, progress: 100, phase: "Closed & handover" } : c)));
    addToast(`${id} completed — case closed, room turned over`, "success");
  };

  const checkInDevice = (id) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, status: "Active" } : d)));
    addToast(`${id} checked in — registry updated`, "success");
  };

  const acknowledgeAlert = (id) => {
    setHemo((prev) => prev.map((h) => (h.id === id ? { ...h, alerts: 0 } : h)));
    addToast(`${id} alerts acknowledged by operator`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const tabBtn = (key, label, icon) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        activeTab === key
          ? "bg-slate-800 text-white shadow-lg shadow-slate-950/40 border border-slate-700"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const filterBar = (extra) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cases, devices…"
          className="w-64 rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600"
        />
      </div>
      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value)}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
      >
        {["All", "Emergent", "Urgent", "Elective"].map((s) => <option key={s}>{s}</option>)}
      </select>
      {activeTab === "schedule" && (
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
        >
          {["All", "Lab 1", "Lab 2", "Lab 3", "Lab 4", "Lab 5", "Lab 6"].map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      {extra}
    </div>
  );

  const speedBtn = (v, label) => (
    <button
      onClick={() => setSpeed(v)}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
        speed === v ? "border-slate-600 bg-slate-700 text-white" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  /* ================= SCHEDULE CONSOLE ================= */
  const scheduleConsole = (
    <div className="space-y-6">
      {/* room utilization board */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {["Lab 1", "Lab 2", "Lab 3", "Lab 4", "Lab 5", "Lab 6"].map((room) => {
          const c = schedule.filter((x) => x.room === room)[0];
          const busy = c && c.progress < 100;
          return (
            <div key={room} className={`rounded-xl border p-4 ${busy ? (ROOM_COLORS[room] || "border-slate-700") + " bg-slate-900" : "border-slate-800 bg-slate-900/60"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">{room}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${busy ? "text-rose-300" : "text-emerald-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${busy ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} />
                  {busy ? "In procedure" : "Available"}
                </span>
              </div>
              {busy ? (
                <>
                  <p className="mt-2 truncate text-sm font-semibold text-white">{c.procedure}</p>
                  <p className="truncate text-xs text-slate-500">{c.patient}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${c.progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">{c.progress.toFixed(0)}% · {c.phase}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Open for booking · next slot {`${10 + Math.floor(Math.random() * 3)}:30`}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* schedule table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Cath Lab Schedule</h3>
            <p className="text-xs text-slate-500">{filteredSchedule.length} procedures · fluoroscopy time & contrast tracked per case</p>
          </div>
          {filterBar(null)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Room</th>
                <th className="px-5 py-3">Procedure</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ kind: "case", data: c })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{c.id}</button>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-300">{c.room}</td>
                  <td className="px-5 py-3 text-slate-200">{c.procedure}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{c.patient}</td>
                  <td className="px-5 py-3">{priorityBadge(c.priority)}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{c.operator}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${c.progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{c.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <span className="hidden text-xs text-slate-500 lg:inline">{c.phase}</span>
                      {c.progress < 100 && (
                        <button onClick={() => completeCase(c.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSchedule.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No procedures match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ================= DEVICES CONSOLE ================= */
  const devicesConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Registered devices", value: devices.length, icon: <Award className="h-4 w-4 text-emerald-300" /> },
          { label: "CIEDs with battery <40%", value: stats.ciedsLow, icon: <Battery className="h-4 w-4 text-amber-300" />, alert: stats.ciedsLow > 0 },
          { label: "MRI-conditional", value: devices.filter((d) => d.mriSafe).length, icon: <Monitor className="h-4 w-4 text-sky-300" /> },
          { label: "Non-MRI-conditional", value: devices.filter((d) => !d.mriSafe).length, icon: <ShieldAlert className="h-4 w-4 text-rose-300" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.alert ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={`mt-2 text-2xl font-bold ${s.alert ? "text-amber-300" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Device & Implant Registry</h3>
            <p className="text-xs text-slate-500">UDI-linked implantables · CIED remote monitoring · MRI-conditional status</p>
          </div>
          {filterBar(
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
            >
              {["All", "Stent", "ICD", "CRT-D", "Valve", "PM", "Temporary", "LAA closure"].map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Device</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Implant</th>
                <th className="px-5 py-3">Battery</th>
                <th className="px-5 py-3">MRI</th>
                <th className="px-5 py-3">Follow-up</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((d) => (
                <tr key={d.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ kind: "device", data: d })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{d.id}</button>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-300">{d.patient}</td>
                  <td className="px-5 py-3 text-slate-200">{d.device}</td>
                  <td className="px-5 py-3">{deviceBadge(d.type)}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{d.implant}</td>
                  <td className="px-5 py-3">
                    {d.battery != null ? (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${d.battery < 40 ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                        {d.battery.toFixed(0)}%
                      </span>
                    ) : <span className="text-xs text-slate-500">n/a</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${d.mriSafe ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                      {d.mriSafe ? "Conditional" : "Unsafe"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">{d.followUp}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${d.status === "Active" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : d.status === "Implanted today" ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                      {d.status}
                    </span>
                    {d.status !== "Active" && (
                      <button onClick={() => checkInDevice(d.id)} className="ml-2 rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800">
                        Check in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">No devices match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ================= HEMO CONSOLE ================= */
  const hemoConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Live monitors", value: hemo.length, icon: <Monitor className="h-4 w-4 text-emerald-300" /> },
          { label: "Hypotensive (MAP<65)", value: hemo.filter((h) => h.map < 65).length, icon: <TrendingDown className="h-4 w-4 text-rose-300" />, alert: true },
          { label: "Desaturation (SpO₂<92)", value: hemo.filter((h) => h.spo2 < 92).length, icon: <Activity className="h-4 w-4 text-amber-300" />, alert: true },
          { label: "Unacknowledged alerts", value: hemo.reduce((a, h) => a + h.alerts, 0), icon: <Bell className="h-4 w-4 text-amber-300" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.alert ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800 bg-slate-900"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={`mt-2 text-2xl font-bold ${s.alert ? "text-rose-300" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Live Hemodynamic Telemetry</h3>
            <p className="text-xs text-slate-500">Aortic pressure · LVEDP · cardiac output · per-case contrast & fluoroscopy</p>
          </div>
          {filterBar(null)}
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {filteredHemo.map((h) => {
            const band = mapBand(h.map);
            return (
              <div key={h.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <button onClick={() => setModal({ kind: "hemo", data: h })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{h.caseId}</button>
                    <p className="mt-0.5 text-sm font-medium text-slate-200">{h.patient}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${band.cls}`}>{band.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{h.phase}</p>
                <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                  <Vital label="HR" value={h.hr} sub="bpm" />
                  <Vital label="SYS" value={h.sys} sub="mmHg" />
                  <Vital label="DIA" value={h.dia} sub="mmHg" />
                  <Vital label="MAP" value={h.map} sub="mmHg" alert={h.map < 65} />
                  <Vital label="SpO₂" value={h.spo2} sub="%" alert={h.spo2 < 92} />
                  <Vital label="CO" value={h.co.toFixed(1)} sub="L/min" />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>LVEDP <span className="font-semibold text-slate-300">{h.lvedp} mmHg</span></span>
                  <span>Contrast <span className="font-semibold text-slate-300">{h.contrast} ml</span></span>
                  {h.alerts > 0 && (
                    <button onClick={() => acknowledgeAlert(h.id)} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20">
                      Ack {h.alerts} alert{h.alerts > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredHemo.length === 0 && (
            <div className="col-span-2 rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No live monitors match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );

  /* ================= MODAL ================= */
  const renderModal = () => {
    if (!modal) return null;
    const { kind, data } = modal;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setModal(null)}>
        <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {kind === "case" ? `Case ${data.id}` : kind === "device" ? `Device ${data.id}` : `Monitor ${data.id}`}
            </h3>
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {kind === "case" && (
            <div className="space-y-3 text-sm">
              <Row label="Room" value={data.room} />
              <Row label="Procedure" value={data.procedure} />
              <Row label="Patient" value={data.patient} />
              <Row label="Priority" value={data.priority} />
              <Row label="Operator" value={data.operator} />
              <Row label="Progress" value={`${data.progress.toFixed(0)}%`} />
              <Row label="Phase" value={data.phase} />
              <Row label="Start" value={data.start} />
              <Row label="Duration" value={`${data.duration} min planned`} />
              <Row label="Contrast" value={`${data.contrast} ml`} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.fl
                  ? "Fluoroscopy on — radiation dose monitored; operator badge dose logged per ACC guidance."
                  : "Standard imaging protocol; contrast volume tracked against AKI-risk thresholds."}
              </p>
            </div>
          )}
          {kind === "device" && (
            <div className="space-y-3 text-sm">
              <Row label="Patient" value={data.patient} />
              <Row label="Device" value={data.device} />
              <Row label="Type" value={data.type} />
              <Row label="Implant date" value={data.implant} />
              <Row label="Model" value={data.model} />
              <Row label="MRI safety" value={data.mriSafe ? "Conditional" : "Not MRI-conditional"} />
              <Row label="Battery" value={data.battery != null ? `${data.battery.toFixed(1)}%` : "n/a"} />
              <Row label="Follow-up" value={data.followUp} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.battery != null && data.battery < 40
                  ? "CIED battery reaching elective-replacement indicator — schedule device clinic within 30 days."
                  : "UDI registry entry verified; implant card issued to patient per ACC/AHA HRS guidance."}
              </p>
            </div>
          )}
          {kind === "hemo" && (
            <div className="space-y-3 text-sm">
              <Row label="Case" value={data.caseId} />
              <Row label="Patient" value={data.patient} />
              <Row label="HR" value={`${data.hr} bpm`} />
              <Row label="BP" value={`${data.sys}/${data.dia} mmHg`} />
              <Row label="MAP" value={`${data.map} mmHg`} />
              <Row label="SpO₂" value={`${data.spo2}%`} />
              <Row label="LVEDP" value={`${data.lvedp} mmHg`} />
              <Row label="Cardiac output" value={`${data.co.toFixed(1)} L/min`} />
              <Row label="Phase" value={data.phase} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.map < 65
                  ? "Hypotension protocol armed — fluids and vasopressor ready; operator notified. IABP timing reviewed."
                  : "Hemodynamics within procedural limits; invasive pressures trended every heartbeat."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <HeartPulse className="h-6 w-6 text-rose-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Cardiology & Cath Lab</h1>
                <p className="text-sm text-slate-400">ACC/AHA cath lab standards · UDI implant registry · invasive hemodynamics · fluoroscopy dose tracking</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                paused ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
              {[[1, "1×"], [2, "2×"], [4, "4×"]].map(([v, label]) => speedBtn(v, label))}
            </div>
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {/* stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Active procedures" value={stats.active} icon={<Stethoscope className="h-4 w-4 text-emerald-300" />} />
          <StatCard label="Emergent lanes" value={stats.emergent} icon={<Siren className="h-4 w-4 text-rose-300" />} />
          <StatCard label="Avg room utilization" value={`${stats.avgUtil}%`} icon={<Gauge className="h-4 w-4 text-sky-300" />} />
          <StatCard label="CIED battery <40%" value={stats.ciedsLow} icon={<Battery className="h-4 w-4 text-amber-300" />} alert={stats.ciedsLow > 0} />
          <StatCard label="Registered devices" value={devices.length} icon={<Award className="h-4 w-4 text-violet-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabBtn("schedule", "Cath Lab Schedule", <Stethoscope className="h-4 w-4" />)}
          {tabBtn("devices", "Device & Implant Registry", <Award className="h-4 w-4" />)}
          {tabBtn("hemo", "Hemodynamic Telemetry", <HeartPulse className="h-4 w-4" />)}
        </div>

        {/* active console */}
        {activeTab === "schedule" && scheduleConsole}
        {activeTab === "devices" && devicesConsole}
        {activeTab === "hemo" && hemoConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">ACC/AHA · SCAI · UDI (FDA) · NCDR CathPCI registry alignment</span>
          <button onClick={() => addToast("NCDR CathPCI registry export queued", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
            <FileText className="h-3.5 w-3.5" /> Export registry
          </button>
        </div>
      </div>

      {/* modal */}
      {renderModal()}

      {/* toasts */}
      <KindToastTray toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */


