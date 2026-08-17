import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Battery, Bed, Bell, Bluetooth, CheckCircle2, ChevronRight, Clock,
  Cpu, Download, Droplets, FileText, Filter, Gauge, HeartPulse, Info, Layers,
  Lock, Pause, Phone, Play, Power, RefreshCw, Search, ShieldCheck, Signal,
  Siren, Syringe, Timer, User, Users, Wifi, Wind, Workflow, Wrench, X, Zap
} from "lucide-react";
import { clamp, round1, fmtNumber, seededSeries as series } from "../../utils/series";
import PlaybackControls from "../../components/common/PlaybackControls";
import { ExportButton } from "../../components/common/ExportButton";
import LiveStatus from "../../components/common/LiveStatus";
import ToastStack, { useToasts } from "../../components/common/ToastStack";
// Shared primitives this console renders. The extraction into src/components/common removed the
// page-local definitions; these imports replace them. Without them each name is a free variable and
// the first render throws, which is what the console did before this line existed.
import { csvEscape, downloadCsv } from "../../utils/export";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { SeverityChips } from "../../components/common/SeverityChips";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Real-Time Telemetry & ICU Monitoring Hub
 *  ------------------------------------------------------------------
 *  Three live consoles for the intensive-care floor:
 *    1. Vitals Stream       - real-time multi-parameter bed grid with
 *                             waveform sparklines and acuity flags.
 *    2. IoT Device Mesh     - the connected device fleet: monitors,
 *                             ventilators and pumps with battery, signal,
 *                             firmware compliance and heartbeat state.
 *    3. Alert Escalation    - rules-driven escalation ladder (L1 charge
 *                             nurse -> L2 intensivist -> L3 rapid
 *                             response) with acknowledgement workflow.
 *
 *  The whole floor is simulated client-side on a tick loop: vitals drift,
 *  batteries drain, heartbeats drop, alerts spawn and age up the ladder.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const DEVICE_STATUS_META = {
  online: { label: "Online", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  degraded: { label: "Degraded", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  offline: { label: "Offline", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const DEVICE_TYPE_META = {
  "Patient Monitor": { icon: HeartPulse, tone: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  Ventilator: { icon: Wind, tone: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  "Infusion Pump": { icon: Droplets, tone: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  "Syringe Pump": { icon: Syringe, tone: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  "ECG Telemetry": { icon: Activity, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  "Pulse Oximeter": { icon: Gauge, tone: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
};

const TABS = [
  { key: "vitals", label: "Vitals Stream", icon: Activity, blurb: "Live multi-parameter bed grid with waveform trends" },
  { key: "devices", label: "IoT Device Mesh", icon: Cpu, blurb: "Connected fleet telemetry, firmware & heartbeat state" },
  { key: "alerts", label: "Alert Escalation", icon: Siren, blurb: "Rules-driven ladder, on-call rotation & acknowledgement" },
];

const ESCALATION_RULES = [
  { level: 1, label: "L1 · Charge Nurse", role: "Charge Nurse", windowMin: 0, channel: "Pager + Voice", action: "First responder; verify vitals and assess" },
  { level: 2, label: "L2 · Intensivist", role: "On-call Intensivist", windowMin: 5, channel: "Page + Mobile App", action: "Remote review; orders entered if required" },
  { level: 3, label: "L3 · Rapid Response", role: "Rapid Response Team", windowMin: 10, channel: "Code Pager + SMS", action: "Bedside team mobilised; escalation to ICU chief" },
];

const ON_CALL = [
  { id: "OC-01", name: "Dr. Priya Raghavan", role: "Intensivist", shift: "Day · 07:00–19:00", channel: "Pager 441 · Mobile App", status: "Available" },
  { id: "OC-02", name: "Nurse James Okafor", role: "Charge Nurse", shift: "Day · 07:00–19:00", channel: "Pager 208", status: "Available" },
  { id: "OC-03", name: "Dr. Elena Sorokin", role: "Intensivist", shift: "Night · 19:00–07:00", channel: "Pager 552 · Mobile App", status: "Handover due" },
  { id: "OC-04", name: "Rapid Response Team", role: "Code Team", shift: "24/7", channel: "Code Pager 911", status: "Standby" },
];

const BEDS = [
  { id: "BED-101", name: "Sofia Marchetti", mrn: "MRN-229634", room: "ICU West · Bed 02", acuity: "critical", dx: "ARDS on invasive ventilation", admittedAgoMin: 322, ventilator: true, isolation: true, vitals: { hr: 124, rr: 31, spo2: 88, sbp: 88, dbp: 54, temp: 38.6, etco2: 44, glucose: 189 } },
  { id: "BED-102", name: "Robert Callahan", mrn: "MRN-335802", room: "ICU West · Bed 07", acuity: "critical", dx: "Septic shock, urinary source", admittedAgoMin: 194, ventilator: true, isolation: false, vitals: { hr: 118, rr: 26, spo2: 91, sbp: 92, dbp: 58, temp: 38.9, etco2: 38, glucose: 168 } },
  { id: "BED-103", name: "Amara Nwosu", mrn: "MRN-441927", room: "ICU East · Bed 12", acuity: "high", dx: "Large vessel occlusion stroke", admittedAgoMin: 66, ventilator: false, isolation: false, vitals: { hr: 104, rr: 22, spo2: 96, sbp: 176, dbp: 98, temp: 37.1, etco2: 33, glucose: 142 } },
  { id: "BED-104", name: "Derek Osei", mrn: "MRN-664509", room: "Surgical 3 · Bed 04", acuity: "high", dx: "Diverticulitis w/ contained perforation", admittedAgoMin: 118, ventilator: false, isolation: false, vitals: { hr: 96, rr: 18, spo2: 97, sbp: 118, dbp: 74, temp: 38.2, etco2: 31, glucose: 121 } },
  { id: "BED-105", name: "Fatima Zahra", mrn: "MRN-775316", room: "Cardiology 2 · Bed 09", acuity: "high", dx: "Acute segmental pulmonary embolism", admittedAgoMin: 48, ventilator: false, isolation: false, vitals: { hr: 112, rr: 24, spo2: 92, sbp: 106, dbp: 66, temp: 36.9, etco2: 35, glucose: 108 } },
  { id: "BED-106", name: "Eleanor Vance", mrn: "MRN-884120", room: "Respiratory 1 · Bed 15", acuity: "medium", dx: "Community-acquired pneumonia", admittedAgoMin: 96, ventilator: false, isolation: true, vitals: { hr: 102, rr: 22, spo2: 93, sbp: 124, dbp: 78, temp: 38.1, etco2: 34, glucose: 156 } },
  { id: "BED-107", name: "Marcus Bell", mrn: "MRN-770218", room: "Neurology 1 · Bed 11", acuity: "medium", dx: "TIA workup — rule out stroke", admittedAgoMin: 24, ventilator: false, isolation: false, vitals: { hr: 78, rr: 16, spo2: 98, sbp: 134, dbp: 84, temp: 36.8, etco2: 29, glucose: 104 } },
  { id: "BED-108", name: "Grace Adeyemi", mrn: "MRN-554190", room: "Oncology 2 · Bed 06", acuity: "medium", dx: "Metastatic NSCLC — cycle 3 chemo", admittedAgoMin: 162, ventilator: false, isolation: false, vitals: { hr: 88, rr: 17, spo2: 96, sbp: 128, dbp: 80, temp: 37.4, etco2: 30, glucose: 132 } },
  { id: "BED-109", name: "Haruto Sato", mrn: "MRN-660283", room: "Pediatrics · Bed 03", acuity: "low", dx: "Status asthmaticus, resolving", admittedAgoMin: 41, ventilator: false, isolation: false, vitals: { hr: 92, rr: 20, spo2: 97, sbp: 104, dbp: 62, temp: 37.0, etco2: 32, glucose: 98 } },
  { id: "BED-110", name: "Yuki Tanaka", mrn: "MRN-558173", room: "Med-Surg 2 · Bed 08", acuity: "low", dx: "Post-op observation, cholecystectomy", admittedAgoMin: 285, ventilator: false, isolation: false, vitals: { hr: 74, rr: 15, spo2: 99, sbp: 116, dbp: 72, temp: 36.7, etco2: 28, glucose: 111 } },
];

const DEVICES = [
  { id: "ICU-MON-0042", type: "Patient Monitor", model: "Philips IntelliVue MX750", room: "ICU West · Bed 02", battery: 86, signal: 94, firmware: "4.8.21", latestFirmware: "4.8.21", status: "online", heartbeatMin: 0, ip: "10.24.8.42", uptimeDays: 41, patchLevel: "PS-2026-07", vendor: "Philips" },
  { id: "ICU-MON-0043", type: "Patient Monitor", model: "Philips IntelliVue MX750", room: "ICU West · Bed 07", battery: 71, signal: 88, firmware: "4.8.21", latestFirmware: "4.8.21", status: "online", heartbeatMin: 0, ip: "10.24.8.43", uptimeDays: 41, patchLevel: "PS-2026-07", vendor: "Philips" },
  { id: "ICU-VEN-0112", type: "Ventilator", model: "Medtronic PB980", room: "ICU West · Bed 02", battery: 64, signal: 91, firmware: "2.6.4", latestFirmware: "2.6.4", status: "online", heartbeatMin: 0, ip: "10.24.9.112", uptimeDays: 17, patchLevel: "PS-2026-06", vendor: "Medtronic" },
  { id: "ICU-VEN-0113", type: "Ventilator", model: "Drager Evita V500", room: "ICU West · Bed 07", battery: 52, signal: 84, firmware: "3.1.2", latestFirmware: "3.2.0", status: "degraded", heartbeatMin: 1, ip: "10.24.9.113", uptimeDays: 33, patchLevel: "PS-2026-05", vendor: "Drager" },
  { id: "ICU-PMP-0231", type: "Infusion Pump", model: "B Braun Infusomat Space", room: "ICU West · Bed 07", battery: 38, signal: 89, firmware: "1.9.0", latestFirmware: "1.9.0", status: "online", heartbeatMin: 0, ip: "10.24.10.231", uptimeDays: 8, patchLevel: "PS-2026-07", vendor: "B. Braun" },
  { id: "ICU-PMP-0232", type: "Syringe Pump", model: "Terufusion TE-112", room: "Surgical 3 · Bed 04", battery: 47, signal: 86, firmware: "2.2.1", latestFirmware: "2.2.1", status: "online", heartbeatMin: 0, ip: "10.24.10.232", uptimeDays: 12, patchLevel: "PS-2026-07", vendor: "Terumo" },
  { id: "ICU-PMP-0233", type: "Infusion Pump", model: "B Braun Infusomat Space", room: "Cardiology 2 · Bed 09", battery: 61, signal: 90, firmware: "1.8.9", latestFirmware: "1.9.0", status: "degraded", heartbeatMin: 2, ip: "10.24.10.233", uptimeDays: 54, patchLevel: "PS-2026-04", vendor: "B. Braun" },
  { id: "ICU-ECG-0310", type: "ECG Telemetry", model: "GE MAC-2000 Tele", room: "ICU East · Bed 12", battery: 79, signal: 95, firmware: "5.0.3", latestFirmware: "5.0.3", status: "online", heartbeatMin: 0, ip: "10.24.11.310", uptimeDays: 29, patchLevel: "PS-2026-07", vendor: "GE HealthCare" },
  { id: "ICU-ECG-0311", type: "ECG Telemetry", model: "GE MAC-2000 Tele", room: "Cardiology 2 · Bed 09", battery: 68, signal: 92, firmware: "5.0.3", latestFirmware: "5.0.3", status: "online", heartbeatMin: 0, ip: "10.24.11.311", uptimeDays: 29, patchLevel: "PS-2026-07", vendor: "GE HealthCare" },
  { id: "ICU-OXM-0440", type: "Pulse Oximeter", model: "Masimo Rad-97", room: "Respiratory 1 · Bed 15", battery: 23, signal: 74, firmware: "7.6.0", latestFirmware: "7.6.2", status: "degraded", heartbeatMin: 3, ip: "10.24.12.440", uptimeDays: 6, patchLevel: "PS-2026-05", vendor: "Masimo" },
  { id: "ICU-OXM-0441", type: "Pulse Oximeter", model: "Masimo Rad-97", room: "Pediatrics · Bed 03", battery: 91, signal: 97, firmware: "7.6.2", latestFirmware: "7.6.2", status: "online", heartbeatMin: 0, ip: "10.24.12.441", uptimeDays: 3, patchLevel: "PS-2026-07", vendor: "Masimo" },
  { id: "ICU-MON-0044", type: "Patient Monitor", model: "Philips IntelliVue MX750", room: "Med-Surg 2 · Bed 08", battery: 12, signal: 63, firmware: "4.7.9", latestFirmware: "4.8.21", status: "offline", heartbeatMin: 11, ip: "10.24.8.44", uptimeDays: 96, patchLevel: "PS-2026-02", vendor: "Philips" },
];

const INITIAL_ALERTS = [
  { id: "ICU-AL-8812", severity: "critical", title: "SpO2 sustained below 90%", body: "Sofia Marchetti · Bed 02 — SpO2 88% on 60% FiO2 for 4+ min", ref: "BED-101", refLabel: "ICU West · Bed 02", createdTick: 0, acknowledged: false, acknowledgedBy: null, assignedTo: "Nurse James Okafor", channel: "Pager + Voice" },
  { id: "ICU-AL-8811", severity: "high", title: "Ventilator alarm — high airway pressure", body: "ICU-VEN-0113 degraded · high pressure alerts ×3 in 10 min", ref: "ICU-VEN-0113", refLabel: "Drager Evita V500 · Bed 07", createdTick: 2, acknowledged: false, acknowledgedBy: null, assignedTo: "Dr. Priya Raghavan", channel: "Page + Mobile App" },
  { id: "ICU-AL-8810", severity: "high", title: "MAP below 65 despite pressors", body: "Robert Callahan · Bed 07 — MAP 63, norepinephrine 0.14 mcg/kg/min", ref: "BED-102", refLabel: "ICU West · Bed 07", createdTick: 4, acknowledged: false, acknowledgedBy: null, assignedTo: "Dr. Priya Raghavan", channel: "Page + Mobile App" },
  { id: "ICU-AL-8809", severity: "medium", title: "Pump battery low", body: "ICU-PMP-0233 battery 38% — expect 3h runtime on battery", ref: "ICU-PMP-0233", refLabel: "Cardiology 2 · Bed 09", createdTick: 7, acknowledged: true, acknowledgedBy: "Nurse James Okafor", assignedTo: "Nurse James Okafor", channel: "App" },
  { id: "ICU-AL-8808", severity: "medium", title: "Telemetry signal degraded", body: "ICU-OXM-0440 signal 74% — possible RF interference near bay 15", ref: "ICU-OXM-0440", refLabel: "Respiratory 1 · Bed 15", createdTick: 9, acknowledged: false, acknowledgedBy: null, assignedTo: "BioMed On-call", channel: "App" },
  { id: "ICU-AL-8807", severity: "low", title: "Firmware update available", body: "ICU-MON-0044 on 4.7.9 · latest 4.8.21 · update window suggested 02:00", ref: "ICU-MON-0044", refLabel: "Med-Surg 2 · Bed 08", createdTick: 12, acknowledged: false, acknowledgedBy: null, assignedTo: "BioMed On-call", channel: "App" },
];

const SEED_POINTS = 22;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 90, amp = 12) =>
  series(seed, n, base, amp, { seedMult: 104729, pull: 0.08 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);



const timeAgoMin = (createdTick, tick) => {
  const mins = Math.max(0, tick - createdTick);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

const escalationLevel = (alert, tick) => {
  if (alert.acknowledged) return 0;
  const mins = Math.max(0, tick - alert.createdTick);
  if (mins >= ESCALATION_RULES[2].windowMin) return 3;
  if (mins >= ESCALATION_RULES[1].windowMin) return 2;
  return 1;
};

const deviceFirmwareState = (d) => {
  if (d.firmware !== d.latestFirmware) return "outdated";
  const patch = d.patchLevel || "PS-2026-07";
  return patch < "PS-2026-07" ? "patch-outstanding" : "current";
};

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */



function DeviceStatusPill({ status }) {
  const meta = DEVICE_STATUS_META[status] || DEVICE_STATUS_META.online;
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>;
}







function VitalTiles({ vitals }) {
  const cells = [
    { k: "hr", label: "HR", unit: "bpm", danger: (v) => v > 115 || v < 50, tone: "rose" },
    { k: "rr", label: "RR", unit: "/min", danger: (v) => v > 28 || v < 8, tone: "violet" },
    { k: "spo2", label: "SpO₂", unit: "%", danger: (v) => v < 92, tone: "sky" },
    { k: "sbp", label: "SBP", unit: "mmHg", danger: (v) => v < 90 || v > 180, tone: "amber" },
    { k: "temp", label: "Temp", unit: "°C", danger: (v) => v > 38.5 || v < 35.5, tone: "emerald" },
    { k: "etco2", label: "EtCO₂", unit: "mmHg", danger: (v) => v > 45 || v < 28, tone: "rose" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {cells.map(({ k, label, unit, danger }) => {
        const v = vitals[k];
        const bad = danger(v);
        return (
          <div key={k} className={`rounded-lg border px-1.5 py-1.5 text-center ${bad ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/60"}`}>
            <p className={`text-sm font-black tabular-nums ${bad ? "text-rose-400" : "text-slate-100"}`}>{v}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label} <span className="text-slate-600">({unit})</span></p>
          </div>
        );
      })}
    </div>
  );
}

function EscalationLadder({ level }) {
  return (
    <div className="flex items-center gap-2">
      {ESCALATION_RULES.map((r, i) => {
        const reached = i < level;
        const isCurrent = i === level - 1;
        return (
          <React.Fragment key={r.level}>
            <div className={`flex flex-col items-center rounded-xl border px-3 py-2 text-center ${reached ? (isCurrent ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10") : "border-slate-800 bg-slate-950/50 opacity-60"}`}>
              <p className={`text-[10px] font-black ${reached ? (isCurrent ? "text-amber-400" : "text-emerald-400") : "text-slate-600"}`}>L{r.level}</p>
              <p className="text-[9px] text-slate-400">{r.role}</p>
            </div>
            {i < ESCALATION_RULES.length - 1 && (
              <ChevronRight size={14} className={reached ? "text-amber-400" : "text-slate-700"} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 1 - Vitals Stream
 * ------------------------------------------------------------------ */

function VitalsStreamTab({ beds, search, severity, tick, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds.filter((b) => {
      const matchesSearch = !q || [b.name, b.mrn, b.id, b.room, b.dx].some((f) => String(f).toLowerCase().includes(q));
      const matchesSeverity = severity === "all" || b.acuity === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [beds, search, severity]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <Activity size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No beds match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or switch the acuity chips to see the stream.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((b) => {
        const sev = SEVERITY_META[b.acuity] || SEVERITY_META.medium;
        const hrSeries = seededSeries(b.id.length * 7 + 3, SEED_POINTS, b.vitals.hr, 8);
        const spo2Series = seededSeries(b.id.length * 13 + 5, SEED_POINTS, b.vitals.spo2, 4);
        return (
          <button
            key={b.id}
            onClick={() => onInspect(b)}
            className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${sev.border}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${sev.bg} ${sev.text}`}>
                  <HeartPulse size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{b.name}</p>
                  <p className="text-[11px] text-slate-500">{b.room} · {b.mrn}</p>
                </div>
              </div>
              <Badge tone={b.acuity}>{b.acuity} acuity</Badge>
            </div>

            <p className="mt-2 truncate text-[11px] text-slate-400">{b.dx}</p>

            <div className="mt-3">
              <VitalTiles vitals={b.vitals} />
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="flex-1">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">HR trend</p>
                <MiniSparkline points={hrSeries} tone={b.vitals.hr > 115 ? "rose" : "sky"} width={120} height={30} />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">SpO₂ trend</p>
                <MiniSparkline points={spo2Series} tone={b.vitals.spo2 < 92 ? "rose" : "emerald"} width={120} height={30} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                {b.ventilator && <span className="flex items-center gap-1"><Wind size={11} className="text-violet-400" /> Vent</span>}
                {b.isolation && <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-amber-400" /> Isolation</span>}
                <span className="flex items-center gap-1"><Clock size={11} /> {b.admittedAgoMin} min</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 transition group-hover:gap-2">
                Inspect <ChevronRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 2 - IoT Device Mesh
 * ------------------------------------------------------------------ */

function IotDeviceMeshTab({ devices, search, statusFilter, setStatusFilter, onInspect }) {
  const statuses = ["All", "online", "degraded", "offline"];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      const matchesSearch = !q || [d.id, d.type, d.model, d.room, d.ip, d.vendor].some((f) => String(f).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "All" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [devices, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
              statusFilter === s ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {s === "All" ? "All devices" : s}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          {devices.filter((d) => d.status === "online").length} online · {devices.filter((d) => d.status === "degraded").length} degraded · {devices.filter((d) => d.status === "offline").length} offline
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Cpu size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No devices match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Try a different search term or device status.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const meta = DEVICE_TYPE_META[d.type] || DEVICE_TYPE_META["Patient Monitor"];
            const Icon = meta.icon;
            const fw = deviceFirmwareState(d);
            const batteryTone = d.battery < 15 ? "bg-rose-500" : d.battery < 40 ? "bg-amber-500" : "bg-emerald-500";
            const offline = d.status === "offline";
            return (
              <button
                key={d.id}
                onClick={() => onInspect(d)}
                className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${offline ? "opacity-80" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${meta.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{d.model}</p>
                      <p className="font-mono text-[10px] text-slate-500">{d.id} · {d.room}</p>
                    </div>
                  </div>
                  <DeviceStatusPill status={d.status} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                    <div className="flex items-center justify-between">
                      <Battery size={12} className="text-slate-500" />
                      <span className={`text-[11px] font-black tabular-nums ${d.battery < 15 ? "text-rose-400" : d.battery < 40 ? "text-amber-400" : "text-slate-200"}`}>{d.battery}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${batteryTone}`} style={{ width: `${d.battery}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                    <Wifi size={12} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-[11px] font-black tabular-nums text-slate-200">{d.signal}%</p>
                    <p className="text-[9px] text-slate-600">signal</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                    <Signal size={12} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-[11px] font-black tabular-nums text-slate-200">{d.heartbeatMin}m</p>
                    <p className="text-[9px] text-slate-600">heartbeat</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className={`flex items-center gap-1.5 text-[11px] ${fw === "current" ? "text-emerald-400" : fw === "outdated" ? "text-amber-400" : "text-sky-400"}`}>
                    <Workflow size={12} />
                    {fw === "current" ? "FW up to date" : fw === "outdated" ? `FW ${d.firmware} → ${d.latestFirmware}` : "Security patch outstanding"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                    Inspect <ChevronRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - Alert Escalation
 * ------------------------------------------------------------------ */

function AlertEscalationTab({ alerts, search, severity, tick, onInspect, onAcknowledge }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      const matchesSearch = !q || [a.id, a.title, a.body, a.refLabel, a.assignedTo].some((f) => String(f).toLowerCase().includes(q));
      const matchesSeverity = severity === "all" || a.severity === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [alerts, search, severity]);

  const openCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
            <Siren size={32} className="mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No alerts match the current filters</p>
            <p className="mt-1 text-xs text-slate-600">All clear — or widen the severity chips.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const sev = SEVERITY_META[a.severity] || SEVERITY_META.medium;
              const lvl = escalationLevel(a, tick);
              const isCurrent = lvl > 0 && !a.acknowledged;
              return (
                <div key={a.id} className={`rounded-2xl border bg-slate-900/70 p-4 shadow-lg shadow-black/20 animate-fade-up ${sev.border} ${isCurrent ? `shadow-lg ${sev.text.replace("text-", "shadow-")}/20` : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg border p-2 ${sev.bg} ${sev.text}`}>
                        <Siren size={15} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-white">{a.title}</p>
                          {a.acknowledged ? (
                            <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 size={11} /> Acked · {a.acknowledgedBy}
                            </span>
                          ) : (
                            <Badge tone={a.severity}>{a.severity}</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{a.body}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                          <span>{a.refLabel}</span>
                          <span className="flex items-center gap-1"><User size={11} /> {a.assignedTo}</span>
                          <span className="flex items-center gap-1"><Phone size={11} /> {a.channel}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {timeAgoMin(a.createdTick, tick)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.acknowledged ? (
                        <span className="text-[10px] font-bold text-emerald-400">Resolved</span>
                      ) : (
                        <>
                          <p className={`text-lg font-black tabular-nums ${sev.text}`}>L{lvl}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">escalation</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
                    <EscalationLadder level={a.acknowledged ? 3 : lvl} />
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      disabled={a.acknowledged}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                        a.acknowledged ? "cursor-default border border-slate-800 text-slate-600" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      <CheckCircle2 size={13} /> {a.acknowledged ? "Acknowledged" : "Acknowledge"}
                    </button>
                    <button onClick={() => onInspect(a)} className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-sky-400 transition hover:gap-2">
                      Inspect <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Escalation rules + on-call panel */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Layers size={14} className="text-amber-400" /> Escalation rules
          </p>
          <div className="mt-3 space-y-2.5">
            {ESCALATION_RULES.map((r) => (
              <div key={r.level} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-200">{r.label}</p>
                  <span className="text-[10px] font-bold text-slate-500">≥ {r.windowMin} min</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{r.action}</p>
                <p className="mt-1 text-[10px] text-slate-600">Channel: {r.channel}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Users size={14} className="text-sky-400" /> On-call rotation
          </p>
          <div className="mt-3 space-y-2.5">
            {ON_CALL.map((o) => (
              <div key={o.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300">
                  <User size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200">{o.name}</p>
                  <p className="text-[10px] text-slate-500">{o.role} · {o.shift}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">{o.channel}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${o.status === "Available" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-600">{openCount} open alert{openCount === 1 ? "" : "s"} currently in the ladder</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function IcuTelemetryHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("vitals");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [beds, setBeds] = useState(BEDS);
  const [devices, setDevices] = useState(DEVICES);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9000);
  const bedsRef = useRef(beds);
  const devicesRef = useRef(devices);
  useEffect(() => { bedsRef.current = beds; }, [beds]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);



  const spawnAlert = useCallback((severityLevel, title, body, ref, refLabel) => {
    const id = `ICU-AL-${seqRef.current++}`;
    setAlerts((prev) => {
      const fresh = {
        id, severity: severityLevel, title, body, ref, refLabel,
        createdTick: Math.max(...prev.map((a) => a.createdTick), 0) + 1,
        acknowledged: false, acknowledgedBy: null,
        assignedTo: severityLevel === "critical" ? "Nurse James Okafor" : "Dr. Priya Raghavan",
        channel: severityLevel === "critical" ? "Pager + Voice" : "Page + Mobile App",
      };
      return [fresh, ...prev].slice(0, 14);
    });
    pushToast(title, body, severityLevel);
  }, [pushToast]);

  /* Live simulation loop. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      setBeds((prev) =>
        prev.map((b) => {
          const v = b.vitals;
          return {
            ...b,
            vitals: {
              hr: jitter(v.hr, 4, 48, 165),
              rr: jitter(v.rr, 2, 10, 40),
              spo2: jitter(v.spo2, 1.2, 78, 100),
              sbp: jitter(v.sbp, 5, 70, 200),
              dbp: jitter(v.dbp, 3, 40, 120),
              temp: jitter(v.temp, 0.15, 35.5, 40.5),
              etco2: jitter(v.etco2, 1.5, 20, 55),
              glucose: jitter(v.glucose, 6, 60, 260),
            },
          };
        })
      );

      setDevices((prev) =>
        prev.map((d) => {
          if (d.status === "offline") {
            return { ...d, heartbeatMin: d.heartbeatMin + 1 };
          }
          const battery = d.battery <= 0 ? 0 : round1(jitter(d.battery, 0.3, 0, 100));
          const signal = Math.round(clamp(d.signal + (Math.random() * 6 - 3), 30, 100));
          const missed = Math.random() < 0.015;
          if (missed) {
            return { ...d, battery, signal, status: "offline", heartbeatMin: 1 };
          }
          const degraded = battery < 15 || signal < 70;
          return { ...d, battery, signal, status: degraded ? "degraded" : "online", heartbeatMin: 0 };
        })
      );

      // Device events -> alerts.
      const devPool = devicesRef.current;
      const wentOffline = devPool.filter((d) => d.status === "online" || d.status === "degraded").length > 0 && Math.random() < 0.07;
      if (wentOffline) {
        const candidates = devPool.filter((d) => d.status !== "offline");
        if (candidates.length > 0) {
          const d = candidates[Math.floor(Math.random() * candidates.length)];
          spawnAlert("high", `${d.model} heartbeat lost`, `${d.id} missed its heartbeat window — check network path and power`, d.id, d.room);
        }
      }
      if (Math.random() < 0.08) {
        const lowBattery = devPool.filter((d) => d.battery > 0 && d.battery < 25 && d.status !== "offline");
        if (lowBattery.length > 0) {
          const d = lowBattery[Math.floor(Math.random() * lowBattery.length)];
          spawnAlert("medium", "Device battery low", `${d.id} at ${Math.round(d.battery)}% — schedule charge or swap`, d.id, d.room);
        }
      }

      // Random clinical alerts from high/critical beds.
      if (Math.random() < 0.1) {
        const hot = bedsRef.current.filter((b) => b.acuity === "critical" || b.acuity === "high");
        if (hot.length > 0) {
          const b = hot[Math.floor(Math.random() * hot.length)];
          spawnAlert("critical", "Vitals trend deteriorating", `${b.name} ${b.room} — HR ${b.vitals.hr}, SpO2 ${b.vitals.spo2}%`, b.id, b.room);
        }
      }

      // Escalation crossing toasts.
      const escalated = alerts.filter((a) => {
        if (a.acknowledged) return false;
        const mins = tick + 1 - a.createdTick;
        return mins === ESCALATION_RULES[1].windowMin || mins === ESCALATION_RULES[2].windowMin;
      });
      if (escalated.length > 0) {
        const a = escalated[0];
        const lvl = escalationLevel(a, tick + 1);
        pushToast(`Alert escalated to L${lvl}`, `${a.title} → ${ESCALATION_RULES[lvl - 1].role} notified`, "high");
      }
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, spawnAlert, pushToast, alerts]);

  const resetSimulation = useCallback(() => {
    setBeds(BEDS.map((b) => ({ ...b, vitals: { ...b.vitals } })));
    setDevices(DEVICES.map((d) => ({ ...d })));
    setAlerts(INITIAL_ALERTS.map((a) => ({ ...a })));
    setTick(20);
    setInspect(null);
    pushToast("Floor reset", "Beds, device mesh and alert ladder restored to baseline", "medium");
  }, [pushToast]);

  const handleAcknowledge = useCallback((alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true, acknowledgedBy: "Nurse James Okafor" } : a))
    );
    pushToast("Alert acknowledged", `${alertId} acknowledged by Charge Nurse — ladder cleared`, "low");
  }, [pushToast]);

  const handleDeviceAction = useCallback((deviceId, action) => {
    if (action === "reboot") {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, status: "online", heartbeatMin: 0, signal: 92 } : d))
      );
      pushToast("Device reboot queued", `${deviceId} reconnecting to mesh…`, "medium");
    } else if (action === "update") {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, firmware: d.latestFirmware, patchLevel: "PS-2026-07" } : d))
      );
      pushToast("Firmware update applied", `${deviceId} now on latest firmware`, "low");
    }
  }, [pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "devices" ? devices : activeTab === "alerts" ? alerts : beds;
    const header = activeTab === "devices"
      ? ["id", "type", "model", "room", "battery", "signal", "firmware", "status", "heartbeatMin"]
      : activeTab === "alerts"
        ? ["id", "severity", "title", "body", "ref", "assignedTo", "acknowledged"]
        : ["id", "name", "mrn", "room", "acuity", "hr", "rr", "spo2", "sbp", "temp", "etco2"];
    const csv = [
      header.map(csvEscape).join(","),
      ...rows.map((r) =>
        (activeTab === "devices"
          ? [r.id, r.type, r.model, r.room, r.battery, r.signal, r.firmware, r.status, r.heartbeatMin]
          : activeTab === "alerts"
            ? [r.id, r.severity, r.title, r.body, r.refLabel, r.assignedTo, r.acknowledged]
            : [r.id, r.name, r.mrn, r.room, r.acuity, r.vitals.hr, r.vitals.rr, r.vitals.spo2, r.vitals.sbp, r.vitals.temp, r.vitals.etco2]
        ).map(csvEscape).join(",")
      ),
    ].join("\n");
    downloadCsv(`medtrack-icu-${activeTab}-${Date.now()}.csv`, csv);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, beds, devices, alerts, pushToast]);

  const stats = useMemo(() => {
    const monitored = beds.length;
    const online = devices.filter((d) => d.status !== "offline").length;
    const openAlerts = alerts.filter((a) => !a.acknowledged).length;
    const critical = beds.filter((b) => b.acuity === "critical").length;
    return { monitored, online, openAlerts, critical, total: devices.length };
  }, [beds, devices, alerts]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400 shadow-lg shadow-rose-500/10">
                <Activity size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Real-Time Telemetry &amp; ICU Monitoring</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} livePrefix="Streaming · tick #" pausedLabel="Stream paused" />
                  <span className="text-slate-600">·</span>
                  <span>Vitals Stream · IoT Mesh · Escalation Ladder</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlaybackControls
              playing={playing}
              onToggle={() => setPlaying((p) => !p)}
              speed={speed}
              onSpeedChange={setSpeed}
              onReset={resetSimulation}
              pauseLabel="Pause stream"
              resumeLabel="Resume stream"
              speedLabel="Stream speed"
            />
            <ExportButton onClick={handleExport} exporting={exporting} />
          </div>
        </div>

        {/* ---------- Stat row ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Bed} label="Beds monitored" value={stats.monitored} sub={`${stats.critical} critical acuity`} tone="sky" />
          <StatCard icon={Cpu} label="Devices on mesh" value={`${stats.online}/${stats.total}`} sub={`${devices.filter((d) => d.status === "degraded").length} degraded`} tone="emerald" />
          <StatCard icon={Siren} label="Open alerts" value={stats.openAlerts} sub={`in the escalation ladder`} tone="rose" />
          <StatCard icon={Zap} label="Mean resp. time" value={`${Math.round(alerts.reduce((acc, a) => acc + Math.min(tick - a.createdTick, 12), 0) / Math.max(alerts.length, 1))}m`} sub="ack-to-alert across floor" tone="amber" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              {activeTab === "devices" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> status:</span>
                  {["All", "online", "degraded", "offline"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        statusFilter === s ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      {s === "All" ? "All" : s}
                    </button>
                  ))}
                </div>
              ) : (
                <SeverityChips value={severity} onChange={setSeverity} meta={SEVERITY_META} />
              )}
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "vitals" && (
              <VitalsStreamTab beds={beds} search={search} severity={severity} tick={tick} onInspect={setInspect} />
            )}
            {activeTab === "devices" && (
              <IotDeviceMeshTab devices={devices} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onInspect={setInspect} />
            )}
            {activeTab === "alerts" && (
              <AlertEscalationTab alerts={alerts} search={search} severity={severity} tick={tick} onInspect={setInspect} onAcknowledge={handleAcknowledge} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.vitals) {
            const b = inspect;
            const sev = SEVERITY_META[b.acuity] || SEVERITY_META.medium;
            return (
              <Modal open onClose={() => setInspect(null)} title={b.name} subtitle={`${b.room} · ${b.mrn} · admitted ${b.admittedAgoMin} min ago`} icon={HeartPulse} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={b.acuity}>{b.acuity} acuity</Badge>
                    {b.ventilator && <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400"><Wind size={11} /> Ventilated</span>}
                    {b.isolation && <span className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400"><ShieldCheck size={11} /> Isolation</span>}
                  </div>
                  <p className="text-xs text-slate-400">{b.dx}</p>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Current vitals</p>
                    <VitalTiles vitals={b.vitals} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Trend history · last {SEED_POINTS} min</p>
                    <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
                      {[
                        { label: "Heart rate", pts: seededSeries(b.id.length * 7 + 3, SEED_POINTS, b.vitals.hr, 8), tone: b.vitals.hr > 115 ? "rose" : "sky" },
                        { label: "SpO₂", pts: seededSeries(b.id.length * 13 + 5, SEED_POINTS, b.vitals.spo2, 4), tone: b.vitals.spo2 < 92 ? "rose" : "emerald" },
                        { label: "Resp rate", pts: seededSeries(b.id.length * 17 + 1, SEED_POINTS, b.vitals.rr, 4), tone: b.vitals.rr > 28 ? "rose" : "violet" },
                        { label: "EtCO₂", pts: seededSeries(b.id.length * 23 + 9, SEED_POINTS, b.vitals.etco2, 4), tone: b.vitals.etco2 > 45 ? "rose" : "amber" },
                      ].map(({ label, pts, tone }) => (
                        <div key={label}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                          <MiniSparkline points={pts} tone={tone} width={240} height={44} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Bell size={14} /> Watch bed
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20">
                      <Siren size={14} /> Trigger rapid review
                    </button>
                    {typeof onNavigate === "function" && (
                      <button onClick={() => onNavigate("clinical-ai")} className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                        <BrainIcon size={14} /> AI risk models
                      </button>
                    )}
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.refLabel && inspect.createdTick !== undefined) {
            const a = inspect;
            const sev = SEVERITY_META[a.severity] || SEVERITY_META.medium;
            const lvl = escalationLevel(a, tick);
            return (
              <Modal open onClose={() => setInspect(null)} title={a.title} subtitle={`${a.id} · ${a.refLabel}`} icon={Siren} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.severity}>{a.severity}</Badge>
                    {a.acknowledged && <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400"><CheckCircle2 size={11} /> Acked by {a.acknowledgedBy}</span>}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">{a.body}</p>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Escalation state</p>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <EscalationLadder level={a.acknowledged ? 3 : lvl} />
                      <span className={`text-lg font-black tabular-nums ${sev.text}`}>{a.acknowledged ? "✓" : `L${lvl}`}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {a.acknowledged
                        ? "Ladder cleared on acknowledgement. Follow-up chart review scheduled."
                        : `Aged ${timeAgoMin(a.createdTick, tick)} · ${ESCALATION_RULES[Math.min(lvl, 3) - 1].role} currently engaged via ${a.channel}.`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Assigned to" value={a.assignedTo} />
                    <InfoRow label="Notification channel" value={a.channel} />
                    <InfoRow label="Linked asset" value={a.refLabel} mono />
                    <InfoRow label="Created" value={timeAgoMin(a.createdTick, tick)} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      disabled={a.acknowledged}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${a.acknowledged ? "border border-slate-800 text-slate-600" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
                    >
                      <CheckCircle2 size={14} /> {a.acknowledged ? "Acknowledged" : "Acknowledge & clear"}
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20">
                      <Phone size={14} /> Call assignee
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Audit trail
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const d = inspect;
          const meta = DEVICE_TYPE_META[d.type] || DEVICE_TYPE_META["Patient Monitor"];
          const Icon = meta.icon;
          const fw = deviceFirmwareState(d);
          return (
            <Modal open onClose={() => setInspect(null)} title={d.model} subtitle={`${d.id} · ${d.room}`} icon={Icon} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DeviceStatusPill status={d.status} />
                  <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${fw === "current" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : fw === "outdated" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-sky-500/30 bg-sky-500/10 text-sky-400"}`}>
                    <Workflow size={11} />
                    {fw === "current" ? "Firmware current" : fw === "outdated" ? `Update available → ${d.latestFirmware}` : "Security patch outstanding"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Battery size={14} className="mx-auto text-slate-500" />
                    <p className={`mt-1 text-lg font-black tabular-nums ${d.battery < 15 ? "text-rose-400" : d.battery < 40 ? "text-amber-400" : "text-white"}`}>{d.battery}%</p>
                    <p className="text-[10px] text-slate-500">Battery</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Wifi size={14} className="mx-auto text-slate-500" />
                    <p className={`mt-1 text-lg font-black tabular-nums ${d.signal < 70 ? "text-amber-400" : "text-white"}`}>{d.signal}%</p>
                    <p className="text-[10px] text-slate-500">Signal</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Timer size={14} className="mx-auto text-slate-500" />
                    <p className={`mt-1 text-lg font-black tabular-nums ${d.heartbeatMin > 0 ? "text-rose-400" : "text-white"}`}>{d.heartbeatMin}m</p>
                    <p className="text-[10px] text-slate-500">Heartbeat</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Clock size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{d.uptimeDays}d</p>
                    <p className="text-[10px] text-slate-500">Uptime</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Manufacturer" value={d.vendor} />
                  <InfoRow label="Model" value={d.model} />
                  <InfoRow label="Firmware" value={`${d.firmware}${fw === "outdated" ? ` (latest ${d.latestFirmware})` : ""}`} mono />
                  <InfoRow label="Security patch" value={d.patchLevel} mono />
                  <InfoRow label="Mesh address" value={d.ip} mono />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button
                    onClick={() => handleDeviceAction(d.id, "reboot")}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20"
                  >
                    <Power size={14} /> Reboot device
                  </button>
                  <button
                    onClick={() => handleDeviceAction(d.id, "update")}
                    disabled={fw === "current"}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${fw === "current" ? "border border-slate-800 text-slate-600" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"}`}
                  >
                    <Workflow size={14} /> {fw === "current" ? "Up to date" : "Apply update"}
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <Wrench size={14} /> Dispatch BioMed
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()
      )}

      {/* ---------- Footer strip ---------- */}
      <div className="border-t border-slate-800/60 bg-slate-950 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-[11px] text-slate-600 sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5">
            <Bluetooth size={12} className="text-emerald-500" />
            Simulated device mesh · no PHI transmitted · HL7 v2 / FHIR R4 output contract
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> AES-256 at rest · TLS 1.3 in transit · device certs rotated 90d
          </p>
        </div>
      </div>
    </div>
  );
}

/* Small alias so the modal stays readable. */
function BrainIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}
