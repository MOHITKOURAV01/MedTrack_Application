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

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const STUDIES = [
  { id: "st-8001", patient: "P-4471", modality: "CT", body: "Abdomen / Pelvis", order: "Dr. A. Verma", status: "Reading", tat: 26, priority: "STAT", reader: "Dr. Amir Hassan", ai: "Done", aiFindings: 3, ts: "9m ago" },
  { id: "st-8002", patient: "P-8830", modality: "MR", body: "Breast Bi-lateral", order: "Dr. L. Fischer", status: "Acquired", tat: 18, priority: "Routine", reader: "—", ai: "Queued", aiFindings: 0, ts: "5m ago" },
  { id: "st-8003", patient: "P-1120", modality: "XR", body: "Chest 2-View", order: "Dr. R. Patel", status: "Drafted", tat: 41, priority: "Routine", reader: "Dr. Amir Hassan", ai: "Done", aiFindings: 1, ts: "22m ago" },
  { id: "st-8004", patient: "P-6655", modality: "US", body: "Right Upper Quadrant", order: "Dr. S. Nair", status: "Scheduled", tat: 0, priority: "Routine", reader: "—", ai: "Pending", aiFindings: 0, ts: "—" },
  { id: "st-8005", patient: "P-2210", modality: "CT", body: "Head w/o Contrast", order: "ER On-call", status: "Reading", tat: 15, priority: "STAT", reader: "Dr. K. Brooks", ai: "Done", aiFindings: 2, ts: "4m ago" },
  { id: "st-8006", patient: "P-7721", modality: "PET", body: "Oncology Staging", order: "Dr. L. Fischer", status: "Acquired", tat: 64, priority: "Routine", reader: "—", ai: "Running", aiFindings: 0, ts: "31m ago" },
  { id: "st-8007", patient: "P-3389", modality: "CT", body: "Chest w/ Contrast", order: "Dr. A. Verma", status: "Reading", tat: 33, priority: "Urgent", reader: "Dr. Amir Hassan", ai: "Done", aiFindings: 4, ts: "14m ago" },
  { id: "st-8008", patient: "P-9902", modality: "MR", body: "Lumbar Spine", order: "Dr. M. Chen", status: "Drafted", tat: 52, priority: "Routine", reader: "Dr. K. Brooks", ai: "Done", aiFindings: 1, ts: "40m ago" },
  { id: "st-8009", patient: "P-5567", modality: "XR", body: "Pelvis", order: "ER On-call", status: "Reading", tat: 21, priority: "STAT", reader: "Dr. Amir Hassan", ai: "Done", aiFindings: 2, ts: "7m ago" },
  { id: "st-8010", patient: "P-4410", modality: "US", body: "Carotid Doppler", order: "Dr. S. Nair", status: "Scheduled", tat: 0, priority: "Routine", reader: "—", ai: "Pending", aiFindings: 0, ts: "—" },
];

const MODALITIES = [
  { id: "mo-01", name: "CT Scanner 1", model: "Siemens SOMATOM Force", room: "Rad-1", status: "Running", load: 84, studies: 38, uptime: 98.2, dose: 1.8, last: "1m ago" },
  { id: "mo-02", name: "CT Scanner 2", model: "GE Revolution Apex", room: "Rad-2", status: "Running", load: 71, studies: 31, uptime: 97.6, dose: 2.1, last: "3m ago" },
  { id: "mo-03", name: "MRI 3T", model: "Siemens MAGNETOM Vida", room: "MR-1", status: "Running", load: 92, studies: 17, uptime: 99.1, dose: 0, last: "40s ago" },
  { id: "mo-04", name: "MRI 1.5T", model: "Philips Ingenia", room: "MR-2", status: "Idle", load: 22, studies: 12, uptime: 96.8, dose: 0, last: "18m ago" },
  { id: "mo-05", name: "PET/CT", model: "GE Discovery MI", room: "NM-1", status: "Running", load: 58, studies: 9, uptime: 95.4, dose: 4.2, last: "6m ago" },
  { id: "mo-06", name: "Radiography DR 1", model: "Carestream DRX", room: "XR-1", status: "Running", load: 63, studies: 74, uptime: 99.0, dose: 0.6, last: "2m ago" },
  { id: "mo-07", name: "Radiography DR 2", model: "Agfa DX-D 600", room: "XR-2", status: "Running", load: 47, studies: 61, uptime: 98.5, dose: 0.5, last: "4m ago" },
  { id: "mo-08", name: "Ultrasound EPIQ", model: "Philips EPIQ Elite", room: "US-1", status: "Running", load: 55, studies: 28, uptime: 97.9, dose: 0, last: "5m ago" },
  { id: "mo-09", name: "Mammography", model: "Hologic Dimensions", room: "MG-1", status: "Idle", load: 18, studies: 22, uptime: 99.3, dose: 1.2, last: "25m ago" },
  { id: "mo-10", name: "Mobile C-Arm", model: "GE OEC 9900", room: "OR-2", status: "Running", load: 38, studies: 11, uptime: 96.1, dose: 2.8, last: "8m ago" },
];

const AI_JOBS = [
  { id: "ai-501", study: "st-8001", model: "Abdomen Hemorrhage Detector", version: "v4.2", status: "Completed", confidence: 94, findings: 3, latency: "14s", runtime: "2m ago" },
  { id: "ai-502", study: "st-8003", model: "Chest XR Pneumonia AI", version: "v3.8", status: "Completed", confidence: 87, findings: 1, latency: "9s", runtime: "21m ago" },
  { id: "ai-503", study: "st-8005", model: "Head CT Hemorrhage", version: "v5.1", status: "Completed", confidence: 96, findings: 2, latency: "11s", runtime: "3m ago" },
  { id: "ai-504", study: "st-8006", model: "PET Lesion Segmentation", version: "v2.6", status: "Running", confidence: 0, findings: 0, latency: "—", runtime: "38s" },
  { id: "ai-505", study: "st-8007", model: "PE (Pulmonary Embolism)", version: "v4.9", status: "Completed", confidence: 91, findings: 4, latency: "13s", runtime: "13m ago" },
  { id: "ai-506", study: "st-8009", model: "Fracture Detection", version: "v6.0", status: "Completed", confidence: 89, findings: 2, latency: "8s", runtime: "6m ago" },
  { id: "ai-507", study: "st-8002", model: "Breast Density & Calc", version: "v4.0", status: "Queued", confidence: 0, findings: 0, latency: "—", runtime: "queued" },
  { id: "ai-508", study: "st-8008", model: "Spine Degenerative Grading", version: "v3.2", status: "Completed", confidence: 82, findings: 1, latency: "16s", runtime: "39m ago" },
];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["STAT", "Critical"].includes(v)) return "red";
  if (["Urgent", "Running", "Reading"].includes(v)) return "amber";
  if (["Completed", "In Range"].includes(v)) return "green";
  if (["Scheduled", "Queued", "Drafted", "Acquired", "Idle"].includes(v)) return "sky";
  return "slate";
};



const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;



const Meter = ({ value, color = "bg-emerald-400" }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-800">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);




const ScanIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Live simulation hook                                               */
/* ------------------------------------------------------------------ */

function useSimulation({ studyRef, modalityRef, aiRef, toast }) {
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

    // Study TAT creep + stage transitions
    studyRef.current = studyRef.current.map((s) => {
      if (s.status === "Scheduled" || s.status === "Completed") return s;
      const tat = s.tat + 1;
      const status = s.status === "Acquired" && tat > 30 ? "Reading" : s.status;
      return { ...s, tat, status };
    });

    // Modality load + study counts
    modalityRef.current = modalityRef.current.map((m) => {
      if (m.status === "Idle") return m;
      const load = Math.min(99, Math.max(10, Math.round(m.load + (Math.random() * 6 - 3))));
      const studies = m.studies + (Math.random() < 0.4 ? 1 : 0);
      return { ...m, load, studies };
    });

    // AI job progression
    aiRef.current = aiRef.current.map((a) => {
      if (a.status === "Queued") {
        if (Math.random() < 0.3) {
          toast(`${a.model} started on study ${a.study}`, "Low");
          return { ...a, status: "Running", runtime: "started" };
        }
        return a;
      }
      if (a.status === "Running" && Math.random() < 0.4) {
        toast(`${a.model} completed · ${a.confidence}% confidence`, "Low");
        return { ...a, status: "Completed", findings: Math.max(1, Math.round(Math.random() * 4)), confidence: Math.round(80 + Math.random() * 17), latency: `${Math.round(8 + Math.random() * 10)}s`, runtime: "just now" };
      }
      return a;
    });
  }, [studyRef, modalityRef, aiRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      studyRef.current = STUDIES.map((s) => ({ ...s }));
      modalityRef.current = MODALITIES.map((m) => ({ ...m }));
      aiRef.current = AI_JOBS.map((a) => ({ ...a }));
      setTick(0);
      toast("Radiology console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function RadiologyImagingHub() {
  const [tab, setTab] = useState("worklist");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modalityFilter, setModalityFilter] = useState("All");
  const [aiFilter, setAiFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [studies, setStudies] = useState(() => STUDIES.map((s) => ({ ...s })));
  const [modalities, setModalities] = useState(() => MODALITIES.map((m) => ({ ...m })));
  const [aiJobs, setAiJobs] = useState(() => AI_JOBS.map((a) => ({ ...a })));

  const studyRef = useRef(studies);
  const modalityRef = useRef(modalities);
  const aiRef = useRef(aiJobs);

  useEffect(() => { studyRef.current = studies; }, [studies]);
  useEffect(() => { modalityRef.current = modalities; }, [modalities]);
  useEffect(() => { aiRef.current = aiJobs; }, [aiJobs]);

  const sim = useSimulation({ studyRef, modalityRef, aiRef, toast });

  useEffect(() => {
    setStudies([...studyRef.current]);
    setModalities([...modalityRef.current]);
    setAiJobs([...aiRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const stat = studies.filter((s) => s.priority === "STAT" && s.status !== "Completed").length;
    const reading = studies.filter((s) => s.status === "Reading").length;
    const running = modalities.filter((m) => m.status === "Running").length;
    const aiDone = aiJobs.filter((a) => a.status === "Completed").length;
    return { stat, reading, running, aiDone };
  }, [studies, modalities, aiJobs]);

  /* ---------- filters ---------- */
  const filteredStudies = useMemo(() => {
    return studies.filter((s) => {
      const q = query.toLowerCase();
      const matchQ = !q || [s.patient, s.modality, s.body, s.order, s.reader].some((x) => x.toLowerCase().includes(q));
      const matchP = priorityFilter === "All" || s.priority === priorityFilter;
      return matchQ && matchP;
    });
  }, [studies, query, priorityFilter]);

  const filteredModalities = useMemo(() => {
    return modalities.filter((m) => {
      const q = query.toLowerCase();
      const matchQ = !q || [m.name, m.model, m.room].some((x) => x.toLowerCase().includes(q));
      const matchS = modalityFilter === "All" || m.status === modalityFilter;
      return matchQ && matchS;
    });
  }, [modalities, query, modalityFilter]);

  const filteredAi = useMemo(() => {
    return aiJobs.filter((a) => {
      const q = query.toLowerCase();
      const matchQ = !q || [a.model, a.study, a.version].some((x) => x.toLowerCase().includes(q));
      const matchS = aiFilter === "All" || a.status === aiFilter;
      return matchQ && matchS;
    });
  }, [aiJobs, query, aiFilter]);

  /* ---------- actions ---------- */
  const claimStudy = (id) => {
    setStudies((ss) => ss.map((s) => (s.id === id ? { ...s, status: "Reading", reader: "Dr. Amir Hassan" } : s)));
    toast("Study claimed by on-call radiologist", "Low");
  };

  const finalizeStudy = (id) => {
    setStudies((ss) => ss.map((s) => (s.id === id ? { ...s, status: "Completed" } : s)));
    toast("Report finalized and routed to ordering physician", "Low");
  };

  const toggleModality = (id) => {
    setModalities((ms) => ms.map((m) => (m.id === id ? { ...m, status: m.status === "Idle" ? "Running" : "Idle" } : m)));
    toast("Modality operational state toggled", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "worklist"
        ? [["ID", "Patient", "Modality", "Body", "Ordered By", "Status", "TAT (m)", "Priority", "Reader"], ...filteredStudies.map((s) => [s.id, s.patient, s.modality, s.body, s.order, s.status, s.tat, s.priority, s.reader])]
        : tab === "modalities"
        ? [["ID", "Modality", "Model", "Room", "Status", "Load %", "Studies", "Uptime %", "Dose"], ...filteredModalities.map((m) => [m.id, m.name, m.model, m.room, m.status, m.load, m.studies, m.uptime, m.dose])]
        : [["ID", "Study", "AI Model", "Version", "Status", "Confidence %", "Findings", "Latency"], ...filteredAi.map((a) => [a.id, a.study, a.model, a.version, a.status, a.confidence, a.findings, a.latency])];
    downloadCsv(`radiology-imaging-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "worklist", label: "Study Worklist & TAT", icon: FileText },
    { id: "modalities", label: "Modality Fleet", icon: Cpu },
    { id: "ai", label: "AI CAD & Reporting", icon: Radar },
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
            icon={<ScanIcon />}
            title="Radiology Imaging &amp; PACS Overwatch Hub"
            subtitle="Study worklist · modality fleet · AI CAD &amp; reporting — DICOM / HL7 / IHE aligned"
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
          <StatCard icon={Siren} label="STAT Studies Open" value={stats.stat} sub="expedited read lanes" accent={stats.stat > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Eye} label="Currently Reading" value={stats.reading} sub="radiologists in queue" accent="text-amber-400" />
          <StatCard icon={Cpu} label="Modalities Running" value={stats.running} sub={`${modalities.length}-unit fleet`} accent="text-emerald-400" />
          <StatCard icon={Radar} label="AI Jobs Completed" value={stats.aiDone} sub="CAD findings available" accent="text-sky-400" />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search studies, modalities, AI jobs…" />
          {tab === "worklist" && (
            <FilterChips options={["All", "STAT", "Urgent", "Routine"]} value={priorityFilter} onChange={setPriorityFilter} />
          )}
          {tab === "modalities" && (
            <FilterChips options={["All", "Running", "Idle"]} value={modalityFilter} onChange={setModalityFilter} />
          )}
          {tab === "ai" && (
            <FilterChips options={["All", "Completed", "Running", "Queued"]} value={aiFilter} onChange={setAiFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= WORKLIST TAB ================= */}
        {tab === "worklist" && (
          <div className="space-y-6">
            {/* modality mix strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {["CT", "MR", "XR", "US", "PET"].map((mod) => {
                const count = studies.filter((s) => s.modality === mod).length;
                return (
                  <div key={mod} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xl font-bold text-slate-100">{count}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{mod} studies</p>
                  </div>
                );
              })}
            </section>

            {/* worklist table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<FileText size={16} className="text-emerald-400" />}
                title="Radiology Worklist"
                badge={`${filteredStudies.length} studies`}
                right="DICOM MWL · TAT in minutes"
              />
              {filteredStudies.length === 0 ? (
                <EmptyState icon={ScanIcon} message="No studies match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Study</th>
                        <th className="px-4 py-3">Modality</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">TAT</th>
                        <th className="px-4 py-3">Reader</th>
                        <th className="px-4 py-3">AI CAD</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredStudies]
                        .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="flex items-center gap-3 text-left" onClick={() => setModal({ kind: "study", data: s })}>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.priority === "STAT" ? "bg-red-500/15 text-red-400" : s.priority === "Urgent" ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-400"}`}>
                                  <ScanIcon size={14} />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-200">{s.patient}</p>
                                  <p className="text-[10px] text-slate-500">{s.body} · {s.order}</p>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{s.modality}</span>
                            </td>
                            <td className="px-4 py-3"><Badge>{s.priority}</Badge></td>
                            <td className="px-4 py-3"><Badge>{s.status}</Badge></td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${s.priority === "STAT" && s.tat > 20 ? "text-red-400" : "text-slate-300"}`}>{s.tat > 0 ? `${s.tat}m` : "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{s.reader === "—" ? "unassigned" : s.reader}</td>
                            <td className="px-4 py-3">
                              {s.ai === "Done" ? (
                                <span className="text-[11px] font-medium text-emerald-400">{s.aiFindings} findings</span>
                              ) : (
                                <Badge>{s.ai}</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {s.status === "Acquired" && (
                                  <button
                                    onClick={() => claimStudy(s.id)}
                                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    Claim
                                  </button>
                                )}
                                {(s.status === "Reading" || s.status === "Drafted") && (
                                  <button
                                    onClick={() => finalizeStudy(s.id)}
                                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    Finalize
                                  </button>
                                )}
                                <button
                                  onClick={() => setModal({ kind: "study", data: s })}
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

        {/* ================= MODALITY FLEET TAB ================= */}
        {tab === "modalities" && (
          <div className="space-y-6">
            {/* fleet cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredModalities.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModal({ kind: "modality", data: m })}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu size={15} className={m.status === "Running" ? "text-emerald-400" : "text-slate-400"} />
                      <span className="text-[11px] font-bold tracking-wide text-slate-300">{m.id}</span>
                    </div>
                    <Badge>{m.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-200">{m.name}</p>
                  <p className="text-[10px] text-slate-500">{m.model} · {m.room}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Load</span>
                      <span>{m.load}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${m.load > 85 ? "bg-amber-400" : m.load > 50 ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${m.load}%` }} />
                    </div>
                    <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                      <span>{m.studies} today</span>
                      <span>{m.dose > 0 ? `${m.dose} mSv` : "no ionizing"}</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredModalities.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
                  <EmptyState icon={ScanIcon} message="No modalities match the current filters." />
                </div>
              )}
            </section>

            {/* uptime strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Activity size={16} className="text-emerald-400" />} title="Fleet Performance" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-emerald-400">{(modalities.reduce((a, x) => a + x.uptime, 0) / Math.max(1, modalities.length)).toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-500">avg uptime (30d)</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-slate-100">{modalities.reduce((a, x) => a + x.studies, 0)}</p>
                  <p className="text-[10px] text-slate-500">studies today</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-amber-400">{(modalities.reduce((a, x) => a + x.dose, 0) / Math.max(1, modalities.filter((m) => m.dose > 0).length)).toFixed(1)} mSv</p>
                  <p className="text-[10px] text-slate-500">avg effective dose / exam</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xl font-bold text-sky-400">{modalities.filter((m) => m.status === "Running").length}</p>
                  <p className="text-[10px] text-slate-500">units accepting work</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= AI CAD TAB ================= */}
        {tab === "ai" && (
          <div className="space-y-6">
            {/* ai summary */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Radar size={14} className="text-emerald-400" /> Completed</div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{aiJobs.filter((a) => a.status === "Completed").length}</p>
                <p className="text-[10px] text-slate-500">findings delivered to worklist</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Zap size={14} className="text-amber-400" /> Running</div>
                <p className="mt-1 text-2xl font-bold text-amber-400">{aiJobs.filter((a) => a.status === "Running").length}</p>
                <p className="text-[10px] text-slate-500">inference in progress</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Clock size={14} className="text-sky-400" /> Queued</div>
                <p className="mt-1 text-2xl font-bold text-sky-400">{aiJobs.filter((a) => a.status === "Queued").length}</p>
                <p className="text-[10px] text-slate-500">awaiting GPU capacity</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Award size={14} className="text-purple-400" /> Avg Confidence</div>
                <p className="mt-1 text-2xl font-bold text-purple-400">
                  {Math.round(aiJobs.filter((a) => a.confidence > 0).reduce((a, x) => a + x.confidence, 0) / Math.max(1, aiJobs.filter((a) => a.confidence > 0).length))}%
                </p>
                <p className="text-[10px] text-slate-500">across completed jobs</p>
              </div>
            </section>

            {/* ai job table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Radar size={16} className="text-sky-400" />}
                title="AI CAD Inference Queue"
                badge={`${filteredAi.length} jobs`}
                right="DICOM SR structured findings"
              />
              {filteredAi.length === 0 ? (
                <EmptyState icon={ScanIcon} message="No AI jobs match the current filters." />
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filteredAi.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        a.status === "Completed" ? "bg-emerald-500/15 text-emerald-400" : a.status === "Running" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"
                      }`}>
                        {a.status === "Completed" ? <CheckCircle2 size={15} /> : a.status === "Running" ? <Zap size={15} /> : <Clock size={15} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button className="flex items-center gap-2 text-left" onClick={() => setModal({ kind: "ai", data: a })}>
                          <p className="truncate text-xs font-medium text-slate-200">{a.model}</p>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">{a.version}</span>
                        </button>
                        <p className="mt-0.5 text-[10px] text-slate-500">study {a.study} · {a.runtime}</p>
                      </div>
                      <div className="hidden items-center gap-3 sm:flex">
                        {a.status === "Completed" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-300">{a.confidence}%</span>
                            <Meter value={a.confidence} color={a.confidence >= 90 ? "bg-emerald-400" : "bg-amber-400"} />
                          </div>
                        )}
                        <Badge>{a.status}</Badge>
                        {a.status === "Completed" && <span className="text-[10px] text-slate-500">{a.findings} findings · {a.latency}</span>}
                      </div>
                      <button
                        onClick={() => setModal({ kind: "ai", data: a })}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "study" && (
        <Modal title={`${modal.data.body} — ${modal.data.patient}`} subtitle={`${modal.data.id} · ${modal.data.modality}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.priority}</Badge>
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">TAT {modal.data.tat}m</span>
          </div>
          <Row label="Ordering Physician" value={modal.data.order} />
          <Row label="Reader" value={modal.data.reader === "—" ? "Unassigned" : modal.data.reader} />
          <Row label="AI CAD" value={modal.data.ai === "Done" ? `${modal.data.aiFindings} findings available` : modal.data.ai} />
          <Row label="Requested" value={modal.data.ts === "—" ? "scheduled" : modal.data.ts} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Studies flow through acquisition → AI CAD inference → radiologist interpretation → final report, with turnaround time measured from order entry to verified report. STAT and Urgent lanes bypass the routine queue.
          </p>
          {modal.data.status === "Acquired" && (
            <button
              onClick={() => { claimStudy(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Claim for Reading
            </button>
          )}
          {(modal.data.status === "Reading" || modal.data.status === "Drafted") && (
            <button
              onClick={() => { finalizeStudy(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Finalize Report
            </button>
          )}
        </Modal>
      )}

      {modal?.kind === "modality" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.model}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">uptime {modal.data.uptime}%</span>
          </div>
          <Row label="Location" value={modal.data.room} />
          <Row label="Current Load" value={`${modal.data.load}%`} />
          <Row label="Studies Today" value={String(modal.data.studies)} />
          <Row label="Avg Effective Dose" value={modal.data.dose > 0 ? `${modal.data.dose} mSv / exam` : "No ionizing radiation"} />
          <Row label="Last Heartbeat" value={modal.data.last} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Modalities communicate via DICOM MWL/MPPS with automatic dose reporting (DICOM SR RDSR) and scheduled QC phantom runs. Idle units can be routed work to balance load across the fleet.
          </p>
          <button
            onClick={() => { toggleModality(modal.data.id); setModal(null); }}
            className="w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            {modal.data.status === "Idle" ? "Accept Work" : "Pause Intake"}
          </button>
        </Modal>
      )}

      {modal?.kind === "ai" && (
        <Modal title={modal.data.model} subtitle={`${modal.data.id} · study ${modal.data.study}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.version}</span>
          </div>
          <Row label="Inference Latency" value={modal.data.latency} />
          <Row label="Confidence" value={modal.data.confidence > 0 ? `${modal.data.confidence}%` : "—"} />
          <Row label="Findings" value={String(modal.data.findings)} />
          <Row label="Run Time" value={modal.data.runtime} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            CAD findings are embedded as DICOM SR structured reports and surfaced to the radiologist as a second reader. The model card records version, training cohort, intended use and FDA/EU MDR clearance status for governance.
          </p>
        </Modal>
      )}

      <Footer>
        Radiology Imaging &amp; PACS Overwatch Hub — DICOM, HL7 FHIR, IHE, ACR-AI-LAB · simulation environment · not connected to live imaging devices
      </Footer>
    </div>
  );
}
