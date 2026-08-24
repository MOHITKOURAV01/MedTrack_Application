import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Beaker, Bell, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Clock, Download, Eye, FileText, Filter, Gauge,
  HeartPulse, Home, Info, Layers, Mail, MessageSquare, Pause, Phone, Play, Plus,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Sparkles, Stethoscope, Syringe, Target, Timer, TrendingDown, TrendingUp,
  User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const ACUITY_META = {
  Imminent: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Urgent: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Routine: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const TX_META = {
  CBT: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  DBT: { cls: "bg-violet-500/15 text-violet-300 border-violet-500/40" },
  ACT: { cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  EMDR: { cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40" },
  Psychodynamic: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
};

const SEED_CRISIS = [
  { id: "C-501", time: "09:42", caller: "Self", name: "Anon Caller 117", phq9: 21, gad7: 16, csu: "SI passive — no plan", acuity: "Urgent", disposition: "Same-day assessment", line: "988 Backup", status: "In Triage" },
  { id: "C-502", time: "09:51", caller: "Family member", name: "Jordan Reyes", phq9: 26, gad7: 19, csu: "SI active w/ plan + access", acuity: "Imminent", disposition: "ED referral", line: "Crisis 24/7", status: "Escalated" },
  { id: "C-503", time: "10:05", caller: "Self", name: "Anon Caller 118", phq9: 13, gad7: 11, csu: "Panic — no SI", acuity: "Routine", disposition: "Safety plan", line: "988 Backup", status: "De-escalated" },
  { id: "C-504", time: "10:17", caller: "School counselor", name: "Marcus Chen", phq9: 18, gad7: 12, csu: "SI passive + bullying", acuity: "Urgent", disposition: "Same-day assessment", line: "Crisis 24/7", status: "In Triage" },
  { id: "C-505", time: "10:29", caller: "Self", name: "Anon Caller 119", phq9: 24, gad7: 15, csu: "SI w/ intent, no access", acuity: "Imminent", disposition: "Mobile response", line: "988 Backup", status: "Escalated" },
  { id: "C-506", time: "10:41", caller: "Self", name: "Anon Caller 120", phq9: 9, gad7: 7, csu: "Grief — supportive", acuity: "Routine", disposition: "Community referral", line: "Crisis 24/7", status: "Resolved" },
  { id: "C-507", time: "10:52", caller: "Clinic", name: "Elena Petrova", phq9: 22, gad7: 17, csu: "SI passive, psychosis concerns", acuity: "Urgent", disposition: "Same-day assessment", line: "988 Backup", status: "In Triage" },
  { id: "C-508", time: "11:03", caller: "Self", name: "Anon Caller 121", phq9: 16, gad7: 13, csu: "Panic + substance craving", acuity: "Urgent", disposition: "Detox referral", line: "Crisis 24/7", status: "In Triage" },
];

const SEED_CASELOAD = [
  { id: "M-601", name: "Sofia Alvarez", dx: ["MDD", "GAD"], modality: "CBT", freq: "Weekly", session: "Telehealth", noShowRisk: 8, sessions: 12, next: "2026-08-19", therapist: "Dr. Hargrove", status: "Active" },
  { id: "M-602", name: "David Okonkwo", dx: ["PTSD"], modality: "EMDR", freq: "Weekly", session: "In-person", noShowRisk: 22, sessions: 7, next: "2026-08-18", therapist: "Dr. Patel", status: "Active" },
  { id: "M-603", name: "Rebecca Stone", dx: ["BPD"], modality: "DBT", freq: "2×/week", session: "Group + individual", noShowRisk: 31, sessions: 24, next: "2026-08-18", therapist: "Dr. Hargrove", status: "High-risk" },
  { id: "M-604", name: "Tyler Nguyen", dx: ["ADHD", "ODD"], modality: "Behavioral", freq: "Biweekly", session: "In-person", noShowRisk: 12, sessions: 5, next: "2026-08-21", therapist: "Dr. Wells", status: "Active" },
  { id: "M-605", name: "Grace Kim", dx: ["GAD", "Panic"], modality: "ACT", freq: "Weekly", session: "Telehealth", noShowRisk: 9, sessions: 10, next: "2026-08-20", therapist: "Dr. Patel", status: "Active" },
  { id: "M-606", name: "Samuel Brooks", dx: ["Bipolar I"], modality: "Psychodynamic", freq: "Biweekly", session: "In-person", noShowRisk: 18, sessions: 31, next: "2026-08-22", therapist: "Dr. Wells", status: "Watch" },
  { id: "M-607", name: "Maya Singh", dx: ["Substance use", "MDD"], modality: "CBT-I", freq: "Weekly", session: "Telehealth", noShowRisk: 26, sessions: 8, next: "2026-08-19", therapist: "Dr. Hargrove", status: "High-risk" },
  { id: "M-608", name: "Oliver Grant", dx: ["OCD"], modality: "ERP", freq: "Weekly", session: "In-person", noShowRisk: 6, sessions: 16, next: "2026-08-20", therapist: "Dr. Patel", status: "Active" },
  { id: "M-609", name: "Isabella Rossi", dx: ["MDD"], modality: "CBT", freq: "Biweekly", session: "Telehealth", noShowRisk: 14, sessions: 4, next: "2026-08-25", therapist: "Dr. Wells", status: "Active" },
  { id: "M-610", name: "Ethan Carter", dx: ["GAD", "Insomnia"], modality: "CBT-I", freq: "Weekly", session: "Telehealth", noShowRisk: 11, sessions: 9, next: "2026-08-19", therapist: "Dr. Hargrove", status: "Active" },
];

const SEED_MEDS = [
  { id: "R-701", name: "Sofia Alvarez", med: "Sertraline 100mg", class: "SSRI", dose: "1 × daily", adherence: 92, refill: "2026-08-22", control: false, lai: false, prescriber: "Dr. Hargrove", status: "On track" },
  { id: "R-702", name: "Samuel Brooks", med: "Lithium 900mg", class: "Mood stabilizer", dose: "2 × daily", adherence: 78, refill: "2026-08-20", control: false, lai: false, prescriber: "Dr. Wells", status: "Needs review" },
  { id: "R-703", name: "David Okonkwo", med: "Prazosin 4mg", class: "Alpha-blocker", dose: "1 × nightly", adherence: 88, refill: "2026-08-25", control: false, lai: false, prescriber: "Dr. Patel", status: "On track" },
  { id: "R-704", name: "Maya Singh", med: "Buprenorphine-naloxone 8/2mg", class: "MAT", dose: "1 × daily", adherence: 71, refill: "2026-08-19", control: true, lai: false, prescriber: "Dr. Hargrove", status: "Watch" },
  { id: "R-705", name: "Tyler Nguyen", med: "Methylphenidate ER 36mg", class: "Stimulant", dose: "1 × morning", adherence: 95, refill: "2026-08-18", control: true, lai: false, prescriber: "Dr. Wells", status: "Due today" },
  { id: "R-706", name: "Rebecca Stone", med: "Aripiprazole LAI 400mg", class: "Antipsychotic LAI", dose: "Monthly IM", adherence: 97, refill: "2026-08-27", control: false, lai: true, prescriber: "Dr. Hargrove", status: "Scheduled" },
  { id: "R-707", name: "Grace Kim", med: "Escitalopram 20mg", class: "SSRI", dose: "1 × daily", adherence: 90, refill: "2026-08-30", control: false, lai: false, prescriber: "Dr. Patel", status: "On track" },
  { id: "R-708", name: "Oliver Grant", med: "Fluoxetine 40mg", class: "SSRI", dose: "1 × daily", adherence: 85, refill: "2026-08-23", control: false, lai: false, prescriber: "Dr. Patel", status: "On track" },
  { id: "R-709", name: "Ethan Carter", med: "Zolpidem 10mg PRN", class: "Hypnotic", dose: "PRN max 1", adherence: 64, refill: "2026-08-21", control: true, lai: false, prescriber: "Dr. Hargrove", status: "Needs review" },
  { id: "R-710", name: "Isabella Rossi", med: "Bupropion XL 150mg", class: "NDRI", dose: "1 × daily", adherence: 82, refill: "2026-08-26", control: false, lai: false, prescriber: "Dr. Wells", status: "Watch" },
];

/* ------------------------------------------------------------------ */
/*  Simulation helpers                                                 */
/* ------------------------------------------------------------------ */

const SPEEDS = [
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
];

const CRISIS_FLOW = ["In Triage", "Escalated", "De-escalated", "Resolved"];

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, sub, accent = "text-cyan-300" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Chip({ children, cls }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        active
          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function ProgressMeter({ pct, cls = "bg-cyan-500" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function BehavioralHealthHub() {
  const [tab, setTab] = useState("crisis");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [lastRun, setLastRun] = useState("live");

  const [crisis, setCrisis] = useState(SEED_CRISIS);
  const [caseload, setCaseload] = useState(SEED_CASELOAD);
  const [meds, setMeds] = useState(SEED_MEDS);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [toasts, setToasts] = useState([]);
  const [inspect, setInspect] = useState(null);

  const toastId = useRef(0);
  const tickerRef = useRef(0);

  const pushToast = useCallback((title, body, tone = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, body, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ---------------- simulation loop ---------------- */
  useEffect(() => {
    if (!running) return undefined;
    const iv = setInterval(() => setTick((t) => t + 1), 1200 / speed);
    return () => clearInterval(iv);
  }, [running, speed]);

  useEffect(() => {
    if (tick === 0) return;
    tickerRef.current += 1;
    const n = tickerRef.current;

    // Crisis queue: advance triage state machine
    setCrisis((prev) =>
      prev.map((c, i) => {
        const idx = CRISIS_FLOW.indexOf(c.status);
        if (idx < 0 || idx >= CRISIS_FLOW.length - 1) return c;
        if (n % (4 + i) === 0) return { ...c, status: CRISIS_FLOW[idx + 1] };
        return c;
      })
    );

    // Caseload: no-show risk drift, occasional status escalation
    setCaseload((prev) =>
      prev.map((m, i) => {
        const drift = (Math.sin(n * 0.5 + i * 1.7) * 1.2 + 0.6).toFixed(1) * 1;
        const risk = Math.max(2, Math.min(48, +(m.noShowRisk + drift).toFixed(1)));
        let status = m.status;
        if (risk >= 25 && status !== "High-risk" && n % 6 === i % 6) status = "High-risk";
        if (risk < 20 && status === "High-risk" && n % 8 === i % 8) status = "Active";
        return { ...m, noShowRisk: risk, status };
      })
    );

    // Meds: adherence creep toward target
    setMeds((prev) =>
      prev.map((r, i) => {
        const wobble = (Math.sin(n * 0.9 + i) * 1.4).toFixed(1) * 1;
        const adh = Math.max(40, Math.min(99, +(r.adherence + wobble * 0.4).toFixed(1)));
        let status = r.status;
        if (adh < 75 && status !== "Needs review" && n % 5 === i % 5) status = "Needs review";
        if (adh >= 85 && status === "Needs review" && n % 9 === i % 9) status = "On track";
        return { ...r, adherence: adh, status };
      })
    );

    // Toasts
    if (n % 9 === 0) pushToast("Crisis escalation", "C-502 Jordan Reyes escalated to mobile response — safety plan active, ED notified.", "warn");
    if (n % 14 === 0) pushToast("No-show risk up", "Maya Singh's no-show risk crossed 25% — outreach reminder scheduled.", "warn");
    if (n % 16 === 0) pushToast("Refill due", "Tyler Nguyen's methylphenidate refill is due today — controlled-substance verification pending.", "info");
    if (n % 19 === 0) pushToast("LAI administered", "Rebecca Stone received monthly aripiprazole LAI — next dose tracked.", "ok");
  }, [tick, pushToast]);

  /* ---------------- derived views ---------------- */
  const filteredCrisis = useMemo(() => {
    const q = query.toLowerCase();
    return crisis.filter((c) => {
      if (filter !== "All" && c.acuity !== filter) return false;
      if (!q) return true;
      return [c.id, c.caller, c.name, c.disposition, c.line].join(" ").toLowerCase().includes(q);
    });
  }, [crisis, query, filter]);

  const filteredCaseload = useMemo(() => {
    const q = query.toLowerCase();
    return caseload.filter((m) => {
      if (filter !== "All" && m.status !== filter) return false;
      if (!q) return true;
      return [m.id, m.name, m.dx.join(" "), m.modality, m.therapist].join(" ").toLowerCase().includes(q);
    });
  }, [caseload, query, filter]);

  const filteredMeds = useMemo(() => {
    const q = query.toLowerCase();
    return meds.filter((r) => {
      if (filter !== "All" && r.status !== filter) return false;
      if (!q) return true;
      return [r.id, r.name, r.med, r.class, r.prescriber].join(" ").toLowerCase().includes(q);
    });
  }, [meds, query, filter]);

  const stats = useMemo(() => {
    const imminent = crisis.filter((c) => c.acuity === "Imminent").length;
    const urgent = crisis.filter((c) => c.acuity === "Urgent").length;
    const highRisk = caseload.filter((m) => m.status === "High-risk").length;
    const watch = caseload.filter((m) => m.status === "Watch").length;
    const onTrack = meds.filter((r) => r.status === "On track" || r.status === "Scheduled").length;
    const needsReview = meds.filter((r) => r.status === "Needs review").length;
    const avgAdh = Math.round(meds.reduce((a, r) => a + r.adherence, 0) / Math.max(1, meds.length));
    const lai = meds.filter((r) => r.lai).length;
    return { imminent, urgent, highRisk, watch, onTrack, needsReview, avgAdh, lai };
  }, [crisis, caseload, meds]);

  /* ---------------- actions ---------------- */
  const resetSim = () => {
    setCrisis(SEED_CRISIS);
    setCaseload(SEED_CASELOAD);
    setMeds(SEED_MEDS);
    tickerRef.current = 0;
    setLastRun("reset");
    setTimeout(() => setLastRun("live"), 1500);
    pushToast("Simulation reset", "Crisis, caseload and medication state restored to baseline.", "info");
  };

  const resolveCrisis = (c) => {
    setCrisis((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "Resolved" } : x)));
    pushToast("Disposition completed", `${c.disposition} logged for ${c.name} — follow-up routed to care team.`, "ok");
  };

  const renewRefill = (r) => {
    setMeds((prev) => prev.map((x) => (x.id === r.id ? { ...x, refill: "2026-09-14", status: "On track" } : x)));
    pushToast("Refill renewed", `${r.med} renewed for 30 days — pharmacy notified.`, "ok");
  };

  const exportCsv = () => {
    let rows = [];
    let header = [];
    if (tab === "crisis") {
      header = ["Call ID", "Time", "Caller", "Name", "PHQ-9", "GAD-7", "Suicide/CSU flag", "Acuity", "Disposition", "Line", "Status"];
      rows = filteredCrisis.map((c) => [c.id, c.time, c.caller, c.name, c.phq9, c.gad7, c.csu, c.acuity, c.disposition, c.line, c.status]);
    } else if (tab === "caseload") {
      header = ["Member ID", "Name", "Diagnoses", "Modality", "Frequency", "Session type", "No-show risk %", "Sessions", "Next", "Therapist", "Status"];
      rows = filteredCaseload.map((m) => [m.id, m.name, m.dx.join(" / "), m.modality, m.freq, m.session, m.noShowRisk, m.sessions, m.next, m.therapist, m.status]);
    } else {
      header = ["Rx ID", "Name", "Medication", "Class", "Dose", "Adherence %", "Refill", "Controlled", "LAI", "Prescriber", "Status"];
      rows = filteredMeds.map((r) => [r.id, r.name, r.med, r.class, r.dose, r.adherence, r.refill, r.control ? "Yes" : "No", r.lai ? "Yes" : "No", r.prescriber, r.status]);
    }
    downloadCsv(`behavioral-health-${tab}-${Date.now()}.csv`, [header, ...rows]);
    pushToast("Export ready", `${rows.length} rows exported to CSV.`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const bandFilters = tab === "crisis" ? ["All", "Imminent", "Urgent", "Routine"] : null;
  const statusFilters =
    tab === "caseload" ? ["All", "Active", "Watch", "High-risk"] : tab === "meds" ? ["All", "On track", "Watch", "Needs review", "Due today", "Scheduled"] : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-200 sm:px-6">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-2">
              <HeartPulse className="h-5 w-5 text-violet-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Behavioral Health Command</h1>
              <p className="text-xs text-slate-500">
                Crisis triage &amp; suicide-safety · outpatient caseload · psychotropic adherence
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
            {running ? "LIVE · crisis telemetry" : "PAUSED"}
          </span>
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:border-slate-600">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s.label}
              onClick={() => setSpeed(s.mult)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                speed === s.mult ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button onClick={resetSim} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-slate-600">
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard icon={Siren} label="Imminent" value={stats.imminent} sub="active safety risk" accent="text-rose-400" />
        <StatCard icon={AlertTriangle} label="Urgent" value={stats.urgent} sub="same-day needed" accent="text-amber-400" />
        <StatCard icon={ShieldAlert} label="High-risk" value={stats.highRisk} sub="caseload watch" accent="text-violet-400" />
        <StatCard icon={Eye} label="Watch" value={stats.watch} sub="monitor cadence" accent="text-sky-300" />
        <StatCard icon={Beaker} label="On-track RX" value={stats.onTrack} sub="adherence ≥ 85%" accent="text-emerald-300" />
        <StatCard icon={FileText} label="Needs review" value={stats.needsReview} sub="intervention" accent="text-fuchsia-300" />
        <StatCard icon={Gauge} label="Avg adherence" value={stats.avgAdh + "%"} sub="psychotropics" accent="text-cyan-300" />
        <StatCard icon={Zap} label="LAI track" value={stats.lai} sub="long-acting injectables" accent="text-lime-300" />
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "crisis", label: "Crisis & Triage", icon: Siren },
          { key: "caseload", label: "Outpatient Caseload", icon: Users },
          { key: "meds", label: "Medication & Compliance", icon: Syringe },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setQuery("");
              setFilter("All");
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search callers, members, meds…"
              className="w-48 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
            />
          </div>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-slate-600">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
        {(bandFilters || statusFilters).map((f) => (
          <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* ================= TAB: CRISIS & TRIAGE ================= */}
      {tab === "crisis" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Acuity mix</span>
                <Siren className="h-4 w-4 text-rose-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["Imminent", "Urgent", "Routine"].map((a) => {
                  const v = crisis.filter((c) => c.acuity === a).length;
                  return (
                    <div key={a} className="flex items-center gap-2">
                      <span className="w-16 text-[11px] text-slate-400">{a}</span>
                      <ProgressMeter pct={(v / Math.max(1, crisis.length)) * 100} cls={a === "Imminent" ? "bg-rose-500" : a === "Urgent" ? "bg-amber-500" : "bg-emerald-500"} />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Columbia Suicide Severity Rating Scale (C-SSRS) applied to every call with SI flag; imminent cases auto-route to mobile response or ED.
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Line load</span>
                <Phone className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-3">
                {[
                  { k: "Crisis 24/7 (primary)", v: crisis.filter((c) => c.line === "Crisis 24/7").length, load: 72 },
                  { k: "988 Backup (surge)", v: crisis.filter((c) => c.line === "988 Backup").length, load: 41 },
                ].map((l) => (
                  <div key={l.k} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{l.k}</span>
                      <span className="font-mono text-slate-300">{l.v} calls</span>
                    </div>
                    <ProgressMeter pct={l.load} cls="bg-cyan-500" />
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Avg time to answer 41s · abandonment 2.3% · target ≤ 60s / 5% (NSPL best practice).
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Dispositions</span>
                <ClipboardList className="h-4 w-4 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2">
                {crisis.reduce((acc, c) => {
                  const existing = acc.find((a) => a.k === c.disposition);
                  if (existing) existing.v += 1;
                  else acc.push({ k: c.disposition, v: 1 });
                  return acc;
                }, []).map((d) => (
                  <div key={d.k} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{d.k}</span>
                    <span className="font-mono text-slate-300">{d.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Every disposition triggers a warm hand-off and 48h follow-up callback.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Call</th>
                  <th className="px-3 py-2.5">Caller</th>
                  <th className="px-3 py-2.5">PHQ-9 / GAD-7</th>
                  <th className="px-3 py-2.5">Suicide / CSU flag</th>
                  <th className="px-3 py-2.5">Acuity</th>
                  <th className="px-3 py-2.5">Disposition</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredCrisis.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{c.id}</div>
                      <div className="text-[10px] text-slate-500">{c.time} · {c.line}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.caller}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-slate-300">{c.phq9}</span>
                      <span className="mx-1 text-slate-600">/</span>
                      <span className="font-mono text-slate-300">{c.gad7}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] ${c.csu.toLowerCase().includes("active") || c.csu.toLowerCase().includes("intent") ? "text-rose-300" : "text-amber-300"}`}>{c.csu}</span>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls={ACUITY_META[c.acuity].cls}>{c.acuity}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{c.disposition}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={c.status === "Resolved" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : c.status === "Escalated" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : c.status === "In Triage" ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}>
                        {c.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "crisis", item: c })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {c.status !== "Resolved" && (
                          <button onClick={() => resolveCrisis(c)} className="rounded-md border border-emerald-600/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCrisis.length === 0 && (
                  <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No calls match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: OUTPATIENT CASELOAD ================= */}
      {tab === "caseload" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Modality mix</span>
                <MessageSquare className="h-4 w-4 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2">
                {Object.entries(caseload.reduce((acc, m) => {
                  acc[m.modality] = (acc[m.modality] || 0) + 1;
                  return acc;
                }, {})).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-24 truncate text-[11px] text-slate-400">{k}</span>
                    <ProgressMeter pct={(v / Math.max(1, caseload.length)) * 100} cls="bg-violet-500" />
                    <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">No-show risk bands</span>
                <TrendingUp className="h-4 w-4 text-amber-300" />
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { k: "< 10% (low)", v: caseload.filter((m) => m.noShowRisk < 10).length, cls: "bg-emerald-500" },
                  { k: "10–25% (moderate)", v: caseload.filter((m) => m.noShowRisk >= 10 && m.noShowRisk < 25).length, cls: "bg-amber-500" },
                  { k: "≥ 25% (high)", v: caseload.filter((m) => m.noShowRisk >= 25).length, cls: "bg-rose-500" },
                ].map((b) => (
                  <div key={b.k} className="flex items-center gap-2">
                    <span className="w-28 text-[11px] text-slate-400">{b.k}</span>
                    <ProgressMeter pct={(b.v / Math.max(1, caseload.length)) * 100} cls={b.cls} />
                    <span className="w-4 text-right font-mono text-[11px] text-slate-300">{b.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-slate-500">Predictive no-show model: engagement history, transportation SDOH, telehealth fit.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Therapist panel</span>
                <Users className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["Dr. Hargrove", "Dr. Patel", "Dr. Wells"].map((t) => {
                  const v = caseload.filter((m) => m.therapist === t).length;
                  return (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-24 text-[11px] text-slate-400">{t}</span>
                      <ProgressMeter pct={(v / Math.max(1, caseload.length)) * 100} cls="bg-cyan-500" />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-slate-500">Panel size target ≤ 45; supervision ratio 1:4 meets APA best practice.</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Diagnoses</th>
                  <th className="px-3 py-2.5">Modality</th>
                  <th className="px-3 py-2.5">Cadence</th>
                  <th className="px-3 py-2.5">Session</th>
                  <th className="px-3 py-2.5">No-show risk</th>
                  <th className="px-3 py-2.5">Next</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredCaseload.map((m) => (
                  <tr key={m.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{m.name}</div>
                      <div className="text-[10px] text-slate-500">{m.id} · {m.therapist} · {m.sessions} sessions</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {m.dx.map((d) => (
                          <span key={d} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls={TX_META[m.modality] ? TX_META[m.modality].cls : "bg-slate-800 text-slate-300 border-slate-700"}>{m.modality}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{m.freq}</td>
                    <td className="px-3 py-2.5 text-slate-400">{m.session}</td>
                    <td className="px-3 py-2.5">
                      <div className="w-24">
                        <div className={`mb-1 font-mono text-[11px] ${m.noShowRisk >= 25 ? "text-rose-300" : m.noShowRisk >= 10 ? "text-amber-300" : "text-emerald-300"}`}>{m.noShowRisk}%</div>
                        <ProgressMeter pct={m.noShowRisk * 2} cls={m.noShowRisk >= 25 ? "bg-rose-500" : m.noShowRisk >= 10 ? "bg-amber-500" : "bg-emerald-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{m.next}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={m.status === "High-risk" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : m.status === "Watch" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>
                        {m.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect({ kind: "caseload", item: m })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCaseload.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No members match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: MEDICATION & COMPLIANCE ================= */}
      {tab === "meds" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { k: "SSRI / NDRI / SNRI", v: meds.filter((r) => r.class.includes("SSRI") || r.class.includes("NDRI")).length, cls: "text-cyan-300" },
              { k: "Mood stabilizer / AP", v: meds.filter((r) => r.class.includes("Mood") || r.class.includes("Antipsychotic")).length, cls: "text-violet-300" },
              { k: "Controlled substances", v: meds.filter((r) => r.control).length, cls: "text-rose-300" },
              { k: "Long-acting injectables", v: meds.filter((r) => r.lai).length, cls: "text-emerald-300" },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <Syringe className={`h-4 w-4 ${c.cls}`} />
                  <span className="text-xs text-slate-400">{c.k}</span>
                </div>
                <span className="text-xl font-bold text-slate-100">{c.v}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Medication</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Class</th>
                  <th className="px-3 py-2.5">Dose</th>
                  <th className="px-3 py-2.5">Adherence</th>
                  <th className="px-3 py-2.5">Refill</th>
                  <th className="px-3 py-2.5">Controls</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredMeds.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{r.med}</div>
                      <div className="text-[10px] text-slate-500">{r.id} · Rx by {r.prescriber}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{r.name}</div>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls={r.lai ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : r.control ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : "bg-slate-800 text-slate-300 border-slate-700"}>{r.class}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{r.dose}</td>
                    <td className="px-3 py-2.5">
                      <div className="w-24">
                        <div className={`mb-1 font-mono text-[11px] ${r.adherence < 75 ? "text-rose-300" : r.adherence < 85 ? "text-amber-300" : "text-emerald-300"}`}>{r.adherence}%</div>
                        <ProgressMeter pct={r.adherence} cls={r.adherence < 75 ? "bg-rose-500" : r.adherence < 85 ? "bg-amber-500" : "bg-emerald-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${r.refill === "2026-08-18" ? "text-rose-300" : "text-slate-400"}`}>{r.refill}</span>
                      {r.refill === "2026-08-18" && <div className="text-[10px] text-rose-400">due today</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.control ? (
                        <Chip cls="bg-rose-500/15 text-rose-300 border-rose-500/40"><ShieldAlert className="h-3 w-3" /> Schedule II–IV</Chip>
                      ) : r.lai ? (
                        <Chip cls="bg-emerald-500/15 text-emerald-300 border-emerald-500/40"><Syringe className="h-3 w-3" /> LAI</Chip>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip cls={r.status === "On track" || r.status === "Scheduled" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : r.status === "Needs review" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : r.status === "Watch" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-sky-500/15 text-sky-300 border-sky-500/40"}>
                        {r.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "med", item: r })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => renewRefill(r)} className="rounded-md border border-cyan-600/40 p-1.5 text-cyan-400 hover:bg-cyan-500/10" title="Renew refill">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMeds.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No medications match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= INSPECT MODAL ================= */}
      {inspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setInspect(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                {inspect.kind === "crisis" && <Siren className="h-4 w-4 text-rose-300" />}
                {inspect.kind === "caseload" && <Users className="h-4 w-4 text-violet-300" />}
                {inspect.kind === "med" && <Syringe className="h-4 w-4 text-emerald-300" />}
                <h3 className="text-sm font-bold text-slate-100">
                  {inspect.kind === "crisis" ? inspect.item.name : inspect.kind === "caseload" ? inspect.item.name : inspect.item.med}
                </h3>
              </div>
              <button onClick={() => setInspect(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              {inspect.kind === "crisis" && (
                <>
                  <DetailRow k="Call ID" v={`${inspect.item.id} · ${inspect.item.time}`} />
                  <DetailRow k="Caller type" v={inspect.item.caller} />
                  <DetailRow k="Screening scores" v={`PHQ-9 ${inspect.item.phq9} · GAD-7 ${inspect.item.gad7}`} />
                  <DetailRow k="Suicide / CSU flag" v={inspect.item.csu} />
                  <DetailRow k="Acuity" v={inspect.item.acuity} />
                  <DetailRow k="Disposition" v={inspect.item.disposition} />
                  <DetailRow k="Line" v={inspect.item.line} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-rose-300" />
                    C-SSRS protocol: passive ideation → 48h callback + safety plan; active ideation with intent/plan → same-day assessment; intent + access → mobile crisis response with ED coordination.
                  </div>
                </>
              )}
              {inspect.kind === "caseload" && (
                <>
                  <DetailRow k="Member ID" v={inspect.item.id} />
                  <DetailRow k="Diagnoses" v={inspect.item.dx.join(", ")} />
                  <DetailRow k="Modality" v={`${inspect.item.modality} · ${inspect.item.freq}`} />
                  <DetailRow k="Session type" v={inspect.item.session} />
                  <DetailRow k="Sessions completed" v={inspect.item.sessions} />
                  <DetailRow k="No-show risk" v={`${inspect.item.noShowRisk}%`} />
                  <DetailRow k="Next session" v={inspect.item.next} />
                  <DetailRow k="Therapist" v={inspect.item.therapist} />
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
                    Treatment plan: PHQ-9/GAD-7 administered every session; ≥50% score reduction tracked at session 10; supervision review at every 4th session.
                  </div>
                </>
              )}
              {inspect.kind === "med" && (
                <>
                  <DetailRow k="Rx ID" v={inspect.item.id} />
                  <DetailRow k="Member" v={inspect.item.name} />
                  <DetailRow k="Medication" v={inspect.item.med} />
                  <DetailRow k="Class" v={inspect.item.class} />
                  <DetailRow k="Regimen" v={inspect.item.dose} />
                  <DetailRow k="Adherence (PDC)" v={`${inspect.item.adherence}%`} />
                  <DetailRow k="Next refill" v={inspect.item.refill} />
                  <DetailRow k="Prescriber" v={inspect.item.prescriber} />
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />
                    {inspect.item.control
                      ? "Controlled substance: PDMP query required per refill; pill counts at alternating visits; e-prescribe only."
                      : inspect.item.lai
                        ? "Long-acting injectable: administered on-site, obs window 30 min, next dose auto-scheduled in the LAI calendar."
                        : "Adherence < 85% triggers pharmacist outreach; < 70% escalates to prescriber for regimen review."}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TOASTS ================= */}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl border p-3 shadow-lg backdrop-blur ${
            t.tone === "ok" ? "border-emerald-500/40 bg-emerald-950/90" : t.tone === "warn" ? "border-amber-500/40 bg-amber-950/90" : "border-slate-700 bg-slate-900/95"
          }`}>
            <div className="flex items-center gap-2">
              {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : t.tone === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <Bell className="h-4 w-4 text-cyan-400" />}
              <span className="text-xs font-semibold text-slate-100">{t.title}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t.body}</p>
          </div>
        ))}
      </div>

      {/* footer note */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-800/60 pt-4 text-[10px] text-slate-600">
        <span>Behavioral Health Command · C-SSRS · PHQ-9 / GAD-7 · SAMHSA NSPL · PDMP / DEA e-prescribe</span>
        <span>sim tick {tickerRef.current} · {lastRun}</span>
      </div>
    </div>
  );
}

function DetailRow({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-2">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-200">{v}</span>
    </div>
  );
}
