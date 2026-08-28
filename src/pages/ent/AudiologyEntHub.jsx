import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Beaker, Bell, Calculator,
  Calendar, CalendarClock, CheckCircle2, ChevronRight, Clock, Cross, Database,
  Download, Droplet, Droplets, Eye, FileText, Filter, Fingerprint, FlaskConical,
  Gauge, HeartPulse, Info, Layers, PackageCheck, Pause, Play, Plus, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal, Stethoscope, Sun,
  Syringe, Thermometer, Timer, TrendingDown, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard, MiniStat } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const RISK_META = {
  Critical: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  High: { cls: "bg-orange-500/15 text-orange-300 border-orange-500/40" },
  Medium: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Low: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const BOOTH_COLORS = {
  "Booth 1": "border-sky-500/40",
  "Booth 2": "border-emerald-500/40",
  "Booth 3": "border-amber-500/40",
  "Booth 4": "border-violet-500/40",
};

const APPOINTMENT_STAGES = ["Checked in", "Pre-test", "Testing", "Review", "Done"];

const INITIAL_APPOINTMENTS = [
  { id: "AU-01", booth: "Booth 1", patient: "A. Novak", age: 47, reason: "Noise-induced hearing loss", stage: "Testing", acuity: "Medium", audiologist: "S. Okafor", tests: "PTA + Speech", note: "Tinnitus since factory exposure" },
  { id: "AU-02", booth: "Booth 2", patient: "B. Mensah", age: 3, reason: "Newborn screen referral", stage: "Pre-test", acuity: "High", audiologist: "L. Park", tests: "OAE + ABR", note: "Failed newborn OAE left ear" },
  { id: "AU-03", booth: "Booth 3", patient: "C. Rossi", age: 68, reason: "Sudden hearing loss (L)", stage: "Testing", acuity: "Critical", audiologist: "S. Okafor", tests: "PTA + Tympanometry", note: "SSNHL within 72h — urgent" },
  { id: "AU-04", booth: "Booth 4", patient: "D. Tanaka", age: 52, reason: "Dizziness / vertigo", stage: "Review", acuity: "Medium", audiologist: "L. Park", tests: "VNG + Caloric", note: "Canalith repositioning tried" },
  { id: "AU-05", booth: "Booth 1", patient: "E. Silva", age: 35, reason: "Hearing aid recheck", stage: "Checked in", acuity: "Low", audiologist: "S. Okafor", tests: "Real-ear measurement", note: "Bilateral RIC fittings" },
  { id: "AU-06", booth: "Booth 3", patient: "F. Kovács", age: 71, reason: "Tinnitus assessment", stage: "Pre-test", acuity: "Medium", audiologist: "L. Park", tests: "PTA + Loudness", note: "Pulsatile component — ENT referral" },
  { id: "AU-07", booth: "Booth 2", patient: "G. Baptiste", age: 8, reason: "Otitis media with effusion", stage: "Testing", acuity: "Medium", audiologist: "L. Park", tests: "Tympanometry + PTA", note: "Type B curve — grommet consult" },
  { id: "AU-08", booth: "Booth 4", patient: "H. Duarte", age: 44, reason: "Meniere's follow-up", stage: "Checked in", acuity: "Low", audiologist: "S. Okafor", tests: "PTA + ECochG", note: "Low-salt diet compliance good" },
];

const INITIAL_AUDIOLOGY = [
  { id: "AD-01", patient: "A. Novak", exam: "Pure-tone audiometry", left: 62, right: 48, type: "Sensorineural", speech: 68, wrs: 82, configuration: "High-freq notch", risk: "Medium", status: "Reported", note: "Noise notch at 4 kHz" },
  { id: "AD-02", patient: "C. Rossi", exam: "Pure-tone audiometry", left: 78, right: 22, type: "Sudden SNHL", speech: 42, wrs: 54, configuration: "Flat (L)", risk: "Critical", status: "Analyzing", note: "Oral steroid course started" },
  { id: "AD-03", patient: "D. Tanaka", exam: "VNG + caloric", left: 34, right: 30, type: "Normal", speech: 0, wrs: 0, configuration: "—", risk: "Low", status: "Reported", note: "Caloric asymmetry 8% — within normal" },
  { id: "AD-04", patient: "B. Mensah", exam: "OAE + ABR", left: 0, right: 0, type: "OAE refer (L)", speech: 0, wrs: 0, configuration: "ABR Wave V 45 dB (R)", risk: "High", status: "Pending", note: "Rescreen in 2 weeks per protocol" },
  { id: "AD-05", patient: "G. Baptiste", exam: "Tympanometry", left: 0, right: 0, type: "Type B (R)", speech: 0, wrs: 0, configuration: "—", risk: "Medium", status: "Reported", note: "Volume 0.4 mL, compliance flat" },
  { id: "AD-06", patient: "E. Silva", exam: "Real-ear measurement", left: 0, right: 0, type: "Target match", speech: 0, wrs: 0, configuration: "REIG within ±5 dB", risk: "Low", status: "Reported", note: "Both aids on target" },
  { id: "AD-07", patient: "F. Kovács", exam: "Loudness discomfort", left: 0, right: 0, type: "Hyperacusis", speech: 0, wrs: 0, configuration: "LDL 85 dB (L)", risk: "Medium", status: "Analyzing", note: "Tinnitus retraining planning" },
  { id: "AD-08", patient: "H. Duarte", exam: "ECochG", left: 0, right: 0, type: "Elevated SP/AP", speech: 0, wrs: 0, configuration: "SP/AP 0.48 (L)", risk: "Medium", status: "Reported", note: "Supports Meniere's diagnosis" },
];

const INITIAL_ENT = [
  { id: "EN-01", patient: "I. Whitfield", procedure: "Tympanoplasty (L)", room: "OR 3", stage: "In surgery", surgeon: "Dr. Rossi", duration: "2h 15m", risk: "Medium", note: "Fascia graft, underlay technique" },
  { id: "EN-02", patient: "J. Nair", procedure: "FESS (bilateral)", room: "OR 3", stage: "Pre-op", surgeon: "Dr. Iyer", duration: "1h 40m", risk: "Medium", note: "Chronic sinusitis, polyps" },
  { id: "EN-03", patient: "K. Adeyemi", procedure: "Cochlear implant (R)", room: "OR 5", stage: "In surgery", surgeon: "Dr. Osei", duration: "3h 05m", risk: "High", note: "Post-meningitis deafness" },
  { id: "EN-04", patient: "L. Fischer", procedure: "Septoplasty + turbinates", room: "OR 5", stage: "Recovery", surgeon: "Dr. Rossi", duration: "1h 15m", risk: "Low", note: "Extubation clean, packing in" },
  { id: "EN-05", patient: "M. Verma", procedure: "Parotidectomy (R)", room: "OR 3", stage: "Scheduled", surgeon: "Dr. Osei", duration: "2h 50m", risk: "High", note: "Facial nerve monitoring planned" },
  { id: "EN-06", patient: "N. Duarte", procedure: "Tonsillectomy (pediatric)", room: "OR 5", stage: "Recovery", surgeon: "Dr. Iyer", duration: "45m", risk: "Low", note: "Post-op bleed watch 24h" },
  { id: "EN-07", patient: "O. Park", procedure: "Tracheostomy", room: "ICU-2", stage: "In surgery", surgeon: "Dr. Rossi", duration: "1h 05m", risk: "Critical", note: "Percutaneous, dilational" },
  { id: "EN-08", patient: "P. Rossi", procedure: "Myringotomy + tubes", room: "OR 5", stage: "Scheduled", surgeon: "Dr. Iyer", duration: "25m", risk: "Low", note: "Bilateral, under mask" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function riskBadge(r) {
  const m = RISK_META[r] || RISK_META.Low;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${r === "Critical" ? "bg-rose-400" : r === "High" ? "bg-orange-400" : r === "Medium" ? "bg-amber-400" : "bg-emerald-400"}`} />{r}</span>;
}

function stageColor(s) {
  if (s === "Done") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "Testing") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (s === "Review") return "bg-sky-500/15 text-sky-300 border-sky-500/40";
  return "bg-slate-700/40 text-slate-300 border-slate-600/40";
}

function stageBadge(s) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${stageColor(s)}`}>{s}</span>;
}

function hearingBand(db) {
  if (db >= 60) return { label: "Severe", cls: "text-rose-300" };
  if (db >= 40) return { label: "Moderate", cls: "text-amber-300" };
  if (db > 0) return { label: "Mild", cls: "text-sky-300" };
  return { label: "—", cls: "text-slate-400" };
}

function entStageColor(s) {
  if (s === "In surgery") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (s === "Recovery") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "Pre-op" || s === "Scheduled") return "bg-slate-700/40 text-slate-300 border-slate-600/40";
  return "bg-amber-500/15 text-amber-300 border-amber-500/40";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AudiologyEntHub() {
  const [activeTab, setActiveTab] = useState("clinic");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [audiology, setAudiology] = useState(INITIAL_AUDIOLOGY);
  const [ent, setEnt] = useState(INITIAL_ENT);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  const { toasts, addToast, removeToast } = useKindToasts();
  const speedRef = useRef(1);
  const pausedRef = useRef(false);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      setTick((t) => t + 1);
    }, 900);
    return () => clearInterval(iv);
  }, []);

  /* live creep: appointment stage, audiology analysis, ENT progression */
  useEffect(() => {
    if (pausedRef.current || tick === 0) return;
    const mult = speedRef.current;

    setAppointments((rows) =>
      rows.map((r) => {
        if (r.stage === "Done") return r;
        const idx = APPOINTMENT_STAGES.indexOf(r.stage);
        if (idx === -1 || idx >= APPOINTMENT_STAGES.length - 1) return r;
        const next = Math.random() < 0.35 * mult ? APPOINTMENT_STAGES[idx + 1] : r.stage;
        if (next === "Done") return { ...r, stage: next };
        return { ...r, stage: next };
      })
    );

    setAudiology((rows) =>
      rows.map((r) => {
        if (r.status === "Reported" || r.status === "Pending") return r;
        if (r.status === "Analyzing" && Math.random() < 0.4 * mult) return { ...r, status: "Reported" };
        return r;
      })
    );

    setEnt((rows) =>
      rows.map((r) => {
        if (r.stage === "In surgery" && Math.random() < 0.25 * mult) return { ...r, stage: "Recovery" };
        if (r.stage === "Pre-op" && Math.random() < 0.3 * mult) return { ...r, stage: "In surgery" };
        if (r.stage === "Scheduled" && Math.random() < 0.2 * mult) return { ...r, stage: "Pre-op" };
        return r;
      })
    );
  }, [tick]);

  const reset = useCallback(() => {
    setAppointments(INITIAL_APPOINTMENTS);
    setAudiology(INITIAL_AUDIOLOGY);
    setEnt(INITIAL_ENT);
    setTick(0);
    setPaused(false);
    setSpeed(1);
    addToast("Audiology & ENT consoles reset to morning schedule", "info");
  }, [addToast]);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "clinic"
      ? appointments.map((r) => ({ patient: r.patient, booth: r.booth, reason: r.reason, stage: r.stage, acuity: r.acuity, audiologist: r.audiologist, tests: r.tests }))
      : activeTab === "audiology"
        ? audiology.map((r) => ({ patient: r.patient, exam: r.exam, left: r.left, right: r.right, type: r.type, speech: r.speech, risk: r.risk, status: r.status }))
        : ent.map((r) => ({ patient: r.patient, procedure: r.procedure, room: r.room, stage: r.stage, surgeon: r.surgeon, duration: r.duration, risk: r.risk }));
    downloadCsv(`audiology-ent-${activeTab}.csv`, rows);
    addToast(`${rows.length} rows exported to CSV`, "success");
  }, [activeTab, appointments, audiology, ent, addToast]);

  const advanceAppointment = useCallback((id) => {
    setAppointments((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const idx = APPOINTMENT_STAGES.indexOf(r.stage);
        const next = APPOINTMENT_STAGES[Math.min(idx + 1, APPOINTMENT_STAGES.length - 1)];
        if (next === "Done") addToast(`${r.patient} audiology appointment complete — report signed`, "success");
        else addToast(`${r.patient} moved to "${next}"`, "info");
        return { ...r, stage: next };
      })
    );
  }, [addToast]);

  const markReported = useCallback((id) => {
    setAudiology((rows) => rows.map((r) => (r.id === id ? { ...r, status: "Reported" } : r)));
    addToast("Audiogram report finalized and pushed to EHR", "success");
  }, [addToast]);

  const advanceEnt = useCallback((id) => {
    setEnt((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const order = ["Scheduled", "Pre-op", "In surgery", "Recovery"];
        const idx = order.indexOf(r.stage);
        const next = order[Math.min(idx + 1, order.length - 1)];
        addToast(`${r.patient} (${r.procedure}) → ${next}`, "info");
        return { ...r, stage: next };
      })
    );
  }, [addToast]);

  /* simulation event toasts */
  useEffect(() => {
    if (pausedRef.current || tick === 0 || tick % 3 !== 0) return;
    const ssnhl = appointments.find((r) => r.acuity === "Critical" && r.stage !== "Done");
    if (ssnhl && Math.random() < 0.6) {
      addToast(`SSNHL pathway: ${ssnhl.patient} — steroid window ${ssnhl.reason}`, "error");
    }
    const analyzing = audiology.find((r) => r.status === "Analyzing");
    if (analyzing && Math.random() < 0.5) {
      addToast(`${analyzing.patient} ${analyzing.exam} analysis ready for review`, "warning");
    }
    const surgery = ent.find((r) => r.stage === "In surgery" && r.risk === "Critical");
    if (surgery && Math.random() < 0.5) {
      addToast(`${surgery.patient} ${surgery.procedure} — critical case in OR, monitoring on`, "warning");
    }
  }, [tick, appointments, audiology, ent, addToast]);

  const stats = useMemo(() => {
    const testing = appointments.filter((r) => r.stage === "Testing" || r.stage === "Pre-test").length;
    const criticalAppts = appointments.filter((r) => r.acuity === "Critical").length;
    const pendingReports = audiology.filter((r) => r.status !== "Reported").length;
    const inSurgery = ent.filter((r) => r.stage === "In surgery").length;
    const recovery = ent.filter((r) => r.stage === "Recovery").length;
    return { testing, criticalAppts, pendingReports, inSurgery, recovery };
  }, [appointments, audiology, ent]);

  const q = search.trim().toLowerCase();
  const filteredAppointments = appointments.filter((r) =>
    (stageFilter === "All" || r.stage === stageFilter) &&
    (riskFilter === "All" || r.acuity === riskFilter) &&
    (!q || (r.patient + r.reason + r.audiologist + r.tests).toLowerCase().includes(q))
  );
  const filteredAudiology = audiology.filter((r) =>
    (statusFilter === "All" || r.status === statusFilter) &&
    (!q || (r.patient + r.exam + r.type + r.note).toLowerCase().includes(q))
  );
  const filteredEnt = ent.filter((r) =>
    (stageFilter === "All" || r.stage === stageFilter) &&
    (!q || (r.patient + r.procedure + r.surgeon + r.note).toLowerCase().includes(q))
  );

  const tabBtn = (key, label, icon) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "border-slate-700 bg-slate-800 text-white" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"}`}
    >
      {icon} {label}
    </button>
  );

  const speedBtn = (v, label) => (
    <button onClick={() => setSpeed(v)} className={`rounded px-2.5 py-1 text-xs font-bold ${speed === v ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>{label}</button>
  );

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patients, tests, procedures…"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600"
      />
    </div>
  );

  const renderModal = () => {
    if (!modal) return null;
    const source = modal.tab === "clinic" ? appointments : modal.tab === "audiology" ? audiology : ent;
    const item = source.find((r) => r.id === modal.id);
    if (!item) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{item.patient}</h3>
              <p className="text-xs text-slate-500">{item.id} · {item.booth || item.exam || item.procedure}</p>
            </div>
            <button onClick={() => setModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2">
            {Object.entries(item).filter(([k]) => !["id"].includes(k)).map(([k, v]) => (
              <Row key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} value={String(v)} />
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:text-white">Close</button>
          </div>
        </div>
      </div>
    );
  };

  /* --------------------------- clinic console ------------------------------ */
  const clinicConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {filteredAppointments.map((r) => {
        const idx = APPOINTMENT_STAGES.indexOf(r.stage);
        const pct = r.stage === "Done" ? 100 : Math.round((idx / (APPOINTMENT_STAGES.length - 1)) * 100);
        return (
          <div key={r.id} className={`rounded-xl border ${BOOTH_COLORS[r.booth] || "border-slate-800"} bg-slate-900 p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{r.booth}</span>
              {stageBadge(r.stage)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-white">{r.patient}</span>
              <span className="ml-auto text-xs text-slate-500">{r.age}y</span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-300">{r.reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Audiologist" value={r.audiologist.replace("S. ", "").replace("L. ", "")} sub="provider" />
              <MiniStat label="Tests" value={r.tests.split(" ")[0]} sub={r.tests.split(" ").slice(1).join(" ") || "battery"} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {r.acuity} acuity</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${r.stage === "Done" ? "bg-emerald-500" : r.acuity === "Critical" ? "bg-rose-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => advanceAppointment(r.id)} disabled={r.stage === "Done"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                {r.stage === "Done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {r.stage === "Done" ? "Complete" : "Advance"}
              </button>
              <button onClick={() => setModal({ tab: "clinic", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredAppointments.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No audiology appointments match the current filters.</p>}
    </div>
  );

  /* -------------------------- audiology console ---------------------------- */
  const audiologyConsole = (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">L (dB)</th>
              <th className="px-4 py-3">R (dB)</th>
              <th className="px-4 py-3">Type / finding</th>
              <th className="px-4 py-3">Speech</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAudiology.map((r) => {
              const l = hearingBand(r.left);
              return (
                <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{r.patient}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.exam}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm font-bold ${l.cls}`}>{r.left || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm font-bold ${hearingBand(r.right).cls}`}>{r.right || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{r.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.speech ? `${r.speech}% (WRS ${r.wrs}%)` : "—"}</td>
                  <td className="px-4 py-3">{riskBadge(r.risk)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${r.status === "Reported" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : r.status === "Analyzing" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-slate-700 bg-slate-800 text-slate-300"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => markReported(r.id)} disabled={r.status === "Reported"} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                        <FileText className="h-3.5 w-3.5" /> Report
                      </button>
                      <button onClick={() => setModal({ tab: "audiology", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ------------------------------ ENT console ------------------------------ */
  const entConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {filteredEnt.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{r.room}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${entStageColor(r.stage)}`}>{r.stage}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Syringe className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">{r.patient}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-300">{r.procedure}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Surgeon" value={r.surgeon.replace("Dr. ", "")} sub="lead" />
            <MiniStat label="Duration" value={r.duration} sub="est. time" />
            <MiniStat label="Risk" value={r.risk} sub="case risk" alert={r.risk === "Critical" || r.risk === "High"} />
          </div>
          <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => advanceEnt(r.id)} disabled={r.stage === "Recovery"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
              <ArrowRight className="h-3.5 w-3.5" /> {r.stage === "Recovery" ? "Recovered" : "Advance"}
            </button>
            <button onClick={() => setModal({ tab: "ent", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      {filteredEnt.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No ENT cases match the current filters.</p>}
    </div>
  );

  /* -------------------------------- render ---------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 px-5 py-6 text-slate-200">
      <div className="mx-auto max-w-7xl">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2"><Activity className="h-5 w-5 text-sky-300" /></span>
              <h1 className="text-2xl font-bold text-white">Audiology &amp; ENT Command Hub</h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Hearing-test clinic queue, audiometric diagnostics, and ENT surgical board with OR &amp; recovery tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPaused((p) => !p)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:text-white">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Resume" : "Pause"}
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
          <StatCard label="Tests in progress" value={stats.testing} icon={<Gauge className="h-4 w-4 text-sky-300" />} />
          <StatCard label="Critical appointments" value={stats.criticalAppts} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.criticalAppts > 0} />
          <StatCard label="Reports pending" value={stats.pendingReports} icon={<FileText className="h-4 w-4 text-amber-300" />} alert={stats.pendingReports > 0} />
          <StatCard label="In surgery" value={stats.inSurgery} icon={<Syringe className="h-4 w-4 text-rose-300" />} alert={stats.inSurgery > 0} />
          <StatCard label="In recovery" value={stats.recovery} icon={<HeartPulse className="h-4 w-4 text-emerald-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabBtn("clinic", "Clinic & Test Queue", <Stethoscope className="h-4 w-4" />)}
            {tabBtn("audiology", "Audiology Diagnostics", <Gauge className="h-4 w-4" />)}
            {tabBtn("ent", "ENT Surgical Board", <Syringe className="h-4 w-4" />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={activeTab === "audiology" ? statusFilter : riskFilter}
                onChange={(e) => (activeTab === "audiology" ? setStatusFilter(e.target.value) : setRiskFilter(e.target.value))}
                className="rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                {activeTab === "audiology" ? (
                  <>
                    <option value="All">All statuses</option>
                    <option>Reported</option>
                    <option>Analyzing</option>
                    <option>Pending</option>
                  </>
                ) : (
                  <>
                    <option value="All">All risk</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </>
                )}
              </select>
            </div>
            {(activeTab === "clinic" || activeTab === "ent") && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                <option value="All">All stages</option>
                {activeTab === "clinic"
                  ? APPOINTMENT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)
                  : ["Scheduled", "Pre-op", "In surgery", "Recovery"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* active console */}
        {activeTab === "clinic" && clinicConsole}
        {activeTab === "audiology" && audiologyConsole}
        {activeTab === "ent" && entConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">ASHA · JCIH · AAO-HNS alignment</span>
          <button onClick={() => addToast("Audiology census synced to newborn hearing screening registry", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
            <Database className="h-3.5 w-3.5" /> Sync census
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
