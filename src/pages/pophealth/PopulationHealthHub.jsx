import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Bell, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardList, Clock, Download, Eye, FileText, Filter, FlaskConical, Gauge, HeartPulse,
  Home, Info, Layers, Mail, MessageSquare, Pause, Phone, Play, Plus, RefreshCw,
  Search, ShieldCheck, Siren, SlidersHorizontal, Sparkles, Stethoscope, Syringe,
  Target, Timer, TrendingDown, TrendingUp, User, Users, X, Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const RISK_META = {
  High: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Elevated: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Moderate: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  Low: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const CHANNEL_META = {
  SMS: { cls: "bg-violet-500/15 text-violet-300 border-violet-500/40", icon: "sms" },
  Call: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40", icon: "call" },
  Portal: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: "portal" },
  Mail: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: "mail" },
};

const SEED_PATIENTS = [
  { id: "P-10482", name: "Maria Delgado", age: 67, sex: "F", payer: "Medicare ACO", ccs: ["T2DM", "HTN", "CKD-3"], hcc: 2.41, readmit: 28, band: "High", assign: "Dr. Okafor", lastVisit: "2026-08-02", phone: "(312) 555-0144" },
  { id: "P-10817", name: "James Whitfield", age: 74, sex: "M", payer: "Medicare ACO", ccs: ["CHF", "COPD", "AFib"], hcc: 2.87, readmit: 34, band: "High", assign: "Dr. Nguyen", lastVisit: "2026-07-28", phone: "(312) 555-0172" },
  { id: "P-11103", name: "Priya Raman", age: 58, sex: "F", payer: "Commercial PPO", ccs: ["T2DM", "Obesity"], hcc: 1.62, readmit: 19, band: "Elevated", assign: "Dr. Brooks", lastVisit: "2026-08-10", phone: "(312) 555-0119" },
  { id: "P-11240", name: "Robert Castillo", age: 71, sex: "M", payer: "Medicaid MCO", ccs: ["HTN", "CKD-4", "Depression"], hcc: 2.13, readmit: 24, band: "Elevated", assign: "Dr. Okafor", lastVisit: "2026-07-19", phone: "(312) 555-0136" },
  { id: "P-11472", name: "Evelyn Park", age: 62, sex: "F", payer: "Commercial HMO", ccs: ["Asthma", "HTN"], hcc: 1.18, readmit: 12, band: "Moderate", assign: "Dr. Nguyen", lastVisit: "2026-08-08", phone: "(312) 555-0188" },
  { id: "P-11608", name: "Omar Haddad", age: 55, sex: "M", payer: "Medicaid MCO", ccs: ["T2DM", "Neuropathy"], hcc: 1.74, readmit: 21, band: "Elevated", assign: "Dr. Brooks", lastVisit: "2026-07-25", phone: "(312) 555-0163" },
  { id: "P-11744", name: "Grace Osei", age: 79, sex: "F", payer: "Medicare ACO", ccs: ["CHF", "HTN", "Osteoporosis"], hcc: 2.55, readmit: 31, band: "High", assign: "Dr. Okafor", lastVisit: "2026-07-30", phone: "(312) 555-0151" },
  { id: "P-11901", name: "Daniel Kim", age: 48, sex: "M", payer: "Commercial PPO", ccs: ["Hyperlipidemia", "OSA"], hcc: 0.94, readmit: 8, band: "Low", assign: "Dr. Nguyen", lastVisit: "2026-08-12", phone: "(312) 555-0195" },
  { id: "P-12033", name: "Lucia Fernandez", age: 69, sex: "F", payer: "Medicare ACO", ccs: ["T2DM", "CKD-3", "Retinopathy"], hcc: 2.32, readmit: 26, band: "High", assign: "Dr. Brooks", lastVisit: "2026-08-05", phone: "(312) 555-0127" },
  { id: "P-12188", name: "William Tran", age: 63, sex: "M", payer: "Medicaid MCO", ccs: ["COPD", "HTN", "Anxiety"], hcc: 1.86, readmit: 22, band: "Elevated", assign: "Dr. Okafor", lastVisit: "2026-08-01", phone: "(312) 555-0140" },
  { id: "P-12305", name: "Amara Johnson", age: 34, sex: "F", payer: "Commercial HMO", ccs: ["Asthma", "Obesity"], hcc: 0.88, readmit: 6, band: "Low", assign: "Dr. Nguyen", lastVisit: "2026-08-14", phone: "(312) 555-0177" },
  { id: "P-12451", name: "George Petrov", age: 76, sex: "M", payer: "Medicare ACO", ccs: ["CHF", "T2DM", "PAD"], hcc: 2.68, readmit: 29, band: "High", assign: "Dr. Brooks", lastVisit: "2026-07-22", phone: "(312) 555-0109" },
];

const SEED_GAPS = [
  { id: "G-201", patient: "P-10482", name: "Maria Delgado", measure: "HbA1c ≤ 9% (poor control)", type: "Diabetes", owner: "Dr. Okafor", due: "2026-08-31", channel: "SMS", status: "Sent" },
  { id: "G-202", patient: "P-10817", name: "James Whitfield", measure: "Mammography (every 2y)", type: "Preventive", owner: "Dr. Nguyen", due: "2026-09-12", channel: "Call", status: "Scheduled" },
  { id: "G-203", patient: "P-11103", name: "Priya Raman", measure: "Retinal eye exam (diabetic)", type: "Diabetes", owner: "Dr. Brooks", due: "2026-08-20", channel: "Portal", status: "Contacted" },
  { id: "G-204", patient: "P-11240", name: "Robert Castillo", measure: "Depression screening (PHQ-9)", type: "Behavioral", owner: "Dr. Okafor", due: "2026-08-28", channel: "SMS", status: "Pending" },
  { id: "G-205", patient: "P-11472", name: "Evelyn Park", measure: "Colorectal screening (FIT)", type: "Preventive", owner: "Dr. Nguyen", due: "2026-09-05", channel: "Mail", status: "Pending" },
  { id: "G-206", patient: "P-11608", name: "Omar Haddad", measure: "Foot exam (diabetic)", type: "Diabetes", owner: "Dr. Brooks", due: "2026-08-24", channel: "Call", status: "Scheduled" },
  { id: "G-207", patient: "P-11744", name: "Grace Osei", measure: "Influenza vaccine (seasonal)", type: "Immunization", owner: "Dr. Okafor", due: "2026-10-15", channel: "SMS", status: "Pending" },
  { id: "G-208", patient: "P-12033", name: "Lucia Fernandez", measure: "Nephropathy monitoring (UACR)", type: "Diabetes", owner: "Dr. Brooks", due: "2026-08-18", channel: "Portal", status: "Contacted" },
  { id: "G-209", patient: "P-12188", name: "William Tran", measure: "COPD annual spirometry", type: "Chronic", owner: "Dr. Okafor", due: "2026-09-01", channel: "Call", status: "Pending" },
  { id: "G-210", patient: "P-12451", name: "George Petrov", measure: "BP control < 140/90", type: "Chronic", owner: "Dr. Brooks", due: "2026-08-22", channel: "SMS", status: "Sent" },
  { id: "G-211", patient: "P-11901", name: "Daniel Kim", measure: "Lipid panel (LDL ≥ 190)", type: "Preventive", owner: "Dr. Nguyen", due: "2026-09-20", channel: "Portal", status: "Pending" },
  { id: "G-212", patient: "P-12305", name: "Amara Johnson", measure: "Asthma controller adherence", type: "Chronic", owner: "Dr. Nguyen", due: "2026-08-26", channel: "SMS", status: "Contacted" },
];

const SEED_SDOH = [
  { id: "S-301", patient: "P-11240", name: "Robert Castillo", domain: "Housing", need: "Utility assistance (past-due gas)", risk: "High", partner: "Metro Housing Trust", status: "Referred", updated: "2026-08-11" },
  { id: "S-302", patient: "P-10817", name: "James Whitfield", domain: "Food", need: "SNAP enrollment + food pantry", risk: "High", partner: "Community Harvest", status: "Active", updated: "2026-08-09" },
  { id: "S-303", patient: "P-11608", name: "Omar Haddad", domain: "Transport", need: "Ride scheduling for dialysis", risk: "Medium", partner: "Access2Care", status: "Active", updated: "2026-08-13" },
  { id: "S-304", patient: "P-11744", name: "Grace Osei", domain: "Financial", need: "Medicare Part D low-income subsidy", risk: "Medium", partner: "Senior Benefits Aid", status: "Referred", updated: "2026-08-07" },
  { id: "S-305", patient: "P-10482", name: "Maria Delgado", domain: "Isolation", need: "Social engagement program", risk: "Low", partner: "Golden Circle Seniors", status: "Active", updated: "2026-08-12" },
  { id: "S-306", patient: "P-12188", name: "William Tran", domain: "Housing", need: "Section 8 recertification", risk: "Medium", partner: "Metro Housing Trust", status: "Pending", updated: "2026-08-14" },
  { id: "S-307", patient: "P-12033", name: "Lucia Fernandez", domain: "Food", need: "Home-delivered meals (Meals on Wheels)", risk: "High", partner: "Community Harvest", status: "Active", updated: "2026-08-10" },
  { id: "S-308", patient: "P-12451", name: "George Petrov", domain: "Transport", need: "Veteran ride program", risk: "Medium", partner: "VetRide Network", status: "Pending", updated: "2026-08-08" },
  { id: "S-309", patient: "P-11472", name: "Evelyn Park", domain: "Financial", need: "Copay assistance (inhalers)", risk: "Low", partner: "RxBridge Fund", status: "Resolved", updated: "2026-08-05" },
  { id: "S-310", patient: "P-11103", name: "Priya Raman", domain: "Wellness", need: "DPP lifestyle program (prediabetes)", risk: "Low", partner: "WellTrack Coaching", status: "Active", updated: "2026-08-15" },
];

/* ------------------------------------------------------------------ */
/*  Simulation helpers                                                 */
/* ------------------------------------------------------------------ */

const SPEEDS = [
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
];

const GAP_FLOW = ["Pending", "Sent", "Contacted", "Scheduled", "Closed"];
const SDOH_FLOW = ["Pending", "Referred", "Active", "Resolved"];

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

export default function PopulationHealthHub() {
  const [tab, setTab] = useState("risk");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [lastRun, setLastRun] = useState("live");

  const [patients, setPatients] = useState(SEED_PATIENTS);
  const [gaps, setGaps] = useState(SEED_GAPS);
  const [sdoh, setSdoh] = useState(SEED_SDOH);

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

    // Risk-score drift: high-risk patients creep upward slightly, occasional band escalation
    setPatients((prev) =>
      prev.map((p, i) => {
        const wobble = (Math.sin(n * 0.7 + i * 1.3) * 0.03).toFixed(2) * 1;
        const newHcc = Math.max(0.5, +(p.hcc + (p.band === "High" ? 0.012 : 0.004) + wobble * 0.05).toFixed(2));
        let band = p.band;
        if (newHcc >= 2.3 && band === "Elevated" && n % 5 === i % 5) band = "High";
        if (newHcc < 2.3 && newHcc >= 1.4 && band === "Moderate" && n % 7 === i % 7) band = "Elevated";
        return { ...p, hcc: newHcc, band, readmit: Math.min(42, p.readmit + (p.band === "High" ? 1 : 0)) };
      })
    );

    // Care gaps: advance outreach state machine
    setGaps((prev) =>
      prev.map((g, i) => {
        const idx = GAP_FLOW.indexOf(g.status);
        if (idx < 0 || idx >= GAP_FLOW.length - 1) return g;
        if (n % (4 + i) === 0) {
          const next = GAP_FLOW[idx + 1];
          return { ...g, status: next };
        }
        return g;
      })
    );

    // SDOH: advance referral lifecycle
    setSdoh((prev) =>
      prev.map((s, i) => {
        const idx = SDOH_FLOW.indexOf(s.status);
        if (idx < 0 || idx >= SDOH_FLOW.length - 1) return s;
        if (n % (5 + i) === 0) return { ...s, status: SDOH_FLOW[idx + 1], updated: "2026-08-" + String(10 + ((n + i) % 15)).padStart(2, "0") };
        return s;
      })
    );

    // Toast triggers
    if (n % 11 === 0) pushToast("Band escalation", "Maria Delgado's HCC risk crossed the 2.3 high-risk threshold — care team notified.", "warn");
    if (n % 17 === 0) pushToast("Gap closed", "Omar Haddad completed his diabetic foot exam — HEDIS gap closed.", "ok");
    if (n % 13 === 0) pushToast("SDOH referral active", "Community Harvest accepted a food-security referral for Lucia Fernandez.", "ok");
    if (n % 23 === 0) pushToast("Outreach sent", "SMS reminder dispatched for influenza vaccine campaign (cohort: Medicare ACO).", "info");
  }, [tick, pushToast]);

  /* ---------------- derived views ---------------- */
  const filteredPatients = useMemo(() => {
    const q = query.toLowerCase();
    return patients.filter((p) => {
      if (filter !== "All" && p.band !== filter) return false;
      if (!q) return true;
      return [p.name, p.id, p.payer, p.ccs.join(" ")].join(" ").toLowerCase().includes(q);
    });
  }, [patients, query, filter]);

  const filteredGaps = useMemo(() => {
    const q = query.toLowerCase();
    return gaps.filter((g) => {
      if (filter !== "All" && g.status !== filter) return false;
      if (!q) return true;
      return [g.patient, g.name, g.measure, g.type, g.owner].join(" ").toLowerCase().includes(q);
    });
  }, [gaps, query, filter]);

  const filteredSdoh = useMemo(() => {
    const q = query.toLowerCase();
    return sdoh.filter((s) => {
      if (filter !== "All" && s.status !== filter) return false;
      if (!q) return true;
      return [s.patient, s.name, s.domain, s.need, s.partner].join(" ").toLowerCase().includes(q);
    });
  }, [sdoh, query, filter]);

  const stats = useMemo(() => {
    const high = patients.filter((p) => p.band === "High").length;
    const elevated = patients.filter((p) => p.band === "Elevated").length;
    const open = gaps.filter((g) => g.status !== "Closed").length;
    const scheduled = gaps.filter((g) => g.status === "Scheduled").length;
    const active = sdoh.filter((s) => s.status === "Active" || s.status === "Referred").length;
    const resolved = sdoh.filter((s) => s.status === "Resolved").length;
    const avgHcc = (patients.reduce((a, p) => a + p.hcc, 0) / Math.max(1, patients.length)).toFixed(2);
    return { high, elevated, open, scheduled, active, resolved, avgHcc };
  }, [patients, gaps, sdoh]);

  /* ---------------- actions ---------------- */
  const resetSim = () => {
    setPatients(SEED_PATIENTS);
    setGaps(SEED_GAPS);
    setSdoh(SEED_SDOH);
    tickerRef.current = 0;
    setLastRun("reset");
    setTimeout(() => setLastRun("live"), 1500);
    pushToast("Simulation reset", "Cohort, gap and SDOH state restored to baseline.", "info");
  };

  const closeGap = (g) => {
    setGaps((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: "Closed" } : x)));
    pushToast("Gap closed", `${g.name} — ${g.measure} marked closed and submitted for HEDIS attribution.`, "ok");
  };

  const escalateSdoh = (s) => {
    pushToast("Escalation routed", `${s.need} escalated to ${s.partner} with 48h SLA.`, "warn");
  };

  const exportCsv = () => {
    let rows = [];
    let header = [];
    if (tab === "risk") {
      header = ["Patient ID", "Name", "Age", "Sex", "Payer", "Chronic Conditions", "HCC", "Readmit %", "Band", "Care Manager", "Last Visit"];
      rows = filteredPatients.map((p) => [p.id, p.name, p.age, p.sex, p.payer, p.ccs.join(" / "), p.hcc, p.readmit, p.band, p.assign, p.lastVisit]);
    } else if (tab === "gaps") {
      header = ["Gap ID", "Patient ID", "Name", "Measure", "Type", "Owner", "Due", "Channel", "Status"];
      rows = filteredGaps.map((g) => [g.id, g.patient, g.name, g.measure, g.type, g.owner, g.due, g.channel, g.status]);
    } else {
      header = ["Ref ID", "Patient ID", "Name", "Domain", "Need", "Risk", "Partner", "Status", "Updated"];
      rows = filteredSdoh.map((s) => [s.id, s.patient, s.name, s.domain, s.need, s.risk, s.partner, s.status, s.updated]);
    }
    const csv = [header.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `population-health-${tab}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Export ready", `${rows.length} rows exported to CSV.`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const bandFilters = tab === "risk" ? ["All", "High", "Elevated", "Moderate", "Low"] : null;
  const statusFilters =
    tab === "gaps" ? ["All", ...GAP_FLOW] : tab === "sdoh" ? ["All", ...SDOH_FLOW] : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-200 sm:px-6">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-2">
              <Users className="h-5 w-5 text-cyan-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Population Health &amp; Care Management</h1>
              <p className="text-xs text-slate-500">
                Risk stratification · HEDIS care-gap closure · SDOH referral coordination
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
            {running ? "LIVE · cohort telemetry" : "PAUSED"}
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
        <StatCard icon={AlertTriangle} label="High risk" value={stats.high} sub="HCC ≥ 2.3 · active mgmt" accent="text-rose-400" />
        <StatCard icon={Activity} label="Elevated" value={stats.elevated} sub="1.4 ≤ HCC < 2.3" accent="text-amber-400" />
        <StatCard icon={Gauge} label="Avg HCC" value={stats.avgHcc} sub="risk-adjustment factor" accent="text-cyan-300" />
        <StatCard icon={ClipboardList} label="Open gaps" value={stats.open} sub="HEDIS open measures" accent="text-violet-300" />
        <StatCard icon={CalendarDays} label="Scheduled" value={stats.scheduled} sub="appointments booked" accent="text-emerald-300" />
        <StatCard icon={Users} label="SDOH active" value={stats.active} sub="referrals in flight" accent="text-sky-300" />
        <StatCard icon={CheckCircle2} label="SDOH resolved" value={stats.resolved} sub="needs met this cycle" accent="text-lime-300" />
        <StatCard icon={Zap} label="Tick" value={tickerRef.current} sub={"sim steps · " + lastRun} accent="text-fuchsia-300" />
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "risk", label: "Risk Stratification", icon: Activity },
          { key: "gaps", label: "Care Gaps & Outreach", icon: Target },
          { key: "sdoh", label: "SDOH & Wellness", icon: Home },
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
              placeholder="Search patients, measures, partners…"
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

      {/* ================= TAB: RISK STRATIFICATION ================= */}
      {tab === "risk" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400">Cohort engine:</span> HCC risk-adjustment factors blended with 30-day readmission probability, chronic-condition clusters and payer attribution (ACO / MCO / commercial). High-risk members auto-assigned to care managers with 7-day touch cadence.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Payer</th>
                  <th className="px-3 py-2.5">Chronic clusters</th>
                  <th className="px-3 py-2.5">HCC</th>
                  <th className="px-3 py-2.5">Readmit risk</th>
                  <th className="px-3 py-2.5">Band</th>
                  <th className="px-3 py-2.5">Care manager</th>
                  <th className="px-3 py-2.5">Last visit</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.id} · {p.age} {p.sex}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{p.payer}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.ccs.map((c) => (
                          <span key={c} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="w-20">
                        <div className="mb-1 font-mono text-[11px] text-slate-300">{p.hcc.toFixed(2)}</div>
                        <ProgressMeter pct={(p.hcc / 3.2) * 100} cls={p.band === "High" ? "bg-rose-500" : p.band === "Elevated" ? "bg-amber-500" : "bg-emerald-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${p.readmit >= 25 ? "text-rose-300" : p.readmit >= 15 ? "text-amber-300" : "text-emerald-300"}`}>{p.readmit}%</span>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls={RISK_META[p.band].cls}>{p.band}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{p.assign}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{p.lastVisit}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect({ kind: "patient", item: p })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPatients.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No members match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: CARE GAPS ================= */}
      {tab === "gaps" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">HEDIS measure mix</span>
                <Target className="h-4 w-4 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { k: "Diabetes (HbA1c / retinal / foot)", v: gaps.filter((g) => g.type === "Diabetes").length, cls: "bg-rose-500" },
                  { k: "Preventive (mammo / FIT / lipid)", v: gaps.filter((g) => g.type === "Preventive").length, cls: "bg-sky-500" },
                  { k: "Chronic (BP / asthma / COPD)", v: gaps.filter((g) => g.type === "Chronic").length, cls: "bg-amber-500" },
                  { k: "Immunization & behavioral", v: gaps.filter((g) => g.type === "Immunization" || g.type === "Behavioral").length, cls: "bg-emerald-500" },
                ].map((r) => (
                  <div key={r.k} className="flex items-center gap-2">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.cls.replace("bg-", "#") }} />
                    <span className="flex-1 truncate text-[11px] text-slate-400">{r.k}</span>
                    <span className="font-mono text-[11px] text-slate-300">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Outreach channel mix</span>
                <MessageSquare className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["SMS", "Call", "Portal", "Mail"].map((ch) => {
                  const v = gaps.filter((g) => g.channel === ch).length;
                  return (
                    <div key={ch} className="flex items-center gap-2">
                      <span className="w-10 text-[11px] text-slate-400">{ch}</span>
                      <ProgressMeter pct={(v / Math.max(1, gaps.length)) * 100} cls="bg-cyan-500" />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Closure pipeline</span>
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="mt-3 space-y-2">
                {GAP_FLOW.map((st) => {
                  const v = gaps.filter((g) => g.status === st).length;
                  return (
                    <div key={st} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-400">{st}</span>
                      <ProgressMeter pct={(v / Math.max(1, gaps.length)) * 100} cls={st === "Closed" ? "bg-emerald-500" : st === "Scheduled" ? "bg-sky-500" : "bg-slate-600"} />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Measure</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5">Channel</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredGaps.map((g) => (
                  <tr key={g.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{g.measure}</div>
                      <div className="text-[10px] text-slate-500">{g.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{g.name}</div>
                      <div className="text-[10px] text-slate-500">{g.patient}</div>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls="bg-slate-800 text-slate-300 border-slate-700">{g.type}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{g.owner}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{g.due}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={CHANNEL_META[g.channel].cls}>
                        {g.channel === "SMS" ? <MessageSquare className="h-3 w-3" /> : g.channel === "Call" ? <Phone className="h-3 w-3" /> : g.channel === "Portal" ? <ShieldCheck className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                        {g.channel}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip cls={g.status === "Closed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : g.status === "Scheduled" ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : g.status === "Pending" ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}>
                        {g.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "gap", item: g })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {g.status !== "Closed" && (
                          <button onClick={() => closeGap(g)} className="rounded-md border border-emerald-600/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredGaps.length === 0 && (
                  <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No gaps match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: SDOH ================= */}
      {tab === "sdoh" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { k: "Housing", icon: Home, v: sdoh.filter((s) => s.domain === "Housing").length, cls: "text-amber-300" },
              { k: "Food security", icon: Users, v: sdoh.filter((s) => s.domain === "Food").length, cls: "text-emerald-300" },
              { k: "Transport", icon: Syringe, v: sdoh.filter((s) => s.domain === "Transport").length, cls: "text-sky-300" },
              { k: "Financial & isolation", icon: HeartPulse, v: sdoh.filter((s) => s.domain === "Financial" || s.domain === "Isolation" || s.domain === "Wellness").length, cls: "text-violet-300" },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <c.icon className={`h-4 w-4 ${c.cls}`} />
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
                  <th className="px-3 py-2.5">Need</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Domain</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Partner</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Updated</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredSdoh.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{s.need}</div>
                      <div className="text-[10px] text-slate-500">{s.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{s.patient}</div>
                    </td>
                    <td className="px-3 py-2.5"><Chip cls="bg-slate-800 text-slate-300 border-slate-700">{s.domain}</Chip></td>
                    <td className="px-3 py-2.5"><Chip cls={s.risk === "High" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : s.risk === "Medium" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>{s.risk}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{s.partner}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={s.status === "Resolved" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : s.status === "Active" ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : s.status === "Referred" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}>
                        {s.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{s.updated}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "sdoh", item: s })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {s.status !== "Resolved" && (
                          <button onClick={() => escalateSdoh(s)} className="rounded-md border border-rose-600/40 p-1.5 text-rose-400 hover:bg-rose-500/10">
                            <Siren className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSdoh.length === 0 && (
                  <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No referrals match the current filters.</td></tr>
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
                {inspect.kind === "patient" && <User className="h-4 w-4 text-cyan-300" />}
                {inspect.kind === "gap" && <Target className="h-4 w-4 text-violet-300" />}
                {inspect.kind === "sdoh" && <Home className="h-4 w-4 text-amber-300" />}
                <h3 className="text-sm font-bold text-slate-100">
                  {inspect.kind === "patient" ? inspect.item.name : inspect.kind === "gap" ? inspect.item.measure : inspect.item.need}
                </h3>
              </div>
              <button onClick={() => setInspect(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              {inspect.kind === "patient" && (
                <>
                  <DetailRow k="Member ID" v={`${inspect.item.id} · ${inspect.item.age} ${inspect.item.sex}`} />
                  <DetailRow k="Payer attribution" v={inspect.item.payer} />
                  <DetailRow k="Chronic clusters" v={inspect.item.ccs.join(", ")} />
                  <DetailRow k="HCC risk factor" v={inspect.item.hcc.toFixed(2)} />
                  <DetailRow k="30-day readmission risk" v={`${inspect.item.readmit}%`} />
                  <DetailRow k="Risk band" v={inspect.item.band} />
                  <DetailRow k="Care manager" v={inspect.item.assign} />
                  <DetailRow k="Last encounter" v={inspect.item.lastVisit} />
                  <DetailRow k="Contact" v={inspect.item.phone} />
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />
                    Next intervention: 7-day care-manager touch, diabetes self-management education referral, and quarterly medication reconciliation.
                  </div>
                </>
              )}
              {inspect.kind === "gap" && (
                <>
                  <DetailRow k="Gap ID" v={inspect.item.id} />
                  <DetailRow k="Member" v={`${inspect.item.name} (${inspect.item.patient})`} />
                  <DetailRow k="Measure" v={inspect.item.measure} />
                  <DetailRow k="Category" v={inspect.item.type} />
                  <DetailRow k="Owner" v={inspect.item.owner} />
                  <DetailRow k="Due date" v={inspect.item.due} />
                  <DetailRow k="Outreach channel" v={inspect.item.channel} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Target className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
                    HEDIS attribution: this measure counts toward the Medicare ACO quality pool — closing it on or before {inspect.item.due} protects the incentive payment.
                  </div>
                </>
              )}
              {inspect.kind === "sdoh" && (
                <>
                  <DetailRow k="Referral ID" v={inspect.item.id} />
                  <DetailRow k="Member" v={`${inspect.item.name} (${inspect.item.patient})`} />
                  <DetailRow k="Domain" v={inspect.item.domain} />
                  <DetailRow k="Need" v={inspect.item.need} />
                  <DetailRow k="Risk level" v={inspect.item.risk} />
                  <DetailRow k="Community partner" v={inspect.item.partner} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <DetailRow k="Last updated" v={inspect.item.updated} />
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <HeartPulse className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
                    SDOH loop closed: partner outcome is written back to the EHR problem list and re-screens this member at the next visit (standard 90-day cadence).
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
        <span>Population Health &amp; Care Management · HCC v28 · HEDIS MY2026 · NCQA / CMS ACO attribution models</span>
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
