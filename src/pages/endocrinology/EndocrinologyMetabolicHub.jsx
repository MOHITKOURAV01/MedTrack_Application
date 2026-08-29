import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Calendar, CheckCircle2,
  ChevronRight, Clock, Cpu, Database, Download, Droplet, Eye, FileText, Filter,
  FlaskConical, Gauge, Heart, HeartPulse, Info, KeyRound, Layers, Lock, Network,
  Pause, Play, Plus, Radar, RefreshCw, Scale, Search, Server, ShieldAlert,
  ShieldCheck, Siren, Stethoscope, Syringe, Thermometer, Timer, TrendingDown,
  TrendingUp, User, Users, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import { ExportCsvButton } from "../../components/common/ExportButton";
import { downloadCsv } from "../../utils/csv";
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { CompactSearch } from "../../components/common/SearchBox";
import { FilterChips } from "../../components/common/FilterChips";
import { Row } from "../../components/common/InfoRow";
import { EmptyState } from "../../components/common/EmptyState";
import { ToneBadge } from "../../components/common/ToneBadge";
import { TabsBar } from "../../components/common/TabsBar";
import { SimpleModal as Modal } from "../../components/common/Modal";
import ToastTray, { useToastTray } from "../../components/common/ToastTray";
import { PageHeader, Footer } from "../../components/common/PageHeader";
import { SectionHeader, PanelHeader } from "../../components/common/SectionHeader";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const DIABETES_PATIENTS = [
  { id: "DM-001", name: "Robert Chen", age: 58, type: "Type 2 DM", a1c: 7.2, fastingGlucose: 142, lastVisit: "3d ago", regimen: "Metformin 1000mg BID + GLP-1 RA", pumpStatus: "No Pump", cgmDevice: "Dexcom G7", timeInRange: 68, hypoEvents: 2, riskScore: "Moderate", endocrinologist: "Dr. Sarah Kim", bmi: 31.2 },
  { id: "DM-002", name: "Maria Santos", age: 34, type: "Type 1 DM", a1c: 6.8, fastingGlucose: 118, lastVisit: "1d ago", regimen: "Insulin Pump (Tandem t:slim) + CGM", pumpStatus: "Active — Tandem t:slim X2", cgmDevice: "Dexcom G7", timeInRange: 74, hypoEvents: 1, riskScore: "Low", endocrinologist: "Dr. James Wright", bmi: 24.1 },
  { id: "DM-003", name: "Ahmed Al-Rashid", age: 67, type: "Type 2 DM", a1c: 9.1, fastingGlucose: 210, lastVisit: "7d ago", regimen: "Insulin Glargine + Sitagliptin", pumpStatus: "No Pump", cgmDevice: "Freestyle Libre 3", timeInRange: 42, hypoEvents: 5, riskScore: "High", endocrinologist: "Dr. Sarah Kim", bmi: 34.8 },
  { id: "DM-004", name: "Lisa Johansson", age: 29, type: "Type 1 DM", a1c: 7.0, fastingGlucose: 105, lastVisit: "2d ago", regimen: "Omnipod 5 + CGM Closed Loop", pumpStatus: "Active — Omnipod 5", cgmDevice: "Dexcom G7", timeInRange: 78, hypoEvents: 0, riskScore: "Low", endocrinologist: "Dr. James Wright", bmi: 22.3 },
  { id: "DM-005", name: "David Okafor", age: 72, type: "Type 2 DM", a1c: 8.5, fastingGlucose: 188, lastVisit: "5d ago", regimen: "Insulin Aspart + Empagliflozin", pumpStatus: "No Pump", cgmDevice: "Freestyle Libre 3", timeInRange: 51, hypoEvents: 3, riskScore: "High", endocrinologist: "Dr. Sarah Kim", bmi: 33.1 },
  { id: "DM-006", name: "Yuki Tanaka", age: 41, type: "Type 2 DM", a1c: 7.8, fastingGlucose: 155, lastVisit: "4d ago", regimen: "Metformin 1000mg BID + SGLT2i", pumpStatus: "No Pump", cgmDevice: "Dexcom G7", timeInRange: 62, hypoEvents: 1, riskScore: "Moderate", endocrinologist: "Dr. James Wright", bmi: 28.9 },
];

const THYROID_PATIENTS = [
  { id: "TH-001", name: "Anna Petrova", age: 45, condition: "Hashimoto's Thyroiditis", tsh: 3.8, freeT4: 0.9, freeT3: 2.4, antibody: "Anti-TPO 480 IU/mL", status: "Subclinical Hypothyroid", med: "Levothyroxine 75mcg", lastLabs: "2d ago", riskScore: "Low" },
  { id: "TH-002", name: "Michael Brooks", age: 52, condition: "Graves' Disease", tsh: 0.02, freeT4: 3.2, freeT3: 8.1, antibody: "TSI 380%", status: "Hyperthyroid — Active", med: "Methimazole 20mg", lastLabs: "1d ago", riskScore: "High" },
  { id: "TH-003", name: "Fatima Hassan", age: 38, condition: "Post-thyroidectomy", tsh: 0.8, freeT4: 1.2, freeT3: 3.1, antibody: "N/A — Surgical", status: "Euthyroid on Replacement", med: "Levothyroxine 125mcg", lastLabs: "5d ago", riskScore: "Low" },
  { id: "TH-004", name: "Carlos Mendez", age: 61, condition: "Toxic Multinodular Goiter", tsh: 0.15, freeT4: 2.4, freeT3: 5.8, antibody: "Negative", status: "Subclinical Hyperthyroid", med: "Methimazole 10mg", lastLabs: "3d ago", riskScore: "Moderate" },
  { id: "TH-005", name: "Rachel Green", age: 28, condition: "Subacute Thyroiditis", tsh: 5.2, freeT4: 0.7, freeT3: 1.8, antibody: "ESR 68 mm/hr", status: "Hypothyroid Phase", med: "Levothyroxine 50mcg (temp)", lastLabs: "1d ago", riskScore: "Moderate" },
];

const METABOLIC_PANELS = [
  { id: "MP-001", patient: "Robert Chen", glucose: 142, insulin: 18.2, homaIr: 6.4, cholesterol: 228, ldl: 142, hdl: 38, triglycerides: 218, crp: 4.2, ua: 7.8, egfr: 72, status: "Metabolic Syndrome", risk: "High" },
  { id: "MP-002", patient: "Maria Santos", glucose: 118, insulin: 8.1, homaIr: 2.3, cholesterol: 185, ldl: 105, hdl: 62, triglycerides: 95, crp: 0.8, ua: 5.1, egfr: 108, status: "Well-Controlled", risk: "Low" },
  { id: "MP-003", patient: "Ahmed Al-Rashid", glucose: 210, insulin: 24.5, homaIr: 12.8, cholesterol: 265, ldl: 178, hdl: 32, triglycerides: 285, crp: 8.1, ua: 9.2, egfr: 58, status: "Uncontrolled DM + Dyslipidemia", risk: "Critical" },
  { id: "MP-004", patient: "Lisa Johansson", glucose: 105, insulin: 6.8, homaIr: 1.7, cholesterol: 172, ldl: 92, hdl: 68, triglycerides: 62, crp: 0.4, ua: 4.2, egfr: 115, status: "Optimal", risk: "Low" },
  { id: "MP-005", patient: "David Okafor", glucose: 188, insulin: 22.1, homaIr: 10.3, cholesterol: 248, ldl: 162, hdl: 35, triglycerides: 248, crp: 6.5, ua: 8.9, egfr: 61, status: "Uncontrolled DM + CKD Stage 3", risk: "Critical" },
];

const INSULIN_PUMPS = [
  { id: "PUMP-001", patient: "Maria Santos", device: "Tandem t:slim X2", firmware: "v7.7.1", status: "Active", batteryLevel: 78, reservoirLevel: 45, iob: 3.2, currentBasal: 0.85, lastCalibration: "12m ago", ocAlerts: 0, cgmLink: "Dexcom G7", mode: "Control-IQ" },
  { id: "PUMP-002", patient: "Lisa Johansson", device: "Omnipod 5", firmware: "v3.2.0", status: "Active", batteryLevel: 92, reservoirLevel: 68, iob: 2.8, currentBasal: 0.72, lastCalibration: "8m ago", ocAlerts: 0, cgmLink: "Dexcom G7", mode: "Automated" },
  { id: "PUMP-003", patient: "Ahmed Al-Rashid", device: "Medtronic 780G", firmware: "v6.1.3", status: "Paused — Low Reservoir", batteryLevel: 34, reservoirLevel: 12, iob: 0, currentBasal: 0, lastCalibration: "2h ago", ocAlerts: 2, cgmLink: "Guardian 4", mode: "Manual" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Critical", "High", "At Risk", "Hyperthyroid", "Uncontrolled DM + Dyslipidemia", "Uncontrolled DM + CKD Stage 3", "Active — Hyperthyroid — Active"].includes(v)) return "red";
  if (["Moderate", "Subclinical Hypothyroid", "Subclinical Hyperthyroid", "Hypothyroid Phase", "Metabolic Syndrome", "Paused — Low Reservoir"].includes(v)) return "amber";
  if (["Low", "Healthy", "Well-Controlled", "Optimal", "Euthyroid on Replacement", "Active"].includes(v)) return "green";
  return "slate";
};

const Badge = ({ children }) => <ToneBadge toneOf={toneOf} tone={toneOf(children)}>{children}</ToneBadge>;

const Meter = ({ value, color = "bg-emerald-400" }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-800">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

/* ------------------------------------------------------------------ */
/*  Live simulation hook                                               */
/* ------------------------------------------------------------------ */

function useSimulation({ dmRef, thyroidRef, metabolicRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(true);
  const speedRef = useRef(1);
  const timerRef = useRef(null);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    setTick((tk) => tk + 1);

    // CGM glucose drift
    dmRef.current = dmRef.current.map((p) => {
      let fg = p.fastingGlucose + (Math.random() * 16 - 8);
      let tir = p.timeInRange + (Math.random() * 4 - 2);
      let hypo = p.hypoEvents;
      if (Math.random() < 0.03) hypo += 1;
      fg = Math.round(Math.min(350, Math.max(60, fg)));
      tir = Math.round(Math.min(100, Math.max(15, tir)));
      const risk = fg > 200 || tir < 50 ? "High" : fg > 160 || tir < 65 ? "Moderate" : "Low";
      return { ...p, fastingGlucose: fg, timeInRange: tir, hypoEvents: hypo, riskScore: risk };
    });

    // Thyroid drift
    thyroidRef.current = thyroidRef.current.map((t) => {
      let tsh = t.tsh + (Math.random() * 0.4 - 0.2);
      tsh = Math.round(Math.min(15, Math.max(0.01, tsh)) * 100) / 100;
      return { ...t, tsh };
    });

    // Metabolic panel drift
    metabolicRef.current = metabolicRef.current.map((m) => {
      let glucose = m.glucose + (Math.random() * 12 - 6);
      glucose = Math.round(Math.min(350, Math.max(60, glucose)));
      return { ...m, glucose };
    });

    // Alert event
    if (Math.random() < 0.1 * speedRef.current) {
      const alerts = [
        ["Hypoglycemia alert — BG < 70 mg/dL", "High"],
        ["Insulin pump occlusion detected", "High"],
        ["TSH out of range — review needed", "Moderate"],
        ["CGM sensor lost connection", "Moderate"],
        ["A1c trending upward over 3 months", "Moderate"],
      ];
      const pick = alerts[Math.floor(Math.random() * alerts.length)];
      toast(`${pick[0]} · ${pick[1]}`, pick[1]);
    }
  }, [dmRef, thyroidRef, metabolicRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    timerRef.current = iv;
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      dmRef.current = DIABETES_PATIENTS.map((p) => ({ ...p }));
      thyroidRef.current = THYROID_PATIENTS.map((t) => ({ ...t }));
      metabolicRef.current = METABOLIC_PANELS.map((m) => ({ ...m }));
      setTick(0);
      toast("Simulation reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function EndocrinologyMetabolicHub() {
  const [tab, setTab] = useState("diabetes");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [dmFilter, setDmFilter] = useState("All");
  const [thyroidFilter, setThyroidFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [diabetesPatients, setDiabetesPatients] = useState(() => DIABETES_PATIENTS.map((p) => ({ ...p })));
  const [thyroidPatients, setThyroidPatients] = useState(() => THYROID_PATIENTS.map((t) => ({ ...t })));
  const [metabolicPanels, setMetabolicPanels] = useState(() => METABOLIC_PANELS.map((m) => ({ ...m })));
  const [pumps] = useState(() => INSULIN_PUMPS.map((p) => ({ ...p })));

  const dmRef = useRef(diabetesPatients);
  const thyroidRef = useRef(thyroidPatients);
  const metabolicRef = useRef(metabolicPanels);

  useEffect(() => { dmRef.current = diabetesPatients; }, [diabetesPatients]);
  useEffect(() => { thyroidRef.current = thyroidPatients; }, [thyroidPatients]);
  useEffect(() => { metabolicRef.current = metabolicPanels; }, [metabolicPanels]);

  const sim = useSimulation({ dmRef, thyroidRef, metabolicRef, toast });

  useEffect(() => {
    setDiabetesPatients([...dmRef.current]);
    setThyroidPatients([...thyroidRef.current]);
    setMetabolicPanels([...metabolicRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const highRisk = diabetesPatients.filter((p) => p.riskScore === "High").length;
    const avgA1c = (diabetesPatients.reduce((a, p) => a + p.a1c, 0) / Math.max(1, diabetesPatients.length)).toFixed(1);
    const avgTIR = Math.round(diabetesPatients.reduce((a, p) => a + p.timeInRange, 0) / Math.max(1, diabetesPatients.length));
    const hyperthyroid = thyroidPatients.filter((t) => t.tsh < 0.1).length;
    const pumpAlerts = pumps.reduce((a, p) => a + p.ocAlerts, 0);
    return { highRisk, avgA1c, avgTIR, hyperthyroid, pumpAlerts };
  }, [diabetesPatients, thyroidPatients, pumps]);

  /* ---------- filters ---------- */
  const filteredDM = useMemo(() => {
    return diabetesPatients.filter((p) => {
      const q = query.toLowerCase();
      const matchQ = !q || [p.name, p.type, p.regimen, p.endocrinologist].some((s) => s.toLowerCase().includes(q));
      const matchR = dmFilter === "All" || p.riskScore === dmFilter;
      return matchQ && matchR;
    });
  }, [diabetesPatients, query, dmFilter]);

  const filteredThyroid = useMemo(() => {
    return thyroidPatients.filter((t) => {
      const q = query.toLowerCase();
      const matchQ = !q || [t.name, t.condition, t.med].some((s) => s.toLowerCase().includes(q));
      const matchT = thyroidFilter === "All" || t.status.includes(thyroidFilter);
      return matchQ && matchT;
    });
  }, [thyroidPatients, query, thyroidFilter]);

  const filteredMetabolic = useMemo(() => {
    return metabolicPanels.filter((m) => {
      const q = query.toLowerCase();
      const matchQ = !q || [m.patient, m.status].some((s) => s.toLowerCase().includes(q));
      const matchR = riskFilter === "All" || m.risk === riskFilter;
      return matchQ && matchR;
    });
  }, [metabolicPanels, query, riskFilter]);

  /* ---------- actions ---------- */
  const exportCsv = () => {
    const rows =
      tab === "diabetes"
        ? [["ID", "Name", "Age", "Type", "A1c", "Glucose", "TIR%", "Hypo", "Regimen", "Pump", "Risk"], ...filteredDM.map((p) => [p.id, p.name, p.age, p.type, p.a1c, p.fastingGlucose, p.timeInRange, p.hypoEvents, p.regimen, p.pumpStatus, p.riskScore])]
        : tab === "thyroid"
        ? [["ID", "Name", "Age", "Condition", "TSH", "Free T4", "Free T3", "Antibody", "Status", "Medication", "Risk"], ...filteredThyroid.map((t) => [t.id, t.name, t.age, t.condition, t.tsh, t.freeT4, t.freeT3, t.antibody, t.status, t.med, t.riskScore])]
        : tab === "metabolic"
        ? [["Patient", "Glucose", "Insulin", "HOMA-IR", "Cholesterol", "LDL", "HDL", "Triglycerides", "CRP", "UA", "eGFR", "Status", "Risk"], ...filteredMetabolic.map((m) => [m.patient, m.glucose, m.insulin, m.homaIr, m.cholesterol, m.ldl, m.hdl, m.triglycerides, m.crp, m.ua, m.egfr, m.status, m.risk])]
        : [["Patient", "Device", "Firmware", "Status", "Battery", "Reservoir", "IOB", "Basal", "Mode", "Alerts"], ...pumps.map((p) => [p.patient, p.device, p.firmware, p.status, p.batteryLevel, p.reservoirLevel, p.iob, p.currentBasal, p.mode, p.ocAlerts])];
    downloadCsv(`endo-metabolic-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "diabetes", label: "Diabetes Management", icon: Droplet },
    { id: "thyroid", label: "Thyroid Disorders", icon: Activity },
    { id: "metabolic", label: "Metabolic Panel", icon: FlaskConical },
    { id: "pumps", label: "Insulin Pump Monitor", icon: Syringe },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <ToastTray toasts={toasts} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<Stethoscope size={24} className="text-emerald-400" />}
            title="Endocrinology &amp; Metabolic Medicine Hub"
            subtitle="Diabetes management · Thyroid disorders · Metabolic panels · Insulin pump monitoring — ADA Standards of Care 2026"
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
                  {s}x
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
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={Droplet} label="Avg A1c" value={stats.avgA1c + "%"} sub={`${diabetesPatients.length} DM patients`} accent={parseFloat(stats.avgA1c) > 8 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Gauge} label="Avg Time in Range" value={`${stats.avgTIR}%`} sub="target > 70%" accent={stats.avgTIR >= 70 ? "text-emerald-400" : "text-amber-400"} />
          <StatCard icon={ShieldAlert} label="High-Risk DM" value={stats.highRisk} sub="requires intervention" accent={stats.highRisk > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Activity} label="Hyperthyroid" value={stats.hyperthyroid} sub="TSH < 0.1" accent={stats.hyperthyroid > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Syringe} label="Pump Alerts" value={stats.pumpAlerts} sub="active device issues" accent={stats.pumpAlerts > 0 ? "text-amber-400" : "text-emerald-400"} />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search patients, conditions, medications..." />
          {tab === "diabetes" && (
            <FilterChips label="Filter diabetes patients by risk" options={["All", "Low", "Moderate", "High"]} value={dmFilter} onChange={setDmFilter} />
          )}
          {tab === "thyroid" && (
            <FilterChips label="Filter thyroid patients by state" options={["All", "Hypothyroid", "Hyperthyroid", "Euthyroid"]} value={thyroidFilter} onChange={setThyroidFilter} />
          )}
          {tab === "metabolic" && (
            <FilterChips label="Filter metabolic patients by risk" options={["All", "Low", "High", "Critical"]} value={riskFilter} onChange={setRiskFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= DIABETES TAB ================= */}
        {tab === "diabetes" && (
          <div className="space-y-6">
            {/* diabetes patients */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Droplet size={16} className="text-red-400" />}
                title="Diabetes Patient Registry"
                badge={`${filteredDM.length} patients`}
                right="ADA Standards of Care 2026 · CGM-integrated"
              />
              {filteredDM.length === 0 ? (
                <EmptyState icon={Droplet} message="No diabetes patients match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Patient</th>
                        <th className="px-4 py-3">A1c</th>
                        <th className="px-4 py-3">Glucose</th>
                        <th className="px-4 py-3">TIR</th>
                        <th className="px-4 py-3">Hypo Events</th>
                        <th className="px-4 py-3">Pump / CGM</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDM.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="text-left" onClick={() => setModal({ kind: "dm", data: p })}>
                              <p className="font-medium text-slate-200">{p.name}</p>
                              <p className="text-[10px] text-slate-500">{p.id} · {p.type} · Age {p.age}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${p.a1c <= 7 ? "text-emerald-400" : p.a1c <= 8 ? "text-amber-400" : "text-red-400"}`}>{p.a1c}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${p.fastingGlucose <= 130 ? "text-emerald-400" : p.fastingGlucose <= 180 ? "text-amber-400" : "text-red-400"}`}>{p.fastingGlucose}</span>
                            <span className="text-[10px] text-slate-500"> mg/dL</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${p.timeInRange >= 70 ? "text-emerald-400" : p.timeInRange >= 50 ? "text-amber-400" : "text-red-400"}`}>{p.timeInRange}%</span>
                              <Meter value={p.timeInRange} color={p.timeInRange >= 70 ? "bg-emerald-400" : p.timeInRange >= 50 ? "bg-amber-400" : "bg-red-400"} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${p.hypoEvents === 0 ? "text-emerald-400" : p.hypoEvents <= 2 ? "text-amber-400" : "text-red-400"}`}>{p.hypoEvents}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-300">{p.pumpStatus === "No Pump" ? "MDI" : p.pumpStatus.split("—")[1]?.trim()}</p>
                            <p className="text-[10px] text-slate-500">{p.cgmDevice}</p>
                          </td>
                          <td className="px-4 py-3"><Badge>{p.riskScore}</Badge></td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setModal({ kind: "dm", data: p })}
                              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                            >
                              Inspect
                            </button>
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

        {/* ================= THYROID TAB ================= */}
        {tab === "thyroid" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Activity size={16} className="text-sky-400" />}
                title="Thyroid Disorder Registry"
                badge={`${filteredThyroid.length} patients`}
                right="ATA Guidelines · TSH / Free T4 / Free T3 monitoring"
              />
              {filteredThyroid.length === 0 ? (
                <EmptyState icon={Activity} message="No thyroid patients match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Patient</th>
                        <th className="px-4 py-3">Condition</th>
                        <th className="px-4 py-3">TSH</th>
                        <th className="px-4 py-3">Free T4</th>
                        <th className="px-4 py-3">Free T3</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Medication</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredThyroid.map((t) => (
                        <tr key={t.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="text-left" onClick={() => setModal({ kind: "thyroid", data: t })}>
                              <p className="font-medium text-slate-200">{t.name}</p>
                              <p className="text-[10px] text-slate-500">{t.id} · Age {t.age}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{t.condition}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${t.tsh >= 0.4 && t.tsh <= 4.0 ? "text-emerald-400" : t.tsh < 0.1 || t.tsh > 10 ? "text-red-400" : "text-amber-400"}`}>{t.tsh}</span>
                            <span className="text-[10px] text-slate-500"> mIU/L</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${t.freeT4 >= 0.8 && t.freeT4 <= 1.8 ? "text-emerald-400" : "text-amber-400"}`}>{t.freeT4}</span>
                            <span className="text-[10px] text-slate-500"> ng/dL</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-slate-300">{t.freeT3}</span>
                            <span className="text-[10px] text-slate-500"> pg/mL</span>
                          </td>
                          <td className="px-4 py-3"><Badge>{t.status}</Badge></td>
                          <td className="px-4 py-3 text-slate-400">{t.med}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setModal({ kind: "thyroid", data: t })}
                              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                            >
                              Inspect
                            </button>
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

        {/* ================= METABOLIC TAB ================= */}
        {tab === "metabolic" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<FlaskConical size={16} className="text-amber-400" />}
                title="Metabolic Panel Analytics"
                badge={`${filteredMetabolic.length} panels`}
                right="Comprehensive metabolic panel · HOMA-IR · Lipid profile"
              />
              {filteredMetabolic.length === 0 ? (
                <EmptyState icon={FlaskConical} message="No metabolic panels match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Patient</th>
                        <th className="px-4 py-3">Glucose</th>
                        <th className="px-4 py-3">HOMA-IR</th>
                        <th className="px-4 py-3">LDL</th>
                        <th className="px-4 py-3">HDL</th>
                        <th className="px-4 py-3">TG</th>
                        <th className="px-4 py-3">CRP</th>
                        <th className="px-4 py-3">eGFR</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMetabolic.map((m) => (
                        <tr key={m.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="text-left" onClick={() => setModal({ kind: "metabolic", data: m })}>
                              <p className="font-medium text-slate-200">{m.patient}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.glucose <= 130 ? "text-emerald-400" : m.glucose <= 180 ? "text-amber-400" : "text-red-400"}`}>{m.glucose}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.homaIr <= 2.5 ? "text-emerald-400" : m.homaIr <= 5 ? "text-amber-400" : "text-red-400"}`}>{m.homaIr}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.ldl <= 100 ? "text-emerald-400" : m.ldl <= 160 ? "text-amber-400" : "text-red-400"}`}>{m.ldl}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.hdl >= 60 ? "text-emerald-400" : m.hdl >= 40 ? "text-amber-400" : "text-red-400"}`}>{m.hdl}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.triglycerides <= 150 ? "text-emerald-400" : m.triglycerides <= 200 ? "text-amber-400" : "text-red-400"}`}>{m.triglycerides}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.crp <= 1 ? "text-emerald-400" : m.crp <= 3 ? "text-amber-400" : "text-red-400"}`}>{m.crp}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.egfr >= 90 ? "text-emerald-400" : m.egfr >= 60 ? "text-amber-400" : "text-red-400"}`}>{m.egfr}</span>
                          </td>
                          <td className="px-4 py-3"><Badge>{m.status}</Badge></td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setModal({ kind: "metabolic", data: m })}
                              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                            >
                              Inspect
                            </button>
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

        {/* ================= PUMP TAB ================= */}
        {tab === "pumps" && (
          <div className="space-y-6">
            <section>
              <PanelHeader
                icon={<Syringe size={16} className="text-sky-400" />}
                title="Insulin Pump Fleet Monitor"
                badge={`${pumps.length} active devices`}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pumps.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setModal({ kind: "pump", data: p })}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-sky-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Syringe size={15} className="text-sky-400" />
                        <span className="text-[11px] font-bold tracking-wide text-slate-300">{p.device}</span>
                      </div>
                      <Badge>{p.status.split("—")[0].trim()}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-200">{p.patient}</p>
                    <p className="text-[10px] text-slate-500">{p.firmware} · {p.mode}</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Battery</span>
                        <span>{p.batteryLevel}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${p.batteryLevel > 50 ? "bg-emerald-400" : p.batteryLevel > 20 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${p.batteryLevel}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Reservoir</span>
                        <span>{p.reservoirLevel}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${p.reservoirLevel > 30 ? "bg-sky-400" : "bg-red-400"}`} style={{ width: `${p.reservoirLevel}%` }} />
                      </div>
                      <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                        <span>IOB: {p.iob}u</span>
                        <span>{p.ocAlerts} alerts</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "dm" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.type}`} onClose={() => setModal(null)}>
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <Droplet size={18} className="text-red-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Time in Range</span>
                <span className={`text-lg font-bold ${modal.data.timeInRange >= 70 ? "text-emerald-400" : "text-amber-400"}`}>{modal.data.timeInRange}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${modal.data.timeInRange >= 70 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${modal.data.timeInRange}%` }} />
              </div>
            </div>
          </div>
          <Row label="A1c" value={`${modal.data.a1c}%`} accent={modal.data.a1c <= 7 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Fasting Glucose" value={`${modal.data.fastingGlucose} mg/dL`} />
          <Row label="Hypo Events (30d)" value={String(modal.data.hypoEvents)} />
          <Row label="Regimen" value={modal.data.regimen} />
          <Row label="Pump" value={modal.data.pumpStatus} />
          <Row label="CGM" value={modal.data.cgmDevice} />
          <Row label="Endocrinologist" value={modal.data.endocrinologist} />
          <Row label="BMI" value={String(modal.data.bmi)} />
          <Row label="Risk Score" value={modal.data.riskScore} accent={modal.data.riskScore === "High" ? "text-red-400" : "text-amber-400"} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Management per ADA Standards of Care 2026: A1c target &lt;7% for most adults, TIR &gt;70%, hypoglycemia &lt;4% time below 70 mg/dL. CGM-integrated insulin dosing recommended for T1D and intensively treated T2D.
          </p>
        </Modal>
      )}

      {modal?.kind === "thyroid" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.condition}`} onClose={() => setModal(null)}>
          <Row label="TSH" value={`${modal.data.tsh} mIU/L`} accent={modal.data.tsh >= 0.4 && modal.data.tsh <= 4.0 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Free T4" value={`${modal.data.freeT4} ng/dL`} />
          <Row label="Free T3" value={`${modal.data.freeT3} pg/mL`} />
          <Row label="Antibody" value={modal.data.antibody} />
          <Row label="Status" value={modal.data.status} />
          <Row label="Medication" value={modal.data.med} />
          <Row label="Last Labs" value={modal.data.lastLabs} />
          <Row label="Risk" value={modal.data.riskScore} accent={modal.data.riskScore === "High" ? "text-red-400" : "text-amber-400"} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Thyroid management per ATA Guidelines: TSH target 0.4–4.0 mIU/L for most patients. Levothyroxine dosing adjusted in 12.5–25 mcg increments every 6–8 weeks. Graves' disease monitored with TSI antibodies and bone density screening.
          </p>
        </Modal>
      )}

      {modal?.kind === "metabolic" && (
        <Modal title={modal.data.patient} subtitle={`${modal.data.id} · Metabolic Panel`} onClose={() => setModal(null)}>
          <Row label="Glucose" value={`${modal.data.glucose} mg/dL`} accent={modal.data.glucose <= 130 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Insulin" value={`${modal.data.insulin} μU/mL`} />
          <Row label="HOMA-IR" value={String(modal.data.homaIr)} accent={modal.data.homaIr <= 2.5 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Total Cholesterol" value={`${modal.data.cholesterol} mg/dL`} />
          <Row label="LDL" value={`${modal.data.ldl} mg/dL`} accent={modal.data.ldl <= 100 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="HDL" value={`${modal.data.hdl} mg/dL`} accent={modal.data.hdl >= 60 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Triglycerides" value={`${modal.data.triglycerides} mg/dL`} />
          <Row label="CRP" value={`${modal.data.crp} mg/L`} accent={modal.data.crp <= 1 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Uric Acid" value={`${modal.data.ua} mg/dL`} />
          <Row label="eGFR" value={`${modal.data.egfr} mL/min`} accent={modal.data.egfr >= 90 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Status" value={modal.data.status} />
          <Row label="Risk" value={modal.data.risk} accent={modal.data.risk === "Critical" ? "text-red-400" : "text-amber-400"} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Metabolic syndrome diagnosed when 3+ of: waist &gt;102cm (M) / &gt;88cm (F), TG &gt;150, HDL &lt;40 (M) / &lt;50 (F), BP &gt;130/85, fasting glucose &gt;100. HOMA-IR &gt;2.5 indicates insulin resistance.
          </p>
        </Modal>
      )}

      {modal?.kind === "pump" && (
        <Modal title={modal.data.device} subtitle={`${modal.data.patient} · ${modal.data.firmware}`} onClose={() => setModal(null)}>
          <Row label="Status" value={modal.data.status} accent={modal.data.status.includes("Paused") ? "text-amber-400" : "text-emerald-400"} />
          <Row label="Mode" value={modal.data.mode} />
          <Row label="Battery" value={`${modal.data.batteryLevel}%`} accent={modal.data.batteryLevel > 50 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Reservoir" value={`${modal.data.reservoirLevel}%`} accent={modal.data.reservoirLevel > 30 ? "text-emerald-400" : "text-red-400"} />
          <Row label="Insulin on Board" value={`${modal.data.iob} units`} />
          <Row label="Current Basal Rate" value={`${modal.data.currentBasal} U/hr`} />
          <Row label="CGM Link" value={modal.data.cgmLink} />
          <Row label="Last Calibration" value={modal.data.lastCalibration} />
          <Row label="Active Alerts" value={String(modal.data.ocAlerts)} accent={modal.data.ocAlerts > 0 ? "text-amber-400" : "text-emerald-400"} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Closed-loop insulin delivery systems combine CGM data with automated basal/bolus adjustments. Control-IQ and Omnipod 5 algorithms target TIR &gt;70% with automated correction boluses when glucose exceeds target range.
          </p>
        </Modal>
      )}

      <Footer>
        Endocrinology &amp; Metabolic Medicine Hub — simulation environment · Diabetes management, thyroid disorders, metabolic panels, insulin pump monitoring (ADA 2026, ATA Guidelines)
      </Footer>
    </div>
  );
}
