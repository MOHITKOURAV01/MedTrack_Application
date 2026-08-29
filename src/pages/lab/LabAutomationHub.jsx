import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Calendar, CheckCircle2,
  ChevronRight, Clock, Cpu, Database, Download, Eye, FileText, Filter, Fingerprint,
  Gauge, Globe, HardDrive, Info, KeyRound, Layers, Lock, Network, Pause, Play,
  Plus, Radar, RefreshCw, Scale, Search, Server, ShieldAlert, ShieldCheck, Siren,
  Timer, TrendingDown, TrendingUp, User, Users, Wifi, WifiOff, Zap,
} from "lucide-react";
import { ExportCsvButton } from "../../components/common/ExportButton";
import { downloadCsv } from "../../utils/csv";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import ToastTray, { useToastTray } from "../../components/common/ToastTray";
import { PageHeader, Footer } from "../../components/common/PageHeader";
import { SectionHeader, PanelHeader } from "../../components/common/SectionHeader";
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { CompactSearch } from "../../components/common/SearchBox";
import { FilterChips } from "../../components/common/FilterChips";
import { Row } from "../../components/common/InfoRow";
import { EmptyState } from "../../components/common/EmptyState";
import { ToneBadge } from "../../components/common/ToneBadge";
import { TabsBar } from "../../components/common/TabsBar";
import { SimpleModal as Modal } from "../../components/common/Modal";
import { Sparkline } from "../../components/common/Sparkline";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const ANALYZERS = [
  { id: "an-01", name: "Roche Cobas 8000 — Chemistry", room: "Chem Lab A", status: "Running", load: 82, tests: 1420, uptime: 96.4, reagents: 71, calibrations: 6, last: "2m ago", model: "c702" },
  { id: "an-02", name: "Sysmex XN-9000 — Hematology", room: "Heme Lab B", status: "Running", load: 64, tests: 980, uptime: 98.1, reagents: 58, calibrations: 4, last: "1m ago", model: "XN-20" },
  { id: "an-03", name: "Abbott Alinity — Immunoassay", room: "Immuno C", status: "Running", load: 91, tests: 610, uptime: 99.2, reagents: 44, calibrations: 3, last: "30s ago", model: "i" },
  { id: "an-04", name: "Bio-Rad QX200 — PCR/Digital", room: "Mol Bio D", status: "Running", load: 47, tests: 210, uptime: 93.7, reagents: 82, calibrations: 2, last: "4m ago", model: "Droplet" },
  { id: "an-05", name: "Siemens Atellica — Urinalysis", room: "UA Lab E", status: "Idle", load: 12, tests: 88, uptime: 97.5, reagents: 90, calibrations: 1, last: "22m ago", model: "CH930" },
  { id: "an-06", name: "Ortho VITROS — ECL", room: "Immuno C", status: "Running", load: 73, tests: 452, uptime: 95.8, reagents: 63, calibrations: 5, last: "90s ago", model: "5600" },
  { id: "an-07", name: "BD BACTEC FX — Microbiology", room: "Micro F", status: "Maintenance", load: 0, tests: 190, uptime: 89.2, reagents: 38, calibrations: 1, last: "3h ago", model: "FX40" },
  { id: "an-08", name: "Cepheid GeneXpert — Molecular", room: "Mol Bio D", status: "Running", load: 55, tests: 340, uptime: 99.0, reagents: 52, calibrations: 2, last: "1m ago", model: "Infinity-80" },
];

const SAMPLES = [
  { id: "sp-1001", patient: "P-4471", type: "Whole Blood", test: "CBC + Chem Panel", dept: "Hematology", priority: "STAT", status: "Analyzing", tube: "Lavender", received: "4m ago", turn: "8m", eta: "5m" },
  { id: "sp-1002", patient: "P-8830", type: "Serum", test: "Tumor Markers", dept: "Immunoassay", priority: "Routine", status: "Queued", tube: "Gold", received: "12m ago", turn: "45m", eta: "33m" },
  { id: "sp-1003", patient: "P-1120", type: "Plasma", test: "INR / PT", dept: "Coagulation", priority: "STAT", status: "Analyzing", tube: "Blue", received: "6m ago", turn: "10m", eta: "4m" },
  { id: "sp-1004", patient: "P-6655", type: "Urine", test: "UA + Culture", dept: "Microbiology", priority: "Routine", status: "Received", tube: "Sterile cup", received: "20m ago", turn: "90m", eta: "70m" },
  { id: "sp-1005", patient: "P-2210", type: "CSF", test: "Culture & Cell Count", dept: "Microbiology", priority: "STAT", status: "Plating", tube: "Sterile", received: "9m ago", turn: "120m", eta: "111m" },
  { id: "sp-1006", patient: "P-7721", type: "Nasal Swab", test: "SARS-CoV-2 PCR", dept: "Molecular", priority: "Routine", status: "Extracting", tube: "VTM", received: "25m ago", turn: "75m", eta: "50m" },
  { id: "sp-1007", patient: "P-3389", type: "Whole Blood", test: "Drug Screen", dept: "Toxicology", priority: "Urgent", status: "Analyzing", tube: "Lavender", received: "14m ago", turn: "30m", eta: "16m" },
  { id: "sp-1008", patient: "P-9902", type: "Serum", test: "Hormone Panel", dept: "Immunoassay", priority: "Routine", status: "Queued", tube: "Gold", received: "30m ago", turn: "45m", eta: "15m" },
  { id: "sp-1009", patient: "P-5567", type: "Whole Blood", test: "Troponin I", dept: "Cardiac", priority: "STAT", status: "Analyzing", tube: "Green", received: "2m ago", turn: "12m", eta: "10m" },
  { id: "sp-1010", patient: "P-4410", type: "Serum", test: "Liver Function", dept: "Chemistry", priority: "Routine", status: "Received", tube: "Gold", received: "35m ago", turn: "40m", eta: "5m" },
];

const QC_RUNS = [
  { id: "qc-01", analyzer: "Roche Cobas 8000", level: "Level 3", analyte: "ALT", target: 45.0, measured: 45.8, unit: "U/L", status: "In Range", time: "30m ago", chart: [44.2, 45.1, 44.8, 45.6, 45.2, 45.8] },
  { id: "qc-02", analyzer: "Sysmex XN-9000", level: "Level 1", analyte: "WBC", target: 4.2, measured: 4.35, unit: "10⁹/L", status: "In Range", time: "45m ago", chart: [4.15, 4.22, 4.3, 4.28, 4.33, 4.35] },
  { id: "qc-03", analyzer: "Abbott Alinity", level: "Level 2", analyte: "TSH", target: 2.8, measured: 3.24, unit: "mIU/L", status: "Warning", time: "1h ago", chart: [2.75, 2.82, 2.9, 3.05, 3.12, 3.24] },
  { id: "qc-04", analyzer: "Siemens Atellica", level: "Level 1", analyte: "Glucose", target: 90.0, measured: 91.4, unit: "mg/dL", status: "In Range", time: "2h ago", chart: [89.2, 90.1, 89.8, 90.6, 91.0, 91.4] },
  { id: "qc-05", analyzer: "Bio-Rad QX200", level: "Level 3", analyte: "ctDNA", target: 120.0, measured: 126.8, unit: "copies", status: "Warning", time: "3h ago", chart: [118.2, 120.1, 121.5, 123.0, 124.8, 126.8] },
  { id: "qc-06", analyzer: "Ortho VITROS", level: "Level 2", analyte: "HbA1c", target: 6.5, measured: 6.51, unit: "%", status: "In Range", time: "4h ago", chart: [6.42, 6.48, 6.5, 6.49, 6.52, 6.51] },
  { id: "qc-07", analyzer: "Cepheid GeneXpert", level: "Control", analyte: "GAPDH", target: 28.0, measured: 28.6, unit: "Cq", status: "In Range", time: "5h ago", chart: [27.8, 28.1, 28.3, 28.2, 28.5, 28.6] },
  { id: "qc-08", analyzer: "BD BACTEC FX", level: "Control", analyte: "Growth Ctrl", target: 1.0, measured: 0.6, unit: "signal", status: "Out of Range", time: "6h ago", chart: [1.02, 1.0, 0.9, 0.8, 0.7, 0.6] },
];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Maintenance", "Out of Range", "STAT", "Critical"].includes(v)) return "red";
  if (["Warning", "Urgent", "Idle"].includes(v)) return "amber";
  if (["Running", "In Range", "Received", "Extracting", "Plating"].includes(v)) return "green";
  if (["Analyzing", "Queued"].includes(v)) return "sky";
  return "slate";
};



const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;



const Meter = ({ value, color = "bg-emerald-400" }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-800">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);




const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Live simulation hook                                               */
/* ------------------------------------------------------------------ */

function useSimulation({ analyzerRef, sampleRef, qcRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    setTick((tk) => tk + 1);

    // Analyzer load + test counts creep
    analyzerRef.current = analyzerRef.current.map((a) => {
      if (a.status === "Maintenance") return a;
      const load = Math.min(99, Math.max(8, Math.round(a.load + (Math.random() * 8 - 4))));
      const tests = a.status === "Running" ? a.tests + Math.round(Math.random() * 6) : a.tests;
      return { ...a, load, tests };
    });

    // Sample pipeline progress
    sampleRef.current = sampleRef.current.map((s) => {
      const eta = Math.max(1, parseInt(s.eta, 10) - 1);
      const status = s.status === "Queued" && eta <= s.turn * 0.5 ? "Analyzing" : s.status === "Received" && eta <= s.turn * 0.6 ? "Extracting" : s.status;
      return { ...s, eta: `${eta}m`, status };
    });

    // QC drift
    qcRef.current = qcRef.current.map((q) => {
      if (q.status === "Out of Range") return q;
      const drift = (Math.random() - 0.48) * q.target * 0.02;
      const measured = Math.max(0.1, Math.round((q.measured + drift) * 100) / 100);
      const pct = Math.abs(measured - q.target) / q.target;
      const status = pct > 0.08 ? "Warning" : "In Range";
      if (status === "Warning" && q.status === "In Range") toast(`QC drift on ${q.analyzer} · ${q.analyte}`, "Medium");
      return { ...q, measured, status, chart: [...q.chart.slice(1), measured] };
    });
  }, [analyzerRef, sampleRef, qcRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      analyzerRef.current = ANALYZERS.map((a) => ({ ...a }));
      sampleRef.current = SAMPLES.map((s) => ({ ...s }));
      qcRef.current = QC_RUNS.map((q) => ({ ...q }));
      setTick(0);
      toast("Lab automation console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LabAutomationHub() {
  const [tab, setTab] = useState("fleet");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [qcFilter, setQcFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [analyzers, setAnalyzers] = useState(() => ANALYZERS.map((a) => ({ ...a })));
  const [samples, setSamples] = useState(() => SAMPLES.map((s) => ({ ...s })));
  const [qcRuns, setQcRuns] = useState(() => QC_RUNS.map((q) => ({ ...q })));

  const analyzerRef = useRef(analyzers);
  const sampleRef = useRef(samples);
  const qcRef = useRef(qcRuns);

  useEffect(() => { analyzerRef.current = analyzers; }, [analyzers]);
  useEffect(() => { sampleRef.current = samples; }, [samples]);
  useEffect(() => { qcRef.current = qcRuns; }, [qcRuns]);

  const sim = useSimulation({ analyzerRef, sampleRef, qcRef, toast });

  useEffect(() => {
    setAnalyzers([...analyzerRef.current]);
    setSamples([...sampleRef.current]);
    setQcRuns([...qcRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const running = analyzers.filter((a) => a.status === "Running").length;
    const stat = samples.filter((s) => s.priority === "STAT" && s.status !== "Completed").length;
    const warn = qcRuns.filter((q) => q.status !== "In Range").length;
    const totalTests = analyzers.reduce((a, x) => a + x.tests, 0);
    return { running, stat, warn, totalTests };
  }, [analyzers, samples, qcRuns]);

  /* ---------- filters ---------- */
  const filteredAnalyzers = useMemo(() => {
    return analyzers.filter((a) => {
      const q = query.toLowerCase();
      const matchQ = !q || [a.name, a.room, a.model].some((s) => s.toLowerCase().includes(q));
      const matchS = statusFilter === "All" || a.status === statusFilter;
      return matchQ && matchS;
    });
  }, [analyzers, query, statusFilter]);

  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      const q = query.toLowerCase();
      const matchQ = !q || [s.patient, s.type, s.test, s.dept, s.tube].some((x) => x.toLowerCase().includes(q));
      const matchP = priorityFilter === "All" || s.priority === priorityFilter;
      return matchQ && matchP;
    });
  }, [samples, query, priorityFilter]);

  const filteredQc = useMemo(() => {
    return qcRuns.filter((q) => {
      const qq = query.toLowerCase();
      const matchQ = !qq || [q.analyzer, q.analyte, q.level].some((x) => x.toLowerCase().includes(qq));
      const matchS = qcFilter === "All" || q.status === qcFilter;
      return matchQ && matchS;
    });
  }, [qcRuns, query, qcFilter]);

  /* ---------- actions ---------- */
  const cycleAnalyzer = (id) => {
    setAnalyzers((as) => as.map((a) => (a.id === id ? { ...a, status: a.status === "Maintenance" ? "Running" : "Maintenance", load: a.status === "Maintenance" ? 20 : 0 } : a)));
    toast("Analyzer operational state toggled", "Low");
  };

  const markReceived = (id) => {
    setSamples((ss) => ss.map((s) => (s.id === id ? { ...s, status: "Received", eta: "20m" } : s)));
    toast("Sample marked as received in LIS", "Low");
  };

  const repeatQc = (id) => {
    setQcRuns((qs) => qs.map((q) => (q.id === id ? { ...q, status: "In Range", measured: q.target } : q)));
    toast("QC re-run queued on analyzer", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "fleet"
        ? [["ID", "Analyzer", "Room", "Status", "Load %", "Tests", "Uptime %", "Reagents %"], ...filteredAnalyzers.map((a) => [a.id, a.name, a.room, a.status, a.load, a.tests, a.uptime, a.reagents])]
        : tab === "samples"
        ? [["ID", "Patient", "Type", "Test", "Dept", "Priority", "Status", "Tube", "ETA"], ...filteredSamples.map((s) => [s.id, s.patient, s.type, s.test, s.dept, s.priority, s.status, s.tube, s.eta])]
        : [["ID", "Analyzer", "Level", "Analyte", "Target", "Measured", "Unit", "Status"], ...filteredQc.map((q) => [q.id, q.analyzer, q.level, q.analyte, q.target, q.measured, q.unit, q.status])];
    downloadCsv(`lab-automation-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "fleet", label: "Analyzer Fleet", icon: Server },
    { id: "samples", label: "Sample Workflow Pipeline", icon: Activity },
    { id: "qc", label: "QC & Calibration", icon: Gauge },
  ];

  const priorityOrder = { STAT: 0, Urgent: 1, Routine: 2 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <ToastTray toasts={toasts} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<Database size={24} className="text-emerald-400" />}
            title="Lab Automation &amp; Diagnostics Fleet Hub"
            subtitle="Analyzer fleet · sample workflow · QC &amp; calibration — CLIA / ISO 15189 aligned"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5">
              <button
                onClick={() => sim.setRunning(!sim.running)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
                title={sim.running ? "Pause simulation" : "Resume simulation"}
              >
                {sim.running ? <Pause size={15} /> : <Play size={15} />}
              </button>
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => sim.setSpeed(s)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${sim.speed === s ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:bg-slate-800"}`}
                >
                  {s}×
                </button>
              ))}
              <button
                onClick={sim.reset}
                className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Reset simulation"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <ExportCsvButton onClick={exportCsv} />
          </div>
        </div>

        {/* stat strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Server} label="Analyzers Running" value={stats.running} sub={`${analyzers.length}-unit fleet`} accent="text-emerald-400" />
          <StatCard icon={Siren} label="STAT Samples Open" value={stats.stat} sub="expedited lanes" accent={stats.stat > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Gauge} label="QC Not In Range" value={stats.warn} sub="Levey-Jennings flagged" accent={stats.warn > 0 ? "text-amber-400" : "text-emerald-400"} />
          <StatCard icon={Activity} label="Tests Today" value={stats.totalTests.toLocaleString()} sub="across all analyzers" accent="text-sky-400" />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search analyzers, samples, QC runs…" />
          {tab === "fleet" && (
            <FilterChips label="Filter analyzers by status" options={["All", "Running", "Idle", "Maintenance"]} value={statusFilter} onChange={setStatusFilter} />
          )}
          {tab === "samples" && (
            <FilterChips label="Filter samples by priority" options={["All", "STAT", "Urgent", "Routine"]} value={priorityFilter} onChange={setPriorityFilter} />
          )}
          {tab === "qc" && (
            <FilterChips label="Filter QC runs by result" options={["All", "In Range", "Warning", "Out of Range"]} value={qcFilter} onChange={setQcFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= ANALYZER FLEET TAB ================= */}
        {tab === "fleet" && (
          <div className="space-y-6">
            {/* fleet cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAnalyzers.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setModal({ kind: "analyzer", data: a })}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server size={15} className={a.status === "Running" ? "text-emerald-400" : a.status === "Maintenance" ? "text-red-400" : "text-slate-400"} />
                      <span className="text-[11px] font-bold tracking-wide text-slate-300">{a.id}</span>
                    </div>
                    <Badge>{a.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-200">{a.name}</p>
                  <p className="text-[10px] text-slate-500">{a.room} · {a.model}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Load</span>
                      <span>{a.load}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${a.load > 85 ? "bg-amber-400" : a.load > 50 ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${a.load}%` }} />
                    </div>
                    <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                      <span>{a.tests.toLocaleString()} tests</span>
                      <span>reagents {a.reagents}%</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredAnalyzers.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                  <EmptyState icon={Database} message="No analyzers match the current filters." />
                </div>
              )}
            </section>

            {/* uptime strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Zap size={16} className="text-amber-400" />} title="Fleet Availability" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-emerald-400">{(analyzers.reduce((a, x) => a + x.uptime, 0) / Math.max(1, analyzers.length)).toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-500">avg uptime (30d)</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-slate-100">{analyzers.reduce((a, x) => a + x.calibrations, 0)}</p>
                  <p className="text-[10px] text-slate-500">calibrations (7d)</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-amber-400">{Math.round(analyzers.reduce((a, x) => a + x.reagents, 0) / Math.max(1, analyzers.length))}%</p>
                  <p className="text-[10px] text-slate-500">avg reagent inventory</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-red-400">{analyzers.filter((a) => a.status === "Maintenance").length}</p>
                  <p className="text-[10px] text-slate-500">units in maintenance</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= SAMPLE PIPELINE TAB ================= */}
        {tab === "samples" && (
          <div className="space-y-6">
            {/* pipeline stage strip */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {[
                { label: "Received", key: "Received" },
                { label: "Extracting", key: "Extracting" },
                { label: "Plating", key: "Plating" },
                { label: "Analyzing", key: "Analyzing" },
                { label: "Queued", key: "Queued" },
                { label: "STAT", key: "STAT" },
              ].map((stage) => {
                const count = stage.key === "STAT"
                  ? samples.filter((s) => s.priority === "STAT").length
                  : samples.filter((s) => s.status === stage.key).length;
                return (
                  <div key={stage.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-center">
                    <p className={`text-xl font-bold ${stage.key === "STAT" ? "text-red-400" : "text-slate-100"}`}>{count}</p>
                    <p className="text-[9px] uppercase tracking-wide text-slate-500">{stage.label}</p>
                  </div>
                );
              })}
            </section>

            {/* sample table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Activity size={16} className="text-sky-400" />}
                title="Sample Workflow Pipeline"
                badge={`${filteredSamples.length} samples`}
                right="pre-analytical → analytical → post-analytical"
              />
              {filteredSamples.length === 0 ? (
                <EmptyState icon={Database} message="No samples match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Sample</th>
                        <th className="px-4 py-3">Test</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tube</th>
                        <th className="px-4 py-3">Received</th>
                        <th className="px-4 py-3">ETA</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredSamples]
                        .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="flex items-center gap-3 text-left" onClick={() => setModal({ kind: "sample", data: s })}>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.priority === "STAT" ? "bg-red-500/15 text-red-400" : s.priority === "Urgent" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                                  <Database size={14} />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-200">{s.patient}</p>
                                  <p className="text-[10px] text-slate-500">{s.type} · {s.dept}</p>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{s.test}</td>
                            <td className="px-4 py-3"><Badge>{s.priority}</Badge></td>
                            <td className="px-4 py-3"><Badge>{s.status}</Badge></td>
                            <td className="px-4 py-3 text-slate-400">{s.tube}</td>
                            <td className="px-4 py-3 text-slate-400">{s.received}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${s.priority === "STAT" ? "text-red-400" : "text-slate-300"}`}>{s.eta}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {s.status === "Received" && (
                                  <button
                                    onClick={() => markReceived(s.id)}
                                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    Start
                                  </button>
                                )}
                                <button
                                  onClick={() => setModal({ kind: "sample", data: s })}
                                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                                >
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= QC & CALIBRATION TAB ================= */}
        {tab === "qc" && (
          <div className="space-y-6">
            {/* qc summary */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Gauge size={14} className="text-emerald-400" /> In Range</div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{qcRuns.filter((q) => q.status === "In Range").length}</p>
                <p className="text-[10px] text-slate-500">passing Levey-Jennings</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle size={14} className="text-amber-400" /> Warning</div>
                <p className="mt-1 text-2xl font-bold text-amber-400">{qcRuns.filter((q) => q.status === "Warning").length}</p>
                <p className="text-[10px] text-slate-500">2-sigma drift</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Siren size={14} className="text-red-400" /> Out of Range</div>
                <p className="mt-1 text-2xl font-bold text-red-400">{qcRuns.filter((q) => q.status === "Out of Range").length}</p>
                <p className="text-[10px] text-slate-500">patient results on hold</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Calendar size={14} className="text-sky-400" /> Calibrations</div>
                <p className="mt-1 text-2xl font-bold text-sky-400">{analyzers.reduce((a, x) => a + x.calibrations, 0)}</p>
                <p className="text-[10px] text-slate-500">completed this week</p>
              </div>
            </section>

            {/* qc table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Gauge size={16} className="text-amber-400" />}
                title="Levey-Jennings Control Runs"
                badge={`${filteredQc.length} runs`}
                right="Westgard multi-rule · CLIA 42 CFR 493.1256"
              />
              {filteredQc.length === 0 ? (
                <EmptyState icon={Database} message="No QC runs match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Analyzer</th>
                        <th className="px-4 py-3">Analyte</th>
                        <th className="px-4 py-3">Target</th>
                        <th className="px-4 py-3">Measured</th>
                        <th className="px-4 py-3">Deviation</th>
                        <th className="px-4 py-3">Trend</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQc.map((q) => {
                        const dev = ((q.measured - q.target) / q.target) * 100;
                        return (
                          <tr key={q.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="text-left" onClick={() => setModal({ kind: "qc", data: q })}>
                                <p className="font-medium text-slate-200">{q.analyzer}</p>
                                <p className="text-[10px] text-slate-500">{q.level} · {q.id}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{q.analyte}</td>
                            <td className="px-4 py-3 text-slate-400">{q.target} {q.unit}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${q.status === "In Range" ? "text-emerald-400" : q.status === "Warning" ? "text-amber-400" : "text-red-400"}`}>
                                {q.measured} {q.unit}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] ${Math.abs(dev) > 8 ? "text-red-400" : Math.abs(dev) > 4 ? "text-amber-400" : "text-slate-400"}`}>
                                {dev > 0 ? "+" : ""}{dev.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Sparkline points={q.chart} color={q.status === "In Range" ? "#34d399" : q.status === "Warning" ? "#fbbf24" : "#f87171"} />
                            </td>
                            <td className="px-4 py-3"><Badge>{q.status}</Badge></td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {q.status !== "In Range" && (
                                  <button
                                    onClick={() => repeatQc(q.id)}
                                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    Re-run
                                  </button>
                                )}
                                <button
                                  onClick={() => setModal({ kind: "qc", data: q })}
                                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                                >
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "analyzer" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.model}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">uptime {modal.data.uptime}%</span>
          </div>
          <Row label="Location" value={modal.data.room} />
          <Row label="Current Load" value={`${modal.data.load}%`} />
          <Row label="Tests Completed" value={modal.data.tests.toLocaleString()} />
          <Row label="Reagent Inventory" value={`${modal.data.reagents}%`} />
          <Row label="Calibrations (7d)" value={String(modal.data.calibrations)} />
          <Row label="Last Heartbeat" value={modal.data.last} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Analyzer connectivity is monitored via LIS2-A2 interface. Maintenance mode quarantines the unit from new work and routes samples to failover instruments; results remain available for review.
          </p>
          <button
            onClick={() => { cycleAnalyzer(modal.data.id); setModal(null); }}
            className="w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            {modal.data.status === "Maintenance" ? "Return to Service" : "Place in Maintenance"}
          </button>
        </Modal>
      )}

      {modal?.kind === "sample" && (
        <Modal title={`${modal.data.test} — ${modal.data.patient}`} subtitle={`${modal.data.id} · ${modal.data.dept}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.priority}</Badge>
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">TAT {modal.data.turn}m</span>
          </div>
          <Row label="Specimen Type" value={modal.data.type} />
          <Row label="Collection Tube" value={modal.data.tube} />
          <Row label="Received" value={modal.data.received} />
          <Row label="ETA to Result" value={modal.data.eta} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Samples are tracked through pre-analytical (receipt, centrifugation, aliquoting), analytical (instrument queue) and post-analytical (verification, release) stages with tube-level barcode lineage and chain-of-custody timestamps.
          </p>
          {modal.data.status === "Received" && (
            <button
              onClick={() => { markReceived(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Start Processing
            </button>
          )}
        </Modal>
      )}

      {modal?.kind === "qc" && (
        <Modal title={`${modal.data.analyte} — ${modal.data.analyzer}`} subtitle={`${modal.data.level} · ${modal.data.id}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.unit}</span>
          </div>
          <Row label="Target" value={`${modal.data.target} ${modal.data.unit}`} />
          <Row label="Measured" value={`${modal.data.measured} ${modal.data.unit}`} accent={modal.data.status === "In Range" ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Deviation" value={`${(((modal.data.measured - modal.data.target) / modal.data.target) * 100).toFixed(1)}%`} />
          <Row label="Run Time" value={modal.data.time} />
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-300"><Gauge size={12} /> Levey-Jennings trend</p>
            <Sparkline points={modal.data.chart} color={modal.data.status === "In Range" ? "#34d399" : modal.data.status === "Warning" ? "#fbbf24" : "#f87171"} w={200} h={40} />
          </div>
          {modal.data.status !== "In Range" && (
            <button
              onClick={() => { repeatQc(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Queue Control Re-run
            </button>
          )}
        </Modal>
      )}

      <Footer>
        Lab Automation &amp; Diagnostics Fleet Hub — CLIA 42 CFR 493, ISO 15189, CLSI EP23 · simulation environment · not connected to live instruments
      </Footer>
    </div>
  );
}
