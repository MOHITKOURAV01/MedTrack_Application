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

const WARD_COLORS = {
  "ICU": "border-rose-500/40",
  "Oncology": "border-violet-500/40",
  "Surgery": "border-sky-500/40",
  "Medical": "border-amber-500/40",
  "Pediatrics": "border-emerald-500/40",
  "Geriatrics": "border-fuchsia-500/40",
};

const INITIAL_SCREENING = [
  { id: "NS-01", patient: "W. Torres", ward: "ICU", mst: 4, bmi: 17.2, glim: "Moderate malnutrition", risk: "High", calories: 1450, protein: 62, dietitian: "R. Iyer", rescreen: "Due now", note: "CRRT — high protein target" },
  { id: "NS-02", patient: "J. Fontaine", ward: "Oncology", mst: 6, bmi: 19.8, glim: "Severe malnutrition", risk: "Critical", calories: 1200, protein: 58, dietitian: "M. Osei", rescreen: "Overdue 2d", note: "Neoadjuvant chemo, dysphagia" },
  { id: "NS-03", patient: "H. Nakamura", ward: "Surgery", mst: 2, bmi: 26.4, glim: "None", risk: "Low", calories: 1900, protein: 80, dietitian: "—", rescreen: "In 3d", note: "Post-op day 2, advancing diet" },
  { id: "NS-04", patient: "A. Silva", ward: "Medical", mst: 5, bmi: 15.1, glim: "Severe malnutrition", risk: "High", calories: 1100, protein: 50, dietitian: "R. Iyer", rescreen: "Due now", note: "Anorexia nervosa, refeeding risk" },
  { id: "NS-05", patient: "B. Kovács", ward: "Geriatrics", mst: 3, bmi: 20.5, glim: "Moderate malnutrition", risk: "Medium", calories: 1500, protein: 65, dietitian: "L. Park", rescreen: "Due now", note: "Dementia, 6% weight loss/3mo" },
  { id: "NS-06", patient: "C. Mensah", ward: "Pediatrics", mst: 1, bmi: 22.3, glim: "None", risk: "Low", calories: 1300, protein: 45, dietitian: "—", rescreen: "In 7d", note: "Asthma exacerbation, eating well" },
  { id: "NS-07", patient: "D. Petrova", ward: "ICU", mst: 5, bmi: 24.9, glim: "Severe malnutrition", risk: "Critical", calories: 1350, protein: 70, dietitian: "M. Osei", rescreen: "Overdue 1d", note: "Ventilated, high output stoma" },
  { id: "NS-08", patient: "E. Khan", ward: "Medical", mst: 3, bmi: 23.1, glim: "Moderate malnutrition", risk: "Medium", calories: 1600, protein: 68, dietitian: "L. Park", rescreen: "Due now", note: "COPD, early satiety" },
  { id: "NS-09", patient: "F. Rossi", ward: "Surgery", mst: 4, bmi: 18.6, glim: "Moderate malnutrition", risk: "High", calories: 1400, protein: 60, dietitian: "R. Iyer", rescreen: "Due now", note: "Post esophagectomy, NJ tube" },
  { id: "NS-10", patient: "G. Tanaka", ward: "Oncology", mst: 2, bmi: 21.7, glim: "None", risk: "Low", calories: 1800, protein: 75, dietitian: "—", rescreen: "In 5d", note: "Hematology, stable weight" },
];

const INITIAL_PN_ORDERS = [
  { id: "PN-01", patient: "W. Torres", ward: "ICU", type: "TNA (3-in-1)", volume: 1450, kcals: 1450, protein: 62, lipids: 35, rate: 60, hangTime: "14:00", hangHours: 24, status: "Running", pump: "Pump 4", note: "Standard formula, K+ 30 mEq" },
  { id: "PN-02", patient: "D. Petrova", ward: "ICU", type: "2-in-1 + lipid", volume: 1350, kcals: 1350, protein: 70, lipids: 40, rate: 56, hangTime: "13:00", hangHours: 24, status: "Running", pump: "Pump 7", note: "High protein, CrCl adjusted" },
  { id: "PN-03", patient: "J. Fontaine", ward: "Oncology", type: "TNA (3-in-1)", volume: 1200, kcals: 1200, protein: 58, lipids: 30, rate: 50, hangTime: "16:00", hangHours: 24, status: "Compounding", pump: "—", note: "Soy-free lipid, MCT based" },
  { id: "PN-04", patient: "A. Silva", ward: "Medical", type: "TNA (3-in-1)", volume: 1100, kcals: 1100, protein: 50, lipids: 25, rate: 46, hangTime: "17:30", hangHours: 24, status: "Compounding", pump: "—", note: "Refeeding protocol — start slow" },
  { id: "PN-05", patient: "F. Rossi", ward: "Surgery", type: "Peripheral PN", volume: 900, kcals: 720, protein: 35, lipids: 20, rate: 38, hangTime: "12:00", hangHours: 12, status: "Running", pump: "Pump 2", note: "Bridging while NJ advances" },
  { id: "PN-06", patient: "E. Khan", ward: "Medical", type: "2-in-1 + lipid", volume: 1600, kcals: 1600, protein: 68, lipids: 38, rate: 67, hangTime: "19:00", hangHours: 24, status: "Scheduled", pump: "—", note: "Standard, insulin sliding scale" },
];

const INITIAL_ENTERAL = [
  { id: "EN-01", patient: "F. Rossi", ward: "Surgery", formula: "Vital 1.5", route: "NJ tube", volume: 1000, kcals: 1500, protein: 62, rate: 42, status: "Running", pump: "Pump 9", note: "Gravity drip over 24h" },
  { id: "EN-02", patient: "G. Tanaka", ward: "Oncology", formula: "Jevity 1.5", route: "NG tube", volume: 1250, kcals: 1875, protein: 83, rate: 52, status: "Running", pump: "Pump 3", note: "Immunonutrition added" },
  { id: "EN-03", patient: "B. Kovács", ward: "Geriatrics", formula: "Nepro with Carb Steady", route: "NG tube", volume: 800, kcals: 1360, protein: 68, rate: 33, status: "Holding", pump: "Pump 6", note: "Renal — hold 2h pre dialysis" },
  { id: "EN-04", patient: "C. Mensah", ward: "Pediatrics", formula: "Pediasure 1.5", route: "Gastrostomy", volume: 700, kcals: 1050, protein: 35, rate: 29, status: "Running", pump: "Pump 11", note: "Bolus q4h tolerated" },
  { id: "EN-05", patient: "D. Petrova", ward: "ICU", formula: "Osmolite 1.2", route: "NG tube", volume: 1100, kcals: 1320, protein: 60, rate: 46, status: "Ordered", pump: "—", note: "Post feeding-tolerance check" },
  { id: "EN-06", patient: "H. Nakamura", ward: "Surgery", formula: "Osmolite 1.0", route: "Oral + NG", volume: 600, kcals: 600, protein: 25, rate: 25, status: "Running", pump: "Pump 1", note: "Supplemental while advancing" },
];

const INITIAL_TRAYS = [
  { id: "TY-01", room: "ICU-4", patient: "W. Torres", diet: "NPO (PN only)", texture: "—", allergens: "None", state: "Assembled", station: "PN", eta: "Delivered" },
  { id: "TY-02", room: "MED-12", patient: "E. Khan", diet: "Diabetic 1800 kcal", texture: "Regular", allergens: "Soy", state: "Assembling", station: "Mainline", eta: "11:20" },
  { id: "TY-03", room: "ONC-7", patient: "J. Fontaine", diet: "Renal + low potassium", texture: "Mechanical soft", allergens: "None", state: "Plated", station: "Therapeutic", eta: "11:35" },
  { id: "TY-04", room: "GER-2", patient: "B. Kovács", diet: "Cardiac + low sodium", texture: "Pureed", allergens: "Dairy", state: "Assembling", station: "Therapeutic", eta: "11:40" },
  { id: "TY-05", room: "SUR-9", patient: "F. Rossi", diet: "Clear liquid", texture: "Liquid", allergens: "None", state: "Ready", station: "Mainline", eta: "11:15" },
  { id: "TY-06", room: "PED-3", patient: "C. Mensah", diet: "Regular child portion", texture: "Regular", allergens: "Peanut", state: "Assembling", station: "Pediatric", eta: "11:30" },
  { id: "TY-07", room: "MED-5", patient: "A. Silva", diet: "High protein + fortified", texture: "Mechanical soft", allergens: "None", state: "Queued", station: "Therapeutic", eta: "11:50" },
  { id: "TY-08", room: "SUR-2", patient: "H. Nakamura", diet: "Regular + high fiber", texture: "Regular", allergens: "None", state: "Ready", station: "Mainline", eta: "11:10" },
  { id: "TY-09", room: "ICU-2", patient: "D. Petrova", diet: "NPO (EN via NG)", texture: "—", allergens: "None", state: "Assembled", station: "Enteral", eta: "Delivered" },
  { id: "TY-10", room: "ONC-3", patient: "G. Tanaka", diet: "Neutropenic", texture: "Regular", allergens: "Shellfish", state: "Queued", station: "Therapeutic", eta: "12:00" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function riskBadge(r) {
  const m = RISK_META[r] || RISK_META.Low;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${r === "Critical" ? "bg-rose-400" : r === "High" ? "bg-orange-400" : r === "Medium" ? "bg-amber-400" : "bg-emerald-400"}`} />{r}</span>;
}

function trayStateColor(s) {
  if (s === "Delivered") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "Ready") return "bg-sky-500/15 text-sky-300 border-sky-500/40";
  if (s === "Assembling" || s === "Plated") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-slate-700/40 text-slate-300 border-slate-600/40";
}

function trayBadge(s) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${trayStateColor(s)}`}>{s}</span>;
}

function glimBand(g) {
  if (g === "Severe malnutrition") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (g === "Moderate malnutrition") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function NutritionDieteticsHub() {
  const [activeTab, setActiveTab] = useState("screening");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trayFilter, setTrayFilter] = useState("All");
  const [screening, setScreening] = useState(INITIAL_SCREENING);
  const [pn, setPn] = useState(INITIAL_PN_ORDERS);
  const [enteral, setEnteral] = useState(INITIAL_ENTERAL);
  const [trays, setTrays] = useState(INITIAL_TRAYS);
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

  /* live creep: risk drift, infusion progress, trayline advancement */
  useEffect(() => {
    if (pausedRef.current || tick === 0) return;
    const mult = speedRef.current;

    setScreening((rows) =>
      rows.map((r) => {
        if (r.risk === "Low") return r;
        const drift = Math.random() < 0.25 * mult;
        const next = r.risk === "Critical" ? "Critical" : r.risk === "High" ? (drift ? "Critical" : "High") : drift ? "High" : "Medium";
        return { ...r, risk: next };
      })
    );

    setPn((rows) =>
      rows.map((r) => {
        if (r.status === "Running") return r;
        if (r.status === "Compounding" && Math.random() < 0.4 * mult) return { ...r, status: "Running", pump: r.pump === "—" ? `Pump ${Math.floor(Math.random() * 10) + 1}` : r.pump };
        return r;
      })
    );

    setEnteral((rows) =>
      rows.map((r) => {
        if (r.status === "Running") return r;
        if (r.status === "Ordered" && Math.random() < 0.5 * mult) return { ...r, status: "Running", pump: r.pump === "—" ? `Pump ${Math.floor(Math.random() * 10) + 1}` : r.pump };
        return r;
      })
    );

    setTrays((rows) =>
      rows.map((r) => {
        if (r.state === "Delivered" || r.state === "Queued") return r;
        const order = ["Ready", "Plated", "Assembling", "Assembled", "Delivered"];
        const idx = order.indexOf(r.state);
        if (idx === -1) return r;
        const next = idx < order.length - 1 && Math.random() < 0.3 * mult ? order[idx + 1] : r.state;
        if (next === "Delivered") return { ...r, state: next, eta: "Delivered" };
        return { ...r, state: next };
      })
    );
  }, [tick]);

  const reset = useCallback(() => {
    setScreening(INITIAL_SCREENING);
    setPn(INITIAL_PN_ORDERS);
    setEnteral(INITIAL_ENTERAL);
    setTrays(INITIAL_TRAYS);
    setTick(0);
    setPaused(false);
    setSpeed(1);
    addToast("Nutrition consoles reset to morning census", "info");
  }, [addToast]);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "screening"
      ? screening.map((r) => ({ patient: r.patient, ward: r.ward, mst: r.mst, bmi: r.bmi, glim: r.glim, risk: r.risk, calories: r.calories, protein: r.protein, dietitian: r.dietitian }))
      : activeTab === "orders"
        ? [...pn, ...enteral].map((r) => ({ patient: r.patient, ward: r.ward, type: r.type || r.formula, route: r.route || "PN", volume: r.volume, kcals: r.kcals, protein: r.protein, rate: r.rate, status: r.status }))
        : trays.map((r) => ({ room: r.room, patient: r.patient, diet: r.diet, texture: r.texture, allergens: r.allergens, state: r.state, eta: r.eta }));
    downloadCsv(`nutrition-${activeTab}.csv`, rows);
    addToast(`${rows.length} rows exported to CSV`, "success");
  }, [activeTab, screening, pn, enteral, trays, addToast]);

  const recordAssessment = useCallback((id) => {
    setScreening((rows) => rows.map((r) => (r.id === id ? { ...r, rescreen: "Reassessed" } : r)));
    addToast("Nutrition assessment documented (MUST + GLIM criteria)", "success");
  }, [addToast]);

  const escalateRisk = useCallback((id) => {
    setScreening((rows) => rows.map((r) => (r.id === id ? { ...r, risk: "Critical", dietitian: "R. Iyer" } : r)));
    addToast("Case escalated — urgent dietitian review requested", "warning");
  }, [addToast]);

  const sendToPharmacy = useCallback((id) => {
    setPn((rows) => rows.map((r) => (r.id === id ? { ...r, status: "Compounding" } : r)));
    addToast("PN order sent to compounding — USP 797 verification queued", "success");
  }, [addToast]);

  const startEnteral = useCallback((id) => {
    setEnteral((rows) => rows.map((r) => (r.id === id ? { ...r, status: "Running", pump: r.pump === "—" ? `Pump ${Math.floor(Math.random() * 10) + 1}` : r.pump } : r)));
    addToast("Enteral feed started — aspiration precautions confirmed", "success");
  }, [addToast]);

  const sendTray = useCallback((id) => {
    setTrays((rows) => rows.map((r) => (r.id === id ? { ...r, state: "Delivered", eta: "Delivered" } : r)));
    addToast(`Tray ${id} dispatched to ward`, "success");
  }, [addToast]);

  /* simulation event toasts */
  useEffect(() => {
    if (pausedRef.current || tick === 0 || tick % 3 !== 0) return;
    const critical = screening.find((r) => r.risk === "Critical" && r.rescreen !== "Reassessed");
    if (critical && Math.random() < 0.6) {
      addToast(`Malnutrition alert: ${critical.patient} (${critical.glim}) — dietitian consult`, "error");
    }
    const holding = enteral.find((r) => r.status === "Holding");
    if (holding && Math.random() < 0.5) {
      addToast(`${holding.patient} enteral feed holding — dialysis window active`, "warning");
    }
    const overdue = screening.find((r) => r.rescreen.startsWith("Overdue"));
    if (overdue && Math.random() < 0.5) {
      addToast(`Rescreen overdue: ${overdue.patient} — MUST score ${overdue.mst}`, "warning");
    }
  }, [tick, screening, enteral, addToast]);

  const stats = useMemo(() => {
    const critical = screening.filter((r) => r.risk === "Critical").length;
    const high = screening.filter((r) => r.risk === "High").length;
    const runningPn = pn.filter((r) => r.status === "Running").length;
    const runningEn = enteral.filter((r) => r.status === "Running").length;
    const traysOut = trays.filter((r) => r.state === "Delivered").length;
    return { critical, high, runningPn, runningEn, traysOut };
  }, [screening, pn, enteral, trays]);

  const q = search.trim().toLowerCase();
  const filteredScreening = screening.filter((r) =>
    (riskFilter === "All" || r.risk === riskFilter) &&
    (!q || (r.patient + r.ward + r.glim + r.note).toLowerCase().includes(q))
  );
  const filteredOrders = [...pn, ...enteral].filter((r) =>
    (statusFilter === "All" || r.status === statusFilter) &&
    (!q || (r.patient + r.ward + (r.type || r.formula) + r.note).toLowerCase().includes(q))
  );
  const filteredTrays = trays.filter((r) =>
    (trayFilter === "All" || r.state === trayFilter) &&
    (!q || (r.patient + r.room + r.diet + r.texture).toLowerCase().includes(q))
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
        placeholder="Search patients, formulas, diets…"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-600"
      />
    </div>
  );

  const renderModal = () => {
    if (!modal) return null;
    const source = modal.tab === "screening" ? screening : modal.tab === "orders" ? [...pn, ...enteral] : trays;
    const item = source.find((r) => r.id === modal.id);
    if (!item) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{item.patient}</h3>
              <p className="text-xs text-slate-500">{item.id} · {item.ward || item.room}</p>
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

  /* -------------------------- screening console ---------------------------- */
  const screeningConsole = (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">MUST</th>
              <th className="px-4 py-3">BMI</th>
              <th className="px-4 py-3">GLIM</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Targets (kcal / g)</th>
              <th className="px-4 py-3">Dietitian</th>
              <th className="px-4 py-3">Rescreen</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScreening.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{r.patient}</span>
                    <span className={`text-xs ${WARD_COLORS[r.ward] ? "text-slate-400" : "text-slate-500"}`}>{r.ward}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm font-bold ${r.mst >= 4 ? "text-rose-300" : r.mst >= 2 ? "text-amber-300" : "text-emerald-300"}`}>{r.mst}</span>
                  <span className="text-[10px] text-slate-600">/9</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.bmi}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${glimBand(r.glim)}`}>{r.glim}</span>
                </td>
                <td className="px-4 py-3">{riskBadge(r.risk)}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{r.calories} kcal / {r.protein} g</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.dietitian === "—" ? <span className="text-slate-600">unassigned</span> : r.dietitian}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${r.rescreen.startsWith("Overdue") ? "text-rose-300" : r.rescreen === "Due now" ? "text-amber-300" : r.rescreen === "Reassessed" ? "text-emerald-300" : "text-slate-400"}`}>{r.rescreen}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => recordAssessment(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Assess
                    </button>
                    {r.risk !== "Critical" && (
                      <button onClick={() => escalateRisk(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20">
                        <AlertTriangle className="h-3.5 w-3.5" /> Escalate
                      </button>
                    )}
                    <button onClick={() => setModal({ tab: "screening", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* --------------------------- orders console ------------------------------ */
  const ordersConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filteredOrders.map((r) => {
        const isPn = !!r.hangTime;
        const pct = isPn ? Math.min(100, Math.round(((24 - r.hangHours) / 24) * 100)) : 60;
        return (
          <div key={r.id} className={`rounded-xl border ${isPn ? "border-slate-800" : "border-emerald-800/40"} bg-slate-900 p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg p-1.5 ${isPn ? "bg-violet-500/15" : "bg-emerald-500/15"}`}>
                  {isPn ? <Droplet className="h-4 w-4 text-violet-300" /> : <FlaskConical className="h-4 w-4 text-emerald-300" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{r.patient}</p>
                  <p className="text-xs text-slate-500">{r.ward} · {isPn ? r.type : r.formula}</p>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${r.status === "Running" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : r.status === "Compounding" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : r.status === "Holding" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-slate-700 bg-slate-800 text-slate-300"}`}>{r.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <MiniStat label="Volume" value={`${r.volume} mL`} sub="per day" />
              <MiniStat label="Kcals" value={r.kcals} sub="total" />
              <MiniStat label="Protein" value={`${r.protein} g`} sub="per day" />
              <MiniStat label="Rate" value={`${r.rate}`} sub="mL/hr" />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {r.route || "IV line"} · {r.pump}</span>
                {isPn && <span>hang {r.hangTime}</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${r.status === "Running" ? "bg-emerald-500" : r.status === "Holding" ? "bg-rose-500" : "bg-slate-600"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.note}</p>
            <div className="mt-3 flex items-center gap-2">
              {isPn ? (
                <button onClick={() => sendToPharmacy(r.id)} disabled={r.status === "Running" || r.status === "Compounding"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                  <Beaker className="h-3.5 w-3.5" /> {r.status === "Running" ? "Running" : r.status === "Compounding" ? "Compounding" : "Send to pharmacy"}
                </button>
              ) : (
                <button onClick={() => startEnteral(r.id)} disabled={r.status === "Running"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
                  <Play className="h-3.5 w-3.5" /> {r.status === "Running" ? "Running" : "Start feed"}
                </button>
              )}
              <button onClick={() => setModal({ tab: "orders", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {filteredOrders.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No nutrition orders match the current filters.</p>}
    </div>
  );

  /* ---------------------------- trayline console --------------------------- */
  const trayConsole = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {filteredTrays.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{r.room}</span>
            {trayBadge(r.state)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">{r.patient}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-300">{r.diet}</p>
          <p className="text-[10px] text-slate-500">{r.texture === "—" ? "no tray (special route)" : `${r.texture} texture`}</p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {r.station}</span>
            <span className={r.eta === "Delivered" ? "text-emerald-300" : "text-slate-400"}>{r.eta}</span>
          </div>
          <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.allergens === "None" ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
            {r.allergens === "None" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {r.allergens}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => sendTray(r.id)} disabled={r.state === "Delivered" || r.state === "Queued"} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40">
              <PackageCheck className="h-3.5 w-3.5" /> {r.state === "Delivered" ? "Delivered" : "Send"}
            </button>
            <button onClick={() => setModal({ tab: "trays", id: r.id })} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white"><Eye className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      {filteredTrays.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No trayline orders match the current filters.</p>}
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
              <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2"><FlaskConical className="h-5 w-5 text-emerald-300" /></span>
              <h1 className="text-2xl font-bold text-white">Nutrition &amp; Dietetics Command Hub</h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              MUST/GLIM screening, parenteral &amp; enteral order management, and the diet office trayline with allergen-safe assembly.
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
          <StatCard label="Critical malnutrition" value={stats.critical} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.critical > 0} />
          <StatCard label="High risk cases" value={stats.high} icon={<Activity className="h-4 w-4 text-orange-300" />} />
          <StatCard label="PN infusions live" value={stats.runningPn} icon={<Droplet className="h-4 w-4 text-violet-300" />} />
          <StatCard label="Enteral feeds live" value={stats.runningEn} icon={<FlaskConical className="h-4 w-4 text-emerald-300" />} />
          <StatCard label="Trays dispatched" value={stats.traysOut} icon={<PackageCheck className="h-4 w-4 text-sky-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabBtn("screening", "Screening & Assessment", <Gauge className="h-4 w-4" />)}
            {tabBtn("orders", "PN & Enteral Orders", <Droplets className="h-4 w-4" />)}
            {tabBtn("trays", "Diet Office & Trayline", <Layers className="h-4 w-4" />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchBox}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                value={activeTab === "orders" ? statusFilter : activeTab === "trays" ? trayFilter : riskFilter}
                onChange={(e) => {
                  if (activeTab === "orders") setStatusFilter(e.target.value);
                  else if (activeTab === "trays") setTrayFilter(e.target.value);
                  else setRiskFilter(e.target.value);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-300 outline-none focus:border-slate-600"
              >
                {activeTab === "orders" ? (
                  <>
                    <option value="All">All statuses</option>
                    <option>Running</option>
                    <option>Compounding</option>
                    <option>Ordered</option>
                    <option>Holding</option>
                    <option>Scheduled</option>
                  </>
                ) : activeTab === "trays" ? (
                  <>
                    <option value="All">All states</option>
                    <option>Queued</option>
                    <option>Ready</option>
                    <option>Plated</option>
                    <option>Assembling</option>
                    <option>Assembled</option>
                    <option>Delivered</option>
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
          </div>
        </div>

        {/* active console */}
        {activeTab === "screening" && screeningConsole}
        {activeTab === "orders" && ordersConsole}
        {activeTab === "trays" && trayConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">MUST · GLIM · ASPEN · USP 797 alignment</span>
          <button onClick={() => addToast("Diet office census synced to trayline management system", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
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
