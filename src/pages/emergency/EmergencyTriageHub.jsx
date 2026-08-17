import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Ambulance, ArrowRight, Award, BarChart3, Bed, Bell,
  Building2, CheckCircle2, ChevronRight, Clock, Cpu, Download, FileText, Filter,
  Flame, Gauge, HeartPulse, Hospital, Info, Layers, Lock, MapPin, Navigation,
  Pause, Phone, Play, Plus, Radio, RefreshCw, Route, Search, ShieldCheck, Siren,
  Stethoscope, Timer, TrendingDown, TrendingUp, User, Users, X, Zap
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
import { downloadCsv } from "../../utils/csv";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Hospital Operations & Emergency Triage Hub
 *  ------------------------------------------------------------------
 *  Three consoles for emergency department command:
 *    1. ER Triage Queue   - live ED census with ESI triage levels,
 *                           chief complaints, wait times and zones.
 *    2. Bed Capacity Board - hospital-wide census: occupied vs available
 *                           per unit, boarding load and predicted demand.
 *    3. Ambulance Routing  - inbound EMS units with ETAs, acuity and
 *                           closest-ED routing recommendations.
 *
 *  The ED simulates client-side: arrivals stream in with weighted ESI
 *  acuity, wait times age, discharges free beds, units deliver patients
 *  and new EMS calls spawn.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */

const ESI_META = {
  1: { label: "ESI 1 · Resuscitation", tone: "critical", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  2: { label: "ESI 2 · Emergent", tone: "critical", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  3: { label: "ESI 3 · Urgent", tone: "high", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  4: { label: "ESI 4 · Semi-urgent", tone: "medium", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  5: { label: "ESI 5 · Non-urgent", tone: "low", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};



const UNIT_META = {
  "ED": { icon: Siren, tone: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  "ICU West": { icon: Activity, tone: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  "ICU East": { icon: Activity, tone: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  "Med-Surg": { icon: Bed, tone: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  "Telemetry": { icon: HeartPulse, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  "PACU": { icon: Stethoscope, tone: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  "Peds": { icon: Users, tone: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  "Psych": { icon: Layers, tone: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
};

const TABS = [
  { key: "triage", label: "ER Triage Queue", icon: Siren, blurb: "Live ED census with ESI acuity, wait times & zones" },
  { key: "beds", label: "Bed Capacity Board", icon: Bed, blurb: "Census per unit, boarding load & predicted demand" },
  { key: "routing", label: "Ambulance Routing", icon: Ambulance, blurb: "Inbound EMS units, ETAs & closest-ED routing" },
];

const INITIAL_PATIENTS = [
  { id: "ED-8821", name: "Harold Finch", mrn: "MRN-100294", esi: 2, chiefComplaint: "Chest pain, diaphoresis", zone: "Resus A", age: 67, arrivalTick: 1, vitals: { hr: 118, rr: 24, spo2: 93, sbp: 148, temp: 37.2 }, disposition: "evaluating", provider: "Dr. M. Alvarez" },
  { id: "ED-8822", name: "Gloria Santos", mrn: "MRN-100118", esi: 3, chiefComplaint: "Abdominal pain RUQ", zone: "Acute B", age: 44, arrivalTick: 2, vitals: { hr: 92, rr: 18, spo2: 98, sbp: 122, temp: 37.8 }, disposition: "evaluating", provider: "Dr. R. Callahan" },
  { id: "ED-8823", name: "Tom Vasquez", mrn: "MRN-099881", esi: 5, chiefComplaint: "Mild ankle sprain", zone: "Fast Track", age: 24, arrivalTick: 3, vitals: { hr: 76, rr: 15, spo2: 99, sbp: 118, temp: 36.9 }, disposition: "discharge-ready", provider: "NP S. Whitfield" },
  { id: "ED-8824", name: "Ingrid Larsen", mrn: "MRN-100401", esi: 1, chiefComplaint: "Unresponsive, GCS 7", zone: "Resus A", age: 71, arrivalTick: 1, vitals: { hr: 132, rr: 8, spo2: 86, sbp: 76, temp: 35.9 }, disposition: "evaluating", provider: "Dr. E. Sorensen" },
  { id: "ED-8825", name: "Kwame Mensah", mrn: "MRN-099540", esi: 3, chiefComplaint: "Shortness of breath", zone: "Acute A", age: 58, arrivalTick: 4, vitals: { hr: 104, rr: 26, spo2: 91, sbp: 138, temp: 37.6 }, disposition: "evaluating", provider: "Dr. M. Alvarez" },
  { id: "ED-8826", name: "Lena Kowalski", mrn: "MRN-100332", esi: 4, chiefComplaint: "Laceration - finger", zone: "Fast Track", age: 31, arrivalTick: 5, vitals: { hr: 82, rr: 16, spo2: 99, sbp: 124, temp: 37.0 }, disposition: "discharge-ready", provider: "NP S. Whitfield" },
  { id: "ED-8827", name: "Dmitri Volkov", mrn: "MRN-099912", esi: 2, chiefComplaint: "Stroke symptoms L-sided weakness", zone: "Resus B", age: 69, arrivalTick: 2, vitals: { hr: 96, rr: 20, spo2: 96, sbp: 172, temp: 36.8 }, disposition: "admit-pending", provider: "Dr. R. Callahan" },
  { id: "ED-8828", name: "Aisha Rahman", mrn: "MRN-100210", esi: 3, chiefComplaint: "Fever + productive cough", zone: "Acute B", age: 52, arrivalTick: 6, vitals: { hr: 110, rr: 22, spo2: 94, sbp: 128, temp: 38.4 }, disposition: "evaluating", provider: "Dr. E. Sorensen" },
  { id: "ED-8829", name: "Peter Novak", mrn: "MRN-099750", esi: 4, chiefComplaint: "Foreign body in ear", zone: "Fast Track", age: 8, arrivalTick: 7, vitals: { hr: 98, rr: 18, spo2: 99, sbp: 104, temp: 37.0 }, disposition: "evaluating", provider: "NP S. Whitfield" },
  { id: "ED-8830", name: "Marta Delgado", mrn: "MRN-100455", esi: 2, chiefComplaint: "Anaphylaxis - seafood", zone: "Resus B", age: 39, arrivalTick: 3, vitals: { hr: 122, rr: 26, spo2: 89, sbp: 96, temp: 37.1 }, disposition: "admit-pending", provider: "Dr. M. Alvarez" },
  { id: "ED-8831", name: "Stanley Osei", mrn: "MRN-099633", esi: 3, chiefComplaint: "Fall with hip pain", zone: "Acute A", age: 78, arrivalTick: 8, vitals: { hr: 88, rr: 18, spo2: 96, sbp: 134, temp: 36.9 }, disposition: "evaluating", provider: "Dr. E. Sorensen" },
  { id: "ED-8832", name: "Nadia Petrova", mrn: "MRN-100377", esi: 5, chiefComplaint: "Refill request - migraine", zone: "Fast Track", age: 35, arrivalTick: 9, vitals: { hr: 74, rr: 15, spo2: 99, sbp: 112, temp: 36.8 }, disposition: "discharge-ready", provider: "NP S. Whitfield" },
];

const INITIAL_BEDS = [
  { id: "UNIT-ED", name: "Emergency Department", type: "ED", total: 42, occupied: 38, boarding: 6, predictedDemand: 9, acuityMix: "mixed" },
  { id: "UNIT-ICW", name: "ICU West", type: "ICU West", total: 16, occupied: 14, boarding: 0, predictedDemand: 3, acuityMix: "critical" },
  { id: "UNIT-ICE", name: "ICU East", type: "ICU East", total: 14, occupied: 11, boarding: 0, predictedDemand: 2, acuityMix: "critical" },
  { id: "UNIT-MS", name: "Med-Surg North", type: "Med-Surg", total: 48, occupied: 39, boarding: 0, predictedDemand: 6, acuityMix: "acute" },
  { id: "UNIT-TEL", name: "Telemetry 2", type: "Telemetry", total: 24, occupied: 19, boarding: 0, predictedDemand: 4, acuityMix: "cardiac" },
  { id: "UNIT-PACU", name: "PACU / Recovery", type: "PACU", total: 12, occupied: 9, boarding: 2, predictedDemand: 5, acuityMix: "post-op" },
  { id: "UNIT-PED", name: "Pediatrics", type: "Peds", total: 20, occupied: 13, boarding: 0, predictedDemand: 3, acuityMix: "pediatric" },
  { id: "UNIT-PSY", name: "Behavioral Health", type: "Psych", total: 18, occupied: 16, boarding: 4, predictedDemand: 2, acuityMix: "psych" },
];

const INITIAL_AMBULANCES = [
  { id: "AMB-11", unit: "A-11", origin: "District 4 · Overlook Rd", dest: "MedTrack General", etaTicks: 8, acuity: "P1", lightsSirens: true, patients: 1, crew: "2 crew", distanceKm: 7.2, status: "enroute", route: "I-5 S → Exit 12" },
  { id: "AMB-12", unit: "A-12", origin: "District 2 · Maple Ave", dest: "MedTrack General", etaTicks: 12, acuity: "P2", lightsSirens: false, patients: 1, crew: "2 crew", distanceKm: 11.4, status: "enroute", route: "Hwy 101 → Main St" },
  { id: "AMB-13", unit: "A-13", origin: "St. Mary's Hospital (transfer)", dest: "MedTrack General", etaTicks: 18, acuity: "P2", lightsSirens: true, patients: 1, crew: "CCT nurse on board", distanceKm: 16.8, status: "enroute", route: "I-405 N → Mercy Blvd" },
  { id: "AMB-14", unit: "A-14", origin: "District 1 · Riverside", dest: "MedTrack General", etaTicks: 5, acuity: "P1", lightsSirens: true, patients: 1, crew: "Paramedic pair", distanceKm: 4.1, status: "on-scene", route: "Riverside Dr → ED Bay 1" },
  { id: "AMB-15", unit: "A-15", origin: "District 6 · Industrial Pkwy", dest: "MedTrack General", etaTicks: 22, acuity: "P3", lightsSirens: false, patients: 1, crew: "EMT pair", distanceKm: 21.3, status: "enroute", route: "Industrial Pkwy → I-5 N" },
  { id: "AMB-16", unit: "A-16", origin: "Riverton Clinic (interfacility)", dest: "MedTrack General", etaTicks: 14, acuity: "P2", lightsSirens: false, patients: 1, crew: "RN escort", distanceKm: 13.9, status: "enroute", route: "Hwy 9 → Cedar Ave" },
];

const ARRIVAL_POOL = [
  { name: "Chris Donovan", age: 47, chiefComplaint: "Syncopal episode", esi: 2 },
  { name: "Elena Fischer", age: 63, chiefComplaint: "Diabetic ketoacidosis", esi: 2 },
  { name: "Raj Patel", age: 55, chiefComplaint: "Cellulitis - lower leg", esi: 3 },
  { name: "Sara Quinn", age: 29, chiefComplaint: "Migraine, photophobia", esi: 4 },
  { name: "Omar Haddad", age: 66, chiefComplaint: "GI bleed, melena", esi: 2 },
  { name: "Betty Chen", age: 81, chiefComplaint: "Altered mental status", esi: 1 },
  { name: "Miguel Torres", age: 40, chiefComplaint: "Flank pain, hematuria", esi: 3 },
  { name: "Hannah Lind", age: 19, chiefComplaint: "Anxiety attack", esi: 5 },
];

const SEED_POINTS = 22;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */

const seededSeries = (seed, n = SEED_POINTS, base = 50, amp = 14, lo = 0, hi = 100) =>
  series(seed, n, base, amp, { lo, hi, pull: 0.09 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);


const waitLabel = (ticks) => {
  const mins = ticks * 3;
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const occupancyPct = (u) => Math.round((u.occupied / u.total) * 100);
const unitStatus = (u) => (occupancyPct(u) >= 100 ? "critical" : occupancyPct(u) >= 85 ? "high" : occupancyPct(u) >= 65 ? "medium" : "low");

const esiTone = (esi) => ESI_META[esi].tone;

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */









function EsiPad({ esi }) {
  const meta = ESI_META[esi] || ESI_META[3];
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${meta.cls}`}>{esi}</span>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 1 - ER Triage Queue
 * ------------------------------------------------------------------ */

function TriageTab({ patients, search, severity, tick, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesSearch = !q || [p.id, p.name, p.mrn, p.chiefComplaint, p.zone, p.provider].some((f) => String(f).toLowerCase().includes(q));
      const level = esiTone(p.esi);
      const matchesSeverity = severity === "all" || level === severity || (severity === "high" && p.esi === 3);
      return matchesSearch && matchesSeverity;
    });
  }, [patients, search, severity]);

  const avgWait = patients.length > 0 ? Math.round(patients.reduce((a, p) => a + (tick - p.arrivalTick), 0) / patients.length) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((e) => {
          const count = patients.filter((p) => p.esi === e).length;
          return (
            <span key={e} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${ESI_META[e].cls}`}>
              ESI {e} <span className="tabular-nums opacity-80">· {count}</span>
            </span>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-500">avg wait {waitLabel(avgWait)} · {filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Siren size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No patients match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Clear the search or widen the triage-level chips.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const meta = ESI_META[p.esi];
            const waitTicks = tick - p.arrivalTick;
            const breached = (p.esi <= 2 && waitTicks >= 10) || (p.esi === 3 && waitTicks >= 30);
            const hrSeries = seededSeries(p.id.length * 7 + 1, SEED_POINTS, p.vitals.hr, 8);
            return (
              <button
                key={p.id}
                onClick={() => onInspect(p)}
                className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${breached ? "border-rose-500/40" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <EsiPad esi={p.esi} />
                    <div>
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.id} · {p.mrn}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black tabular-nums ${breached ? "text-rose-400" : "text-slate-300"}`}>{waitLabel(waitTicks)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{breached ? "wait breached" : "in queue"}</p>
                  </div>
                </div>

                <p className="mt-2 truncate text-xs text-slate-300">{p.chiefComplaint}</p>
                <p className="mt-1 text-[10px] text-slate-500">{p.zone} · {p.age}y · {p.provider}</p>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[
                    { k: "hr", label: "HR", bad: p.vitals.hr > 115 || p.vitals.hr < 50 },
                    { k: "rr", label: "RR", bad: p.vitals.rr > 26 },
                    { k: "spo2", label: "SpO₂", bad: p.vitals.spo2 < 92 },
                    { k: "sbp", label: "SBP", bad: p.vitals.sbp < 90 },
                  ].map(({ k, label, bad }) => (
                    <div key={k} className={`rounded-lg border px-1 py-1.5 text-center ${bad ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/60"}`}>
                      <p className={`text-xs font-black tabular-nums ${bad ? "text-rose-400" : "text-slate-100"}`}>{p.vitals[k]}</p>
                      <p className="text-[9px] text-slate-600">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex-1">
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">HR trend</p>
                    <MiniSparkline points={hrSeries} tone={p.vitals.hr > 115 ? "rose" : "sky"} width={150} height={28} />
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold capitalize ${p.disposition === "discharge-ready" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : p.disposition === "admit-pending" ? "border-violet-500/30 bg-violet-500/10 text-violet-400" : "border-slate-700 bg-slate-800/60 text-slate-400"}`}>
                    {p.disposition.replace("-", " ")}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className="text-[10px] text-slate-500">{meta.label}</span>
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
 *  Tab 2 - Bed Capacity Board
 * ------------------------------------------------------------------ */

function BedCapacityTab({ beds, search, onInspect, onHoldBed }) {
  const [censusFilter, setCensusFilter] = useState("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds.filter((u) => {
      const matchesSearch = !q || [u.id, u.name, u.type].some((f) => String(f).toLowerCase().includes(q));
      const matchesCensus = censusFilter === "all" || unitStatus(u) === censusFilter;
      return matchesSearch && matchesCensus;
    });
  }, [beds, search, censusFilter]);

  const totals = useMemo(() => {
    const total = beds.reduce((a, u) => a + u.total, 0);
    const occupied = beds.reduce((a, u) => a + u.occupied, 0);
    const boarding = beds.reduce((a, u) => a + u.boarding, 0);
    return { total, occupied, boarding, free: total - occupied };
  }, [beds]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All units" }, { key: "critical", label: "Full" }, { key: "high", label: "High census" }, { key: "medium", label: "Monitoring" }, { key: "low", label: "Available" },
        ].map(({ key, label }) => {
          const active = censusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setCensusFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-500">
          {fmtNumber(totals.free)} free of {fmtNumber(totals.total)} · {fmtNumber(totals.boarding)} boarding
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Bed size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No units match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or census chips.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map((u) => {
            const meta = UNIT_META[u.type] || UNIT_META["Med-Surg"];
            const Icon = meta.icon;
            const pct = occupancyPct(u);
            const status = unitStatus(u);
            const sev = SEVERITY_META[status] || SEVERITY_META.medium;
            const demandSeries = seededSeries(u.id.length * 3 + 1, 12, u.predictedDemand * 10, 18, 0, 100);
            const full = pct >= 100;
            return (
              // A div rather than a <button>: the card carries the inspect action while its
              // "Reserve bed" control is a real button, and interactive content nested inside
              // a button is invalid HTML (browsers close the outer button early and React
              // warns about a hydration error). role/tabIndex/onKeyDown keep it keyboard
              // accessible, matching the button it replaces.
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => onInspect(u)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onInspect(u);
                  }
                }}
                className={`cursor-pointer rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${full ? "border-rose-500/40" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${meta.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{u.name}</p>
                      <p className="text-[11px] text-slate-500">{u.id} · {u.acuityMix} mix</p>
                    </div>
                  </div>
                  <Badge tone={status}>{full ? "full" : `${pct}%`}</Badge>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-white tabular-nums">{u.occupied}<span className="text-sm font-semibold text-slate-500"> / {u.total}</span></p>
                    <p className="text-[10px] text-slate-500">{u.total - u.occupied} available</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-amber-400 tabular-nums">{u.boarding} boarding</p>
                    <p className="text-[10px] text-slate-500">ED holds</p>
                  </div>
                </div>

                <div className="mt-3">
                  <ProgressBar pct={pct} tone={full ? "rose" : status === "high" ? "amber" : status === "medium" ? "sky" : "emerald"} />
                </div>

                <div className="mt-3">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Predicted demand · 12h</p>
                  <MiniSparkline points={demandSeries} tone={status === "high" || full ? "amber" : "sky"} width={200} height={28} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onHoldBed(u.id); }}
                    disabled={u.occupied >= u.total}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${u.occupied >= u.total ? "text-slate-600" : "text-sky-400 hover:bg-sky-500/10"}`}
                  >
                    <Plus size={11} /> {u.occupied >= u.total ? "Full" : "Reserve bed"}
                  </button>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                    Inspect <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - Ambulance Routing
 * ------------------------------------------------------------------ */

function RoutingTab({ ambulances, search, tick, onInspect }) {
  const [acuityFilter, setAcuityFilter] = useState("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ambulances.filter((a) => {
      const matchesSearch = !q || [a.id, a.unit, a.origin, a.dest, a.route, a.crew].some((f) => String(f).toLowerCase().includes(q));
      const matchesAcuity = acuityFilter === "all" || a.acuity === acuityFilter;
      return matchesSearch && matchesAcuity;
    });
  }, [ambulances, search, acuityFilter]);

  const enroute = ambulances.filter((a) => a.status === "enroute").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All units" }, { key: "P1", label: "P1 · Critical", cls: "text-rose-400 border-rose-500/30 bg-rose-500/10" }, { key: "P2", label: "P2 · Urgent", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" }, { key: "P3", label: "P3 · Routine", cls: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
        ].map(({ key, label, cls }) => {
          const active = acuityFilter === key;
          return (
            <button
              key={key}
              onClick={() => setAcuityFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? (cls || "border-sky-500/40 bg-sky-500/10 text-sky-400") : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-500">{enroute} enroute · tick #{tick}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Ambulance size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No inbound units match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">All clear on this lane — or widen the acuity chips.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const p1 = a.acuity === "P1";
            const level = a.acuity === "P1" ? "critical" : a.acuity === "P2" ? "high" : "medium";
            const sev = SEVERITY_META[level] || SEVERITY_META.medium;
            const arriving = a.etaTicks <= 3;
            return (
              <button
                key={a.id}
                onClick={() => onInspect(a)}
                className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${p1 ? "border-rose-500/40" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${p1 ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-slate-700 bg-slate-800 text-sky-400"}`}>
                      <Ambulance size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Unit {a.unit}</p>
                      <p className="text-[11px] text-slate-500">{a.id} · {a.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tabular-nums ${arriving ? "text-emerald-400" : "text-slate-200"}`}>{a.etaTicks}<span className="text-[10px] text-slate-500"> min</span></p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{arriving ? "arriving" : "ETA"}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={level}>{a.acuity} acuity</Badge>
                  {a.lightsSirens && (
                    <span className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                      <Siren size={10} /> L&amp;S
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">{a.patients} patient{a.patients === 1 ? "" : "s"} · {a.crew}</span>
                </div>

                <div className="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="flex items-start gap-2 text-[11px] text-slate-300">
                    <MapPin size={12} className="mt-0.5 shrink-0 text-slate-500" /> {a.origin}
                  </p>
                  <p className="flex items-start gap-2 text-[11px] text-slate-300">
                    <Navigation size={12} className="mt-0.5 shrink-0 text-sky-400" /> {a.dest}
                  </p>
                  <p className="flex items-start gap-2 text-[10px] text-slate-500">
                    <Route size={12} className="mt-0.5 shrink-0 text-slate-600" /> {a.route} · {a.distanceKm} km
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className={`flex items-center gap-1 text-[10px] font-bold ${sev.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} /> {sev.label}
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
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function EmergencyTriageHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("triage");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [beds, setBeds] = useState(INITIAL_BEDS);
  const [ambulances, setAmbulances] = useState(INITIAL_AMBULANCES);
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9000);
  const { toasts, pushToast, dismissToast } = useToasts();
  const patientsRef = useRef(patients);
  const ambulancesRef = useRef(ambulances);
  useEffect(() => { patientsRef.current = patients; }, [patients]);
  useEffect(() => { ambulancesRef.current = ambulances; }, [ambulances]);



  const adjustOccupancy = useCallback((unitId, delta) => {
    setBeds((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, occupied: clamp(u.occupied + delta, 0, u.total) } : u))
    );
  }, []);

  /* Live ED simulation loop. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      // New arrivals stream in with weighted ESI acuity.
      if (Math.random() < 0.45) {
        const pool = ARRIVAL_POOL;
        const a = pool[Math.floor(Math.random() * pool.length)];
        const id = `ED-${8833 + seqRef.current++}`;
        const esi = a.esi + (Math.random() < 0.15 ? (Math.random() < 0.5 ? 1 : -1) : 0);
        setPatients((prev) => [
          {
            id,
            name: a.name,
            mrn: `MRN-${100000 + Math.floor(Math.random() * 90000)}`,
            esi: clamp(esi, 1, 5),
            chiefComplaint: a.chiefComplaint,
            zone: esi <= 2 ? "Resus A" : esi === 3 ? "Acute A" : "Fast Track",
            age: a.age,
            arrivalTick: seqRef.current,
            vitals: { hr: 80 + Math.floor(Math.random() * 40), rr: 16 + Math.floor(Math.random() * 10), spo2: 90 + Math.floor(Math.random() * 9), sbp: 100 + Math.floor(Math.random() * 60), temp: 36.8 + Math.round(Math.random() * 10) / 10 },
            disposition: "evaluating",
            provider: esi <= 2 ? "Dr. E. Sorensen" : "Dr. M. Alvarez",
          },
          ...prev,
        ].slice(0, 20));
        if (esi <= 2) {
          pushToast(`P1 arrival — ${a.name}`, `${id} · ${a.chiefComplaint} · assigned ${esi <= 1 ? "Resus A" : "Resus B"}`, "critical");
        }
      }

      // Ambulances tick toward delivery.
      const delivered = ambulancesRef.current.filter((a) => a.etaTicks - 1 <= 0 && a.status === "enroute");
      delivered.forEach((a) => {
        adjustOccupancy("UNIT-ED", 1);
        pushToast(`Unit ${a.unit} delivered`, `${a.origin} → ED bay · ${a.acuity} patient arriving at triage`, "high");
      });
      setAmbulances((prev) =>
        prev
          .map((a) => (a.status === "enroute" ? { ...a, etaTicks: Math.max(0, a.etaTicks - 1) } : a))
          .filter((a) => a.status !== "enroute" || a.etaTicks > 0)
      );

      // Occasional EMS call spawns a new inbound unit.
      if (Math.random() < 0.12) {
        const acuity = Math.random() < 0.3 ? "P1" : Math.random() < 0.7 ? "P2" : "P3";
        setAmbulances((prev) => [
          {
            id: `AMB-${17 + seqRef.current % 90}`,
            unit: `A-${17 + seqRef.current % 90}`,
            origin: `District ${1 + Math.floor(Math.random() * 6)} · new call`,
            dest: "MedTrack General",
            etaTicks: 6 + Math.floor(Math.random() * 10),
            acuity,
            lightsSirens: acuity === "P1",
            patients: 1,
            crew: acuity === "P1" ? "Paramedic pair" : "EMT pair",
            distanceKm: Math.round((5 + Math.random() * 15) * 10) / 10,
            status: "enroute",
            route: "Best route via live traffic",
          },
          ...prev,
        ].slice(0, 12));
        pushToast(`New EMS call dispatched`, `${acuity} acuity unit assigned to ED`, acuity === "P1" ? "critical" : "medium");
      }

      // Bed census drift: discharges happen, boarding persists.
      setBeds((prev) =>
        prev.map((u) => {
          let occupied = u.occupied;
          if (Math.random() < 0.08 && occupied > 0) occupied -= 1;
          if (u.id === "UNIT-ED" && Math.random() < 0.1 && occupied < u.total) occupied += 1;
          return { ...u, occupied };
        })
      );
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, pushToast, adjustOccupancy]);

  const resetSimulation = useCallback(() => {
    setPatients(INITIAL_PATIENTS.map((p) => ({ ...p, vitals: { ...p.vitals } })));
    setBeds(INITIAL_BEDS.map((u) => ({ ...u })));
    setAmbulances(INITIAL_AMBULANCES.map((a) => ({ ...a })));
    setTick(20);
    setInspect(null);
    pushToast("ED reset", "Triage queue, census and EMS units restored to baseline", "medium");
  }, [pushToast]);

  const handleDischarge = useCallback((patientId) => {
    setPatients((prev) => prev.filter((p) => p.id !== patientId));
    setBeds((prev) =>
      prev.map((u) => (u.id === "UNIT-ED" && u.occupied > 0 ? { ...u, occupied: u.occupied - 1 } : u))
    );
    pushToast("Patient discharged", `${patientId} cleared from ED — bed released`, "low");
  }, [pushToast]);

  const handleHoldBed = useCallback((unitId) => {
    adjustOccupancy(unitId, 1);
    const unit = beds.find((u) => u.id === unitId);
    pushToast("Bed reserved", `${unit ? unit.name : unitId} — one bed held for inbound admission`, "medium");
  }, [beds, adjustOccupancy, pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "beds" ? beds : activeTab === "routing" ? ambulances : patients;
    const header = activeTab === "beds"
      ? ["id", "name", "type", "total", "occupied", "boarding", "predictedDemand"]
      : activeTab === "routing"
        ? ["id", "unit", "origin", "dest", "etaTicks", "acuity", "lightsSirens", "status", "route"]
        : ["id", "name", "mrn", "esi", "chiefComplaint", "zone", "disposition", "hr", "spo2"];
    const table = [
      header,
      ...rows.map((r) =>
        (activeTab === "beds"
          ? [r.id, r.name, r.type, r.total, r.occupied, r.boarding, r.predictedDemand]
          : activeTab === "routing"
            ? [r.id, r.unit, r.origin, r.dest, r.etaTicks, r.acuity, r.lightsSirens, r.status, r.route]
            : [r.id, r.name, r.mrn, r.esi, r.chiefComplaint, r.zone, r.disposition, r.vitals.hr, r.vitals.spo2]
        )
      ),
    ];
    downloadCsv(`medtrack-ems-${activeTab}-${Date.now()}.csv`, table);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, patients, beds, ambulances, pushToast]);

  const stats = useMemo(() => {
    const p1 = patients.filter((p) => p.esi <= 2).length;
    const freeBeds = beds.reduce((a, u) => a + (u.total - u.occupied), 0);
    const inbound = ambulances.filter((a) => a.status === "enroute").length;
    const avgWait = patients.length > 0 ? Math.round(patients.reduce((a, p) => a + (tick - p.arrivalTick), 0) / patients.length) : 0;
    return { p1, freeBeds, inbound, avgWait };
  }, [patients, beds, ambulances, tick]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400 shadow-lg shadow-rose-500/10">
                <Siren size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Hospital Operations &amp; Emergency Triage</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} />
                  <span className="text-slate-600">·</span>
                  <span>Triage Queue · Bed Capacity · EMS Routing</span>
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
          <StatCard icon={Siren} label="Resus-level patients" value={stats.p1} sub={`ESI 1–2 in the ED right now`} tone="rose" />
          <StatCard icon={Bed} label="Beds available" value={stats.freeBeds} sub="across all inpatient units" tone="sky" />
          <StatCard icon={Ambulance} label="Units inbound" value={stats.inbound} sub="active EMS responses to ED" tone="amber" />
          <StatCard icon={Timer} label="Avg ED wait" value={waitLabel(stats.avgWait)} sub="arrival → provider assignment" tone="emerald" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> triage:</span>
                {[
                  { key: "all", label: "All" }, { key: "critical", label: "ESI 1–2" }, { key: "high", label: "ESI 3" }, { key: "medium", label: "ESI 4" }, { key: "low", label: "ESI 5" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSeverity(key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      severity === key ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "triage" && (
              <TriageTab patients={patients} search={search} severity={severity} tick={tick} onInspect={setInspect} />
            )}
            {activeTab === "beds" && (
              <BedCapacityTab beds={beds} search={search} onInspect={setInspect} onHoldBed={handleHoldBed} />
            )}
            {activeTab === "routing" && (
              <RoutingTab ambulances={ambulances} search={search} tick={tick} onInspect={setInspect} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.esi !== undefined) {
            const p = inspect;
            const meta = ESI_META[p.esi];
            const waitTicks = tick - p.arrivalTick;
            const hrSeries = seededSeries(p.id.length * 7 + 1, SEED_POINTS, p.vitals.hr, 8);
            const spo2Series = seededSeries(p.id.length * 13 + 1, SEED_POINTS, p.vitals.spo2, 4);
            return (
              <Modal open onClose={() => setInspect(null)} title={p.name} subtitle={`${p.id} · ${p.mrn} · ${p.zone}`} icon={Stethoscope} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <EsiPad esi={p.esi} />
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                    <span className="text-[11px] text-slate-500">{p.age}y · {p.provider} · in queue {waitLabel(waitTicks)}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chief complaint</p>
                    <p className="mt-1 text-sm font-semibold text-white">{p.chiefComplaint}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { k: "hr", label: "Heart rate", unit: "bpm" }, { k: "rr", label: "Resp rate", unit: "/min" }, { k: "spo2", label: "SpO₂", unit: "%" }, { k: "sbp", label: "Systolic BP", unit: "mmHg" }, { k: "temp", label: "Temp", unit: "°C" }, { k: "esi", label: "Triage ESI", unit: "" },
                    ].map(({ k, label, unit }) => (
                      <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                        <p className="text-lg font-black text-white tabular-nums">{k === "esi" ? p.esi : p.vitals[k]}</p>
                        <p className="text-[10px] text-slate-500">{label} <span className="text-slate-600">({unit})</span></p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">HR trend</p>
                      <MiniSparkline points={hrSeries} tone={p.vitals.hr > 115 ? "rose" : "sky"} width={240} height={44} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">SpO₂ trend</p>
                      <MiniSparkline points={spo2Series} tone={p.vitals.spo2 < 92 ? "rose" : "emerald"} width={240} height={44} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Disposition" value={p.disposition.replace("-", " ")} />
                    <InfoRow label="Assigned provider" value={p.provider} />
                    <InfoRow label="Wait time" value={waitLabel(waitTicks)} />
                    <InfoRow label="Zone" value={p.zone} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button onClick={() => handleDischarge(p.id)} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20">
                      <CheckCircle2 size={14} /> Discharge &amp; release bed
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl bg-violet-500/10 px-3.5 py-2 text-xs font-bold text-violet-400 transition hover:bg-violet-500/20">
                      <Bed size={14} /> Request admission bed
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Full chart
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.total !== undefined) {
            const u = inspect;
            const meta = UNIT_META[u.type] || UNIT_META["Med-Surg"];
            const Icon = meta.icon;
            const pct = occupancyPct(u);
            const status = unitStatus(u);
            const demandSeries = seededSeries(u.id.length * 3 + 1, 12, u.predictedDemand * 10, 18, 0, 100);
            const occupancySeries = seededSeries(u.id.length * 5 + 2, SEED_POINTS, pct, 10, 30, 105);
            return (
              <Modal open onClose={() => setInspect(null)} title={u.name} subtitle={`${u.id} · ${u.type} · ${u.acuityMix} acuity mix`} icon={Icon} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status}>{pct >= 100 ? "Full" : `${pct}% occupied`}</Badge>
                    <span className="text-[11px] text-slate-500">{u.total - u.occupied} beds available now</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Bed size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.occupied}</p>
                      <p className="text-[10px] text-slate-500">Occupied</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Hospital size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.total - u.occupied}</p>
                      <p className="text-[10px] text-slate-500">Available</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Users size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.boarding}</p>
                      <p className="text-[10px] text-slate-500">Boarding</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <TrendingUp size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.predictedDemand}</p>
                      <p className="text-[10px] text-slate-500">Predicted demand</p>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Occupancy trend · 22h</p>
                      <MiniSparkline points={occupancySeries} tone={status === "high" || pct >= 100 ? "rose" : "sky"} width={240} height={44} min={30} max={105} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Predicted demand · 12h</p>
                      <MiniSparkline points={demandSeries} tone="amber" width={240} height={44} min={0} max={100} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Total capacity" value={u.total} mono />
                    <InfoRow label="Currently occupied" value={u.occupied} mono />
                    <InfoRow label="Boarding patients" value={u.boarding} mono />
                    <InfoRow label="Predicted next-12h demand" value={u.predictedDemand} mono />
                    <InfoRow label="Acuity mix" value={u.acuityMix} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button
                      onClick={() => handleHoldBed(u.id)}
                      disabled={u.occupied >= u.total}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${u.occupied >= u.total ? "border border-slate-800 text-slate-600" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"}`}
                    >
                      <Plus size={14} /> {u.occupied >= u.total ? "Unit full" : "Reserve bed"}
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Census report
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Layers size={14} /> Transfer matrix
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const a = inspect;
          const level = a.acuity === "P1" ? "critical" : a.acuity === "P2" ? "high" : "medium";
          return (
            <Modal open onClose={() => setInspect(null)} title={`Unit ${a.unit}`} subtitle={`${a.id} · ${a.status} · ${a.acuity} acuity`} icon={Ambulance} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={level}>{a.acuity} acuity</Badge>
                  {a.lightsSirens && (
                    <span className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                      <Siren size={10} /> Lights &amp; sirens
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">{a.patients} patient{a.patients === 1 ? "" : "s"} · {a.crew}</span>
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="flex items-start gap-2 text-xs text-slate-300"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-500" /> {a.origin}</p>
                  <p className="flex items-start gap-2 text-xs text-slate-300"><Navigation size={13} className="mt-0.5 shrink-0 text-sky-400" /> {a.dest}</p>
                  <p className="flex items-start gap-2 text-[11px] text-slate-500"><Route size={13} className="mt-0.5 shrink-0 text-slate-600" /> {a.route} · {a.distanceKm} km</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Timer size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.etaTicks}<span className="text-xs text-slate-500"> min</span></p>
                    <p className="text-[10px] text-slate-500">ETA</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Navigation size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.distanceKm}<span className="text-xs text-slate-500"> km</span></p>
                    <p className="text-[10px] text-slate-500">Distance</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Radio size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.acuity}</p>
                    <p className="text-[10px] text-slate-500">Priority</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Users size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{a.crew}</p>
                    <p className="text-[10px] text-slate-500">Crew</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Origin" value={a.origin} />
                  <InfoRow label="Destination" value={a.dest} />
                  <InfoRow label="Recommended route" value={a.route} />
                  <InfoRow label="Status" value={a.status} />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                    <Phone size={14} /> Contact crew
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <Radio size={14} /> CAD snapshot
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <Hospital size={14} /> Diversion options
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
            <Siren size={12} className="text-rose-500" />
            Simulated ED operations · no PHI · ESI v4 triage &amp; NEDOCS-aligned load model
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> HIPAA-safe demo · CAD/EMS interface modeled on NEMSIS v3
          </p>
        </div>
      </div>
    </div>
  );
}
