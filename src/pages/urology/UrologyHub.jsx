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

const ROOM_COLORS = {
  "Clinic 1": "border-sky-500/40",
  "Clinic 2": "border-emerald-500/40",
  "Cysto 1": "border-violet-500/40",
  "Cysto 2": "border-amber-500/40",
  "UDS": "border-cyan-500/40",
};

const VISIT_STAGES = ["Checked in", "Roomed", "In consult", "Procedure", "Done"];

const INITIAL_VISITS = [
  { id: "UR-01", room: "Clinic 1", patient: "A. Verma", age: 63, reason: "Elevated PSA follow-up", stage: "In consult", acuity: "High", urologist: "Dr. Iyer", tests: "PSA + DRE", note: "PSA velocity rising" },
  { id: "UR-02", room: "Clinic 2", patient: "B. Novak", age: 45, reason: "Recurrent UTI workup", stage: "Checked in", acuity: "Medium", urologist: "Dr. Osei", tests: "Urinalysis + culture", note: "3 episodes in 6 months" },
  { id: "UR-03", room: "Cysto 1", patient: "C. Fischer", age: 58, reason: "Hematuria evaluation", stage: "Procedure", acuity: "High", urologist: "Dr. Iyer", tests: "Cystoscopy + cytology", note: "Gross hematuria, 2 weeks" },
  { id: "UR-04", room: "Cysto 2", patient: "D. Tanaka", age: 71, reason: "Bladder cancer surveillance", stage: "Procedure", acuity: "Medium", urologist: "Dr. Osei", tests: "Flexible cystoscopy", note: "Tis follow-up — 3-month scope" },
  { id: "UR-05", room: "UDS", patient: "E. Mensah", age: 39, reason: "Neurogenic bladder", stage: "Pre-test", acuity: "Medium", urologist: "Dr. Osei", tests: "Urodynamics", note: "Post-SCI, leaking episodes" },
  { id: "UR-06", room: "Clinic 1", patient: "F. Kovács", age: 52, reason: "Renal colic follow-up", stage: "Roomed", acuity: "Low", urologist: "Dr. Iyer", tests: "CT KUB + stone analysis", note: "8 mm stone passed spontaneously" },
  { id: "UR-07", room: "Clinic 2", patient: "G. Rossi", age: 67, reason: "BPH medication review", stage: "Checked in", acuity: "Low", urologist: "Dr. Iyer", tests: "IPSS + uroflow", note: "Tamsulosin — IPSS 19" },
  { id: "UR-08", room: "Cysto 2", patient: "H. Duarte", age: 49, reason: "Stricture assessment", stage: "Review", acuity: "Medium", urologist: "Dr. Osei", tests: "Urethrogram + scope", note: "Post-trauma bulbar stricture" },
];

const INITIAL_STONES = [
  { id: "SC-01", patient: "I. Silva", stone: "Staghorn (struvite)", size: 32, location: "Renal pelvis (L)", density: 1250, shockwave: "N/A", eau: "High", status: "PCNL planned", nextStep: "OR in 3d", note: "Culture-positive urine — antibiotics" },
  { id: "SC-02", patient: "J. Baptiste", stone: "Ureteric (CaOx)", size: 9, location: "Distal ureter (R)", density: 980, shockwave: "Favorable", eau: "Medium", status: "SWL scheduled", nextStep: "Lithotripsy Fri", note: "Colicky pain — analgesia on board" },
  { id: "SC-03", patient: "K. Whitfield", stone: "Calyceal (CaOx)", size: 12, location: "Lower pole (R)", density: 1100, shockwave: "Borderline", eau: "Medium", status: "URS planning", nextStep: "Flexible URS + laser", note: "Lower pole — laser fragmentation" },
  { id: "SC-04", patient: "L. Adeyemi", stone: "Uric acid", size: 15, location: "Renal pelvis (R)", density: 420, shockwave: "N/A", eau: "Low", status: "Medical tx", nextStep: "Urine alkalinization", note: "Dissolution trial — allopurinol + citrate" },
  { id: "SC-05", patient: "M. Park", stone: "CaOx dihydrate", size: 6, location: "Proximal ureter (L)", density: 890, shockwave: "Favorable", eau: "Medium", status: "SWL scheduled", nextStep: "Lithotripsy Tue", note: "Spontaneous passage watch" },
  { id: "SC-06", patient: "N. Chen", stone: "Staghorn (struvite)", size: 28, location: "Renal pelvis (R)", density: 1180, shockwave: "N/A", eau: "High", status: "PCNL planned", nextStep: "Staged PCNL", note: "Residual fragments from prior ESWL" },
  { id: "SC-07", patient: "O. Rossi", stone: "Cystine", size: 10, location: "Ureteropelvic (L)", density: 820, shockwave: "Poor", eau: "High", status: "URS planning", nextStep: "Ureteroscopy + basket", note: "Cystinuria — tiopronin review" },
  { id: "SC-08", patient: "P. Novak", stone: "CaOx monohydrate", size: 7, location: "Distal ureter (L)", density: 1020, shockwave: "Favorable", eau: "Low", status: "Metabolic workup", nextStep: "24h urine collection", note: "First-time stone former" },
];

const INITIAL_ONCO = [
  { id: "ON-01", patient: "A. Verma", cancer: "Prostate adenocarcinoma", psa: 9.4, gleason: "4+3 (7)", tnm: "T2cN0M0", risk: "High", stage: "Active surveillance", nextStep: "PSA in 3m", note: "PSA density 0.18" },
  { id: "ON-02", patient: "C. Fischer", cancer: "Urothelial carcinoma", psa: 0, gleason: "N/A", tnm: "Ta high grade", risk: "High", stage: "TURBT + Mitomycin", nextStep: "Cystoscopy in 3m", note: "Recurrence risk — intravesical therapy" },
  { id: "ON-03", patient: "D. Tanaka", cancer: "CIS (bladder)", psa: 0, gleason: "N/A", tnm: "Tis", risk: "Critical", stage: "BCG induction", nextStep: "BCG #3 of 6", note: "Maintenance protocol planned" },
  { id: "ON-04", patient: "Q. Nair", cancer: "Renal cell carcinoma", psa: 0, gleason: "N/A", tnm: "T1bN0M0", risk: "Medium", stage: "Partial nephrectomy", nextStep: "OR in 2wk", note: "Clear cell, Fuhrman grade 2" },
  { id: "ON-05", patient: "R. Alvarez", cancer: "Prostate adenocarcinoma", psa: 6.1, gleason: "3+3 (6)", tnm: "T1cN0M0", risk: "Low", stage: "Active surveillance", nextStep: "MRI fusion bx in 6m", note: "PSA stable over 2 years" },
  { id: "ON-06", patient: "S. Okafor", cancer: "Testicular (seminoma)", psa: 0, gleason: "N/A", tnm: "pTIaN0M0", risk: "Low", stage: "Surveillance", nextStep: "CT + markers in 4m", note: "Post-orchiectomy, no adjuvant" },
  { id: "ON-07", patient: "T. Kovács", cancer: "Prostate adenocarcinoma", psa: 18.2, gleason: "5+4 (9)", tnm: "T3bN1M0", risk: "Critical", stage: "ADT + docetaxel", nextStep: "Cycle 3 infusion", note: "Metastatic — oligo on PSMA PET" },
  { id: "ON-08", patient: "U. Fischer", cancer: "Bladder (muscle invasive)", psa: 0, gleason: "N/A", tnm: "pT2N0M0", risk: "High", stage: "Neoadjuvant chemo", nextStep: "Cycle 2, day 8", note: "Radical cystectomy planned post-chemo" },
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
  if (s === "Procedure") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (s === "In consult") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-slate-700/40 text-slate-300 border-slate-600/40";
}

function stageBadge(s) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${stageColor(s)}`}>{s}</span>;
}

function psaBand(v) {
  if (v >= 10) return { label: "High", cls: "text-rose-300" };
  if (v >= 4) return { label: "Elevated", cls: "text-amber-300" };
  return { label: "Normal", cls: "text-emerald-300" };
}

function gleasonCls(g) {
  if (g.includes("5+") || g.includes("4+5")) return "text-rose-300";
  if (g.includes("4+3") || g.includes("3+4")) return "text-amber-300";
  return "text-emerald-300";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function UrologyHub() {
  const [activeTab, setActiveTab] = useState("clinic");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [stones, setStones] = useState(INITIAL_STONES);
  const [onco, setOnco] = useState(INITIAL_ONCO);
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

  /* live creep: visit stage, stone size creep, PSA drift */
  useEffect(() => {
    if (pausedRef.current || tick === 0) return;
    const mult = speedRef.current;

    setVisits((rows) =>
      rows.map((r) => {
        if (r.stage === "Done") return r;
        const idx = VISIT_STAGES.indexOf(r.stage);
        if (idx === -1 || idx >= VISIT_STAGES.length - 1) return r;
        const next = Math.random() < 0.35 * mult ? VISIT_STAGES[idx + 1] : r.stage;
        if (next === "Done") return { ...r, stage: next };
        return { ...r, stage: next };
      })
    );

    setStones((rows) =>
      rows.map((r) => {
        if (r.status.startsWith("PCNL") || r.status.startsWith("SWL") || r.status.startsWith("URS")) return r;
        const creep = Math.random() < 0.3 * mult ? +(r.size + 0.4 * mult).toFixed(1) : r.size;
        return { ...r, size: creep };
      })
    );

    setOnco((rows) =>
      rows.map((r) => {
        if (r.psa === 0) return r;
        const drift = Math.random() < 0.25 * mult ? +(r.psa + 0.15 * mult).toFixed(1) : r.psa;
        const risk = drift >= 10 ? "Critical" : drift >= 4 ? "High" : r.risk;
        return { ...r, psa: drift, risk };
      })
    );
  }, [tick]);

  const reset = useCallback(() => {
    setVisits(INITIAL_VISITS);
    setStones(INITIAL_STONES);
    setOnco(INITIAL_ONCO);
    setTick(0);
    setPaused(false);
    setSpeed(1);
    addToast("Urology consoles reset to morning clinic census", "info");
  }, [addToast]);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "clinic"
      ? visits.map((r) => ({ patient: r.patient, room: r.room, reason: r.reason, stage: r.stage, acuity: r.acuity, urologist: r.urologist, tests: r.tests }))
      : activeTab === "stones"
        ? stones.map((r) => ({ patient: r.patient, stone: r.stone, size: r.size, location: r.location, density: r.density, eau: r.eau, status: r.status }))
        : onco.map((r) => ({ patient: r.patient, cancer: r.cancer, psa: r.psa, gleason: r.gleason, tnm: r.tnm, risk: r.risk, stage: r.stage, nextStep: r.nextStep }));
    downloadCsv(`urology-${activeTab}.csv`, rows);
    addToast(`${rows.length} rows exported to CSV`, "success");
  }, [activeTab, visits, stones, onco, addToast]);

  const advanceVisit = useCallback((id) => {
    setVisits((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const idx = VISIT_STAGES.indexOf(r.stage);
        const next = VISIT_STAGES[Math.min(idx + 1, VISIT_STAGES.length - 1)];
        if (next === "Done") addToast(`${r.patient} visit complete — note signed`, "success");
        else addToast(`${r.patient} moved to "${next}"`, "info");
        return { ...r, stage: next };
      })
    );
  }, [addToast]);

  const bookProcedure = useCallback((id) => {
    setStones((rows) => rows.map((r) => (r.id === id ? { ...r, status: "URS planning", nextStep: "OR booked" } : r)));
    addToast("Stone procedure scheduled — OR slot confirmed", "success");
  }, [addToast]);

  const updateOnco = useCallback((id) => {
    setOnco((rows) => rows.map((r) => (r.id === id ? { ...r, nextStep: r.nextStep.includes("m") ? "Updated" : r.nextStep } : r)));
    addToast("Oncology follow-up updated — tumor board notified", "success");
  }, [addToast]);

  /* simulation event toasts */
  useEffect(() => {
    if (pausedRef.current || tick === 0 || tick % 3 !== 0) return;
    // Parenthesised to fix the precedence warning without changing behaviour. Note the second
    // disjunct reduces to `r.psa >= 10`, which makes the whole expression equivalent to that
    // alone and the `risk !== "Critical"` guard dead - flagged rather than changed, because
    // narrowing which patients raise a PSA alert is a clinical decision, not a lint fix.
    const psaRiser = onco.find((r) => (r.psa >= 10 && r.risk !== "Critical") || (r.psa > 0 && r.psa >= 10));
    if (psaRiser && Math.random() < 0.6) {
      addToast(`PSA alert: ${psaRiser.patient} PSA ${psaRiser.psa} ng/mL — review escalation`, "error");
    }
    const staghorn = stones.find((r) => r.stone === "Staghorn (struvite)" && r.status.startsWith("PCNL"));
    if (staghorn && Math.random() < 0.5) {
      addToast(`${staghorn.patient} staghorn case — culture-guided antibiotics active`, "warning");
    }
    const cysto = visits.find((r) => r.stage === "Procedure" && r.tests.includes("Cystoscopy") && r.acuity === "High");
    if (cysto && Math.random() < 0.5) {
      addToast(`${cysto.patient} cystoscopy in progress — biopsy sent to pathology`, "warning");
    }
  }, [tick, onco, stones, visits, addToast]);

  const stats = useMemo(() => {
    const inClinic = visits.filter((r) => r.stage !== "Done").length;
    const procedures = visits.filter((r) => r.stage === "Procedure").length;
    const highOnco = onco.filter((r) => r.risk === "Critical" || r.risk === "High").length;
    const swlCount = stones.filter((r) => r.status.includes("SWL")).length;
    const pcnlCount = stones.filter((r) => r.status.startsWith("PCNL")).length;
    return { inClinic, procedures, highOnco, swlCount, pcnlCount };
  }, [visits, onco, stones]);

  const q = search.trim().toLowerCase();
  const filteredVisits = visits.filter((r) =>
    (stageFilter === "All" || r.stage === stageFilter) &&
    (riskFilter === "All" || r.acuity === riskFilter) &&
    (!q || (r.patient + r.reason + r.urologist + r.tests).toLowerCase().includes(q))
  );
  const filteredStones = stones.filter((r) =>
    (statusFilter === "All" || r.status.includes(statusFilter) || (statusFilter === "Active" && !r.status.includes("planned") && !r.status.includes("scheduled") && !r.status.includes("workup"))) &&
    (!q || (r.patient + r.stone + r.location + r.note).toLowerCase().includes(q))
  );
  const filteredOnco = onco.filter((r) =>
    (riskFilter === "All" || r.risk === riskFilter) &&
    (!q || (r.patient + r.cancer + r.stage + r.note).toLowerCase().includes(q))
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
        placeholder="Search patients, stones, cancers…"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600"
      />
    </div>
  );

  const renderModal = () => {
    if (!modal) return null;
    const source = modal.tab === "clinic" ? visits : modal.tab === "stones" ? stones : onco;
    const item = source.find((r) => r.id === modal.id);
    if (!item) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{item.patient}</h3>
              <p className="text-xs text-slate-500">{item.id} · {item.room || item.stone || item.cancer}</p>
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
      {filteredVisits.map((r) => {
        const idx = VISIT_STAGES.indexOf(r.stage);
        const pct = r.stage === "Done" ? 100 : Math.round((idx / (VISIT_STAGES.length - 1)) * 100);
        return (
          <div key={r.id} className={`rounded-xl border ${ROOM_COLORS[r.room] || "border-slate-800"} bg-slate-900 p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{r.room}</span>
              {stageBadge(r.stage)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-white">{r.patient}</span>
              <span className="ml-auto text-xs text-slate-500">{r.age}y</span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-300">{r.reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Urologist" value={r.urologist.replace("Dr. ", "")} sub="provider" />
              <MiniStat label="Tests" value={r.tests.split(" ")[0]} sub={r.tests.split(" ").slice(1).join(" ") || "panel"} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {r.acuity} acuity</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${r.stage === "Done" ? "bg-emerald-500" : r.acuity === "High" ? "bg-rose-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => advanceVisit(r.id)} disabled={r.stage === "Done"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                {r.stage === "Done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {r.stage === "Done" ? "Complete" : "Advance"}
              </button>
              <button onClick={() => setModal({ tab: "clinic", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredVisits.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No urology visits match the current filters.</p>}
    </div>
  );

  /* --------------------------- stone console ------------------------------- */
  const stoneConsole = (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Stone</th>
              <th className="px-4 py-3">Size (mm)</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Density (HU)</th>
              <th className="px-4 py-3">EAU risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next step</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStones.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{r.patient}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{r.stone}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm font-bold ${r.size >= 20 ? "text-rose-300" : r.size >= 10 ? "text-amber-300" : "text-emerald-300"}`}>{r.size}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.location}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.density}</td>
                <td className="px-4 py-3">{riskBadge(r.eau)}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{r.status}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.nextStep}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => bookProcedure(r.id)} disabled={r.status.includes("planned") || r.status.includes("scheduled")} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                      <CalendarClock className="h-3.5 w-3.5" /> Book
                    </button>
                    <button onClick={() => setModal({ tab: "stones", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* --------------------------- oncology console ---------------------------- */
  const oncoConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {filteredOnco.map((r) => {
        const p = psaBand(r.psa);
        return (
          <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-rose-500/15 p-1.5"><ShieldAlert className="h-4 w-4 text-rose-300" /></span>
                <div>
                  <p className="text-sm font-semibold text-white">{r.patient}</p>
                  <p className="text-xs text-slate-500">{r.cancer}</p>
                </div>
              </div>
              {riskBadge(r.risk)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="PSA" value={r.psa || "—"} sub="ng/mL" alert={r.psa >= 10} />
              <MiniStat label="Gleason" value={r.gleason === "N/A" ? "—" : r.gleason} sub="score" />
              <MiniStat label="Stage" value={r.tnm} sub="TNM" />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>Treatment phase</span>
                <span className={p.cls}>{r.psa ? `${p.label} PSA` : "n/a"}</span>
              </div>
              <p className="text-xs font-semibold text-slate-300">{r.stage}</p>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => updateOnco(r.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
                <FileText className="h-3.5 w-3.5" /> {r.nextStep.includes("Updated") ? "Updated" : "Update"}
              </button>
              <button onClick={() => setModal({ tab: "onco", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredOnco.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No uro-oncology cases match the current filters.</p>}
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
              <span className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-2"><Droplet className="h-5 w-5 text-violet-300" /></span>
              <h1 className="text-2xl font-bold text-white">Urology Command Hub</h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Clinic &amp; cystoscopy queue, stone clinic with ESWL/URS/PCNL pathways, and uro-oncology surveillance with PSA tracking.
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
          <StatCard label="Visits in clinic" value={stats.inClinic} icon={<Users className="h-4 w-4 text-sky-300" />} />
          <StatCard label="In procedure" value={stats.procedures} icon={<Syringe className="h-4 w-4 text-rose-300" />} alert={stats.procedures > 0} />
          <StatCard label="High-risk oncology" value={stats.highOnco} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.highOnco > 0} />
          <StatCard label="SWL scheduled" value={stats.swlCount} icon={<Zap className="h-4 w-4 text-amber-300" />} />
          <StatCard label="PCNL planned" value={stats.pcnlCount} icon={<Layers className="h-4 w-4 text-violet-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabBtn("clinic", "Clinic & Cystoscopy", <Stethoscope className="h-4 w-4" />)}
            {tabBtn("stones", "Stone Clinic", <Layers className="h-4 w-4" />)}
            {tabBtn("onco", "Uro-Oncology", <ShieldAlert className="h-4 w-4" />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={activeTab === "stones" ? statusFilter : riskFilter}
                onChange={(e) => (activeTab === "stones" ? setStatusFilter(e.target.value) : setRiskFilter(e.target.value))}
                className="rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                {activeTab === "stones" ? (
                  <>
                    <option value="All">All statuses</option>
                    <option>PCNL</option>
                    <option>SWL</option>
                    <option>URS</option>
                    <option>Medical</option>
                    <option>Metabolic</option>
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
            {activeTab === "clinic" && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                <option value="All">All stages</option>
                {VISIT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* active console */}
        {activeTab === "clinic" && clinicConsole}
        {activeTab === "stones" && stoneConsole}
        {activeTab === "onco" && oncoConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">EAU · AUA · NCCN alignment</span>
          <button onClick={() => addToast("Urology census synced to stone registry (EAU format)", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
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
