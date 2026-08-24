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

const PHASE_META = {
  Acute: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Subacute: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Chronic: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const SEED_CASELOAD = [
  { id: "PT-801", name: "Hannah Miller", cond: "Total knee arthroplasty", phase: "Subacute", rom: 92, goal: 115, sessions: 8, of: 12, therapist: "M. Cohen", next: "2026-08-19", risk: "Low", status: "On track" },
  { id: "PT-802", name: "Aaron Whitmore", cond: "ACL reconstruction", phase: "Acute", rom: 78, goal: 120, sessions: 4, of: 16, therapist: "R. Singh", next: "2026-08-18", risk: "Elevated", status: "Watch" },
  { id: "PT-803", name: "Clara Novak", cond: "Rotator cuff repair", phase: "Subacute", rom: 88, goal: 110, sessions: 9, of: 14, therapist: "M. Cohen", next: "2026-08-20", risk: "Low", status: "On track" },
  { id: "PT-804", name: "Derek Simmons", cond: "CVA — left hemiparesis", phase: "Chronic", rom: 64, goal: 95, sessions: 22, of: 30, therapist: "L. Okafor", next: "2026-08-19", risk: "High", status: "Watch" },
  { id: "PT-805", name: "Elena Rossi", cond: "Lumbar spinal fusion", phase: "Acute", rom: 58, goal: 100, sessions: 3, of: 14, therapist: "R. Singh", next: "2026-08-18", risk: "Elevated", status: "On track" },
  { id: "PT-806", name: "Frank Bell", cond: "Total hip arthroplasty", phase: "Subacute", rom: 96, goal: 115, sessions: 10, of: 12, therapist: "L. Okafor", next: "2026-08-21", risk: "Low", status: "On track" },
  { id: "PT-807", name: "Grace Liu", cond: "Plantar fasciitis", phase: "Chronic", rom: 84, goal: 100, sessions: 6, of: 8, therapist: "M. Cohen", next: "2026-08-20", risk: "Low", status: "On track" },
  { id: "PT-808", name: "Isaac Foster", cond: "Spinal cord injury T11", phase: "Chronic", rom: 52, goal: 80, sessions: 18, of: 30, therapist: "L. Okafor", next: "2026-08-19", risk: "High", status: "Watch" },
  { id: "PT-809", name: "Julia Meyer", cond: "Femur fracture ORIF", phase: "Subacute", rom: 90, goal: 115, sessions: 11, of: 14, therapist: "R. Singh", next: "2026-08-22", risk: "Low", status: "On track" },
  { id: "PT-810", name: "Kevin Osei", cond: "Shoulder impingement", phase: "Chronic", rom: 97, goal: 105, sessions: 5, of: 8, therapist: "M. Cohen", next: "2026-08-21", risk: "Low", status: "On track" },
];

const SEED_GAIT = [
  { id: "G-901", name: "Derek Simmons", cond: "CVA — left hemiparesis", velocity: 0.72, cadence: 84, stepSym: 62, stride: 1.02, norm: 1.25, trend: "improving", status: "In program" },
  { id: "G-902", name: "Isaac Foster", cond: "Spinal cord injury T11", velocity: 0.55, cadence: 70, stepSym: 78, stride: 0.94, norm: 1.25, trend: "plateau", status: "In program" },
  { id: "G-903", name: "Frank Bell", cond: "Total hip arthroplasty", velocity: 1.02, cadence: 96, stepSym: 88, stride: 1.21, norm: 1.3, trend: "improving", status: "In program" },
  { id: "G-904", name: "Aaron Whitmore", cond: "ACL reconstruction", velocity: 0.94, cadence: 92, stepSym: 84, stride: 1.15, norm: 1.3, trend: "improving", status: "In program" },
  { id: "G-905", name: "Hannah Miller", cond: "Total knee arthroplasty", velocity: 0.98, cadence: 95, stepSym: 86, stride: 1.18, norm: 1.3, trend: "improving", status: "Assessed" },
  { id: "G-906", name: "Elena Rossi", cond: "Lumbar spinal fusion", velocity: 0.68, cadence: 78, stepSym: 72, stride: 1.05, norm: 1.25, trend: "declining", status: "Flagged" },
];

const SEED_HEP = [
  { id: "H-1001", name: "Hannah Miller", plan: "Knee: heel slides, quad sets, SLR", sets: 3, reps: 15, done: 2, pain: 3, engagement: 78, nextDue: "2026-08-18", status: "On track" },
  { id: "H-1002", name: "Aaron Whitmore", plan: "Ankle pumps, AAROM, quad isometrics", sets: 3, reps: 12, done: 1, pain: 6, engagement: 45, nextDue: "2026-08-18", status: "Lagging" },
  { id: "H-1003", name: "Clara Novak", plan: "Pendulum, pulleys, scapular sets", sets: 3, reps: 15, done: 3, pain: 2, engagement: 91, nextDue: "2026-08-19", status: "On track" },
  { id: "H-1004", name: "Derek Simmons", plan: "Sit-to-stand, leg lifts, balance", sets: 3, reps: 10, done: 2, pain: 4, engagement: 63, nextDue: "2026-08-19", status: "On track" },
  { id: "H-1005", name: "Elena Rossi", plan: "Ab brace walk, DL raises, breathing", sets: 2, reps: 10, done: 0, pain: 7, engagement: 28, nextDue: "2026-08-18", status: "Lagging" },
  { id: "H-1006", name: "Frank Bell", plan: "Hip abduction, clamshells, bridges", sets: 3, reps: 12, done: 3, pain: 2, engagement: 86, nextDue: "2026-08-20", status: "On track" },
  { id: "H-1007", name: "Grace Liu", plan: "Calf stretch, towel curls, arch lifts", sets: 2, reps: 20, done: 2, pain: 3, engagement: 74, nextDue: "2026-08-20", status: "On track" },
  { id: "H-1008", name: "Isaac Foster", plan: "Upper-body erg, core, transfers", sets: 3, reps: 10, done: 1, pain: 3, engagement: 52, nextDue: "2026-08-19", status: "Lagging" },
  { id: "H-1009", name: "Julia Meyer", plan: "Weight shifts, step-ups, hip flex", sets: 3, reps: 12, done: 3, pain: 2, engagement: 89, nextDue: "2026-08-21", status: "On track" },
  { id: "H-1010", name: "Kevin Osei", plan: "ER band, Y-T-W, wall slides", sets: 3, reps: 12, done: 2, pain: 1, engagement: 81, nextDue: "2026-08-21", status: "On track" },
];

const SEED_DEVICES = [
  { id: "D-1101", name: "Anti-gravity treadmill", location: "Gait Lab A", util: 72, status: "Available", patients: 3 },
  { id: "D-1102", name: "Continuous passive motion", location: "Ortho Suite", util: 88, status: "In use", patients: 4 },
  { id: "D-1103", name: "Therapeutic ultrasound", location: "Modal Room 2", util: 54, status: "Available", patients: 2 },
  { id: "D-1104", name: "FES cycle ergometer", location: "Neuro Gym", util: 67, status: "In use", patients: 3 },
  { id: "D-1105", name: "Cryotherapy chamber", location: "Recovery Bay", util: 79, status: "In use", patients: 2 },
  { id: "D-1106", name: "Balance master platform", location: "Gait Lab B", util: 46, status: "Available", patients: 2 },
];

/* ------------------------------------------------------------------ */
/*  Simulation helpers                                                 */
/* ------------------------------------------------------------------ */

const SPEEDS = [
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
];

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

export default function RehabPtHub() {
  const [tab, setTab] = useState("caseload");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [lastRun, setLastRun] = useState("live");

  const [caseload, setCaseload] = useState(SEED_CASELOAD);
  const [gait, setGait] = useState(SEED_GAIT);
  const [hep, setHep] = useState(SEED_HEP);
  const [devices, setDevices] = useState(SEED_DEVICES);

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

    // Caseload: ROM improves toward goal; sessions tick up; risk drift
    setCaseload((prev) =>
      prev.map((p, i) => {
        const gain = p.phase === "Acute" ? 0.9 : p.phase === "Subacute" ? 0.6 : 0.35;
        const rom = Math.min(p.goal, +(p.rom + gain + (Math.sin(n * 0.7 + i) * 0.3)).toFixed(1));
        const sessions = Math.min(p.of, p.sessions + (n % 4 === i % 4 ? 1 : 0));
        let status = p.status;
        if (rom >= p.goal * 0.95 && status !== "Discharge ready" && n % 7 === i % 7) status = "Discharge ready";
        if (sessions >= p.of && status === "On track") status = "Discharge ready";
        return { ...p, rom, sessions, status };
      })
    );

    // Gait: velocity/symmetry drift, flagged patients recover slowly
    setGait((prev) =>
      prev.map((g, i) => {
        const wobble = (Math.sin(n * 0.6 + i * 1.4) * 0.012).toFixed(3) * 1;
        const velocity = Math.max(0.4, Math.min(g.norm, +(g.velocity + (g.trend === "declining" ? -0.004 : 0.008) + wobble).toFixed(2)));
        const stepSym = Math.max(50, Math.min(96, +(g.stepSym + (g.trend === "declining" ? -0.2 : 0.4) + wobble * 20).toFixed(1)));
        let trend = g.trend;
        if (trend === "declining" && n % 6 === i % 6 && velocity > 0.6) trend = "improving";
        return { ...g, velocity, stepSym, trend, status: trend === "declining" ? "Flagged" : "In program" };
      })
    );

    // HEP: completed-sets creep, engagement drift
    setHep((prev) =>
      prev.map((h, i) => {
        const done = Math.min(h.sets, h.done + (n % 3 === i % 3 ? 1 : 0));
        const engage = Math.max(15, Math.min(98, +(h.engagement + (Math.sin(n * 0.8 + i) * 2.2)).toFixed(0)));
        const status = engage < 50 ? "Lagging" : "On track";
        return { ...h, done, engagement: engage, status };
      })
    );

    // Devices: utilization wobble
    setDevices((prev) =>
      prev.map((d, i) => ({
        ...d,
        util: Math.max(20, Math.min(98, +(d.util + (Math.sin(n * 0.9 + i * 1.3) * 6 + 1.2)).toFixed(0))),
      }))
    );

    // Toasts
    if (n % 10 === 0) pushToast("Milestone reached", "Frank Bell completed 10 of 12 THA sessions — discharge criteria under review.", "ok");
    if (n % 15 === 0) pushToast("Gait regression", "Elena Rossi's gait velocity dropped below 0.6 m/s — PT re-evaluation scheduled.", "warn");
    if (n % 18 === 0) pushToast("HEP lagging", "Aaron Whitmore below 50% home-exercise engagement — automated check-in sent.", "warn");
    if (n % 21 === 0) pushToast("Device demand", "Cryotherapy chamber utilization crossed 80% — queue prioritisation active.", "info");
  }, [tick, pushToast]);

  /* ---------------- derived views ---------------- */
  const filteredCaseload = useMemo(() => {
    const q = query.toLowerCase();
    return caseload.filter((p) => {
      if (filter !== "All" && p.phase !== filter) return false;
      if (!q) return true;
      return [p.id, p.name, p.cond, p.therapist].join(" ").toLowerCase().includes(q);
    });
  }, [caseload, query, filter]);

  const filteredGait = useMemo(() => {
    const q = query.toLowerCase();
    return gait.filter((g) => {
      if (filter !== "All" && g.status !== filter) return false;
      if (!q) return true;
      return [g.id, g.name, g.cond].join(" ").toLowerCase().includes(q);
    });
  }, [gait, query, filter]);

  const filteredHep = useMemo(() => {
    const q = query.toLowerCase();
    return hep.filter((h) => {
      if (filter !== "All" && h.status !== filter) return false;
      if (!q) return true;
      return [h.id, h.name, h.plan].join(" ").toLowerCase().includes(q);
    });
  }, [hep, query, filter]);

  const stats = useMemo(() => {
    const acute = caseload.filter((p) => p.phase === "Acute").length;
    const ready = caseload.filter((p) => p.status === "Discharge ready").length;
    const flagged = gait.filter((g) => g.status === "Flagged").length;
    const avgVel = (gait.reduce((a, g) => a + g.velocity, 0) / Math.max(1, gait.length)).toFixed(2);
    const lagging = hep.filter((h) => h.status === "Lagging").length;
    const avgEngage = Math.round(hep.reduce((a, h) => a + h.engagement, 0) / Math.max(1, hep.length));
    const avgPain = (hep.reduce((a, h) => a + h.pain, 0) / Math.max(1, hep.length)).toFixed(1);
    const inUse = devices.filter((d) => d.status === "In use").length;
    return { acute, ready, flagged, avgVel, lagging, avgEngage, avgPain, inUse };
  }, [caseload, gait, hep, devices]);

  /* ---------------- actions ---------------- */
  const resetSim = () => {
    setCaseload(SEED_CASELOAD);
    setGait(SEED_GAIT);
    setHep(SEED_HEP);
    setDevices(SEED_DEVICES);
    tickerRef.current = 0;
    setLastRun("reset");
    setTimeout(() => setLastRun("live"), 1500);
    pushToast("Simulation reset", "Caseload, gait, HEP and device state restored to baseline.", "info");
  };

  const markDischarge = (p) => {
    setCaseload((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "Discharged", rom: Math.max(x.rom, x.goal) } : x)));
    pushToast("Discharge logged", `${p.name} discharged from PT — functional outcome summary sent to referring physician.`, "ok");
  };

  const flagHep = (h) => {
    pushToast("HEP check-in", `Personalised reminder + video refresh sent to ${h.name}.`, "info");
  };

  const exportCsv = () => {
    let rows = [];
    let header = [];
    if (tab === "caseload") {
      header = ["Patient ID", "Name", "Condition", "Phase", "ROM (deg)", "Goal (deg)", "Sessions", "Plan total", "Therapist", "Next", "Risk", "Status"];
      rows = filteredCaseload.map((p) => [p.id, p.name, p.cond, p.phase, p.rom, p.goal, p.sessions, p.of, p.therapist, p.next, p.risk, p.status]);
    } else if (tab === "gait") {
      header = ["Patient ID", "Name", "Condition", "Velocity m/s", "Cadence", "Step symmetry %", "Stride m", "Norm m/s", "Trend", "Status"];
      rows = filteredGait.map((g) => [g.id, g.name, g.cond, g.velocity, g.cadence, g.stepSym, g.stride, g.norm, g.trend, g.status]);
    } else {
      header = ["HEP ID", "Name", "Plan", "Sets", "Reps", "Completed", "Pain VAS", "Engagement %", "Next due", "Status"];
      rows = filteredHep.map((h) => [h.id, h.name, h.plan, h.sets, h.reps, h.done, h.pain, h.engagement, h.nextDue, h.status]);
    }
    downloadCsv(`rehab-pt-${tab}-${Date.now()}.csv`, [header, ...rows]);
    pushToast("Export ready", `${rows.length} rows exported to CSV.`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const phaseFilters = tab === "caseload" ? ["All", "Acute", "Subacute", "Chronic"] : null;
  const statusFilters =
    tab === "gait" ? ["All", "In program", "Assessed", "Flagged"] : tab === "hep" ? ["All", "On track", "Lagging"] : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-200 sm:px-6">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2">
              <Activity className="h-5 w-5 text-emerald-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Rehabilitation &amp; Physical Therapy</h1>
              <p className="text-xs text-slate-500">
                PT caseload &amp; ROM progression · gait lab analytics · home-exercise adherence
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
            {running ? "LIVE · rehab telemetry" : "PAUSED"}
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
        <StatCard icon={Siren} label="Acute phase" value={stats.acute} sub="early recovery" accent="text-rose-400" />
        <StatCard icon={Award} label="Discharge ready" value={stats.ready} sub="functional criteria met" accent="text-emerald-300" />
        <StatCard icon={AlertTriangle} label="Gait flagged" value={stats.flagged} sub="velocity regression" accent="text-amber-400" />
        <StatCard icon={Gauge} label="Avg velocity" value={stats.avgVel + " m/s"} sub="gait lab cohort" accent="text-cyan-300" />
        <StatCard icon={ClipboardList} label="HEP lagging" value={stats.lagging} sub="engagement < 50%" accent="text-violet-300" />
        <StatCard icon={TrendingUp} label="Avg engagement" value={stats.avgEngage + "%"} sub="home exercise app" accent="text-sky-300" />
        <StatCard icon={HeartPulse} label="Avg pain VAS" value={stats.avgPain + "/10"} sub="reported after HEP" accent="text-fuchsia-300" />
        <StatCard icon={Zap} label="Devices in use" value={stats.inUse} sub="of 6 fleet units" accent="text-lime-300" />
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "caseload", label: "PT Caseload & Sessions", icon: Users },
          { key: "gait", label: "Device & Gait Analytics", icon: Gauge },
          { key: "hep", label: "Home Exercise Compliance", icon: Home },
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
              placeholder="Search patients, plans, devices…"
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
        {(phaseFilters || statusFilters).map((f) => (
          <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* ================= TAB: PT CASELOAD ================= */}
      {tab === "caseload" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400">Outcome engine:</span> ROM tracked against episode goals, functional milestones (sit-to-stand, gait speed ≥ 0.8 m/s) trigger discharge readiness, and CMS functional-status measures feed MIPS reporting.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Condition</th>
                  <th className="px-3 py-2.5">Phase</th>
                  <th className="px-3 py-2.5">ROM → goal</th>
                  <th className="px-3 py-2.5">Sessions</th>
                  <th className="px-3 py-2.5">Therapist</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredCaseload.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.id} · next {p.next}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{p.cond}</td>
                    <td className="px-3 py-2.5"><Chip cls={PHASE_META[p.phase].cls}>{p.phase}</Chip></td>
                    <td className="px-3 py-2.5">
                      <div className="w-28">
                        <div className="mb-1 flex justify-between font-mono text-[11px]">
                          <span className={p.rom >= p.goal * 0.9 ? "text-emerald-300" : "text-slate-300"}>{p.rom}°</span>
                          <span className="text-slate-600">{p.goal}°</span>
                        </div>
                        <ProgressMeter pct={(p.rom / p.goal) * 100} cls={p.rom >= p.goal * 0.9 ? "bg-emerald-500" : p.rom >= p.goal * 0.6 ? "bg-amber-500" : "bg-rose-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-slate-300">{p.sessions}</span>
                      <span className="text-slate-600"> / {p.of}</span>
                      {p.sessions >= p.of && <div className="text-[10px] text-emerald-400">plan complete</div>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{p.therapist}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={p.risk === "High" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : p.risk === "Elevated" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>
                        {p.risk}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip cls={p.status === "Discharge ready" || p.status === "Discharged" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : p.status === "Watch" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-sky-500/15 text-sky-300 border-sky-500/40"}>
                        {p.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "caseload", item: p })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {p.status === "Discharge ready" && (
                          <button onClick={() => markDischarge(p)} className="rounded-md border border-emerald-600/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Discharge">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCaseload.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No patients match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: DEVICE & GAIT ANALYTICS ================= */}
      {tab === "gait" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Device fleet utilization</span>
                <Layers className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {devices.map((d) => (
                  <div key={d.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{d.name}</span>
                      <span className={`font-mono ${d.util >= 80 ? "text-rose-300" : d.util >= 60 ? "text-amber-300" : "text-emerald-300"}`}>{d.util}%</span>
                    </div>
                    <ProgressMeter pct={d.util} cls={d.util >= 80 ? "bg-rose-500" : d.util >= 60 ? "bg-amber-500" : "bg-emerald-500"} />
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Target utilization 60–85%; &gt; 85% triggers waitlist review; &lt; 40% flags idle capacity.
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Gait trend</span>
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["improving", "plateau", "declining"].map((t) => {
                  const v = gait.filter((g) => g.trend === t).length;
                  return (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-400">{t}</span>
                      <ProgressMeter pct={(v / Math.max(1, gait.length)) * 100} cls={t === "declining" ? "bg-rose-500" : t === "plateau" ? "bg-amber-500" : "bg-emerald-500"} />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Gait speed norm: community ambulation ≥ 1.2 m/s; household ≥ 0.6 m/s (Bohannon reference values).
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Step symmetry</span>
                <Gauge className="h-4 w-4 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2">
                {gait.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{g.name}</span>
                      <span className={`font-mono ${g.stepSym < 75 ? "text-rose-300" : g.stepSym < 85 ? "text-amber-300" : "text-emerald-300"}`}>{g.stepSym}%</span>
                    </div>
                    <ProgressMeter pct={g.stepSym} cls={g.stepSym < 75 ? "bg-rose-500" : g.stepSym < 85 ? "bg-amber-500" : "bg-emerald-500"} />
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Symmetry &lt; 75% indicates compensatory gait — cueing + strengthening protocols auto-recommended.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Condition</th>
                  <th className="px-3 py-2.5">Velocity</th>
                  <th className="px-3 py-2.5">Cadence</th>
                  <th className="px-3 py-2.5">Symmetry</th>
                  <th className="px-3 py-2.5">Stride</th>
                  <th className="px-3 py-2.5">Norm</th>
                  <th className="px-3 py-2.5">Trend</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredGait.map((g) => (
                  <tr key={g.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{g.name}</div>
                      <div className="text-[10px] text-slate-500">{g.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{g.cond}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${g.velocity < 0.6 ? "text-rose-300" : g.velocity < 0.9 ? "text-amber-300" : "text-emerald-300"}`}>{g.velocity.toFixed(2)} m/s</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{g.cadence} spm</td>
                    <td className="px-3 py-2.5">
                      <div className="w-20">
                        <div className={`mb-1 font-mono text-[11px] ${g.stepSym < 75 ? "text-rose-300" : g.stepSym < 85 ? "text-amber-300" : "text-emerald-300"}`}>{g.stepSym}%</div>
                        <ProgressMeter pct={g.stepSym} cls={g.stepSym < 75 ? "bg-rose-500" : g.stepSym < 85 ? "bg-amber-500" : "bg-emerald-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{g.stride.toFixed(2)} m</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{g.norm} m/s</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={g.trend === "declining" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : g.trend === "plateau" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>
                        {g.trend}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect({ kind: "gait", item: g })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGait.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No gait assessments match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: HOME EXERCISE COMPLIANCE ================= */}
      {tab === "hep" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { k: "On track", v: hep.filter((h) => h.status === "On track").length, cls: "text-emerald-300" },
              { k: "Lagging (< 50%)", v: hep.filter((h) => h.status === "Lagging").length, cls: "text-rose-300" },
              { k: "Avg engagement", v: stats.avgEngage + "%", cls: "text-cyan-300" },
              { k: "Avg pain VAS", v: stats.avgPain + "/10", cls: "text-amber-300" },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <Home className={`h-4 w-4 ${c.cls}`} />
                  <span className="text-xs text-slate-400">{c.k}</span>
                </div>
                <span className="text-xl font-bold text-slate-100">{c.v}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Home exercise plan</th>
                  <th className="px-3 py-2.5">Dose</th>
                  <th className="px-3 py-2.5">Completed</th>
                  <th className="px-3 py-2.5">Pain VAS</th>
                  <th className="px-3 py-2.5">Engagement</th>
                  <th className="px-3 py-2.5">Next due</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredHep.map((h) => (
                  <tr key={h.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{h.name}</div>
                      <div className="text-[10px] text-slate-500">{h.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{h.plan}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{h.sets} × {h.reps}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${h.done >= h.sets ? "text-emerald-300" : h.done > 0 ? "text-amber-300" : "text-rose-300"}`}>{h.done}/{h.sets} sets</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${h.pain >= 7 ? "text-rose-300" : h.pain >= 4 ? "text-amber-300" : "text-emerald-300"}`}>{h.pain}/10</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="w-24">
                        <div className={`mb-1 font-mono text-[11px] ${h.engagement < 50 ? "text-rose-300" : h.engagement < 75 ? "text-amber-300" : "text-emerald-300"}`}>{h.engagement}%</div>
                        <ProgressMeter pct={h.engagement} cls={h.engagement < 50 ? "bg-rose-500" : h.engagement < 75 ? "bg-amber-500" : "bg-emerald-500"} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{h.nextDue}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={h.status === "On track" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-rose-500/15 text-rose-300 border-rose-500/40"}>
                        {h.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "hep", item: h })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => flagHep(h)} className="rounded-md border border-cyan-600/40 p-1.5 text-cyan-400 hover:bg-cyan-500/10" title="Send check-in">
                          <Bell className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredHep.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No home-exercise plans match the current filters.</td></tr>
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
                {inspect.kind === "caseload" && <Activity className="h-4 w-4 text-emerald-300" />}
                {inspect.kind === "gait" && <Gauge className="h-4 w-4 text-cyan-300" />}
                {inspect.kind === "hep" && <Home className="h-4 w-4 text-violet-300" />}
                <h3 className="text-sm font-bold text-slate-100">{inspect.item.name}</h3>
              </div>
              <button onClick={() => setInspect(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              {inspect.kind === "caseload" && (
                <>
                  <DetailRow k="Patient ID" v={inspect.item.id} />
                  <DetailRow k="Condition" v={inspect.item.cond} />
                  <DetailRow k="Episode phase" v={inspect.item.phase} />
                  <DetailRow k="ROM / goal" v={`${inspect.item.rom}° / ${inspect.item.goal}°`} />
                  <DetailRow k="Sessions" v={`${inspect.item.sessions} of ${inspect.item.of}`} />
                  <DetailRow k="Therapist" v={inspect.item.therapist} />
                  <DetailRow k="Risk stratification" v={inspect.item.risk} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Target className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />
                    Discharge criteria: ROM ≥ 90% of goal, gait speed ≥ 0.8 m/s, independence in transfers, pain VAS ≤ 3 on exertion, HEP engagement ≥ 75%.
                  </div>
                </>
              )}
              {inspect.kind === "gait" && (
                <>
                  <DetailRow k="Assessment ID" v={inspect.item.id} />
                  <DetailRow k="Condition" v={inspect.item.cond} />
                  <DetailRow k="Velocity" v={`${inspect.item.velocity.toFixed(2)} m/s (norm ${inspect.item.norm})`} />
                  <DetailRow k="Cadence" v={`${inspect.item.cadence} steps/min`} />
                  <DetailRow k="Step symmetry" v={`${inspect.item.stepSym}%`} />
                  <DetailRow k="Stride length" v={`${inspect.item.stride.toFixed(2)} m`} />
                  <DetailRow k="Trend" v={inspect.item.trend} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <TrendingUp className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />
                    Instrumented gait analysis (10 m walk + instrumented mat): velocity and symmetry feed the discharge-readiness model; two consecutive improving sessions clears a Flagged status.
                  </div>
                </>
              )}
              {inspect.kind === "hep" && (
                <>
                  <DetailRow k="Plan ID" v={inspect.item.id} />
                  <DetailRow k="Exercise plan" v={inspect.item.plan} />
                  <DetailRow k="Prescribed dose" v={`${inspect.item.sets} × ${inspect.item.reps}`} />
                  <DetailRow k="Completed today" v={`${inspect.item.done} of ${inspect.item.sets} sets`} />
                  <DetailRow k="Pain after HEP (VAS)" v={`${inspect.item.pain}/10`} />
                  <DetailRow k="App engagement" v={`${inspect.item.engagement}%`} />
                  <DetailRow k="Next due" v={inspect.item.nextDue} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
                    Video-guided HEP library with progress photos; engagement &lt; 50% for 3 consecutive days triggers automated therapist check-in and plan refresh.
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
        <span>Rehabilitation &amp; Physical Therapy · CMS functional-status measures · MIPS QPP · APTA outcomes registry</span>
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
