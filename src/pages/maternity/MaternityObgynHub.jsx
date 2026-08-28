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
  "Room 1": "border-rose-500/40",
  "Room 2": "border-sky-500/40",
  "Room 3": "border-amber-500/40",
  "Room 4": "border-emerald-500/40",
  "Room 5": "border-violet-500/40",
  "Room 6": "border-cyan-500/40",
  "Room 7": "border-fuchsia-500/40",
  "Room 8": "border-lime-500/40",
};

const LABOR_STAGES = ["Admission", "Latent", "Active", "Transition", "Pushing", "Delivered"];

const INITIAL_LABOR = [
  { id: "LR-01", room: "Room 1", mother: "S. Reyes", ga: "39+1 wk", stage: "Active", dilation: 6, bishop: 8, fhr: "Category I", fhrRate: 138, contractions: "q3m", efm: "Reassuring", acuity: "Medium", hoursIn: 4.2, note: "Epidural in situ" },
  { id: "LR-02", room: "Room 2", mother: "T. Kim", ga: "36+4 wk", stage: "Latent", dilation: 3, bishop: 5, fhr: "Category I", fhrRate: 145, contractions: "q5m", efm: "Reassuring", acuity: "High", hoursIn: 1.8, note: "PPROM, GBS+, IV penicillin" },
  { id: "LR-03", room: "Room 3", mother: "A. Dubois", ga: "41+0 wk", stage: "Induction", dilation: 2, bishop: 4, fhr: "Category I", fhrRate: 132, contractions: "q6m", efm: "Reassuring", acuity: "Medium", hoursIn: 6.5, note: "Misoprostol, oxytocin standby" },
  { id: "LR-04", room: "Room 4", mother: "N. Petrov", ga: "40+2 wk", stage: "Transition", dilation: 9, bishop: 11, fhr: "Category II", fhrRate: 118, contractions: "q2m", efm: "Variable decels", acuity: "High", hoursIn: 7.1, note: "Category II — repositioning" },
  { id: "LR-05", room: "Room 5", mother: "J. Adeyemi", ga: "38+0 wk", stage: "Pushing", dilation: 10, bishop: 12, fhr: "Category I", fhrRate: 150, contractions: "q1m", efm: "Reassuring", acuity: "Medium", hoursIn: 8.9, note: "Second stage, active pushing" },
  { id: "LR-06", room: "Room 6", mother: "M. Osei", ga: "35+6 wk", stage: "Latent", dilation: 2, bishop: 3, fhr: "Category II", fhrRate: 108, contractions: "q7m", efm: "Late decels", acuity: "Critical", hoursIn: 2.4, note: "PET, MgSO4 infusion" },
  { id: "LR-07", room: "Room 7", mother: "L. Costa", ga: "39+5 wk", stage: "Active", dilation: 5, bishop: 7, fhr: "Category I", fhrRate: 141, contractions: "q4m", efm: "Reassuring", acuity: "Low", hoursIn: 3.3, note: "VBAC candidate" },
  { id: "LR-08", room: "Room 8", mother: "P. Novak", ga: "37+3 wk", stage: "Admission", dilation: 1, bishop: 2, fhr: "Category I", fhrRate: 136, contractions: "q8m", efm: "Reassuring", acuity: "Low", hoursIn: 0.4, note: "Booking intake" },
];

const INITIAL_ANTENATAL = [
  { id: "AN-01", patient: "F. Hassan", ga: "28+3 wk", risk: "High", condition: "Preeclampsia (severe)", bp: 152, bpTarget: 140, proteinuria: "2+", surveillance: "BPP + NST weekly", lastVisit: "2d ago", growthPct: 38, due: "11 wk", note: "ACOG severe features criteria" },
  { id: "AN-02", patient: "R. Chen", ga: "24+1 wk", risk: "Medium", condition: "GDM A2 (insulin)", bp: 124, bpTarget: 135, proteinuria: "Neg", surveillance: "BPP weekly + HbA1c", lastVisit: "5d ago", growthPct: 52, due: "15 wk", note: "Insulin titration ongoing" },
  { id: "AN-03", patient: "K. Mensah", ga: "31+5 wk", risk: "Critical", condition: "Placenta previa (total)", bp: 118, bpTarget: 135, proteinuria: "Neg", surveillance: "US every 2 wk", lastVisit: "1d ago", growthPct: 44, due: "8 wk", note: "Bleeding — admit for observation" },
  { id: "AN-04", patient: "A. Verma", ga: "33+2 wk", risk: "High", condition: "IUGR (p5)", bp: 136, bpTarget: 140, proteinuria: "Neg", surveillance: "Dopplers weekly", lastVisit: "3d ago", growthPct: 5, due: "6 wk", note: "Umbilical artery PI elevated" },
  { id: "AN-05", patient: "S. Tanaka", ga: "26+4 wk", risk: "Medium", condition: "Twin gestation (DCDA)", bp: 129, bpTarget: 135, proteinuria: "Neg", surveillance: "BPP fortnightly", lastVisit: "4d ago", growthPct: 48, due: "13 wk", note: "Discordance 12% — watch" },
  { id: "AN-06", patient: "L. Baptiste", ga: "36+0 wk", risk: "High", condition: "Chronic HTN + SGA", bp: 144, bpTarget: 140, proteinuria: "1+", surveillance: "BPP + BP diary", lastVisit: "2d ago", growthPct: 9, due: "4 wk", note: "BP trending up — labetalol" },
  { id: "AN-07", patient: "N. Duarte", ga: "20+5 wk", risk: "Low", condition: "Routine low risk", bp: 118, bpTarget: 135, proteinuria: "Neg", surveillance: "Anatomy done", lastVisit: "6d ago", growthPct: 55, due: "19 wk", note: "Scheduled 24wk GTT" },
  { id: "AN-08", patient: "G. Silva", ga: "29+1 wk", risk: "High", condition: "Cervical insufficiency", bp: 121, bpTarget: 135, proteinuria: "Neg", surveillance: "CL US weekly", lastVisit: "1d ago", growthPct: 41, due: "10 wk", note: "Pessary in situ, CL 2.4 cm" },
  { id: "AN-09", patient: "M. Okafor", ga: "34+5 wk", risk: "Medium", condition: "GDM A1 + obesity", bp: 131, bpTarget: 135, proteinuria: "Neg", surveillance: "BPP weekly", lastVisit: "5d ago", growthPct: 66, due: "5 wk", note: "Diet controlled" },
  { id: "AN-10", patient: "E. Fischer", ga: "22+2 wk", risk: "Low", condition: "Routine low risk", bp: 116, bpTarget: 135, proteinuria: "Neg", surveillance: "None indicated", lastVisit: "7d ago", growthPct: 58, due: "17 wk", note: "Rh-neg — anti-D due 28 wk" },
];

const INITIAL_POSTPARTUM = [
  { id: "PP-01", mother: "D. Brooks", delivery: "SVD", hours: 6, pphScore: 2, pphRisk: "Low", hr: 78, bp: "118/72", bili: 4.2, biliRisk: "Low", apgar: "9/9", screening: "All complete", discharge: "Ready", note: "Latch improving" },
  { id: "PP-02", mother: "C. Alvarez", delivery: "C/S", hours: 22, pphScore: 5, pphRisk: "Medium", hr: 92, bp: "128/84", bili: 8.9, biliRisk: "Watch", apgar: "8/9", screening: "CCHD pending", discharge: "In progress", note: "Pitocin drip post-op" },
  { id: "PP-03", mother: "B. Whitfield", delivery: "SVD + PPH", hours: 14, pphScore: 8, pphRisk: "High", hr: 108, bp: "96/60", bili: 6.1, biliRisk: "Low", apgar: "7/8", screening: "All complete", discharge: "Delayed", note: "TXA + uterine balloon used" },
  { id: "PP-04", mother: "S. Patel", delivery: "VBAC", hours: 9, pphScore: 3, pphRisk: "Low", hr: 84, bp: "122/76", bili: 11.4, biliRisk: "Critical", apgar: "9/9", screening: "Hearing pending", discharge: "In progress", note: "Phototherapy under bili lights" },
  { id: "PP-05", mother: "H. Jung", delivery: "C/S (twins)", hours: 30, pphScore: 6, pphRisk: "High", hr: 100, bp: "104/66", bili: 7.2, biliRisk: "Watch", apgar: "6/8, 8/9", screening: "CCHD pending", discharge: "Delayed", note: "Hb 8.9 — trend Hgb" },
  { id: "PP-06", mother: "T. Nwosu", delivery: "SVD", hours: 4, pphScore: 1, pphRisk: "Low", hr: 74, bp: "114/70", bili: 3.5, biliRisk: "Low", apgar: "9/10", screening: "All complete", discharge: "Ready", note: "First void achieved" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function riskBadge(r) {
  const m = RISK_META[r] || RISK_META.Low;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${r === "Critical" ? "bg-rose-400" : r === "High" ? "bg-orange-400" : r === "Medium" ? "bg-amber-400" : "bg-emerald-400"}`} />{r}</span>;
}

function stageColor(s) {
  if (s === "Delivered") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "Pushing" || s === "Transition") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (s === "Active") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-slate-700/40 text-slate-300 border-slate-600/40";
}

function stageBadge(s) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${stageColor(s)}`}>{s}</span>;
}

function pphRisk(r) {
  if (r === "High") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (r === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

function biliBand(v) {
  if (v >= 10) return { label: "Phototherapy", cls: "text-rose-300" };
  if (v >= 7) return { label: "Watch", cls: "text-amber-300" };
  return { label: "Low", cls: "text-emerald-300" };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function MaternityObgynHub() {
  const [activeTab, setActiveTab] = useState("labor");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [pphFilter, setPphFilter] = useState("All");
  const [labor, setLabor] = useState(INITIAL_LABOR);
  const [antenatal, setAntenatal] = useState(INITIAL_ANTENATAL);
  const [postpartum, setPostpartum] = useState(INITIAL_POSTPARTUM);
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

  /* live creep: labor dilation + stage, antenatal BP, postpartum scores */
  useEffect(() => {
    if (pausedRef.current || tick === 0) return;
    const mult = speedRef.current;

    setLabor((rows) =>
      rows.map((r) => {
        if (r.stage === "Delivered" || r.stage === "Admission") return r;
        const creep = Math.random() < 0.4 * mult;
        const nextStage = creep ? LABOR_STAGES[Math.min(LABOR_STAGES.indexOf(r.stage) + 1, LABOR_STAGES.length - 1)] : r.stage;
        return {
          ...r,
          dilation: r.stage === "Pushing" ? 10 : Math.min(10, r.dilation + (creep ? 0.5 : 0)),
          stage: nextStage,
          hoursIn: +(r.hoursIn + 0.1 * mult).toFixed(1),
        };
      })
    );

    setAntenatal((rows) =>
      rows.map((r) => {
        if (r.risk === "Low") return r;
        const bump = Math.random() < 0.35 * mult ? 1 : 0;
        const bp = Math.min(175, r.bp + bump);
        const escalated = bp >= r.bpTarget + 12 && r.risk !== "Critical";
        return { ...r, bp, risk: escalated ? "Critical" : r.risk };
      })
    );

    setPostpartum((rows) =>
      rows.map((r) => {
        const scoreCreep = Math.random() < 0.3 * mult ? 1 : 0;
        const bili = +(r.bili + (Math.random() < 0.5 * mult ? 0.15 : 0)).toFixed(1);
        return {
          ...r,
          pphScore: Math.min(12, r.pphScore + scoreCreep),
          pphRisk: r.pphScore + scoreCreep >= 6 ? "High" : r.pphScore + scoreCreep >= 3 ? "Medium" : "Low",
          bili,
        };
      })
    );
  }, [tick]);

  const reset = useCallback(() => {
    setLabor(INITIAL_LABOR);
    setAntenatal(INITIAL_ANTENATAL);
    setPostpartum(INITIAL_POSTPARTUM);
    setTick(0);
    setPaused(false);
    setSpeed(1);
    addToast("Maternity consoles reset to shift start", "info");
  }, [addToast]);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "labor"
      ? labor.map((r) => ({ room: r.room, mother: r.mother, ga: r.ga, stage: r.stage, dilation: r.dilation, bishop: r.bishop, fhr: r.fhr, acuity: r.acuity }))
      : activeTab === "antenatal"
        ? antenatal.map((r) => ({ patient: r.patient, ga: r.ga, risk: r.risk, condition: r.condition, bp: r.bp, surveillance: r.surveillance, growthPct: r.growthPct }))
        : postpartum.map((r) => ({ mother: r.mother, delivery: r.delivery, hours: r.hours, pphScore: r.pphScore, pphRisk: r.pphRisk, bili: r.bili, discharge: r.discharge }));
    downloadCsv(`maternity-${activeTab}.csv`, rows);
    addToast(`${rows.length} rows exported to CSV`, "success");
  }, [activeTab, labor, antenatal, postpartum, addToast]);

  const advanceLabor = useCallback((id) => {
    setLabor((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const idx = LABOR_STAGES.indexOf(r.stage);
        const next = LABOR_STAGES[Math.min(idx + 1, LABOR_STAGES.length - 1)];
        if (next === "Delivered") {
          addToast(`${r.mother} delivered — newborn handoff to postpartum`, "success");
        } else {
          addToast(`${r.mother} advanced to ${next} stage`, "info");
        }
        return { ...r, stage: next, dilation: next === "Pushing" || next === "Delivered" ? 10 : r.dilation };
      })
    );
  }, [addToast]);

  const recordSurveillance = useCallback((id) => {
    setAntenatal((rows) => rows.map((r) => (r.id === id ? { ...r, lastVisit: "Just now" } : r)));
    addToast("Fetal surveillance recorded (NST/BPP documented)", "success");
  }, [addToast]);

  const clearPphFlag = useCallback((id) => {
    setPostpartum((rows) => rows.map((r) => (r.id === id ? { ...r, pphRisk: "Low", pphScore: 2 } : r)));
    addToast("PPH risk reassessed — bleeding controlled", "success");
  }, [addToast]);

  const completeDischarge = useCallback((id) => {
    setPostpartum((rows) => rows.map((r) => (r.id === id ? { ...r, discharge: "Discharged" } : r)));
    addToast("Mother–baby dyad discharged with 6-week follow-up", "success");
  }, [addToast]);

  /* simulation event toasts */
  useEffect(() => {
    if (pausedRef.current || tick === 0 || tick % 3 !== 0) return;
    const critical = antenatal.filter((r) => r.risk === "Critical");
    if (critical.length && Math.random() < 0.6) {
      addToast(`Preeclampsia alert: ${critical[0].patient} BP ${critical[0].bp} — ACOG severe features review`, "error");
    }
    const pushing = labor.find((r) => r.stage === "Pushing" && r.id !== null);
    if (pushing && Math.random() < 0.5) {
      addToast(`${pushing.mother} in second stage — prepare delivery team`, "warning");
    }
    const biliCritical = postpartum.find((r) => r.bili >= 10);
    if (biliCritical && Math.random() < 0.5) {
      addToast(`Jaundice alert: ${biliCritical.mother} bili ${biliCritical.bili} mg/dL — phototherapy per AAP`, "warning");
    }
  }, [tick, antenatal, labor, postpartum, addToast]);

  const stats = useMemo(() => {
    const active = labor.filter((r) => r.stage !== "Delivered");
    const criticalAntenatal = antenatal.filter((r) => r.risk === "Critical").length;
    const highPph = postpartum.filter((r) => r.pphRisk === "High").length;
    const delivering = labor.filter((r) => r.stage === "Pushing" || r.stage === "Transition").length;
    const pphAvg = +(postpartum.reduce((s, r) => s + r.pphScore, 0) / postpartum.length).toFixed(1);
    return { active: active.length, delivering, criticalAntenatal, highPph, pphAvg };
  }, [labor, antenatal, postpartum]);

  const q = search.trim().toLowerCase();
  const filteredLabor = labor.filter((r) =>
    (stageFilter === "All" || r.stage === stageFilter) &&
    (riskFilter === "All" || r.acuity === riskFilter) &&
    (!q || (r.mother + r.room + r.note).toLowerCase().includes(q))
  );
  const filteredAntenatal = antenatal.filter((r) =>
    (riskFilter === "All" || r.risk === riskFilter) &&
    (!q || (r.patient + r.condition + r.note).toLowerCase().includes(q))
  );
  const filteredPostpartum = postpartum.filter((r) =>
    (pphFilter === "All" || r.pphRisk === pphFilter) &&
    (!q || (r.mother + r.delivery + r.note).toLowerCase().includes(q))
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
        placeholder="Search patients, rooms, conditions…"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600"
      />
    </div>
  );

  const renderModal = () => {
    if (!modal) return null;
    const rows = modal.tab === "labor" ? labor : modal.tab === "antenatal" ? antenatal : postpartum;
    const item = rows.find((r) => r.id === modal.id);
    if (!item) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{modal.tab === "labor" ? item.mother : modal.tab === "antenatal" ? item.patient : item.mother}</h3>
              <p className="text-xs text-slate-500">{item.id} · {modal.tab === "labor" ? item.room : modal.tab === "antenatal" ? item.ga : `${item.delivery} · ${item.hours}h postpartum`}</p>
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

  /* ------------------------------ labor console ------------------------------ */
  const laborConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {filteredLabor.map((r) => {
        const idx = LABOR_STAGES.indexOf(r.stage);
        const pct = r.stage === "Delivered" ? 100 : Math.round((idx / (LABOR_STAGES.length - 1)) * 100);
        return (
          <div key={r.id} className={`rounded-xl border ${ROOM_COLORS[r.room] || "border-slate-800"} bg-slate-900 p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{r.room}</span>
              {stageBadge(r.stage)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-white">{r.mother}</span>
              <span className="ml-auto text-xs text-slate-500">{r.ga}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Dilation" value={`${r.dilation} cm`} sub={r.stage === "Pushing" || r.stage === "Delivered" ? "complete" : "cervix"} alert={r.dilation >= 8 && r.stage !== "Delivered"} />
              <MiniStat label="Bishop" value={r.bishop} sub="score" />
              <MiniStat label="FHR" value={r.fhrRate} sub={r.fhr.replace("Category ", "Cat ")} alert={r.fhr !== "Category I"} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {r.contractions}</span>
                <span>{r.acuity}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${r.stage === "Delivered" ? "bg-emerald-500" : r.fhr !== "Category I" ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => advanceLabor(r.id)} disabled={r.stage === "Delivered"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                {r.stage === "Delivered" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {r.stage === "Delivered" ? "Delivered" : "Advance"}
              </button>
              <button onClick={() => setModal({ tab: "labor", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredLabor.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No labor cases match the current filters.</p>}
    </div>
  );

  /* --------------------------- antenatal console ---------------------------- */
  const antenatalConsole = (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">GA / Due</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">BP (mmHg)</th>
              <th className="px-4 py-3">Surveillance</th>
              <th className="px-4 py-3">Growth</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAntenatal.map((r) => {
              const bpAlert = r.bp >= r.bpTarget;
              return (
                <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{r.patient}</span>
                      <span className="text-xs text-slate-500">{r.ga}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.due}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{r.condition}</td>
                  <td className="px-4 py-3">{riskBadge(r.risk)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs font-bold ${bpAlert ? "text-rose-300" : "text-emerald-300"}`}>{r.bp}</span>
                    <span className="ml-1.5 text-[10px] text-slate-500">/ &lt;{r.bpTarget}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {r.surveillance}
                    <span className="block text-[10px] text-slate-600">last: {r.lastVisit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${r.growthPct <= 10 ? "text-rose-300" : r.growthPct <= 25 ? "text-amber-300" : "text-emerald-300"}`}>{r.growthPct}%</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${r.growthPct <= 10 ? "bg-rose-500" : r.growthPct <= 25 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${r.growthPct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => recordSurveillance(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
                        <FlaskConical className="h-3.5 w-3.5" /> Record
                      </button>
                      <button onClick={() => setModal({ tab: "antenatal", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
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

  /* --------------------------- postpartum console --------------------------- */
  const postpartumConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filteredPostpartum.map((r) => {
        const b = biliBand(r.bili);
        return (
          <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-white">{r.mother}</span>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${pphRisk(r.pphRisk)}`}>{r.pphRisk}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.delivery} · {r.hours}h postpartum · APGAR {r.apgar}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="PPH score" value={r.pphScore} sub="ACOG risk" alert={r.pphRisk === "High"} />
              <MiniStat label="HR" value={r.hr} sub="bpm" alert={r.hr >= 100} />
              <MiniStat label="BP" value={r.bp} sub="mmHg" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Bilirubin</p>
                <p className={`text-base font-bold ${b.cls}`}>{r.bili} mg/dL</p>
                <p className="text-[10px] text-slate-500">{b.label} band</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Screening</p>
                <p className="text-xs font-semibold text-slate-200">{r.screening}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{r.discharge}</p>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              {r.pphRisk === "High" ? (
                <button onClick={() => clearPphFlag(r.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20">
                  <ShieldAlert className="h-3.5 w-3.5" /> Reassess PPH
                </button>
              ) : (
                <button onClick={() => completeDischarge(r.id)} disabled={r.discharge === "Discharged"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                  <PackageCheck className="h-3.5 w-3.5" /> {r.discharge === "Discharged" ? "Discharged" : "Complete discharge"}
                </button>
              )}
              <button onClick={() => setModal({ tab: "postpartum", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredPostpartum.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No postpartum dyads match the current filters.</p>}
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
              <span className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2"><HeartPulse className="h-5 w-5 text-rose-300" /></span>
              <h1 className="text-2xl font-bold text-white">Maternity &amp; OB-GYN Command Hub</h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Labor &amp; delivery board, antenatal risk stratification with ACOG-aligned surveillance, and postpartum hemorrhage / newborn watch.
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
          <StatCard label="Active labors" value={stats.active} icon={<Activity className="h-4 w-4 text-sky-300" />} />
          <StatCard label="Pushing / transition" value={stats.delivering} icon={<Siren className="h-4 w-4 text-rose-300" />} alert={stats.delivering > 0} />
          <StatCard label="Critical antenatal" value={stats.criticalAntenatal} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.criticalAntenatal > 0} />
          <StatCard label="High PPH risk" value={stats.highPph} icon={<Droplet className="h-4 w-4 text-rose-300" />} alert={stats.highPph > 0} />
          <StatCard label="Avg PPH score" value={stats.pphAvg} icon={<Gauge className="h-4 w-4 text-amber-300" />} alert={stats.pphAvg >= 3} />
        </div>

        {/* tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabBtn("labor", "L&D Board", <Activity className="h-4 w-4" />)}
            {tabBtn("antenatal", "Antenatal & Fetal Surveillance", <Stethoscope className="h-4 w-4" />)}
            {tabBtn("postpartum", "Postpartum & Newborn Watch", <Droplets className="h-4 w-4" />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={activeTab === "postpartum" ? pphFilter : riskFilter}
                onChange={(e) => (activeTab === "postpartum" ? setPphFilter(e.target.value) : setRiskFilter(e.target.value))}
                className="rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                <option value="All">All risk</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            {activeTab === "labor" && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                <option value="All">All stages</option>
                {LABOR_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* active console */}
        {activeTab === "labor" && laborConsole}
        {activeTab === "antenatal" && antenatalConsole}
        {activeTab === "postpartum" && postpartumConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">ACOG · AAP · WHO · SMFM alignment</span>
          <button onClick={() => addToast("Census synced to maternal health registry (SMFM format)", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
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
