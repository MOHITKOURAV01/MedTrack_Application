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
  "Exam 1": "border-rose-500/40",
  "Exam 2": "border-sky-500/40",
  "Exam 3": "border-amber-500/40",
  "Exam 4": "border-emerald-500/40",
  "Surg 1": "border-violet-500/40",
  "Surg 2": "border-cyan-500/40",
};

const VISIT_STAGES = ["Checked in", "Roomed", "In consult", "Procedure", "Done"];

const INITIAL_VISITS = [
  { id: "DV-01", room: "Exam 1", patient: "A. Whitfield", age: 54, complaint: "New pigmented lesion, back", stage: "In consult", acuity: "High", provider: "Dr. Osei", dermoscopy: "Pending", note: "Asymmetry + irregular border" },
  { id: "DV-02", room: "Exam 2", patient: "B. Nair", age: 31, complaint: "Psoriasis flare, plaque type", stage: "Checked in", acuity: "Medium", provider: "Dr. Iyer", dermoscopy: "—", note: "PASI reassessment due" },
  { id: "DV-03", room: "Exam 3", patient: "C. Dubois", age: 22, complaint: "Acne vulgaris, nodulocystic", stage: "Roomed", acuity: "Low", provider: "Dr. Park", dermoscopy: "—", note: "Isotretinoin candidacy review" },
  { id: "DV-04", room: "Exam 4", patient: "D. Mensah", age: 61, complaint: "Suspicious mole, right calf", stage: "Procedure", acuity: "High", provider: "Dr. Osei", dermoscopy: "Atypical", note: "Shave biopsy planned" },
  { id: "DV-05", room: "Surg 1", patient: "E. Rossi", age: 48, complaint: "BCC excision, left temple", stage: "Procedure", acuity: "Medium", provider: "Dr. Iyer", dermoscopy: "—", note: "Mohs layer 2 clearance check" },
  { id: "DV-06", room: "Surg 2", patient: "F. Nakamura", age: 39, complaint: "Melanoma excision, left shoulder", stage: "Procedure", acuity: "High", provider: "Dr. Osei", dermoscopy: "Melanoma", note: "WLE 2cm margins + SLN referral" },
  { id: "DV-07", room: "Exam 3", patient: "G. Silva", age: 68, complaint: "Actinic keratosis review", stage: "Checked in", acuity: "Medium", provider: "Dr. Park", dermoscopy: "—", note: "Field therapy follow-up" },
  { id: "DV-08", room: "Exam 4", patient: "H. Kovács", age: 45, complaint: "Hidradenitis suppurativa", stage: "Roomed", acuity: "Medium", provider: "Dr. Iyer", dermoscopy: "—", note: "Hurley II — biologic review" },
];

const INITIAL_LESIONS = [
  { id: "LS-01", patient: "A. Whitfield", site: "Upper back", type: "Junctional nevus", diameter: 6, abcde: "A,B,C flags", dermoscopy: "Atypical network", risk: "High", lastReview: "3m ago", nextReview: "Due now", note: "Growth noted by patient" },
  { id: "LS-02", patient: "D. Mensah", site: "Right calf", type: "Compound nevus", diameter: 8, abcde: "A,B,C,D flags", dermoscopy: "Blue-white veil", risk: "Critical", lastReview: "2m ago", nextReview: "Overdue 5d", note: "Referral to pigmented lesion clinic" },
  { id: "LS-03", patient: "I. Tanaka", site: "Left forearm", type: "Melanocytic nevus", diameter: 4, abcde: "None", dermoscopy: "Benign reticular", risk: "Low", lastReview: "8m ago", nextReview: "In 4m", note: "Stable on serial imaging" },
  { id: "LS-04", patient: "J. Baptiste", site: "Scalp", type: "Atypical nevus", diameter: 7, abcde: "B,C flags", dermoscopy: "Peripheral globules", risk: "High", lastReview: "4m ago", nextReview: "Due now", note: "Sun-exposed site, FHx melanoma" },
  { id: "LS-05", patient: "K. Adeyemi", site: "Left shoulder", type: "Melanoma (excised)", diameter: 5, abcde: "A,B,C,D,E flags", dermoscopy: "Melanoma features", risk: "Critical", lastReview: "1m ago", nextReview: "In 5m", note: "Post-excision surveillance" },
  { id: "LS-06", patient: "L. Fischer", site: "Right temple", type: "Basal cell carcinoma", diameter: 9, abcde: "N/A (BCC)", dermoscopy: "Arborizing vessels", risk: "High", lastReview: "2m ago", nextReview: "Due now", note: "Awaiting Mohs scheduling" },
  { id: "LS-07", patient: "M. Verma", site: "Chest", type: "Melanocytic nevus", diameter: 3, abcde: "None", dermoscopy: "Benign", risk: "Low", lastReview: "12m ago", nextReview: "In 6m", note: "Annual review routine" },
  { id: "LS-08", patient: "N. Duarte", site: "Left ear", type: "Squamous cell carcinoma", diameter: 11, abcde: "N/A (SCC)", dermoscopy: "Keratin mass", risk: "High", lastReview: "3w ago", nextReview: "Due now", note: "Post-curettage, healing well" },
  { id: "LS-09", patient: "O. Park", site: "Back, left flank", type: "Dysplastic nevus", diameter: 5, abcde: "A,C flags", dermoscopy: "Mild atypia", risk: "Medium", lastReview: "6m ago", nextReview: "In 2m", note: "Two-year mapping protocol" },
  { id: "LS-10", patient: "P. Rossi", site: "Right ankle", type: "Acral nevus", diameter: 4, abcde: "None", dermoscopy: "Parallel furrow", risk: "Medium", lastReview: "5m ago", nextReview: "In 1m", note: "Acral site — palmar/plantar map" },
];

const INITIAL_THERAPY = [
  { id: "TH-01", patient: "B. Nair", therapy: "Narrowband UVB", indication: "Plaque psoriasis", dose: 850, doseMax: 1500, mJ: 520, sessions: 22, schedule: "Mon/Wed/Fri", status: "Running", nextDose: "Today 14:00", note: "PASI 75 achieved" },
  { id: "TH-02", patient: "H. Kovács", therapy: "Adalimumab 40 mg q2wk", indication: "HS Hurley II", dose: 40, doseMax: 40, mJ: 0, sessions: 6, schedule: "q2wk SC", status: "Running", nextDose: "In 3d", note: "TGSS improving" },
  { id: "TH-03", patient: "Q. Okafor", therapy: "Ustekinumab 45 mg q12wk", indication: "Plaque psoriasis", dose: 45, doseMax: 45, mJ: 0, sessions: 4, schedule: "q12wk SC", status: "Scheduled", nextDose: "In 2wk", note: "Biologic naive → starter dose done" },
  { id: "TH-04", patient: "R. Chen", therapy: "PUVA (psoralen + UVA)", indication: "Vitiligo", dose: 480, doseMax: 800, mJ: 260, sessions: 14, schedule: "Tue/Thu", status: "Running", nextDose: "Tomorrow 09:30", note: "Repigmentation noted face" },
  { id: "TH-05", patient: "S. Alvarez", therapy: "Dupilumab 300 mg q2wk", indication: "Atopic dermatitis", dose: 300, doseMax: 300, mJ: 0, sessions: 8, schedule: "q2wk SC", status: "Running", nextDose: "In 5d", note: "EASI 75, itch down" },
  { id: "TH-06", patient: "T. Mensah", therapy: "Secukinumab 300 mg monthly", indication: "Pustular psoriasis", dose: 300, doseMax: 300, mJ: 0, sessions: 3, schedule: "Monthly SC", status: "Scheduled", nextDose: "In 9d", note: "Loading doses complete" },
  { id: "TH-07", patient: "U. Novak", therapy: "Narrowband UVB", indication: "Atopic dermatitis", dose: 720, doseMax: 1500, mJ: 430, sessions: 9, schedule: "Mon/Wed/Fri", status: "Running", nextDose: "Today 15:30", note: "Tapering topical steroids" },
  { id: "TH-08", patient: "V. Baptiste", therapy: "Risankizumab 150 mg q12wk", indication: "Plaque psoriasis", dose: 150, doseMax: 150, mJ: 0, sessions: 2, schedule: "q12wk SC", status: "Scheduled", nextDose: "In 6wk", note: "Screening labs pending" },
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

function therapyStatus(s) {
  if (s === "Running") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "Scheduled") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DermatologyHub() {
  const [activeTab, setActiveTab] = useState("clinic");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [therapyFilter, setTherapyFilter] = useState("All");
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [lesions, setLesions] = useState(INITIAL_LESIONS);
  const [therapy, setTherapy] = useState(INITIAL_THERAPY);
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

  /* live creep: visit stage, lesion risk, phototherapy dose accumulation */
  useEffect(() => {
    if (pausedRef.current || tick === 0) return;
    const mult = speedRef.current;

    setVisits((rows) =>
      rows.map((r) => {
        if (r.stage === "Done") return r;
        const idx = VISIT_STAGES.indexOf(r.stage);
        if (idx === -1 || idx >= VISIT_STAGES.length - 1) return r;
        const next = Math.random() < 0.3 * mult ? VISIT_STAGES[idx + 1] : r.stage;
        if (next === "Done") return { ...r, stage: next, dermoscopy: r.dermoscopy === "Pending" ? "Benign" : r.dermoscopy };
        return { ...r, stage: next };
      })
    );

    setLesions((rows) =>
      rows.map((r) => {
        if (r.risk === "Low") return r;
        const drift = Math.random() < 0.2 * mult;
        const next = r.risk === "Critical" ? "Critical" : r.risk === "High" ? (drift ? "Critical" : "High") : drift ? "High" : "Medium";
        if (next === "Critical" && r.risk !== "Critical") return { ...r, risk: next, nextReview: "Overdue" };
        return { ...r, risk: next };
      })
    );

    setTherapy((rows) =>
      rows.map((r) => {
        const creep = r.mJ > 0 && Math.random() < 0.5 * mult ? Math.min(r.doseMax, r.mJ + 40 * mult) : r.mJ;
        return { ...r, mJ: Math.round(creep) };
      })
    );
  }, [tick]);

  const reset = useCallback(() => {
    setVisits(INITIAL_VISITS);
    setLesions(INITIAL_LESIONS);
    setTherapy(INITIAL_THERAPY);
    setTick(0);
    setPaused(false);
    setSpeed(1);
    addToast("Dermatology consoles reset to morning clinic census", "info");
  }, [addToast]);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "clinic"
      ? visits.map((r) => ({ patient: r.patient, room: r.room, complaint: r.complaint, stage: r.stage, acuity: r.acuity, provider: r.provider, dermoscopy: r.dermoscopy }))
      : activeTab === "lesions"
        ? lesions.map((r) => ({ patient: r.patient, site: r.site, type: r.type, diameter: r.diameter, abcde: r.abcde, dermoscopy: r.dermoscopy, risk: r.risk, nextReview: r.nextReview }))
        : therapy.map((r) => ({ patient: r.patient, therapy: r.therapy, indication: r.indication, dose: r.dose, mJ: r.mJ, sessions: r.sessions, status: r.status, nextDose: r.nextDose }));
    downloadCsv(`dermatology-${activeTab}.csv`, rows);
    addToast(`${rows.length} rows exported to CSV`, "success");
  }, [activeTab, visits, lesions, therapy, addToast]);

  const advanceVisit = useCallback((id) => {
    setVisits((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const idx = VISIT_STAGES.indexOf(r.stage);
        const next = VISIT_STAGES[Math.min(idx + 1, VISIT_STAGES.length - 1)];
        if (next === "Done") addToast(`${r.patient} visit complete — chart signed`, "success");
        else addToast(`${r.patient} moved to "${next}"`, "info");
        return { ...r, stage: next, dermoscopy: next === "Procedure" && r.dermoscopy === "Pending" ? "Atypical" : r.dermoscopy };
      })
    );
  }, [addToast]);

  const recordReview = useCallback((id) => {
    setLesions((rows) => rows.map((r) => (r.id === id ? { ...r, lastReview: "Just now", nextReview: "In 3m" } : r)));
    addToast("Lesion photographed + dermoscopy recorded (serial imaging updated)", "success");
  }, [addToast]);

  const escalateLesion = useCallback((id) => {
    setLesions((rows) => rows.map((r) => (r.id === id ? { ...r, risk: "Critical", nextReview: "Overdue" } : r)));
    addToast("Lesion escalated — urgent biopsy scheduling requested", "warning");
  }, [addToast]);

  const scheduleTherapy = useCallback((id) => {
    setTherapy((rows) => rows.map((r) => (r.id === id ? { ...r, status: "Running" } : r)));
    addToast("Therapy session scheduled — phototherapy slot confirmed", "success");
  }, [addToast]);

  /* simulation event toasts */
  useEffect(() => {
    if (pausedRef.current || tick === 0 || tick % 3 !== 0) return;
    const criticalLesion = lesions.find((r) => r.risk === "Critical" && r.lastReview !== "Just now");
    if (criticalLesion && Math.random() < 0.6) {
      addToast(`Melanoma surveillance alert: ${criticalLesion.patient} — ${criticalLesion.dermoscopy}`, "error");
    }
    const nearMax = therapy.find((r) => r.mJ > 0 && r.mJ >= r.doseMax * 0.9);
    if (nearMax && Math.random() < 0.5) {
      addToast(`${nearMax.patient} phototherapy near max dose (${nearMax.mJ}/${nearMax.doseMax} mJ/cm²) — maintenance phase`, "warning");
    }
    const overdueLesion = lesions.find((r) => r.nextReview.startsWith("Overdue"));
    if (overdueLesion && Math.random() < 0.5) {
      addToast(`Surveillance overdue: ${overdueLesion.patient} — ${overdueLesion.site}`, "warning");
    }
  }, [tick, lesions, therapy, addToast]);

  const stats = useMemo(() => {
    const inClinic = visits.filter((r) => r.stage !== "Done").length;
    const procedures = visits.filter((r) => r.stage === "Procedure").length;
    const criticalLesions = lesions.filter((r) => r.risk === "Critical").length;
    const runningTherapy = therapy.filter((r) => r.status === "Running").length;
    const avgSessions = Math.round(therapy.reduce((s, r) => s + r.sessions, 0) / therapy.length);
    return { inClinic, procedures, criticalLesions, runningTherapy, avgSessions };
  }, [visits, lesions, therapy]);

  const q = search.trim().toLowerCase();
  const filteredVisits = visits.filter((r) =>
    (stageFilter === "All" || r.stage === stageFilter) &&
    (riskFilter === "All" || r.acuity === riskFilter) &&
    (!q || (r.patient + r.complaint + r.provider + r.note).toLowerCase().includes(q))
  );
  const filteredLesions = lesions.filter((r) =>
    (riskFilter === "All" || r.risk === riskFilter) &&
    (!q || (r.patient + r.site + r.type + r.dermoscopy).toLowerCase().includes(q))
  );
  const filteredTherapy = therapy.filter((r) =>
    (therapyFilter === "All" || r.status === therapyFilter) &&
    (!q || (r.patient + r.therapy + r.indication + r.note).toLowerCase().includes(q))
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
        placeholder="Search patients, lesions, therapies…"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600"
      />
    </div>
  );

  const renderModal = () => {
    if (!modal) return null;
    const source = modal.tab === "clinic" ? visits : modal.tab === "lesions" ? lesions : therapy;
    const item = source.find((r) => r.id === modal.id);
    if (!item) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{item.patient}</h3>
              <p className="text-xs text-slate-500">{item.id} · {item.room || item.site || item.therapy}</p>
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
            <p className="mt-2 text-xs font-medium text-slate-300">{r.complaint}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Provider" value={r.provider.replace("Dr. ", "")} sub="dermatologist" />
              <MiniStat label="Dermoscopy" value={r.dermoscopy === "—" ? "N/A" : r.dermoscopy} sub="mole check" alert={r.dermoscopy === "Atypical" || r.dermoscopy === "Melanoma"} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {r.acuity} acuity</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${r.stage === "Done" ? "bg-emerald-500" : r.stage === "Procedure" ? "bg-rose-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
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
      {filteredVisits.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No clinic visits match the current filters.</p>}
    </div>
  );

  /* --------------------------- lesion console ------------------------------ */
  const lesionConsole = (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Ø (mm)</th>
              <th className="px-4 py-3">ABCDE</th>
              <th className="px-4 py-3">Dermoscopy</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Next review</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLesions.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{r.patient}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.site}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{r.type}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm font-bold ${r.diameter >= 6 ? "text-amber-300" : "text-emerald-300"}`}>{r.diameter}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${r.abcde === "None" ? "text-emerald-300" : r.abcde.startsWith("N/A") ? "text-slate-400" : "text-rose-300"}`}>{r.abcde}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${r.dermoscopy === "Benign" || r.dermoscopy === "Benign reticular" || r.dermoscopy === "Parallel furrow" ? "text-emerald-300" : r.dermoscopy === "Melanoma" || r.dermoscopy === "Blue-white veil" ? "text-rose-300" : "text-amber-300"}`}>{r.dermoscopy}</span>
                </td>
                <td className="px-4 py-3">{riskBadge(r.risk)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${r.nextReview.startsWith("Overdue") ? "text-rose-300" : r.nextReview === "Due now" ? "text-amber-300" : "text-slate-400"}`}>{r.nextReview}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => recordReview(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
                      <Fingerprint className="h-3.5 w-3.5" /> Review
                    </button>
                    {r.risk !== "Critical" && (
                      <button onClick={() => escalateLesion(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20">
                        <AlertTriangle className="h-3.5 w-3.5" /> Escalate
                      </button>
                    )}
                    <button onClick={() => setModal({ tab: "lesions", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* --------------------------- therapy console ----------------------------- */
  const therapyConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {filteredTherapy.map((r) => {
        const isPhoto = r.mJ > 0;
        const pct = isPhoto ? Math.min(100, Math.round((r.mJ / r.doseMax) * 100)) : Math.min(100, Math.round((r.sessions / 12) * 100));
        return (
          <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg p-1.5 ${isPhoto ? "bg-amber-500/15" : "bg-violet-500/15"}`}>
                  {isPhoto ? <Sun className="h-4 w-4 text-amber-300" /> : <Syringe className="h-4 w-4 text-violet-300" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{r.patient}</p>
                  <p className="text-xs text-slate-500">{r.therapy}</p>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${therapyStatus(r.status)}`}>{r.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{r.indication}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Dose" value={isPhoto ? `${r.mJ}` : `${r.dose} mg`} sub={isPhoto ? "mJ/cm²" : "per dose"} alert={isPhoto && r.mJ >= r.doseMax} />
              <MiniStat label="Max" value={isPhoto ? r.doseMax : r.doseMax} sub={isPhoto ? "mJ/cm²" : "mg"} />
              <MiniStat label="Sessions" value={r.sessions} sub={r.schedule} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>{isPhoto ? "Cumulative dose" : "Course progress"}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${isPhoto && r.mJ >= r.doseMax ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => scheduleTherapy(r.id)} disabled={r.status === "Running"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                <CalendarClock className="h-3.5 w-3.5" /> {r.status === "Running" ? "Next: " + r.nextDose : "Schedule"}
              </button>
              <button onClick={() => setModal({ tab: "therapy", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredTherapy.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No therapy regimens match the current filters.</p>}
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
              <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2"><Stethoscope className="h-5 w-5 text-sky-300" /></span>
              <h1 className="text-2xl font-bold text-white">Dermatology Command Hub</h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Clinic &amp; procedure queue, dermoscopic lesion surveillance, and phototherapy / biologic therapy registry.
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
          <StatCard label="Critical lesions" value={stats.criticalLesions} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.criticalLesions > 0} />
          <StatCard label="Therapies running" value={stats.runningTherapy} icon={<Sun className="h-4 w-4 text-amber-300" />} />
          <StatCard label="Avg sessions" value={stats.avgSessions} icon={<Activity className="h-4 w-4 text-emerald-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabBtn("clinic", "Clinic & Procedures", <Stethoscope className="h-4 w-4" />)}
            {tabBtn("lesions", "Lesion Surveillance", <Eye className="h-4 w-4" />)}
            {tabBtn("therapy", "Phototherapy & Biologics", <Sun className="h-4 w-4" />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={activeTab === "therapy" ? therapyFilter : riskFilter}
                onChange={(e) => (activeTab === "therapy" ? setTherapyFilter(e.target.value) : setRiskFilter(e.target.value))}
                className="rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                {activeTab === "therapy" ? (
                  <>
                    <option value="All">All statuses</option>
                    <option>Running</option>
                    <option>Scheduled</option>
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
        {activeTab === "lesions" && lesionConsole}
        {activeTab === "therapy" && therapyConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">ABCDE rule · 7-point checklist · AAD · ISD alignment</span>
          <button onClick={() => addToast("Clinic census synced to teledermatology referral network", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
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
