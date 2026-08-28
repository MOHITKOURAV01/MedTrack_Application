import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Beaker, Bell, Boxes, CheckCircle2, ChevronRight,
  Clock, Cross, Database, Download, Droplets, Eye, FileText, Filter, Fingerprint,
  FlaskConical, Gauge, Layers, Microscope, PackageCheck, Pause, Play, Plus,
  RefreshCw, Scan, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Timer, TrendingDown, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const STAGES = ["Accession", "Grossing", "Embedding", "Microtomy", "Staining", "Scanning", "Review"];

const STAGE_META = {
  Accession: { color: "text-slate-300", bg: "bg-slate-500/10" },
  Grossing: { color: "text-sky-300", bg: "bg-sky-500/10" },
  Embedding: { color: "text-cyan-300", bg: "bg-cyan-500/10" },
  Microtomy: { color: "text-violet-300", bg: "bg-violet-500/10" },
  Staining: { color: "text-fuchsia-300", bg: "bg-fuchsia-500/10" },
  Scanning: { color: "text-amber-300", bg: "bg-amber-500/10" },
  Review: { color: "text-emerald-300", bg: "bg-emerald-500/10" },
};

const URGENCY_BADGE = {
  STAT: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  Urgent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Routine: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

const INITIAL_CASES = [
  { id: "P-10421", patient: "PT-2301 — T. Nwosu", specimen: "Colon — polypectomy", site: "GI", stage: "Staining", urgency: "STAT", tatHours: 7.2, blocks: 4, pathologist: "Dr. Osei", fna: false },
  { id: "P-10422", patient: "PT-2296 — F. Duarte", specimen: "Breast — core biopsy", site: "Breast", stage: "Microtomy", urgency: "STAT", tatHours: 9.8, blocks: 6, pathologist: "Dr. Lindqvist", fna: false },
  { id: "P-10423", patient: "PT-2288 — H. Bose", specimen: "Lung — wedge resection", site: "Thoracic", stage: "Grossing", urgency: "Urgent", tatHours: 14.3, blocks: 12, pathologist: "Dr. Osei", fna: false },
  { id: "P-10424", patient: "PT-2274 — M. Silva", specimen: "Skin — excision", site: "Derm", stage: "Embedding", urgency: "Routine", tatHours: 22.1, blocks: 3, pathologist: "Dr. Patel", fna: false },
  { id: "P-10425", patient: "PT-2304 — I. Khan", specimen: "Cervical — LEEP", site: "Gyn", stage: "Scanning", urgency: "Urgent", tatHours: 18.6, blocks: 5, pathologist: "Dr. Lindqvist", fna: false },
  { id: "P-10426", patient: "PT-2283 — G. Park", specimen: "Thyroid — FNA", site: "Endocrine", stage: "Staining", urgency: "Routine", tatHours: 26.4, blocks: 2, pathologist: "Dr. Patel", fna: true },
  { id: "P-10427", patient: "PT-2307 — Y. Tanaka", specimen: "Liver — core biopsy", site: "Hepato", stage: "Review", urgency: "Urgent", tatHours: 31.2, blocks: 4, pathologist: "Dr. Osei", fna: false },
  { id: "P-10428", patient: "PT-2291 — R. Vance", specimen: "Prostate — TRUS bx ×12", site: "Uro", stage: "Embedding", urgency: "Routine", tatHours: 33.8, blocks: 14, pathologist: "Dr. Lindqvist", fna: false },
  { id: "P-10429", patient: "PT-2293 — N. Ali", specimen: "Lymph node — excision", site: "Heme", stage: "Grossing", urgency: "STAT", tatHours: 5.9, blocks: 9, pathologist: "Dr. Patel", fna: false },
  { id: "P-10430", patient: "PT-2300 — O. Petrova", specimen: "Kidney — needle biopsy", site: "Nephro", stage: "Accession", urgency: "Urgent", tatHours: 0.8, blocks: 3, pathologist: "Unassigned", fna: false },
];

const INITIAL_GROSS = [
  { id: "GR-31", caseId: "P-10423", specimen: "Lung — wedge resection", grossed: false, margins: "Pending", blocks: 12, cassettes: 12, fixative: "10% NBF", qc: "Pass", pathologist: "Dr. Osei" },
  { id: "GR-32", caseId: "P-10429", specimen: "Lymph node — excision", grossed: false, margins: "Pending", blocks: 9, cassettes: 9, fixative: "10% NBF", qc: "Pass", pathologist: "Dr. Patel" },
  { id: "GR-33", caseId: "P-10430", specimen: "Kidney — needle biopsy", grossed: false, margins: "n/a (needle)", blocks: 3, cassettes: 3, fixative: "10% NBF", qc: "Pass", pathologist: "Unassigned" },
  { id: "GR-34", caseId: "P-10428", specimen: "Prostate — TRUS bx ×12", grossed: true, margins: "Ink applied", blocks: 14, cassettes: 14, fixative: "10% NBF", qc: "Pass", pathologist: "Dr. Lindqvist" },
  { id: "GR-35", caseId: "P-10426", specimen: "Thyroid — FNA", grossed: true, margins: "n/a (FNA)", blocks: 2, cassettes: 4, fixative: "CytoLyt", qc: "Warn — low cellularity", pathologist: "Dr. Patel" },
];

const INITIAL_PANELS = [
  { id: "IH-71", caseId: "P-10422", target: "Breast — core biopsy", panel: "ER / PR / HER2 / Ki-67", method: "IHC", status: "Staining", score: null, qc: "Pending", tatHours: 11.4, reflex: "HER2 FISH on 2+", pathologist: "Dr. Lindqvist" },
  { id: "IH-72", caseId: "P-10423", target: "Lung — wedge resection", panel: "PD-L1 (22C3) + ALK IHC", method: "IHC", status: "Running", score: null, qc: "Pending", tatHours: 16.2, reflex: "ALK FISH if negative", pathologist: "Dr. Osei" },
  { id: "IH-73", caseId: "P-10429", target: "Lymph node — excision", panel: "CD3 / CD20 / Ki-67 / MIB-1", method: "IHC", status: "Review", score: "Ki-67 65%", qc: "Pass", tatHours: 24.8, reflex: "Flow cytometry correlation", pathologist: "Dr. Patel" },
  { id: "IH-74", caseId: "P-10427", target: "Liver — core biopsy", panel: "CK7 / CK19 / Hep Par-1", method: "IHC", status: "Reported", score: "Hep Par-1 +", qc: "Pass", tatHours: 38.1, reflex: "None", pathologist: "Dr. Osei" },
  { id: "IH-75", caseId: "P-10422", target: "Breast — core biopsy", panel: "HER2 FISH", method: "FISH", status: "Running", score: null, qc: "Pending", tatHours: 19.7, reflex: "Report ratio", pathologist: "Dr. Lindqvist" },
  { id: "IH-76", caseId: "P-10425", target: "Cervical — LEEP", panel: "p16 / Ki-67 dual stain", method: "IHC", status: "Pending", score: null, qc: "Pending", tatHours: 0.0, reflex: "None", pathologist: "Dr. Lindqvist" },
];

const PANEL_STATUS = {
  Pending: { cls: "bg-slate-500/10 text-slate-300 border-slate-500/40" },
  Running: { cls: "bg-sky-500/10 text-sky-300 border-sky-500/40" },
  Staining: { cls: "bg-amber-500/10 text-amber-300 border-amber-500/40" },
  Review: { cls: "bg-violet-500/10 text-violet-300 border-violet-500/40" },
  Reported: { cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" },
};

const CAP_CHECKLISTS = [
  { code: "Breast", title: "Invasive Carcinoma of the Breast", ver: "4.3.0.2", pT: "pT2", pN: "pN1a", pM: "pMx", markers: ["ER 90%", "PR 70%", "HER2 2+"], status: "In progress" },
  { code: "Colon", title: "Colorectal Carcinoma", ver: "4.3.0.2", pT: "pT1", pN: "pN0", pM: "pMx", markers: ["MSI stable", "BRAF V600E"], status: "Pending" },
  { code: "Lung", title: "Non-Small Cell Lung Cancer", ver: "4.3.0.2", pT: "pT1b", pN: "pN2", pM: "pM1a", markers: ["PD-L1 TPS 45%", "ALK neg"], status: "In progress" },
  { code: "Prostate", title: "Adenocarcinoma of the Prostate", ver: "4.3.0.2", pT: "pT3a", pN: "pNx", pM: "pMx", markers: ["Gleason 4+3=7", "Grade group 3"], status: "Pending" },
  { code: "Thyroid", title: "Papillary Thyroid Carcinoma", ver: "4.3.0.2", pT: "pT1b", pN: "pN0", pM: "pMx", markers: ["BRAF V600E+"], status: "Complete" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function tatBand(hours) {
  if (hours >= 48) return { label: "Breach", cls: "text-rose-300 bg-rose-500/10 border-rose-500/40" };
  if (hours >= 30) return { label: "Watch", cls: "text-amber-300 bg-amber-500/10 border-amber-500/40" };
  return { label: "On-track", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/40" };
}

function stageBadge(stage) {
  const m = STAGE_META[stage] || STAGE_META.Accession;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold ${m.color} ${m.bg}`}>
      <Activity className="h-3 w-3" />
      {stage}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PathologyDigitalHub() {
  const [activeTab, setActiveTab] = useState("worklist");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [cases, setCases] = useState(INITIAL_CASES);
  const [grossRows, setGrossRows] = useState(INITIAL_GROSS);
  const [panels, setPanels] = useState(INITIAL_PANELS);
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
        setCases((prev) =>
          prev.map((c) => {
            const idx = STAGES.indexOf(c.stage);
            const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : c.stage;
            return { ...c, stage: nextStage, tatHours: +(c.tatHours + 0.35).toFixed(1) };
          })
        );
        setPanels((prev) =>
          prev.map((p) => {
            if (p.status === "Reported" || p.status === "Pending") return p;
            if (p.status === "Staining") return { ...p, status: "Running", tatHours: +(p.tatHours + 0.4).toFixed(1) };
            return { ...p, status: "Review", tatHours: +(p.tatHours + 0.4).toFixed(1) };
          })
        );
      }
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  /* ---------------- periodic events ---------------- */
  useEffect(() => {
    if (tick === 0) return;
    const r = Math.random();
    if (r < 0.14) {
      const sites = ["GI", "Breast", "Derm", "Uro", "Gyn", "Thoracic"];
      const site = sites[Math.floor(Math.random() * sites.length)];
      const urg = Math.random() < 0.25 ? "STAT" : Math.random() < 0.6 ? "Urgent" : "Routine";
      setCases((prev) => [
        {
          id: `P-${10431 + Math.floor(Math.random() * 900)}`,
          patient: `PT-${2310 + Math.floor(Math.random() * 60)} — Referred Patient`,
          specimen: `${site} — biopsy specimen`,
          site, stage: "Accession", urgency: urg,
          tatHours: 0.2, blocks: 2 + Math.floor(Math.random() * 8),
          pathologist: "Unassigned", fna: false,
        },
        ...prev,
      ]);
      addToast(`New case accessioned (${site}, ${urg})`, "success");
    }
    if (r > 0.8) {
      setCases((prev) =>
        prev.map((c) =>
          c.stage === "Review"
            ? c
            : { ...c, urgency: c.urgency === "Routine" && Math.random() < 0.5 ? "Urgent" : c.urgency }
        )
      );
    }
    if (r > 0.92) {
      setGrossRows((prev) => [
        {
          id: `GR-${36 + Math.floor(Math.random() * 90)}`,
          caseId: `P-${10431 + Math.floor(Math.random() * 900)}`,
          specimen: "Resection specimen",
          grossed: false, margins: "Pending", blocks: 4 + Math.floor(Math.random() * 10),
          cassettes: 0, fixative: "10% NBF", qc: "Pass",
          pathologist: Math.random() < 0.5 ? "Dr. Osei" : "Dr. Patel",
        },
        ...prev,
      ]);
      addToast("New grossing task queued", "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  /* ---------------- derived data ---------------- */
  const stats = useMemo(() => {
    const review = cases.filter((c) => c.stage === "Review").length;
    const stat = cases.filter((c) => c.urgency === "STAT").length;
    const breach = cases.filter((c) => c.tatHours >= 48).length;
    const grossPending = grossRows.filter((g) => !g.grossed).length;
    const panelsActive = panels.filter((p) => p.status !== "Reported" && p.status !== "Pending").length;
    return { review, stat, breach, grossPending, panelsActive };
  }, [cases, grossRows, panels]);

  const filteredCases = useMemo(() => {
    const q = search.toLowerCase();
    return cases.filter((c) => {
      if (stageFilter !== "All" && c.stage !== stageFilter) return false;
      if (urgencyFilter !== "All" && c.urgency !== urgencyFilter) return false;
      if (siteFilter !== "All" && c.site !== siteFilter) return false;
      if (q && !`${c.id} ${c.patient} ${c.specimen} ${c.site} ${c.pathologist}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cases, search, stageFilter, urgencyFilter, siteFilter]);

  const filteredGross = useMemo(() => {
    const q = search.toLowerCase();
    return grossRows.filter((g) => {
      if (q && !`${g.id} ${g.caseId} ${g.specimen} ${g.pathologist}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [grossRows, search]);

  const filteredPanels = useMemo(() => {
    const q = search.toLowerCase();
    return panels.filter((p) => {
      if (stageFilter !== "All") {
        if (stageFilter === "Active" && (p.status === "Reported" || p.status === "Pending")) return false;
        if (stageFilter === "Reported" && p.status !== "Reported") return false;
      }
      if (q && !`${p.id} ${p.caseId} ${p.target} ${p.panel} ${p.method}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [panels, search, stageFilter]);

  /* ---------------- actions ---------------- */
  const reset = useCallback(() => {
    setCases(INITIAL_CASES);
    setGrossRows(INITIAL_GROSS);
    setPanels(INITIAL_PANELS);
    setTick(0);
    setSearch("");
    setStageFilter("All");
    setUrgencyFilter("All");
    setSiteFilter("All");
    addToast("Simulation reset to baseline", "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "worklist"
      ? [["Case", "Patient", "Specimen", "Site", "Stage", "Urgency", "TAT(h)", "Blocks", "Pathologist"]].concat(
          filteredCases.map((c) => [c.id, c.patient, c.specimen, c.site, c.stage, c.urgency, c.tatHours, c.blocks, c.pathologist])
        )
      : activeTab === "grossing"
        ? [["Task", "Case", "Specimen", "Grossed", "Margins", "Blocks", "Fixative", "QC", "Pathologist"]].concat(
            filteredGross.map((g) => [g.id, g.caseId, g.specimen, g.grossed, g.margins, g.blocks, g.fixative, g.qc, g.pathologist])
          )
        : [["Panel", "Case", "Target", "Panel", "Method", "Status", "Score", "QC", "TAT(h)"]].concat(
            filteredPanels.map((p) => [p.id, p.caseId, p.target, p.panel, p.method, p.status, p.score || "—", p.qc, p.tatHours])
          );
    downloadCsv(`pathology-${activeTab}.csv`, rows, "text/csv;charset=utf-8;");
    addToast("CSV exported", "success");
  }, [activeTab, filteredCases, filteredGross, filteredPanels, addToast]);

  const claimCase = (id) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, pathologist: c.pathologist === "Unassigned" ? "Dr. Osei" : c.pathologist, stage: "Review" } : c)));
    addToast(`${id} claimed for review`, "success");
  };

  const completeGross = (id) => {
    setGrossRows((prev) => prev.map((g) => (g.id === id ? { ...g, grossed: true, margins: "Ink applied", qc: "Pass" } : g)));
    addToast(`${id} grossing complete — cassettes to embedding`, "success");
  };

  const advancePanel = (id) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.status === "Pending") return { ...p, status: "Staining" };
        if (p.status === "Staining") return { ...p, status: "Running" };
        if (p.status === "Running") return { ...p, status: "Review", qc: "Pass", score: "Score pending pathologist" };
        return p;
      })
    );
    addToast(`Panel ${id} advanced`, "info");
  };

  const reportPanel = (id) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Reported", qc: "Pass", score: p.score || "Reviewed" } : p)));
    addToast(`Panel ${id} signed out`, "success");
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

  const filterBar = () => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cases, panels…"
          className="w-64 rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600"
        />
      </div>
      <select
        value={stageFilter}
        onChange={(e) => setStageFilter(e.target.value)}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
      >
        {activeTab === "panels" ? (
          <>
            <option>All</option>
            <option>Active</option>
            <option>Reported</option>
          </>
        ) : (
          ["All", ...STAGES].map((s) => <option key={s}>{s}</option>)
        )}
      </select>
      <select
        value={urgencyFilter}
        onChange={(e) => setUrgencyFilter(e.target.value)}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
      >
        {["All", "STAT", "Urgent", "Routine"].map((s) => <option key={s}>{s}</option>)}
      </select>
      {activeTab === "worklist" && (
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
        >
          {["All", "GI", "Breast", "Derm", "Uro", "Gyn", "Thoracic", "Heme", "Endocrine", "Hepato", "Nephro"].map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
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

  /* ================= WORKLIST CONSOLE ================= */
  const worklistConsole = (
    <div className="space-y-6">
      {/* pipeline strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Cases in review", value: stats.review, icon: <Microscope className="h-4 w-4 text-emerald-300" /> },
          { label: "STAT lanes active", value: stats.stat, icon: <Siren className="h-4 w-4 text-rose-300" /> },
          { label: "TAT ≥ 48h (breach)", value: stats.breach, icon: <Timer className="h-4 w-4 text-amber-300" />, alert: stats.breach > 0 },
          { label: "Grossing backlog", value: stats.grossPending, icon: <Layers className="h-4 w-4 text-sky-300" /> },
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

      {/* pipeline flow */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Histology Pipeline</h3>
            <p className="text-xs text-slate-500">Live case counts per stage · CAP 10-day / 30-day TAT benchmarks</p>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-amber-300" />
        </div>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
          {STAGES.map((s, i) => {
            const count = cases.filter((c) => c.stage === s).length;
            const m = STAGE_META[s];
            return (
              <div key={s} className={`relative rounded-lg border border-slate-800 p-3 text-center ${m.bg}`}>
                <p className={`text-xl font-bold ${m.color}`}>{count}</p>
                <p className={`text-[11px] font-medium ${m.color}`}>{s}</p>
                {i < STAGES.length - 1 && <ChevronRight className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* cases table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Case Worklist</h3>
            <p className="text-xs text-slate-500">{filteredCases.length} cases · accession → review · digital slide scanning enabled</p>
          </div>
          {filterBar()}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Patient / Specimen</th>
                <th className="px-5 py-3">Site</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">TAT</th>
                <th className="px-5 py-3">Blocks</th>
                <th className="px-5 py-3">Pathologist</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                const band = tatBand(c.tatHours);
                return (
                  <tr key={c.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <button onClick={() => setModal({ kind: "case", data: c })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">
                        {c.id}
                      </button>
                      {c.fna && <span className="ml-2 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">FNA</span>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-200">{c.patient}</p>
                      <p className="text-xs text-slate-500">{c.specimen}</p>
                    </td>
                    <td className="px-5 py-3"><span className="text-xs font-medium text-slate-400">{c.site}</span></td>
                    <td className="px-5 py-3">{stageBadge(c.stage)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${band.cls}`}>{c.tatHours.toFixed(1)}h</span>
                      <span className="ml-2 text-xs text-slate-500">{band.label}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{c.blocks}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{c.pathologist}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${URGENCY_BADGE[c.urgency]}`}>{c.urgency}</span>
                        {c.stage !== "Review" && c.pathologist !== "Unassigned" && (
                          <button onClick={() => claimCase(c.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                            Claim
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCases.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No cases match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ================= GROSSING CONSOLE ================= */
  const grossingConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Grossing tasks", value: grossRows.length, icon: <Layers className="h-4 w-4 text-sky-300" /> },
          { label: "Awaiting gross", value: grossRows.filter((g) => !g.grossed).length, icon: <Clock className="h-4 w-4 text-amber-300" /> },
          { label: "QC warnings", value: grossRows.filter((g) => g.qc.startsWith("Warn")).length, icon: <AlertTriangle className="h-4 w-4 text-rose-300" />, alert: true },
          { label: "Total cassettes", value: grossRows.reduce((a, g) => a + g.cassettes, 0), icon: <Boxes className="h-4 w-4 text-emerald-300" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
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
            <h3 className="text-sm font-semibold text-white">Grossing Station Queue</h3>
            <p className="text-xs text-slate-500">Margin inking · cassette labelling · 10% NBF fixation · CAP specimen-handling protocol</p>
          </div>
          {filterBar()}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Task</th>
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Specimen</th>
                <th className="px-5 py-3">Margins</th>
                <th className="px-5 py-3">Blocks / Cassettes</th>
                <th className="px-5 py-3">Fixative</th>
                <th className="px-5 py-3">QC</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGross.map((g) => (
                <tr key={g.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ kind: "gross", data: g })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{g.id}</button>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{g.caseId}</td>
                  <td className="px-5 py-3 text-slate-200">{g.specimen}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{g.margins}</td>
                  <td className="px-5 py-3 text-slate-300">{g.blocks} / {g.cassettes}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{g.fixative}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      g.qc.startsWith("Warn") ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}>{g.qc}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      {!g.grossed && (
                        <button onClick={() => completeGross(g.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                          Complete
                        </button>
                      )}
                      {g.grossed && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGross.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No grossing tasks match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAP synoptic checklists */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">CAP Cancer Synoptic Checklists</h3>
            <p className="text-xs text-slate-500">pTNM staging · protocol version tracking · structured pathology reporting</p>
          </div>
          <Award className="h-5 w-5 text-amber-300" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {CAP_CHECKLISTS.map((c) => (
            <div key={c.code} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">{c.code}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.status === "Complete" ? "bg-emerald-500/15 text-emerald-300" : c.status === "In progress" ? "bg-sky-500/15 text-sky-300" : "bg-slate-700 text-slate-300"}`}>
                  {c.status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-400">{c.title}</p>
              <p className="mt-2 font-mono text-[11px] text-slate-500">{c.pT} · {c.pN} · {c.pM}</p>
              <p className="mt-1 text-[11px] text-slate-500">v{c.ver} · {c.markers.join(" · ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ================= PANELS CONSOLE ================= */
  const panelsConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active panels", value: stats.panelsActive, icon: <FlaskConical className="h-4 w-4 text-sky-300" /> },
          { label: "Reported / signed out", value: panels.filter((p) => p.status === "Reported").length, icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" /> },
          { label: "Reflex testing flagged", value: panels.filter((p) => p.reflex && p.reflex !== "None").length, icon: <Zap className="h-4 w-4 text-amber-300" /> },
          { label: "FISH assays", value: panels.filter((p) => p.method === "FISH").length, icon: <Scan className="h-4 w-4 text-violet-300" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">IHC / FISH Panel Console</h3>
            <p className="text-xs text-slate-500">ASCO/CAP HER2 & PD-L1 scoring guidelines · reflex algorithm triggers</p>
          </div>
          {filterBar()}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Panel</th>
                <th className="px-5 py-3">Case / Target</th>
                <th className="px-5 py-3">Panel Markers</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">QC</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPanels.map((p) => {
                const s = PANEL_STATUS[p.status] || PANEL_STATUS.Pending;
                return (
                  <tr key={p.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <button onClick={() => setModal({ kind: "panel", data: p })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{p.id}</button>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-200">{p.caseId}</p>
                      <p className="text-xs text-slate-500">{p.target}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-300">{p.panel}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${p.method === "FISH" ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"}`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="px-5 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{p.status}</span></td>
                    <td className="px-5 py-3 text-xs text-slate-300">{p.score || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${p.qc === "Pass" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>{p.qc}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {p.status === "Pending" && (
                          <button onClick={() => advancePanel(p.id)} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/20">Start</button>
                        )}
                        {p.status === "Running" && (
                          <button onClick={() => advancePanel(p.id)} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/20">To Review</button>
                        )}
                        {(p.status === "Review" || p.status === "Staining") && (
                          <button onClick={() => reportPanel(p.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">Sign Out</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPanels.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No panels match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">Reflex & Scoring Rules</h3>
        </div>
        <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            HER2 IHC 2+ (equivocal) auto-triggers HER2 FISH reflex per ASCO/CAP guidelines.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            PD-L1 22C3 TPS scored at ≥1%, ≥50% thresholds; ALK IHC-negative cases reflex to FISH.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Ki-67 proliferation index reported with hot-spot methodology and control validation.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Every run carries positive/negative control slides; QC failure blocks sign-out.
          </div>
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
              {kind === "case" ? `Case ${data.id}` : kind === "gross" ? `Grossing ${data.id}` : `Panel ${data.id}`}
            </h3>
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {kind === "case" && (
            <div className="space-y-3 text-sm">
              <Row label="Patient" value={data.patient} />
              <Row label="Specimen" value={data.specimen} />
              <Row label="Site" value={data.site} />
              <Row label="Stage" value={data.stage} />
              <Row label="Urgency" value={data.urgency} />
              <Row label="TAT elapsed" value={`${data.tatHours.toFixed(1)} hours`} />
              <Row label="Blocks" value={data.blocks} />
              <Row label="Pathologist" value={data.pathologist} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.fna
                  ? "Cytology FNA case — rapid on-site evaluation (ROSE) applied; cell block prepared for ancillary testing."
                  : "Histology case — H&E slide set on digital scanner; whole-slide image available for remote review at 40×."}
              </p>
            </div>
          )}
          {kind === "gross" && (
            <div className="space-y-3 text-sm">
              <Row label="Case" value={data.caseId} />
              <Row label="Specimen" value={data.specimen} />
              <Row label="Grossed" value={data.grossed ? "Yes" : "Pending"} />
              <Row label="Margins" value={data.margins} />
              <Row label="Blocks" value={data.blocks} />
              <Row label="Cassettes" value={data.cassettes} />
              <Row label="Fixative" value={data.fixative} />
              <Row label="QC" value={data.qc} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.qc.startsWith("Warn")
                  ? "QC warning: specimen cellularity below threshold — pathologist to review adequacy before embedding."
                  : "Specimen fixation and inking compliant with CAP gross examination standards; cassettes queued for embedding."}
              </p>
            </div>
          )}
          {kind === "panel" && (
            <div className="space-y-3 text-sm">
              <Row label="Case" value={data.caseId} />
              <Row label="Target" value={data.target} />
              <Row label="Panel" value={data.panel} />
              <Row label="Method" value={data.method} />
              <Row label="Status" value={data.status} />
              <Row label="Score" value={data.score || "Pending"} />
              <Row label="QC" value={data.qc} />
              <Row label="TAT elapsed" value={`${data.tatHours.toFixed(1)} hours`} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                Reflex rule: <span className="font-semibold text-amber-300">{data.reflex}</span> — the assay auto-queues
                follow-up testing when the primary result meets the trigger threshold defined by ASCO/CAP guidelines.
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
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <Microscope className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Pathology & Digital Pathology</h1>
                <p className="text-sm text-slate-400">CAP accreditation · whole-slide imaging · ASCO/CAP biomarker guidelines · synoptic reporting</p>
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
          <StatCard label="Active cases" value={cases.length} icon={<Boxes className="h-4 w-4 text-emerald-300" />} />
          <StatCard label="In review" value={stats.review} icon={<Microscope className="h-4 w-4 text-violet-300" />} />
          <StatCard label="STAT cases" value={stats.stat} icon={<Siren className="h-4 w-4 text-rose-300" />} />
          <StatCard label="TAT breaches" value={stats.breach} icon={<Timer className="h-4 w-4 text-amber-300" />} alert={stats.breach > 0} />
          <StatCard label="Active IHC/FISH" value={stats.panelsActive} icon={<FlaskConical className="h-4 w-4 text-sky-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabBtn("worklist", "Slide Worklist & TAT", <Layers className="h-4 w-4" />)}
          {tabBtn("grossing", "Grossing & Micro Staging", <Boxes className="h-4 w-4" />)}
          {tabBtn("panels", "IHC / FISH Panel Console", <FlaskConical className="h-4 w-4" />)}
        </div>

        {/* active console */}
        {activeTab === "worklist" && worklistConsole}
        {activeTab === "grossing" && grossingConsole}
        {activeTab === "panels" && panelsConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">CAP · CLIA · ASCO/CAP guideline compliance dashboard</span>
          <button onClick={() => addToast("Digital slide archive exported to DICOM-WSI store", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
            <Database className="h-3.5 w-3.5" /> Export WSI archive
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

