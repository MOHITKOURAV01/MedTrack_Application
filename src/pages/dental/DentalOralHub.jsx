import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Beaker, Bell, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Clock, Download, Eye, FileText, Filter, Gauge,
  HeartPulse, Home, Info, Layers, Mail, MessageSquare, Pause, Phone, Play, Plus,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Sparkles, Stethoscope, Syringe, Target, Timer, TrendingDown, TrendingUp,
  User, Users, X, Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const LANE_META = {
  Emergency: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Urgent: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Routine: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const SEED_CHAIRS = [
  { id: "CH-1", patient: "Miguel Santos", proc: "Root canal #19 (molar)", cdt: "D3330", lane: "Urgent", phase: "Canal shaping", progress: 45, provider: "Dr. Iyer", anesthesia: "Local + nitrous", next: "2026-08-18 10:30" },
  { id: "CH-2", patient: "Amelia Fox", proc: "Crown prep #8", cdt: "D2740", lane: "Routine", phase: "Prep & impression", progress: 60, provider: "Dr. Novak", anesthesia: "Local", next: "2026-08-18 10:45" },
  { id: "CH-3", patient: "Liam O'Brien", proc: "Extraction — wisdom teeth ×4", cdt: "D7240", lane: "Routine", phase: "Surgical extractions", progress: 35, provider: "Dr. Iyer", anesthesia: "IV sedation", next: "2026-08-18 11:00" },
  { id: "CH-4", patient: "Sophia Nguyen", proc: "Composite filling #30", cdt: "D2392", lane: "Routine", phase: "Carles removal", progress: 25, provider: "Dr. Novak", anesthesia: "Local", next: "2026-08-18 11:15" },
  { id: "CH-5", patient: "Noah Williams", proc: "Abscess incision & drainage", cdt: "D7510", lane: "Emergency", phase: "Drainage", progress: 70, provider: "Dr. Iyer", anesthesia: "Local", next: "2026-08-18 11:30" },
  { id: "CH-6", patient: "Emma Johnson", proc: "Scaling & root planing (4 quads)", cdt: "D4341", lane: "Urgent", phase: "Quadrant 2 of 4", progress: 40, provider: "Dr. Novak", anesthesia: "Topical", next: "2026-08-18 11:45" },
  { id: "CH-7", patient: "Ethan Brown", proc: "Ortho adjustment — braces", cdt: "D8670", lane: "Routine", phase: "Archwire change", progress: 55, provider: "Dr. Patel", anesthesia: "None", next: "2026-08-18 12:00" },
  { id: "CH-8", patient: "Olivia Davis", proc: "Implant placement #30", cdt: "D6010", lane: "Routine", phase: "Fixture placement", progress: 80, provider: "Dr. Iyer", anesthesia: "IV sedation", next: "2026-08-18 12:15" },
];

const SEED_STERILE = [
  { id: "S-1401", cassette: "CS-221", tray: "Endo kit — rotary NiTi", station: "Ultrasonic bath", cycle: "Dirty", pouchExp: "—", spore: "—", lastCycle: "—", status: "In reprocessing" },
  { id: "S-1402", cassette: "CS-222", tray: "Oral surgery kit", station: "Washer-disinfector", cycle: "Decon", pouchExp: "—", spore: "—", lastCycle: "—", status: "In reprocessing" },
  { id: "S-1403", cassette: "CS-223", tray: "Implant kit — titanium", station: "Autoclave #1", cycle: "Packing", pouchExp: "2026-08-18", spore: "Passed (wk 33)", lastCycle: "08:12", status: "In reprocessing" },
  { id: "S-1404", cassette: "CS-224", tray: "Perio kit — Gracey curettes", station: "Autoclave #2", cycle: "Sterilizing", pouchExp: "2026-08-19", spore: "Passed (wk 33)", lastCycle: "08:24", status: "In reprocessing" },
  { id: "S-1405", cassette: "CS-225", tray: "Restorative kit — composites", station: "Sterile storage", cycle: "Ready", pouchExp: "2026-08-24", spore: "Passed (wk 33)", lastCycle: "07:55", status: "Ready" },
  { id: "S-1406", cassette: "CS-226", tray: "Diagnostic kit — mirrors/probes", station: "Sterile storage", cycle: "Ready", pouchExp: "2026-08-26", spore: "Passed (wk 33)", lastCycle: "07:41", status: "Ready" },
  { id: "S-1407", cassette: "CS-227", tray: "Extraction kit — elevators", station: "Ultrasonic bath", cycle: "Dirty", pouchExp: "—", spore: "—", lastCycle: "—", status: "In reprocessing" },
  { id: "S-1408", cassette: "CS-228", tray: "Ortho kit — bands & brackets", station: "Autoclave #1", cycle: "Packing", pouchExp: "2026-08-20", spore: "Pending", lastCycle: "08:30", status: "In reprocessing" },
];

const SEED_IMPLANTS = [
  { id: "IM-1501", patient: "Olivia Davis", site: "#30 mandible", fixture: "Straumann BLT 4.1×10", stage: "Placement", weeks: 2, torque: 32, next: "2026-09-15", provider: "Dr. Iyer", status: "Osseointegrating" },
  { id: "IM-1502", patient: "Daniel Kim", site: "#14 maxilla", fixture: "NobelActive 4.3×13", stage: "Osseointegration", weeks: 9, torque: 42, next: "2026-09-01", provider: "Dr. Iyer", status: "Ready for abutment" },
  { id: "IM-1503", patient: "Mia Hernandez", site: "#8, #9 anterior", fixture: "Zimmer TSV 3.7×11.5", stage: "Restoration", weeks: 20, torque: 45, next: "2026-08-21", provider: "Dr. Iyer", status: "Crown scheduled" },
  { id: "IM-1504", patient: "Ryan Park", site: "#19 mandible", fixture: "Straumann NC 3.3×12", stage: "Placement", weeks: 1, torque: 28, next: "2026-09-29", provider: "Dr. Iyer", status: "Osseointegrating" },
  { id: "IM-1505", patient: "Chloe Adams", site: "#30 mandible", fixture: "NobelReplace 4.3×10", stage: "Osseointegration", weeks: 12, torque: 43, next: "2026-08-25", provider: "Dr. Iyer", status: "Ready for abutment" },
  { id: "OR-1601", patient: "Ethan Brown", system: "Fixed braces — full arch", stage: "Stage 6/12", weeks: 34, next: "2026-08-18", provider: "Dr. Patel", status: "Adjustment due" },
  { id: "OR-1602", patient: "Isabella Moore", system: "Invisalign aligner 14/26", stage: "Aligner 14", weeks: 26, next: "2026-08-24", provider: "Dr. Patel", status: "On track" },
  { id: "OR-1603", patient: "Jackson Lee", system: "Fixed braces — upper arch", stage: "Retention", weeks: 52, next: "2026-09-05", provider: "Dr. Patel", status: "Retainer check" },
];

/* ------------------------------------------------------------------ */
/*  Simulation helpers                                                 */
/* ------------------------------------------------------------------ */

const SPEEDS = [
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
];

const STERILE_FLOW = ["Dirty", "Decon", "Packing", "Sterilizing", "Ready"];

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

export default function DentalOralHub() {
  const [tab, setTab] = useState("chairs");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [lastRun, setLastRun] = useState("live");

  const [chairs, setChairs] = useState(SEED_CHAIRS);
  const [sterile, setSterile] = useState(SEED_STERILE);
  const [implants, setImplants] = useState(SEED_IMPLANTS);

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

    // Chair procedures progress toward completion
    setChairs((prev) =>
      prev.map((c, i) => {
        const gain = c.lane === "Emergency" ? 3.2 : c.lane === "Urgent" ? 2.4 : 1.8;
        const progress = Math.min(100, +(c.progress + gain + (Math.sin(n * 0.9 + i) * 0.8)).toFixed(1));
        return { ...c, progress };
      })
    );

    // Sterilization cassettes advance through the flow
    setSterile((prev) =>
      prev.map((s, i) => {
        const idx = STERILE_FLOW.indexOf(s.cycle);
        if (idx < 0 || idx >= STERILE_FLOW.length - 1) return s;
        if (n % (3 + i) === 0) {
          const next = STERILE_FLOW[idx + 1];
          return {
            ...s,
            cycle: next,
            status: next === "Ready" ? "Ready" : "In reprocessing",
            station: next === "Packing" ? "Autoclave #1" : next === "Sterilizing" ? "Autoclave #2" : s.station,
            pouchExp: next === "Ready" ? "2026-08-" + String(18 + ((n + i) % 8)).padStart(2, "0") : s.pouchExp,
            lastCycle: next === "Ready" ? "0" + String(8 + (n % 2)) + ":" + String((n * 7 + i) % 60).padStart(2, "0") : s.lastCycle,
            spore: next === "Ready" && s.spore === "—" ? "Passed (wk 33)" : s.spore,
          };
        }
        return s;
      })
    );

    // Implants & ortho: osseointegration weeks creep, stage advancement
    setImplants((prev) =>
      prev.map((im, i) => {
        const isOrtho = im.id.startsWith("OR");
        if (isOrtho) {
          const weeks = im.weeks + 0.02;
          let stage = im.stage;
          let status = im.status;
          if (im.stage.includes("/") && n % 9 === i % 9) {
            const [cur, total] = im.stage.split("/").map(Number);
            if (cur < total) stage = `${cur + 1}/${total}`;
          }
          if (stage === "Aligner 26/26" && n % 11 === i % 11) { stage = "Retention"; status = "Retainer check"; }
          return { ...im, weeks: +weeks.toFixed(1), stage, status };
        }
        const weeks = +(im.weeks + 0.03).toFixed(1);
        let stage = im.stage;
        let status = im.status;
        if (weeks >= 4 && stage === "Placement" && n % 8 === i % 8) { stage = "Osseointegration"; status = "Osseointegrating"; }
        if (weeks >= 12 && stage === "Osseointegration" && n % 10 === i % 10) { stage = "Restoration"; status = "Crown scheduled"; }
        return { ...im, weeks, stage, status };
      })
    );

    // Toasts
    if (n % 9 === 0) pushToast("Cycle complete", "Cassette CS-224 sterilized — class 5 integrator passed, pouch sealed for storage.", "ok");
    if (n % 14 === 0) pushToast("Emergency admission", "Noah Williams (abscess I&D) priority-tracked — recovery room reserved.", "warn");
    if (n % 17 === 0) pushToast("Osseointegration check", "Daniel Kim implant #14 reached 9 weeks — torque test scheduled.", "info");
    if (n % 20 === 0) pushToast("Suture removal due", "Liam O'Brien post-op day 7 — suture removal appointment auto-generated.", "info");
  }, [tick, pushToast]);

  /* ---------------- derived views ---------------- */
  const filteredChairs = useMemo(() => {
    const q = query.toLowerCase();
    return chairs.filter((c) => {
      if (filter !== "All" && c.lane !== filter) return false;
      if (!q) return true;
      return [c.id, c.patient, c.proc, c.cdt, c.provider].join(" ").toLowerCase().includes(q);
    });
  }, [chairs, query, filter]);

  const filteredSterile = useMemo(() => {
    const q = query.toLowerCase();
    return sterile.filter((s) => {
      if (filter !== "All" && s.status !== filter) return false;
      if (!q) return true;
      return [s.id, s.cassette, s.tray, s.station].join(" ").toLowerCase().includes(q);
    });
  }, [sterile, query, filter]);

  const filteredImplants = useMemo(() => {
    const q = query.toLowerCase();
    return implants.filter((im) => {
      if (filter !== "All" && im.status !== filter) return false;
      if (!q) return true;
      return [im.id, im.patient, im.site, im.fixture, im.system, im.provider].join(" ").toLowerCase().includes(q);
    });
  }, [implants, query, filter]);

  const stats = useMemo(() => {
    const emergency = chairs.filter((c) => c.lane === "Emergency").length;
    const inProgress = chairs.filter((c) => c.progress < 100).length;
    const ready = sterile.filter((s) => s.status === "Ready").length;
    const reprocessing = sterile.filter((s) => s.status === "In reprocessing").length;
    // The count is named separately from the list it is counted from. `const implants` here shadowed
    // the state of the same name for the whole block, so every filter to the right of it read the
    // half-initialised local instead of the list: "Cannot access 'implants' before initialization",
    // thrown on first render, taking the page with it.
    const fixtures = implants.filter((im) => im.id.startsWith("IM"));
    const implantCount = fixtures.length;
    const ortho = implants.filter((im) => im.id.startsWith("OR")).length;
    const readyAbut = implants.filter((im) => im.status === "Ready for abutment").length;
    const avgTorque = Math.round(fixtures.reduce((a, im) => a + im.torque, 0) / Math.max(1, implantCount));
    return { emergency, inProgress, ready, reprocessing, implants: implantCount, ortho, readyAbut, avgTorque };
  }, [chairs, sterile, implants]);

  /* ---------------- actions ---------------- */
  const resetSim = () => {
    setChairs(SEED_CHAIRS);
    setSterile(SEED_STERILE);
    setImplants(SEED_IMPLANTS);
    tickerRef.current = 0;
    setLastRun("reset");
    setTimeout(() => setLastRun("live"), 1500);
    pushToast("Simulation reset", "Chair, sterilization and implant/ortho state restored to baseline.", "info");
  };

  const completeProcedure = (c) => {
    setChairs((prev) => prev.map((x) => (x.id === c.id ? { ...x, progress: 100, phase: "Complete — notes pending" } : x)));
    pushToast("Procedure complete", `${c.proc} completed for ${c.patient} — post-op instructions + follow-up generated.`, "ok");
  };

  const flagSterile = (s) => {
    pushToast("Sterilization audit", `${s.tray} pulled for visual + integrator re-check before release.`, "warn");
  };

  const exportCsv = () => {
    let rows = [];
    let header = [];
    if (tab === "chairs") {
      header = ["Chair", "Patient", "Procedure", "CDT code", "Lane", "Phase", "Progress %", "Provider", "Anesthesia", "Next"];
      rows = filteredChairs.map((c) => [c.id, c.patient, c.proc, c.cdt, c.lane, c.phase, c.progress, c.provider, c.anesthesia, c.next]);
    } else if (tab === "sterile") {
      header = ["Cassette", "Tray", "Station", "Cycle", "Pouch expiry", "Spore test", "Last cycle", "Status"];
      rows = filteredSterile.map((s) => [s.cassette, s.tray, s.station, s.cycle, s.pouchExp, s.spore, s.lastCycle, s.status]);
    } else {
      header = ["ID", "Patient", "Site / System", "Fixture / Stage", "Weeks", "Torque", "Next", "Provider", "Status"];
      rows = filteredImplants.map((im) => [im.id, im.patient, im.site || im.system, im.fixture || im.stage, im.weeks, im.torque, im.next, im.provider, im.status]);
    }
    const csv = [header.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dental-oral-${tab}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Export ready", `${rows.length} rows exported to CSV.`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const laneFilters = tab === "chairs" ? ["All", "Emergency", "Urgent", "Routine"] : null;
  const statusFilters =
    tab === "sterile" ? ["All", "In reprocessing", "Ready"] : tab === "implants" ? ["All", "Osseointegrating", "Ready for abutment", "Crown scheduled", "Adjustment due", "On track", "Retainer check"] : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-200 sm:px-6">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2">
              <Stethoscope className="h-5 w-5 text-sky-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Dental &amp; Oral Surgery</h1>
              <p className="text-xs text-slate-500">
                Chair schedule &amp; CDT procedures · sterilization &amp; infection control · implant &amp; ortho tracking
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
            {running ? "LIVE · clinic telemetry" : "PAUSED"}
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
        <StatCard icon={Siren} label="Emergency" value={stats.emergency} sub="priority lane" accent="text-rose-400" />
        <StatCard icon={Activity} label="In procedure" value={stats.inProgress} sub="chairs active" accent="text-cyan-300" />
        <StatCard icon={ShieldCheck} label="Cassettes ready" value={stats.ready} sub="sterile storage" accent="text-emerald-300" />
        <StatCard icon={RefreshCw} label="Reprocessing" value={stats.reprocessing} sub="in the pipeline" accent="text-amber-400" />
        <StatCard icon={Syringe} label="Implants" value={stats.implants} sub="fixtures tracked" accent="text-violet-300" />
        <StatCard icon={Award} label="Ortho cases" value={stats.ortho} sub="braces + aligners" accent="text-sky-300" />
        <StatCard icon={Target} label="Abutment ready" value={stats.readyAbut} sub="osseointegration done" accent="text-lime-300" />
        <StatCard icon={Zap} label="Avg torque" value={stats.avgTorque + " Ncm"} sub="implant stability" accent="text-fuchsia-300" />
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "chairs", label: "Chair Schedule & Procedures", icon: Clock },
          { key: "sterile", label: "Sterilization & Infection Control", icon: ShieldCheck },
          { key: "implants", label: "Implant & Ortho Tracking", icon: Syringe },
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
              placeholder="Search patients, trays, fixtures…"
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
        {(laneFilters || statusFilters).map((f) => (
          <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* ================= TAB: CHAIR SCHEDULE ================= */}
      {tab === "chairs" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-sky-400" />
            <span className="text-slate-400">Chair orchestration:</span> CDT procedure codes (D-codes) drive chair time estimates; emergency insertions re-sequence the queue in real time while sedation recoveries hold the chair.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredChairs.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">{c.id}</span>
                      <Chip cls={LANE_META[c.lane].cls}>{c.lane}</Chip>
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-100">{c.patient}</div>
                    <div className="text-[11px] text-slate-400">{c.proc} · <span className="font-mono text-sky-300">{c.cdt}</span></div>
                  </div>
                  <button onClick={() => setInspect({ kind: "chair", item: c })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{c.phase}</span>
                    <span className={`font-mono ${c.progress >= 100 ? "text-emerald-300" : "text-slate-300"}`}>{c.progress}%</span>
                  </div>
                  <ProgressMeter pct={c.progress} cls={c.progress >= 100 ? "bg-emerald-500" : c.lane === "Emergency" ? "bg-rose-500" : "bg-sky-500"} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{c.provider} · {c.anesthesia}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{c.next}</span>
                    {c.progress < 100 && (
                      <button onClick={() => completeProcedure(c)} className="rounded-md border border-emerald-600/40 p-1 text-emerald-400 hover:bg-emerald-500/10" title="Complete">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredChairs.length === 0 && (
              <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500">No chairs match the current filters.</div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB: STERILIZATION ================= */}
      {tab === "sterile" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {STERILE_FLOW.map((st) => {
              const v = sterile.filter((s) => s.cycle === st).length;
              return (
                <div key={st} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">{st}</span>
                    <span className={`text-lg font-bold ${st === "Ready" ? "text-emerald-300" : st === "Sterilizing" ? "text-sky-300" : "text-slate-300"}`}>{v}</span>
                  </div>
                  <ProgressMeter pct={(v / Math.max(1, sterile.length)) * 100} cls={st === "Ready" ? "bg-emerald-500" : st === "Sterilizing" ? "bg-sky-500" : "bg-slate-600"} />
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
            <span className="text-slate-400">CDC / ADA protocol:</span> weekly biological spore testing (Bacillus atrophaeus), class 5 integrators per load, instrument pouches expire 30 days, and every cassette carries a full reprocessing chain-of-custody.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Cassette</th>
                  <th className="px-3 py-2.5">Instrument tray</th>
                  <th className="px-3 py-2.5">Station</th>
                  <th className="px-3 py-2.5">Cycle</th>
                  <th className="px-3 py-2.5">Pouch expiry</th>
                  <th className="px-3 py-2.5">Spore test</th>
                  <th className="px-3 py-2.5">Last cycle</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredSterile.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5 font-mono text-slate-300">{s.cassette}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{s.tray}</div>
                      <div className="text-[10px] text-slate-500">{s.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{s.station}</td>
                    <td className="px-3 py-2.5"><Chip cls={s.cycle === "Ready" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : s.cycle === "Sterilizing" ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : "bg-slate-800 text-slate-300 border-slate-700"}>{s.cycle}</Chip></td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{s.pouchExp}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={s.spore.includes("Passed") ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : s.spore.includes("Failed") ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}>{s.spore}</Chip>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{s.lastCycle}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={s.status === "Ready" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}>{s.status}</Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "sterile", item: s })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {s.status !== "Ready" && (
                          <button onClick={() => flagSterile(s)} className="rounded-md border border-amber-600/40 p-1.5 text-amber-400 hover:bg-amber-500/10" title="Audit">
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSterile.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No cassettes match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: IMPLANT & ORTHO ================= */}
      {tab === "implants" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Implant stage pipeline</span>
                <Syringe className="h-4 w-4 text-violet-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["Placement", "Osseointegration", "Restoration"].map((st) => {
                  const v = implants.filter((im) => im.id.startsWith("IM") && im.stage === st).length;
                  return (
                    <div key={st} className="flex items-center gap-2">
                      <span className="w-32 text-[11px] text-slate-400">{st}</span>
                      <ProgressMeter pct={(v / Math.max(1, implants.filter((im) => im.id.startsWith("IM")).length)) * 100} cls={st === "Restoration" ? "bg-emerald-500" : st === "Osseointegration" ? "bg-amber-500" : "bg-sky-500"} />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Mandibular healing 3–4 months, maxillary 4–6 months before loading (standard protocol).
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Fixture stability</span>
                <Gauge className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {implants.filter((im) => im.id.startsWith("IM")).map((im) => (
                  <div key={im.id} className="flex items-center gap-2">
                    <span className="w-24 truncate text-[11px] text-slate-400">{im.patient}</span>
                    <ProgressMeter pct={(im.torque / 50) * 100} cls={im.torque >= 40 ? "bg-emerald-500" : im.torque >= 32 ? "bg-amber-500" : "bg-rose-500"} />
                    <span className="w-12 text-right font-mono text-[11px] text-slate-300">{im.torque} Ncm</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Insertion torque ≥ 35 Ncm suggests adequate primary stability; ≥ 40 Ncm allows immediate loading protocols.
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Ortho modality</span>
                <Award className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="mt-3 space-y-2">
                {["Fixed braces", "Invisalign aligners", "Retention"].map((m) => {
                  const v = implants.filter((im) => im.id.startsWith("OR") && (im.system.includes(m) || im.stage.includes(m))).length;
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className="w-36 text-[11px] text-slate-400">{m}</span>
                      <ProgressMeter pct={(v / Math.max(1, implants.filter((im) => im.id.startsWith("OR")).length)) * 100} cls="bg-emerald-500" />
                      <span className="w-4 text-right font-mono text-[11px] text-slate-300">{v}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
                Compliance: aligner wear ≥ 22 h/day tracked via SmartTrack; poor wear auto-flag to orthodontist.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Site / System</th>
                  <th className="px-3 py-2.5">Fixture / Stage</th>
                  <th className="px-3 py-2.5">Weeks</th>
                  <th className="px-3 py-2.5">Torque</th>
                  <th className="px-3 py-2.5">Next</th>
                  <th className="px-3 py-2.5">Provider</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredImplants.map((im) => (
                  <tr key={im.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{im.patient}</div>
                      <div className="text-[10px] text-slate-500">{im.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{im.site || im.system}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-300">{im.fixture || im.stage}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{im.weeks} wk</td>
                    <td className="px-3 py-2.5">
                      {im.torque ? (
                        <span className={`font-mono ${im.torque >= 40 ? "text-emerald-300" : im.torque >= 32 ? "text-amber-300" : "text-rose-300"}`}>{im.torque} Ncm</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{im.next}</td>
                    <td className="px-3 py-2.5 text-slate-400">{im.provider}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={im.status.includes("Ready") || im.status.includes("On track") ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : im.status.includes("due") ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-sky-500/15 text-sky-300 border-sky-500/40"}>
                        {im.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect({ kind: "implant", item: im })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredImplants.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No implant or ortho cases match the current filters.</td></tr>
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
                {inspect.kind === "chair" && <Clock className="h-4 w-4 text-sky-300" />}
                {inspect.kind === "sterile" && <ShieldCheck className="h-4 w-4 text-emerald-300" />}
                {inspect.kind === "implant" && <Syringe className="h-4 w-4 text-violet-300" />}
                <h3 className="text-sm font-bold text-slate-100">
                  {inspect.kind === "chair" ? inspect.item.patient : inspect.kind === "sterile" ? inspect.item.tray : inspect.item.patient}
                </h3>
              </div>
              <button onClick={() => setInspect(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              {inspect.kind === "chair" && (
                <>
                  <DetailRow k="Chair" v={inspect.item.id} />
                  <DetailRow k="Procedure" v={`${inspect.item.proc} (${inspect.item.cdt})`} />
                  <DetailRow k="Lane" v={inspect.item.lane} />
                  <DetailRow k="Phase" v={inspect.item.phase} />
                  <DetailRow k="Progress" v={`${inspect.item.progress}%`} />
                  <DetailRow k="Provider" v={inspect.item.provider} />
                  <DetailRow k="Anesthesia" v={inspect.item.anesthesia} />
                  <DetailRow k="Next action" v={inspect.item.next} />
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-sky-300" />
                    On completion: post-op instructions, CDT claim staging, follow-up interval (per ADA recare schedule) and any lab requisitions are auto-generated.
                  </div>
                </>
              )}
              {inspect.kind === "sterile" && (
                <>
                  <DetailRow k="Cassette" v={inspect.item.cassette} />
                  <DetailRow k="Instrument tray" v={inspect.item.tray} />
                  <DetailRow k="Station" v={inspect.item.station} />
                  <DetailRow k="Cycle" v={inspect.item.cycle} />
                  <DetailRow k="Pouch expiry" v={inspect.item.pouchExp} />
                  <DetailRow k="Spore test" v={inspect.item.spore} />
                  <DetailRow k="Last cycle" v={inspect.item.lastCycle} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />
                    CDC/ADA chain: ultrasonic decon → washer-disinfector → pack with class 5 integrator → autoclave (134°C, 3.5 min) → 30-day sealed storage. Weekly spore tests with B. atrophaeus.
                  </div>
                </>
              )}
              {inspect.kind === "implant" && (
                <>
                  <DetailRow k="Case ID" v={inspect.item.id} />
                  <DetailRow k="Site" v={inspect.item.site || inspect.item.system} />
                  <DetailRow k="Fixture / stage" v={inspect.item.fixture || inspect.item.stage} />
                  <DetailRow k="Weeks in treatment" v={`${inspect.item.weeks} weeks`} />
                  {inspect.item.torque && <DetailRow k="Insertion torque" v={`${inspect.item.torque} Ncm`} />}
                  <DetailRow k="Next appointment" v={inspect.item.next} />
                  <DetailRow k="Provider" v={inspect.item.provider} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
                    {inspect.item.id.startsWith("IM")
                      ? "Implant protocol: guided surgery → placement (≥ 35 Ncm) → osseointegration (3–4 mo mandible / 4–6 mo maxilla) → torque re-test → abutment + final restoration. Warranty registered with the fixture manufacturer."
                      : "Ortho protocol: 4–6 week adjustment intervals; aligner wear ≥ 22 h/day; retention phase minimum 12 months with removable retainer verification."}
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
        <span>Dental &amp; Oral Surgery · CDT 2026 D-codes · CDC / ADA sterilization · AAID implant protocol</span>
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
