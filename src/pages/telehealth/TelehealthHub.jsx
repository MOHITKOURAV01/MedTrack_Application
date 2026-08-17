import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Calendar, Camera, CheckCircle2,
  ChevronRight, Clock, Download, Droplets, FileText, Filter, Gauge, HeartPulse,
  Home, Info, Layers, Lock, MessageSquare, Mic, Pause, Phone, Pill, Play, Plus,
  RefreshCw, Scale, Search, ShieldCheck, Stethoscope, Timer, TrendingDown,
  TrendingUp, User, Users, Video, Wifi, WifiOff, X, Zap
} from "lucide-react";
import { clamp, round1, fmtNumber, seededSeries as series } from "../../utils/series";
import PlaybackControls from "../../components/common/PlaybackControls";
import { ExportButton } from "../../components/common/ExportButton";
import LiveStatus from "../../components/common/LiveStatus";
import ToastStack, { useToasts } from "../../components/common/ToastStack";
// Shared primitives this console renders. The extraction into src/components/common removed the
// page-local definitions; these imports replace them. Without them each name is a free variable and
// the first render throws, which is what the console did before this line existed.
import { ProgressBar } from "../../components/common/ProgressBar";
import { csvEscape, downloadCsv } from "../../utils/export";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { StatusPill } from "../../components/common/StatusPill";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Telehealth & Remote Patient Management Hub
 *  ------------------------------------------------------------------
 *  Three consoles for virtual care operations:
 *    1. Video Consult Overwatch - live/upcoming telehealth sessions with
 *                               provider, specialty, session quality
 *                               (video/audio/latency) and join/end actions.
 *    2. Remote Vitals Monitoring - at-home RPM patients with streaming
 *                               vitals, device compliance and threshold
 *                               flags.
 *    3. Adherence & Care Plans   - medication/appointment adherence,
 *                               task completion and follow-up risk.
 *
 *  Virtual care simulates client-side: consults flow through the queue,
 *  session quality jitters, home vitals drift and threshold alerts fire.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const CONSULT_STATUS_META = {
  "in-session": { label: "In session", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  queued: { label: "Queued", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  scheduled: { label: "Scheduled", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  completed: { label: "Completed", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
};

const TABS = [
  { key: "consults", label: "Video Consult Overwatch", icon: Video, blurb: "Live & upcoming sessions with quality telemetry" },
  { key: "vitals", label: "Remote Vitals Monitoring", icon: HeartPulse, blurb: "At-home RPM patients with streaming vitals & flags" },
  { key: "adherence", label: "Adherence & Care Plans", icon: Pill, blurb: "Medication, appointment & task adherence by risk" },
];

const INITIAL_CONSULTS = [
  { id: "TH-6601", provider: "Dr. A. Okafor", specialty: "Cardiology", patient: "Robert Callahan", patientId: "RPM-2201", status: "in-session", scheduledTick: 2, startTick: 4, durationMin: 11, quality: { video: 92, audio: 95, latencyMs: 84 }, device: "Desktop", location: "Home", followup: true, notes: "Post-discharge rhythm review; pacemaker interrogation pending" },
  { id: "TH-6602", provider: "Dr. L. Reyes", specialty: "Endocrinology", patient: "Grace Adeyemi", patientId: "RPM-2205", status: "in-session", scheduledTick: 3, startTick: 5, durationMin: 7, quality: { video: 88, audio: 90, latencyMs: 112 }, device: "Mobile", location: "Home", followup: false, notes: "Glucose review after cycle 3 chemo; insulin titration" },
  { id: "TH-6603", provider: "Dr. E. Sorensen", specialty: "Pulmonology", patient: "Eleanor Vance", patientId: "RPM-2203", status: "queued", scheduledTick: 5, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Tablet", location: "Home", followup: true, notes: "SpO2 trend review; spacer technique follow-up" },
  { id: "TH-6604", provider: "NP S. Whitfield", specialty: "Dermatology", patient: "Lena Kowalski", patientId: "RPM-2210", status: "queued", scheduledTick: 6, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Mobile", location: "Home", followup: false, notes: "Post-op wound check — laceration healing" },
  { id: "TH-6605", provider: "Dr. R. Callahan", specialty: "Geriatrics", patient: "Amara Nwosu", patientId: "RPM-2202", status: "scheduled", scheduledTick: 9, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Kiosk", location: "Clinic", followup: true, notes: "Mobility + falls risk assessment; caregiver consult" },
  { id: "TH-6606", provider: "Dr. M. Alvarez", specialty: "Infectious Disease", patient: "Derek Osei", patientId: "RPM-2204", status: "scheduled", scheduledTick: 11, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Desktop", location: "Home", followup: false, notes: "Antibiotic course check; culture results review" },
  { id: "TH-6607", provider: "Dr. E. Sorensen", specialty: "Neurology", patient: "Marcus Bell", patientId: "RPM-2208", status: "completed", scheduledTick: 1, startTick: 3, durationMin: 18, quality: { video: 94, audio: 96, latencyMs: 61 }, device: "Desktop", location: "Home", followup: true, notes: "TIA workup results discussed; aspirin started" },
  { id: "TH-6608", provider: "Dr. A. Okafor", specialty: "Cardiology", patient: "Fatima Zahra", patientId: "RPM-2206", status: "completed", scheduledTick: 2, startTick: 4, durationMin: 22, quality: { video: 90, audio: 88, latencyMs: 98 }, device: "Mobile", location: "Home", followup: false, notes: "Anticoagulation education; INR monitoring plan" },
  { id: "TH-6609", provider: "NP S. Whitfield", specialty: "Pediatrics", patient: "Haruto Sato", patientId: "RPM-2209", status: "scheduled", scheduledTick: 13, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Tablet", location: "Home", followup: true, notes: "Asthma action plan review; spacer check" },
  { id: "TH-6610", provider: "Dr. M. Alvarez", specialty: "Primary Care", patient: "Sofia Marchetti", patientId: "RPM-2207", status: "scheduled", scheduledTick: 15, startTick: null, durationMin: 0, quality: { video: 0, audio: 0, latencyMs: 0 }, device: "Kiosk", location: "Clinic", followup: false, notes: "Weaning follow-up after ARDS discharge" },
];

const INITIAL_RPM = [
  { id: "RPM-2201", name: "Robert Callahan", age: 74, condition: "CHF · post-discharge", deviceDays: 92, lastSyncMin: 2, vitals: { hr: 88, sbp: 124, dbp: 76, spo2: 96, glucose: 158, weight: 84.2 }, flags: ["weight +1.8kg since Mon"], compliance: 94 },
  { id: "RPM-2202", name: "Amara Nwosu", age: 82, condition: "Stroke rehab", deviceDays: 61, lastSyncMin: 5, vitals: { hr: 96, sbp: 148, dbp: 88, spo2: 97, glucose: 134, weight: 66.9 }, flags: ["SBP trending high"], compliance: 87 },
  { id: "RPM-2203", name: "Eleanor Vance", age: 71, condition: "COPD · oxygen dependent", deviceDays: 84, lastSyncMin: 1, vitals: { hr: 102, sbp: 118, dbp: 74, spo2: 90, glucose: 149, weight: 71.4 }, flags: ["SpO2 below 92% ×3 readings"], compliance: 96 },
  { id: "RPM-2204", name: "Derek Osei", age: 63, condition: "Post-op diverticulitis", deviceDays: 40, lastSyncMin: 8, vitals: { hr: 84, sbp: 122, dbp: 78, spo2: 97, glucose: 128, weight: 89.8 }, flags: [], compliance: 91 },
  { id: "RPM-2205", name: "Grace Adeyemi", age: 61, condition: "Type 2 diabetes · chemo", deviceDays: 58, lastSyncMin: 3, vitals: { hr: 90, sbp: 128, dbp: 80, spo2: 96, glucose: 212, weight: 73.1 }, flags: ["Glucose >200 mg/dL"], compliance: 88 },
  { id: "RPM-2206", name: "Fatima Zahra", age: 38, condition: "PE recovery · anticoag", deviceDays: 22, lastSyncMin: 4, vitals: { hr: 94, sbp: 118, dbp: 74, spo2: 95, glucose: 108, weight: 62.5 }, flags: [], compliance: 97 },
  { id: "RPM-2207", name: "Sofia Marchetti", age: 67, condition: "Post-ARDS weaning", deviceDays: 14, lastSyncMin: 12, vitals: { hr: 110, sbp: 132, dbp: 82, spo2: 93, glucose: 176, weight: 58.9 }, flags: ["HR elevated at rest", "Sync gap 12 min"], compliance: 82 },
  { id: "RPM-2208", name: "Marcus Bell", age: 58, condition: "Post-TIA monitoring", deviceDays: 33, lastSyncMin: 0, vitals: { hr: 76, sbp: 136, dbp: 84, spo2: 98, glucose: 112, weight: 92.4 }, flags: [], compliance: 95 },
  { id: "RPM-2209", name: "Haruto Sato", age: 9, condition: "Pediatric asthma", deviceDays: 48, lastSyncMin: 2, vitals: { hr: 92, sbp: 104, dbp: 64, spo2: 97, glucose: 102, weight: 31.2 }, flags: [], compliance: 90 },
  { id: "RPM-2210", name: "Lena Kowalski", age: 31, condition: "Post-op wound care", deviceDays: 9, lastSyncMin: 1, vitals: { hr: 78, sbp: 118, dbp: 72, spo2: 99, glucose: 96, weight: 58.1 }, flags: [], compliance: 99 },
];

const INITIAL_ADHERENCE = [
  { id: "RPM-2201", patient: "Robert Callahan", medAdherence: 94, apptAdherence: 100, tasksDone: 8, tasksTotal: 9, nextVisit: "Thu · 10:00", risk: "low", plan: "CHF self-care plan v3" },
  { id: "RPM-2202", patient: "Amara Nwosu", medAdherence: 87, apptAdherence: 90, tasksDone: 5, tasksTotal: 8, nextVisit: "Fri · 14:30", risk: "medium", plan: "Stroke recovery pathway" },
  { id: "RPM-2203", patient: "Eleanor Vance", medAdherence: 96, apptAdherence: 100, tasksDone: 9, tasksTotal: 10, nextVisit: "Mon · 09:00", risk: "low", plan: "COPD action plan + spacer" },
  { id: "RPM-2204", patient: "Derek Osei", medAdherence: 91, apptAdherence: 95, tasksDone: 6, tasksTotal: 7, nextVisit: "Wed · 11:30", risk: "low", plan: "Surgical recovery checklist" },
  { id: "RPM-2205", patient: "Grace Adeyemi", medAdherence: 74, apptAdherence: 80, tasksDone: 4, tasksTotal: 9, nextVisit: "Tue · 15:00", risk: "high", plan: "Diabetes + oncology bundle" },
  { id: "RPM-2206", patient: "Fatima Zahra", medAdherence: 97, apptAdherence: 100, tasksDone: 7, tasksTotal: 8, nextVisit: "Sat · 10:30", risk: "low", plan: "Anticoag education plan" },
  { id: "RPM-2207", patient: "Sofia Marchetti", medAdherence: 82, apptAdherence: 85, tasksDone: 3, tasksTotal: 6, nextVisit: "Mon · 13:00", risk: "high", plan: "Weaning & exercise progression" },
  { id: "RPM-2208", patient: "Marcus Bell", medAdherence: 95, apptAdherence: 90, tasksDone: 6, tasksTotal: 7, nextVisit: "Thu · 09:30", risk: "low", plan: "Stroke prevention bundle" },
  { id: "RPM-2209", patient: "Haruto Sato", medAdherence: 89, apptAdherence: 100, tasksDone: 5, tasksTotal: 6, nextVisit: "Fri · 16:00", risk: "medium", plan: "Pediatric asthma plan" },
  { id: "RPM-2210", patient: "Lena Kowalski", medAdherence: 99, apptAdherence: 100, tasksDone: 4, tasksTotal: 4, nextVisit: "Wed · 12:00", risk: "low", plan: "Wound care checklist" },
];

const SEED_POINTS = 22;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 50, amp = 12, lo = 0, hi = 100) =>
  series(seed, n, base, amp, { lo, hi, pull: 0.09 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);



const rpmRisk = (r) => {
  const v = r.vitals;
  const flags = [];
  if (v.spo2 < 92) flags.push("critical");
  if (v.glucose > 200) flags.push("high");
  if (v.hr > 105) flags.push("high");
  if (v.sbp > 145) flags.push("medium");
  if (r.compliance < 85) flags.push("medium");
  return flags.length === 0 ? "low" : flags.includes("critical") ? "critical" : flags.includes("high") ? "high" : "medium";
};

const consultLevel = (c) => {
  if (c.status === "in-session") return c.quality.latencyMs > 150 ? "high" : "low";
  if (c.status === "queued") return "medium";
  if (c.status === "scheduled") return "low";
  return "low";
};

const adherenceRisk = (a) => (a.medAdherence < 80 || a.apptAdherence < 85 ? "high" : a.medAdherence < 90 ? "medium" : "low");

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */











function QualityMeter({ label, value, icon: Icon, tone = "sky" }) {
  const color = value >= 90 ? "text-emerald-400" : value >= 75 ? "text-amber-400" : "text-rose-400";
  const bar = value >= 90 ? "bg-emerald-500" : value >= 75 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><Icon size={12} /> {label}</span>
        <span className={`text-xs font-black tabular-nums ${color}`}>{value}</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar pct={value} tone={value >= 90 ? "emerald" : value >= 75 ? "amber" : "rose"} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 1 - Video Consult Overwatch
 * ------------------------------------------------------------------ */

function ConsultsTab({ consults, search, statusFilter, setStatusFilter, tick, onInspect, onJoin, onEnd }) {
  const statuses = ["All", "in-session", "queued", "scheduled", "completed"];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consults.filter((c) => {
      const matchesSearch = !q || [c.id, c.provider, c.specialty, c.patient, c.notes, c.device].some((f) => String(f).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [consults, search, statusFilter]);

  const live = consults.filter((c) => c.status === "in-session").length;

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
            {s === "All" ? "All consults" : s.replace("-", " ")}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">{live} live session{live === 1 ? "" : "s"} · tick #{tick}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Video size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No consults match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or status chips.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const liveSession = c.status === "in-session";
            const queued = c.status === "queued";
            const latencyBad = liveSession && c.quality.latencyMs > 150;
            return (
              <button
                key={c.id}
                onClick={() => onInspect(c)}
                className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${latencyBad ? "border-amber-500/40" : liveSession ? "border-emerald-500/40" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${liveSession ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-700 bg-slate-800 text-sky-400"}`}>
                      <Video size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{c.patient}</p>
                      <p className="text-[11px] text-slate-500">{c.id} · {c.specialty}</p>
                    </div>
                  </div>
                  <StatusPill status={c.status} map={CONSULT_STATUS_META} />
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-300">
                  <Stethoscope size={13} className="text-slate-500" /> {c.provider}
                </p>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={13} />
                    {liveSession ? `${c.durationMin} min in session` : queued ? `queued · scheduled ${c.scheduledTick} ticks ago` : `scheduled · ${c.scheduledTick} ticks out`}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    {c.device === "Desktop" ? <MonitorIcon size={12} /> : c.device === "Mobile" ? <Phone size={12} /> : <Home size={12} />} {c.device} · {c.location}
                  </span>
                </div>

                {liveSession ? (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-center">
                      <Camera size={12} className="mx-auto text-slate-500" />
                      <p className="mt-0.5 text-xs font-black text-white tabular-nums">{c.quality.video}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-center">
                      <Mic size={12} className="mx-auto text-slate-500" />
                      <p className="mt-0.5 text-xs font-black text-white tabular-nums">{c.quality.audio}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-center">
                      <Wifi size={12} className={`mx-auto ${latencyBad ? "text-amber-400" : "text-slate-500"}`} />
                      <p className={`mt-0.5 text-xs font-black tabular-nums ${latencyBad ? "text-amber-400" : "text-white"}`}>{c.quality.latencyMs}ms</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 truncate rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[11px] text-slate-500">{c.notes}</p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  {c.status === "in-session" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEnd(c.id); }}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 transition hover:bg-rose-500/20"
                    >
                      <Phone size={12} /> End session
                    </button>
                  ) : c.status === "queued" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onJoin(c.id); }}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      <Video size={12} /> Start now
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-600">{c.followup ? "follow-up" : "initial"} consult</span>
                  )}
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

function MonitorIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 2 - Remote Vitals Monitoring
 * ------------------------------------------------------------------ */

function RemoteVitalsTab({ patients, search, severity, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((r) => {
      const matchesSearch = !q || [r.id, r.name, r.condition].some((f) => String(f).toLowerCase().includes(q));
      const matchesSeverity = severity === "all" || rpmRisk(r) === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [patients, search, severity]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500">{filtered.length} of {patients.length} RPM patients shown · device data synced &lt; 15 min</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          <Wifi size={12} className="text-emerald-400" /> mesh connected
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <HeartPulse size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No RPM patients match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or severity chips.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const risk = rpmRisk(r);
            const sev = SEVERITY_META[risk] || SEVERITY_META.medium;
            const hrSeries = seededSeries(r.id.length * 7 + 3, SEED_POINTS, r.vitals.hr, 8);
            const weightSeries = seededSeries(r.id.length * 11 + 1, SEED_POINTS, r.vitals.weight, 1.2);
            const stale = r.lastSyncMin > 10;
            return (
              <button
                key={r.id}
                onClick={() => onInspect(r)}
                className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${risk === "critical" ? "border-rose-500/40" : risk === "high" ? "border-amber-500/40" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${sev.bg} ${sev.text}`}>
                      <HeartPulse size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-[11px] text-slate-500">{r.id} · {r.condition}</p>
                    </div>
                  </div>
                  <Badge tone={risk}>{risk}</Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    { k: "hr", label: "HR", unit: "bpm", bad: r.vitals.hr > 105 },
                    { k: "spo2", label: "SpO₂", unit: "%", bad: r.vitals.spo2 < 92 },
                    { k: "glucose", label: "Glu", unit: "mg/dL", bad: r.vitals.glucose > 200 },
                    { k: "sbp", label: "SBP", unit: "mmHg", bad: r.vitals.sbp > 145 },
                    { k: "weight", label: "Wt", unit: "kg", bad: false },
                    { k: "dbp", label: "DBP", unit: "mmHg", bad: r.vitals.dbp > 90 },
                  ].map(({ k, label, unit, bad }) => (
                    <div key={k} className={`rounded-lg border px-1 py-1.5 text-center ${bad ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/60"}`}>
                      <p className={`text-xs font-black tabular-nums ${bad ? "text-rose-400" : "text-slate-100"}`}>{r.vitals[k]}</p>
                      <p className="text-[9px] text-slate-600">{label} <span className="text-slate-700">({unit})</span></p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex-1">
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">HR trend</p>
                    <MiniSparkline points={hrSeries} tone={r.vitals.hr > 105 ? "rose" : "sky"} width={150} height={28} />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Weight trend</p>
                    <MiniSparkline points={weightSeries} tone={r.flags.some((f) => f.includes("weight")) ? "amber" : "emerald"} width={150} height={28} />
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {r.flags.map((f) => (
                    <p key={f} className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                      <AlertTriangle size={11} /> {f}
                    </p>
                  ))}
                  {r.flags.length === 0 && (
                    <p className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                      <CheckCircle2 size={11} /> All vitals within threshold
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`flex items-center gap-1 ${stale ? "text-rose-400" : ""}`}>
                      {stale ? <WifiOff size={11} /> : <Wifi size={11} className="text-emerald-400" />} {r.compliance}% device compliance
                    </span>
                    <span className="text-slate-700">· sync {r.lastSyncMin}m ago</span>
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
 *  Tab 3 - Adherence & Care Plans
 * ------------------------------------------------------------------ */

function AdherenceTab({ adherence, search, riskFilter, setRiskFilter, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adherence.filter((a) => {
      const matchesSearch = !q || [a.id, a.patient, a.plan, a.nextVisit].some((f) => String(f).toLowerCase().includes(q));
      const matchesRisk = riskFilter === "all" || adherenceRisk(a) === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [adherence, search, riskFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All patients" }, { key: "low", label: "On track" }, { key: "medium", label: "Watch" }, { key: "high", label: "Intervention" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRiskFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              riskFilter === key ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          avg med adherence {Math.round(adherence.reduce((a, x) => a + x.medAdherence, 0) / adherence.length)}%
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Pill size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No patients match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or risk chips.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="divide-y divide-slate-800/70">
            {filtered.map((a) => {
              const risk = adherenceRisk(a);
              const sev = SEVERITY_META[risk] || SEVERITY_META.medium;
              const taskPct = Math.round((a.tasksDone / a.tasksTotal) * 100);
              return (
                <button key={a.id} onClick={() => onInspect(a)} className="flex w-full flex-col gap-3 bg-slate-900/70 px-4 py-3.5 text-left transition hover:bg-slate-800/60 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{a.patient}</p>
                      <Badge tone={risk}>{risk === "low" ? "on track" : risk === "medium" ? "watch" : "intervention"}</Badge>
                      <span className="text-[11px] text-slate-500">{a.id} · {a.plan}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400"><Pill size={12} className="text-sky-400" /> meds <b className="text-white tabular-nums">{a.medAdherence}%</b></span>
                      <span className="flex items-center gap-1.5 text-slate-400"><Calendar size={12} className="text-violet-400" /> appts <b className="text-white tabular-nums">{a.apptAdherence}%</b></span>
                      <span className="flex items-center gap-1.5 text-slate-400"><Layers size={12} className="text-amber-400" /> tasks <b className="text-white tabular-nums">{a.tasksDone}/{a.tasksTotal}</b></span>
                      <span className="flex items-center gap-1.5 text-slate-500"><Clock size={12} /> next {a.nextVisit}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="w-28">
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="text-slate-500">plan tasks</span>
                        <span className="font-bold text-slate-300 tabular-nums">{taskPct}%</span>
                      </div>
                      <ProgressBar pct={taskPct} tone={risk === "high" ? "rose" : risk === "medium" ? "amber" : "emerald"} />
                    </div>
                    <ChevronRight size={15} className="text-slate-600" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function TelehealthHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("consults");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("all");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [consults, setConsults] = useState(INITIAL_CONSULTS);
  const [rpm, setRpm] = useState(INITIAL_RPM);
  const [adherence] = useState(INITIAL_ADHERENCE);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9000);
  const consultsRef = useRef(consults);
  const rpmRef = useRef(rpm);
  useEffect(() => { consultsRef.current = consults; }, [consults]);
  useEffect(() => { rpmRef.current = rpm; }, [rpm]);



  /* Live virtual-care simulation loop. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      // Consults progress through the pipeline.
      setConsults((prev) =>
        prev.map((c) => {
          if (c.status === "in-session") {
            return {
              ...c,
              durationMin: c.durationMin + 1,
              quality: {
                video: Math.round(jitter(c.quality.video, 4, 40, 100)),
                audio: Math.round(jitter(c.quality.audio, 4, 40, 100)),
                latencyMs: Math.round(jitter(c.quality.latencyMs, 18, 40, 300)),
              },
            };
          }
          if (c.status === "queued" && Math.random() < 0.3) {
            return { ...c, status: "in-session", startTick: seqRef.current };
          }
          return c;
        })
      );

      // Home vitals drift; threshold alerts fire.
      setRpm((prev) =>
        prev.map((r) => {
          const v = r.vitals;
          const next = {
            hr: jitter(v.hr, 3, 55, 130),
            sbp: jitter(v.sbp, 5, 90, 170),
            dbp: jitter(v.dbp, 3, 55, 100),
            spo2: jitter(v.spo2, 1.2, 85, 100),
            glucose: jitter(v.glucose, 8, 80, 260),
            weight: round1(jitter(v.weight, 0.15, 30, 140)),
          };
          return { ...r, vitals: next, lastSyncMin: r.lastSyncMin + 1 };
        })
      );

      const rpmPool = rpmRef.current;
      rpmPool.forEach((r) => {
        const level = rpmRisk(r);
        if (level === "critical" && Math.random() < 0.5) {
          pushToast(`RPM threshold alert — ${r.name}`, `${r.id} · SpO2 ${r.vitals.spo2}%, HR ${r.vitals.hr} — nurse outreach queued`, "critical");
        } else if (level === "high" && Math.random() < 0.3) {
          pushToast(`RPM flag — ${r.name}`, `${r.id} · one or more vitals outside threshold`, "high");
        }
      });

      // Adherence drift: low-adherence patients slip a little.
      if (Math.random() < 0.15) {
        pushToast("Adherence check", "Medication adherence dipped below 80% for one care-plan patient", "medium");
      }
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, pushToast]);

  const resetSimulation = useCallback(() => {
    setConsults(INITIAL_CONSULTS.map((c) => ({ ...c, quality: { ...c.quality } })));
    setRpm(INITIAL_RPM.map((r) => ({ ...r, vitals: { ...r.vitals } })));
    setTick(20);
    setInspect(null);
    pushToast("Virtual care reset", "Consults, RPM devices and adherence restored to baseline", "medium");
  }, [pushToast]);

  const handleJoin = useCallback((consultId) => {
    setConsults((prev) => prev.map((c) => (c.id === consultId ? { ...c, status: "in-session", startTick: seqRef.current } : c)));
    pushToast("Consult started", `${consultId} joined — session live in virtual room`, "low");
  }, [pushToast]);

  const handleEnd = useCallback((consultId) => {
    setConsults((prev) => prev.map((c) => (c.id === consultId ? { ...c, status: "completed" } : c)));
    pushToast("Session ended", `${consultId} completed — notes saved to EHR`, "low");
  }, [pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "vitals" ? rpm : activeTab === "adherence" ? adherence : consults;
    const header = activeTab === "vitals"
      ? ["id", "name", "condition", "hr", "sbp", "spo2", "glucose", "weight", "compliance", "flags"]
      : activeTab === "adherence"
        ? ["id", "patient", "medAdherence", "apptAdherence", "tasksDone", "tasksTotal", "risk", "nextVisit"]
        : ["id", "provider", "specialty", "patient", "status", "durationMin", "device", "location", "video", "audio", "latencyMs"];
    const csv = [
      header.map(csvEscape).join(","),
      ...rows.map((r) =>
        (activeTab === "vitals"
          ? [r.id, r.name, r.condition, r.vitals.hr, r.vitals.sbp, r.vitals.spo2, r.vitals.glucose, r.vitals.weight, r.compliance, r.flags.join(" | ")]
          : activeTab === "adherence"
            ? [r.id, r.patient, r.medAdherence, r.apptAdherence, r.tasksDone, r.tasksTotal, adherenceRisk(r), r.nextVisit]
            : [r.id, r.provider, r.specialty, r.patient, r.status, r.durationMin, r.device, r.location, r.quality.video, r.quality.audio, r.quality.latencyMs]
        ).map(csvEscape).join(",")
      ),
    ].join("\n");
    downloadCsv(`medtrack-telehealth-${activeTab}-${Date.now()}.csv`, csv);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, consults, rpm, adherence, pushToast]);

  const stats = useMemo(() => {
    const live = consults.filter((c) => c.status === "in-session").length;
    const flagged = rpm.filter((r) => rpmRisk(r) === "critical" || rpmRisk(r) === "high").length;
    const intervention = adherence.filter((a) => adherenceRisk(a) === "high").length;
    const avgLatency = consults.filter((c) => c.status === "in-session").length > 0
      ? Math.round(consults.filter((c) => c.status === "in-session").reduce((a, c) => a + c.quality.latencyMs, 0) / consults.filter((c) => c.status === "in-session").length)
      : 0;
    return { live, flagged, intervention, avgLatency };
  }, [consults, rpm, adherence]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Video size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Telehealth &amp; Remote Patient Management</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} />
                  <span className="text-slate-600">·</span>
                  <span>Video Consults · Remote Vitals · Adherence</span>
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
            />
            <ExportButton onClick={handleExport} exporting={exporting} />
          </div>
        </div>

        {/* ---------- Stat row ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Video} label="Live sessions" value={stats.live} sub={`across ${consults.length} scheduled consults`} tone="emerald" />
          <StatCard icon={HeartPulse} label="RPM patients flagged" value={stats.flagged} sub={`of ${rpm.length} remote monitoring`} tone="rose" />
          <StatCard icon={Pill} label="Intervention needed" value={stats.intervention} sub="adherence < 80% on meds or appts" tone="amber" />
          <StatCard icon={Wifi} label="Session latency p50" value={stats.avgLatency > 0 ? `${stats.avgLatency}ms` : "—"} sub="live sessions only" tone="sky" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              {activeTab === "consults" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> status chips above</span>
              )}
              {activeTab === "vitals" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> severity chips above</span>
              )}
              {activeTab === "adherence" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> risk chips above</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "consults" && (
              <ConsultsTab consults={consults} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} tick={tick} onInspect={setInspect} onJoin={handleJoin} onEnd={handleEnd} />
            )}
            {activeTab === "vitals" && (
              <RemoteVitalsTab patients={rpm} search={search} severity={severity} onInspect={setInspect} />
            )}
            {activeTab === "adherence" && (
              <AdherenceTab adherence={adherence} search={search} riskFilter={riskFilter} setRiskFilter={setRiskFilter} onInspect={setInspect} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.quality !== undefined) {
            const c = inspect;
            const liveSession = c.status === "in-session";
            return (
              <Modal open onClose={() => setInspect(null)} title={`${c.patient} — ${c.specialty} consult`} subtitle={`${c.id} · ${c.provider}`} icon={Video} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={c.status} map={CONSULT_STATUS_META} />
                    <span className="text-[11px] text-slate-500">{c.device} · {c.location} · {c.followup ? "follow-up" : "initial"}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Session focus</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{c.notes}</p>
                  </div>
                  {liveSession ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Session quality</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <QualityMeter label="Video" value={c.quality.video} icon={Camera} />
                        <QualityMeter label="Audio" value={c.quality.audio} icon={Mic} />
                        <QualityMeter label={`Latency ${c.quality.latencyMs}ms`} value={c.quality.latencyMs > 150 ? 40 : c.quality.latencyMs > 100 ? 70 : 95} icon={Wifi} />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <p className="text-xs text-slate-500">{c.status === "queued" ? "Patient is in the virtual waiting room." : "Scheduled and not yet started."}</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Provider" value={c.provider} />
                    <InfoRow label="Specialty" value={c.specialty} />
                    <InfoRow label="Patient (RPM link)" value={`${c.patient} · ${c.patientId}`} mono />
                    <InfoRow label="Duration" value={liveSession ? `${c.durationMin} min elapsed` : "not started"} />
                    <InfoRow label="Endpoint" value={`${c.device.toLowerCase()} · ${c.location.toLowerCase()}`} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    {c.status === "queued" && (
                      <button onClick={() => handleJoin(c.id)} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20">
                        <Video size={14} /> Start now
                      </button>
                    )}
                    {c.status === "in-session" && (
                      <button onClick={() => handleEnd(c.id)} className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20">
                        <Phone size={14} /> End session
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Calendar size={14} /> Reschedule
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <MessageSquare size={14} /> Chat transcript
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.deviceDays !== undefined) {
            const r = inspect;
            const risk = rpmRisk(r);
            const sev = SEVERITY_META[risk] || SEVERITY_META.medium;
            const hrSeries = seededSeries(r.id.length * 7 + 3, SEED_POINTS, r.vitals.hr, 8);
            const spo2Series = seededSeries(r.id.length * 13 + 1, SEED_POINTS, r.vitals.spo2, 3);
            const glucoseSeries = seededSeries(r.id.length * 17 + 5, SEED_POINTS, r.vitals.glucose, 14);
            return (
              <Modal open onClose={() => setInspect(null)} title={r.name} subtitle={`${r.id} · ${r.condition}`} icon={HeartPulse} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={risk}>{risk} risk</Badge>
                    <span className="text-[11px] text-slate-500">{r.age}y · device worn {r.deviceDays} days · {r.compliance}% compliance</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {[
                      { k: "hr", label: "HR", unit: "bpm" }, { k: "sbp", label: "SBP", unit: "mmHg" }, { k: "dbp", label: "DBP", unit: "mmHg" }, { k: "spo2", label: "SpO₂", unit: "%" }, { k: "glucose", label: "Glu", unit: "mg/dL" }, { k: "weight", label: "Wt", unit: "kg" },
                    ].map(({ k, label, unit }) => (
                      <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                        <p className="text-lg font-black text-white tabular-nums">{r.vitals[k]}</p>
                        <p className="text-[10px] text-slate-500">{label} <span className="text-slate-600">({unit})</span></p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-3">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">HR · 22 readings</p>
                      <MiniSparkline points={hrSeries} tone={r.vitals.hr > 105 ? "rose" : "sky"} width={180} height={44} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">SpO₂ · 22 readings</p>
                      <MiniSparkline points={spo2Series} tone={r.vitals.spo2 < 92 ? "rose" : "emerald"} width={180} height={44} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Glucose · 22 readings</p>
                      <MiniSparkline points={glucoseSeries} tone={r.vitals.glucose > 200 ? "amber" : "violet"} width={180} height={44} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {r.flags.map((f) => (
                      <p key={f} className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                        <AlertTriangle size={11} /> {f}
                      </p>
                    ))}
                    {r.flags.length === 0 && (
                      <p className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 size={11} /> All vitals within threshold
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Device compliance" value={`${r.compliance}%`} mono />
                    <InfoRow label="Days worn" value={r.deviceDays} mono />
                    <InfoRow label="Last sync" value={`${r.lastSyncMin} min ago`} />
                    <InfoRow label="Device" value={`${r.id}-HUB · Bluetooth LE gateway`} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Phone size={14} /> Nurse outreach
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Calendar size={14} /> Schedule virtual visit
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Full trend report
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const a = inspect;
          const risk = adherenceRisk(a);
          return (
            <Modal open onClose={() => setInspect(null)} title={a.patient} subtitle={`${a.id} · ${a.plan}`} icon={Pill} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={risk}>{risk === "low" ? "on track" : risk === "medium" ? "watch" : "intervention"}</Badge>
                  <span className="text-[11px] text-slate-500">next visit {a.nextVisit}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Pill size={14} className="mx-auto text-sky-400" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.medAdherence}%</p>
                    <p className="text-[10px] text-slate-500">Med adherence</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Calendar size={14} className="mx-auto text-violet-400" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.apptAdherence}%</p>
                    <p className="text-[10px] text-slate-500">Appt adherence</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Layers size={14} className="mx-auto text-amber-400" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.tasksDone}/{a.tasksTotal}</p>
                    <p className="text-[10px] text-slate-500">Plan tasks</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Adherence profile</p>
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div>
                      <div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-500">Medications</span><span className="font-bold text-slate-200 tabular-nums">{a.medAdherence}%</span></div>
                      <ProgressBar pct={a.medAdherence} tone={a.medAdherence < 80 ? "rose" : a.medAdherence < 90 ? "amber" : "emerald"} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-500">Appointments</span><span className="font-bold text-slate-200 tabular-nums">{a.apptAdherence}%</span></div>
                      <ProgressBar pct={a.apptAdherence} tone={a.apptAdherence < 85 ? "rose" : a.apptAdherence < 95 ? "amber" : "emerald"} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-500">Care-plan tasks</span><span className="font-bold text-slate-200 tabular-nums">{Math.round((a.tasksDone / a.tasksTotal) * 100)}%</span></div>
                      <ProgressBar pct={(a.tasksDone / a.tasksTotal) * 100} tone="sky" />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Active care plan" value={a.plan} />
                  <InfoRow label="Next scheduled visit" value={a.nextVisit} />
                  <InfoRow label="Adherence risk" value={risk} />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20">
                    <Bell size={14} /> Send adherence reminder
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                    <MessageSquare size={14} /> Message patient
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <FileText size={14} /> Care plan detail
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
            <Video size={12} className="text-emerald-500" />
            Simulated virtual care · no PHI · HIPAA-compliant video (DTLS-SRTP) &amp; RPM gateway
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> CMS telehealth parity modeled · FDA-cleared RPM device framing
          </p>
        </div>
      </div>
    </div>
  );
}
