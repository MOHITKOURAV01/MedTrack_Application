import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, Battery,
  Bell, CheckCircle2, ChevronRight, Clock, Cpu, Download, Droplets, Eye, FileText,
  Filter, Flame, Gauge, Heart, HeartPulse, HelpCircle, Info, Layers, Lock,
  Monitor, Pause, Play, Plus, Power, Radio, RefreshCw, RotateCcw, Search,
  ShieldAlert, ShieldCheck, Siren, Sliders, SlidersHorizontal, Sparkles,
  Stethoscope, Thermometer, Timer, TrendingDown, TrendingUp, User, Users, Waves,
  Wind, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";

/* ------------------------------------------------------------------ */
/*  Clinical Seed Data & Presets (KDIGO CRRT Telemetry)                */
/* ------------------------------------------------------------------ */

const INITIAL_CRRT_PATIENTS = [
  {
    id: "CRRT-501",
    name: "Arthur Pendelton",
    mrn: "MRN-33910",
    age: 68,
    gender: "Male",
    weightKg: 82.5,
    diagnosis: "Septic Shock / KDIGO Stage 3 AKI / Refractory Acidosis",
    kdigoStage: "Stage 3",
    crrtMode: "CVVHDF",
    dialyzer: "AN69 ST150 Membrane (Surface 1.5 m²)",
    accessSite: "Right Internal Jugular Trialysis Catheter 13 Fr",
    bloodFlowQb: 220,
    dialysateQd: 1400,
    replacementPre: 600,
    replacementPost: 600,
    netUfrTarget: 150,
    actualUfr: 148,
    tmp: 145,
    pFilter: 185,
    pVenous: 75,
    pAccess: -80,
    effluentDose: 31.5,
    citrateRate: 240,
    calciumInfusion: 45,
    postFilterIca: 0.32,
    systemicIca: 1.18,
    serumCreatinine: 4.8,
    bun: 84,
    potassium: 5.6,
    bicarbonate: 16.5,
    lactate: 3.4,
    status: "Active Filtration",
    alerts: [
      { id: "alt-1", type: "warning", msg: "TMP rising: +25 mmHg over last 2h (Fibrin layering)", time: "6m ago" },
      { id: "alt-2", type: "info", msg: "Effluent dose target 30 mL/kg/h maintained", time: "18m ago" },
    ],
  },
  {
    id: "CRRT-502",
    name: "Helena Rostova",
    mrn: "MRN-44129",
    age: 54,
    gender: "Female",
    weightKg: 64.0,
    diagnosis: "Post-Cardiac Arrest AKI / Fluid Overload (+6.5 L)",
    kdigoStage: "Stage 3",
    crrtMode: "CVVH",
    dialyzer: "Polysulfone HF1000 (Surface 1.1 m²)",
    accessSite: "Right Femoral VasCath 13.5 Fr × 24cm",
    bloodFlowQb: 200,
    dialysateQd: 0,
    replacementPre: 1200,
    replacementPost: 600,
    netUfrTarget: 250,
    actualUfr: 250,
    tmp: 120,
    pFilter: 160,
    pVenous: 65,
    pAccess: -60,
    effluentDose: 32.0,
    citrateRate: 190,
    calciumInfusion: 38,
    postFilterIca: 0.29,
    systemicIca: 1.22,
    serumCreatinine: 3.6,
    bun: 62,
    potassium: 4.6,
    bicarbonate: 21.0,
    lactate: 2.1,
    status: "Stable Fluid Removal",
    alerts: [
      { id: "alt-3", type: "info", msg: "Negative fluid balance goal 2.5L/24h on track", time: "12m ago" },
    ],
  },
  {
    id: "CRRT-503",
    name: "Darius Sterling",
    mrn: "MRN-55823",
    age: 61,
    gender: "Male",
    weightKg: 95.0,
    diagnosis: "Severe Acute Pancreatitis / Hyperkalemia 6.8 mEq/L",
    kdigoStage: "Stage 3",
    crrtMode: "CVVHD",
    dialyzer: "Oxiris Endotoxin & Cytokine Adsorption Membrane",
    accessSite: "Left Femoral Extended 13.5 Fr × 28cm",
    bloodFlowQb: 250,
    dialysateQd: 2200,
    replacementPre: 0,
    replacementPost: 0,
    netUfrTarget: 100,
    actualUfr: 98,
    tmp: 215,
    pFilter: 260,
    pVenous: 110,
    pAccess: -120,
    effluentDose: 24.2,
    citrateRate: 280,
    calciumInfusion: 52,
    postFilterIca: 0.38,
    systemicIca: 1.09,
    serumCreatinine: 5.9,
    bun: 98,
    potassium: 6.8,
    bicarbonate: 13.2,
    lactate: 4.8,
    status: "High Transmembrane Pressure",
    alerts: [
      { id: "alt-4", type: "critical", msg: "TMP > 200 mmHg (215 mmHg) - High Filter Coagulation Risk", time: "2m ago" },
      { id: "alt-5", type: "critical", msg: "Severe Acidemia / Serum K+ 6.8 mEq/L", time: "5m ago" },
    ],
  },
  {
    id: "CRRT-504",
    name: "Miriam Al-Mansoor",
    mrn: "MRN-66718",
    age: 43,
    gender: "Female",
    weightKg: 58.0,
    diagnosis: "Hepatorenal Syndrome Type 1 / Encephalopathy",
    kdigoStage: "Stage 2",
    crrtMode: "CVVHDF",
    dialyzer: "AN69 ST100 Membrane",
    accessSite: "Right Internal Jugular 12 Fr × 16cm",
    bloodFlowQb: 180,
    dialysateQd: 1200,
    replacementPre: 400,
    replacementPost: 400,
    netUfrTarget: 80,
    actualUfr: 80,
    tmp: 95,
    pFilter: 130,
    pVenous: 55,
    pAccess: -50,
    effluentDose: 35.8,
    citrateRate: 170,
    calciumInfusion: 32,
    postFilterIca: 0.30,
    systemicIca: 1.25,
    serumCreatinine: 2.9,
    bun: 51,
    potassium: 4.1,
    bicarbonate: 23.5,
    lactate: 1.6,
    status: "Weaning Assessment",
    alerts: [
      { id: "alt-6", type: "info", msg: "Spontaneous urine output increasing: 35 mL/hr", time: "30m ago" },
    ],
  },
];

const KDIGO_BADGES = {
  "Stage 1": { label: "KDIGO 1", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  "Stage 2": { label: "KDIGO 2", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  "Stage 3": { label: "KDIGO 3", cls: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse" },
};

function calcTotalEffluent(qd, repPre, repPost, netUfr) {
  return qd + repPre + repPost + netUfr;
}

function calcEffluentDose(totalEffluent, weightKg) {
  if (!weightKg || weightKg <= 0) return 0;
  return Number((totalEffluent / weightKg).toFixed(1));
}

function calcFiltrationFraction(repPre, netUfr, qb) {
  const plasmaFlowPerHour = qb * 60 * 0.70;
  if (plasmaFlowPerHour <= 0) return 0;
  return Number((((repPre + netUfr) / plasmaFlowPerHour) * 100).toFixed(1));
}

export default function NephrologyCrrtStationPage() {
  const { toasts, addToast, removeToast } = useKindToasts();

  const [patients, setPatients] = useState(INITIAL_CRRT_PATIENTS);
  const [selectedId, setSelectedId] = useState(INITIAL_CRRT_PATIENTS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("ALL");
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);

  const [activeModal, setActiveModal] = useState(null);
  const [modalPatient, setModalPatient] = useState(null);

  const [editParams, setEditParams] = useState({
    bloodFlowQb: 220,
    dialysateQd: 1400,
    replacementPre: 600,
    replacementPost: 600,
    netUfrTarget: 150,
    citrateRate: 240,
    calciumInfusion: 45,
  });

  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedId) || patients[0];
  }, [patients, selectedId]);

  const totalEffluent = useMemo(() => {
    return calcTotalEffluent(
      activePatient.dialysateQd,
      activePatient.replacementPre,
      activePatient.replacementPost,
      activePatient.netUfrTarget
    );
  }, [activePatient]);

  const effluentDose = useMemo(() => {
    return calcEffluentDose(totalEffluent, activePatient.weightKg);
  }, [totalEffluent, activePatient.weightKg]);

  const filtrationFraction = useMemo(() => {
    return calcFiltrationFraction(
      activePatient.replacementPre,
      activePatient.netUfrTarget,
      activePatient.bloodFlowQb
    );
  }, [activePatient]);

  useEffect(() => {
    if (!isLiveSimulating) return;

    const interval = setInterval(() => {
      setPatients((prev) =>
        prev.map((pt) => {
          const tmpJitter = Math.floor(Math.random() * 3) - 1;
          const pFilterJitter = Math.floor(Math.random() * 3) - 1;
          const pVenousJitter = Math.floor(Math.random() * 3) - 1;

          return {
            ...pt,
            pFilter: Math.max(100, Math.min(320, pt.pFilter + pFilterJitter)),
            pVenous: Math.max(30, Math.min(180, pt.pVenous + pVenousJitter)),
            tmp: Math.max(60, Math.min(280, pt.tmp + tmpJitter)),
          };
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveSimulating]);

  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 30) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.06;
        const roller = Math.abs(Math.sin(t)) * 14 + Math.sin(3 * t) * 4;
        const y = h * 0.35 - roller;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.03;
        const tmpWave = Math.sin(t) * 8 + Math.cos(2 * t) * 4;
        const y = h * 0.75 - tmpWave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const sweepX = (offset * 3) % w;
      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.fillRect(sweepX, 0, 4, h);

      offset += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleOpenTitrate = (patient) => {
    setModalPatient(patient);
    setEditParams({
      bloodFlowQb: patient.bloodFlowQb,
      dialysateQd: patient.dialysateQd,
      replacementPre: patient.replacementPre,
      replacementPost: patient.replacementPost,
      netUfrTarget: patient.netUfrTarget,
      citrateRate: patient.citrateRate,
      calciumInfusion: patient.calciumInfusion,
    });
    setActiveModal("TITRATE_CRRT");
  };

  const handleSaveTitration = () => {
    if (!modalPatient) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== modalPatient.id) return p;
        const newTotalEffluent = calcTotalEffluent(
          Number(editParams.dialysateQd),
          Number(editParams.replacementPre),
          Number(editParams.replacementPost),
          Number(editParams.netUfrTarget)
        );
        const newEffluentDose = calcEffluentDose(newTotalEffluent, p.weightKg);

        return {
          ...p,
          bloodFlowQb: Number(editParams.bloodFlowQb),
          dialysateQd: Number(editParams.dialysateQd),
          replacementPre: Number(editParams.replacementPre),
          replacementPost: Number(editParams.replacementPost),
          netUfrTarget: Number(editParams.netUfrTarget),
          actualUfr: Number(editParams.netUfrTarget),
          citrateRate: Number(editParams.citrateRate),
          calciumInfusion: Number(editParams.calciumInfusion),
          effluentDose: newEffluentDose,
        };
      })
    );
    addToast(`CRRT prescription updated for ${modalPatient.name}.`, "info");
    setActiveModal(null);
  };

  const triggerProtocol = (protocolName) => {
    addToast(`Emergency protocol "${protocolName}" executed on ${activePatient.name}.`, "error");
    setActiveModal(null);
  };

  const handleExportCsv = () => {
    const header = [
      "Patient_ID", "Name", "MRN", "Age", "Weight_Kg", "KDIGO_Stage", "CRRT_Mode",
      "Blood_Flow_Qb_mL_min", "Total_Effluent_mL_hr", "Effluent_Dose_mL_kg_hr",
      "TMP_mmHg", "Filter_Pressure_mmHg", "Citrate_ACDA_mL_hr", "Calcium_Infusion_mL_hr",
      "Serum_Creatinine_mg_dL", "Serum_Potassium_mEq_L", "Status",
    ];

    const body = patients.map((p) => {
      const totEff = calcTotalEffluent(p.dialysateQd, p.replacementPre, p.replacementPost, p.netUfrTarget);
      return [
        p.id, p.name, p.mrn, p.age, p.weightKg, p.kdigoStage, p.crrtMode,
        p.bloodFlowQb, totEff, calcEffluentDose(totEff, p.weightKg),
        p.tmp, p.pFilter, p.citrateRate, p.calciumInfusion,
        p.serumCreatinine, p.potassium, p.status,
      ];
    });

    const rowCount = body.length;
    downloadCsv("Nephrology_CRRT_Telemetry_Export.csv", [header, ...body]);
    addToast(`CRRT audit dataset exported (${rowCount} patients).`, "info");
  };

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMode = filterMode === "ALL" || p.crrtMode === filterMode;
      return matchSearch && matchMode;
    });
  }, [patients, searchQuery, filterMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <KindToastTray toasts={toasts} onDismiss={removeToast} />

      {/* Top Header */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-transparent border border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-950/40">
              <Droplets className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Nephrology CRRT & Dialysis Command Station
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
                  <Activity className="h-3 w-3" /> KDIGO ICU Nephrology Level 1
                </span>
              </div>
              <p className="text-xs text-slate-400 sm:text-sm mt-0.5">
                Continuous Renal Replacement Therapy • Regional Citrate Anticoagulation (RCA) • TMP & Filter Surveillance
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsLiveSimulating((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              isLiveSimulating
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {isLiveSimulating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLiveSimulating ? "Pause Telemetry" : "Resume Telemetry"}
          </button>

          <button
            type="button"
            onClick={() => {
              setPatients(INITIAL_CRRT_PATIENTS);
              setSelectedId(INITIAL_CRRT_PATIENTS[0].id);
              addToast("Circuit telemetry reset to admission baseline.", "warn");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Baseline
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            <Download className="h-3.5 w-3.5" /> Export Audit CSV
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("EMERGENCY_PROTOCOLS")}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
          >
            <Siren className="h-3.5 w-3.5" /> Emergency Protocols
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* ---------------------------------------------------------- */}
        {/*  Left: circuit roster                                       */}
        {/* ---------------------------------------------------------- */}
        <aside className="xl:col-span-4 2xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Users className="h-4 w-4 text-cyan-400" /> Active Circuits
              </h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {filteredPatients.length} of {patients.length}
              </span>
            </div>

            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, MRN or diagnosis"
                aria-label="Search CRRT circuits"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none"
              />
            </label>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {["ALL", "CVVH", "CVVHD", "CVVHDF"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                    filterMode === mode
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {mode === "ALL" ? "All Modes" : mode}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredPatients.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
                  No circuit matches this filter.
                </p>
              )}

              {filteredPatients.map((p) => {
                const badge = KDIGO_BADGES[p.kdigoStage] || KDIGO_BADGES["Stage 1"];
                const critical = p.alerts.some((a) => a.type === "critical");
                const selected = p.id === selectedId;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    aria-pressed={selected}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{p.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {p.id} • {p.mrn} • {p.age}y {p.gender}
                        </p>
                      </div>
                      {critical ? (
                        <AlertOctagon className="h-4 w-4 shrink-0 text-rose-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                      )}
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-400">{p.diagnosis}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                        {p.crrtMode}
                      </span>
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] text-slate-400">
                        TMP {p.tmp}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Standards In Force
            </h2>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                KDIGO 2012 AKI — deliver 20–25 mL/kg/h, prescribe 25–30 to allow for downtime
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                RCA protocol — post-filter iCa 0.25–0.35 mmol/L, systemic iCa 1.10–1.30
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                Filtration fraction held below 25% to limit haemoconcentration
              </li>
            </ul>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/*  Right: selected circuit detail                             */}
        {/* ---------------------------------------------------------- */}
        <section className="xl:col-span-8 2xl:col-span-9 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <User className="h-4 w-4 text-cyan-400" /> {activePatient.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{activePatient.diagnosis}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {activePatient.dialyzer} • {activePatient.accessSite}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenTitrate(activePatient)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Titrate Prescription
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                icon={<Waves className="h-4 w-4" />}
                label="Total Effluent"
                value={`${totalEffluent}`}
                unit="mL/hr"
                tone="cyan"
              />
              <StatTile
                icon={<Gauge className="h-4 w-4" />}
                label="Effluent Dose"
                value={`${effluentDose}`}
                unit="mL/kg/hr"
                tone={effluentDose < 20 ? "rose" : effluentDose < 25 ? "amber" : "emerald"}
                note={effluentDose < 25 ? "Below KDIGO prescribed-dose target" : "Within KDIGO target"}
              />
              <StatTile
                icon={<Filter className="h-4 w-4" />}
                label="Filtration Fraction"
                value={`${filtrationFraction}`}
                unit="%"
                tone={filtrationFraction >= 25 ? "rose" : filtrationFraction >= 20 ? "amber" : "emerald"}
                note={filtrationFraction >= 25 ? "Haemoconcentration risk" : "Acceptable"}
              />
              <StatTile
                icon={<Thermometer className="h-4 w-4" />}
                label="Transmembrane Pressure"
                value={`${activePatient.tmp}`}
                unit="mmHg"
                tone={activePatient.tmp >= 200 ? "rose" : activePatient.tmp >= 150 ? "amber" : "emerald"}
                note={activePatient.tmp >= 200 ? "Clotting risk — prepare circuit change" : "Membrane patent"}
              />
            </div>
          </div>

          {/* Circuit pressure trace */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Monitor className="h-4 w-4 text-cyan-400" /> Extracorporeal Circuit Pressure Trace
              </h2>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                <span className={`inline-block h-2 w-2 rounded-full ${isLiveSimulating ? "animate-ping bg-emerald-500" : "bg-slate-600"}`} />
                {isLiveSimulating ? "SWEEP LIVE" : "SWEEP HELD"}
              </span>
            </div>

            <canvas
              ref={canvasRef}
              width={900}
              height={180}
              aria-label="Circuit pressure waveform"
              className="w-full rounded-xl border border-slate-800 bg-slate-950"
            />

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PressureReadout label="Access" value={activePatient.pAccess} unit="mmHg" hint="Target -50 to -150" />
              <PressureReadout label="Filter" value={activePatient.pFilter} unit="mmHg" hint="Alarm above 300" />
              <PressureReadout label="Venous Return" value={activePatient.pVenous} unit="mmHg" hint="Alarm above 200" />
              <PressureReadout label="Blood Flow Qb" value={activePatient.bloodFlowQb} unit="mL/min" hint="Prescribed" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* RCA anticoagulation */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Droplets className="h-4 w-4 text-amber-400" /> Regional Citrate Anticoagulation
              </h2>

              <dl className="space-y-2.5 text-xs">
                <LabRow label="Citrate (ACD-A)" value={`${activePatient.citrateRate} mL/hr`} />
                <LabRow label="Calcium Infusion" value={`${activePatient.calciumInfusion} mL/hr`} />
                <LabRow
                  label="Post-Filter iCa"
                  value={`${activePatient.postFilterIca} mmol/L`}
                  tone={activePatient.postFilterIca >= 0.25 && activePatient.postFilterIca <= 0.35 ? "emerald" : "amber"}
                  hint="Target 0.25–0.35"
                />
                <LabRow
                  label="Systemic iCa"
                  value={`${activePatient.systemicIca} mmol/L`}
                  tone={activePatient.systemicIca >= 1.1 && activePatient.systemicIca <= 1.3 ? "emerald" : "rose"}
                  hint="Target 1.10–1.30"
                />
              </dl>

              <p className="mt-3 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[11px] leading-snug text-slate-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                A rising total-to-ionised calcium ratio above 2.5 suggests citrate accumulation; reduce
                citrate before increasing calcium.
              </p>
            </div>

            {/* Metabolic panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <FileText className="h-4 w-4 text-cyan-400" /> Metabolic Panel
              </h2>

              <dl className="space-y-2.5 text-xs">
                <LabRow label="Serum Creatinine" value={`${activePatient.serumCreatinine} mg/dL`} tone="amber" />
                <LabRow label="Blood Urea Nitrogen" value={`${activePatient.bun} mg/dL`} tone="amber" />
                <LabRow
                  label="Potassium"
                  value={`${activePatient.potassium} mEq/L`}
                  tone={activePatient.potassium >= 6 ? "rose" : activePatient.potassium >= 5.3 ? "amber" : "emerald"}
                  hint="Critical at 6.0"
                />
                <LabRow
                  label="Bicarbonate"
                  value={`${activePatient.bicarbonate} mEq/L`}
                  tone={activePatient.bicarbonate < 18 ? "rose" : "emerald"}
                  hint="Target 22–26"
                />
                <LabRow
                  label="Lactate"
                  value={`${activePatient.lactate} mmol/L`}
                  tone={activePatient.lactate >= 4 ? "rose" : activePatient.lactate >= 2 ? "amber" : "emerald"}
                />
              </dl>
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Bell className="h-4 w-4 text-rose-400" /> Circuit Alerts
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {activePatient.alerts.length}
              </span>
            </h2>

            <ul className="space-y-2">
              {activePatient.alerts.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-800 px-3 py-5 text-center text-xs text-slate-500">
                  No active alerts on this circuit.
                </li>
              )}

              {activePatient.alerts.map((a) => (
                <li
                  key={a.id}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                    a.type === "critical"
                      ? "border-rose-500/40 bg-rose-950/30 text-rose-200"
                      : a.type === "warning"
                        ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
                        : "border-slate-700 bg-slate-950 text-slate-300"
                  }`}
                >
                  {a.type === "critical" ? (
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : a.type === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="flex-1 leading-snug">{a.msg}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Titration modal                                              */}
      {/* ------------------------------------------------------------ */}
      {activeModal === "TITRATE_CRRT" && modalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Titrate CRRT prescription"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-white">
                  <Sliders className="h-4 w-4 text-cyan-400" /> Titrate CRRT Prescription
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {modalPatient.name} • {modalPatient.id} • {modalPatient.weightKg} kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
              <ParamField label="Blood Flow Qb" unit="mL/min" field="bloodFlowQb" params={editParams} onChange={setEditParams} />
              <ParamField label="Dialysate Qd" unit="mL/hr" field="dialysateQd" params={editParams} onChange={setEditParams} />
              <ParamField label="Replacement Pre" unit="mL/hr" field="replacementPre" params={editParams} onChange={setEditParams} />
              <ParamField label="Replacement Post" unit="mL/hr" field="replacementPost" params={editParams} onChange={setEditParams} />
              <ParamField label="Net UF Rate" unit="mL/hr" field="netUfrTarget" params={editParams} onChange={setEditParams} />
              <ParamField label="Citrate (ACD-A)" unit="mL/hr" field="citrateRate" params={editParams} onChange={setEditParams} />
              <ParamField label="Calcium Infusion" unit="mL/hr" field="calciumInfusion" params={editParams} onChange={setEditParams} />
            </div>

            <div className="mx-5 mb-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">
                Projected effluent dose{" "}
                <span className="font-mono font-bold text-cyan-300">
                  {calcEffluentDose(
                    calcTotalEffluent(
                      Number(editParams.dialysateQd),
                      Number(editParams.replacementPre),
                      Number(editParams.replacementPost),
                      Number(editParams.netUfrTarget)
                    ),
                    modalPatient.weightKg
                  )}
                </span>{" "}
                mL/kg/hr, filtration fraction{" "}
                <span className="font-mono font-bold text-cyan-300">
                  {calcFiltrationFraction(
                    Number(editParams.replacementPre),
                    Number(editParams.netUfrTarget),
                    Number(editParams.bloodFlowQb)
                  )}
                </span>
                %
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTitration}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Apply Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Emergency protocol modal                                     */}
      {/* ------------------------------------------------------------ */}
      {activeModal === "EMERGENCY_PROTOCOLS" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Emergency protocols"
            className="w-full max-w-lg rounded-2xl border border-rose-800/60 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-white">
                <Siren className="h-4 w-4 text-rose-400" /> Emergency Protocols
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="px-5 pt-4 text-xs text-slate-400">
              Executing against <span className="font-semibold text-slate-200">{activePatient.name}</span>.
            </p>

            <div className="space-y-2 px-5 py-4">
              {EMERGENCY_PROTOCOLS.map((protocol) => (
                <button
                  key={protocol.name}
                  type="button"
                  onClick={() => triggerProtocol(protocol.name)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-left text-xs font-semibold text-rose-200 transition hover:bg-rose-950/40"
                >
                  <protocol.icon className="h-3.5 w-3.5 shrink-0" />
                  {protocol.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 border-t border-slate-800 pt-4 text-center text-[10px] text-slate-600">
        MedTrack Nephrology CRRT Command Station • Simulated telemetry for demonstration • Not for clinical use
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Local presentational helpers                                       */
/* ------------------------------------------------------------------ */

const EMERGENCY_PROTOCOLS = [
  { name: "Circuit Clotting — Return Blood & Change Filter", icon: RefreshCw },
  { name: "Citrate Accumulation — Stop Citrate, Switch To Heparin", icon: Droplets },
  { name: "Hyperkalaemia — Increase Qd, Zero-Potassium Dialysate", icon: Zap },
  { name: "Access Failure — Halt Pump & Reposition Catheter", icon: Power },
];

const TONE_CLASSES = {
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

/** Single headline metric with an optional interpretation line. */
function StatTile({ icon, label, value, unit, tone = "cyan", note }) {
  return (
    <div className={`rounded-xl border p-3 ${TONE_CLASSES[tone] || TONE_CLASSES.cyan}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-mono text-xl font-bold leading-none">
        {value}
        <span className="ml-1 text-[10px] font-normal opacity-70">{unit}</span>
      </p>
      {note && <p className="mt-1.5 text-[10px] leading-snug opacity-75">{note}</p>}
    </div>
  );
}

/** Circuit pressure readout with its alarm window as a hint. */
function PressureReadout({ label, value, unit, hint }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-base font-bold text-slate-100">
        {value}
        <span className="ml-1 text-[10px] font-normal text-slate-500">{unit}</span>
      </p>
      <p className="mt-0.5 text-[9px] text-slate-600">{hint}</p>
    </div>
  );
}

/** Label/value row with an optional reference range and tone. */
function LabRow({ label, value, tone, hint }) {
  const toneText =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "rose"
          ? "text-rose-300"
          : "text-slate-200";

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-400">
        {label}
        {hint && <span className="ml-1.5 text-[10px] text-slate-600">({hint})</span>}
      </dt>
      <dd className={`shrink-0 font-mono font-semibold ${toneText}`}>{value}</dd>
    </div>
  );
}

/** Numeric prescription input bound to one key of the titration draft. */
function ParamField({ label, unit, field, params, onChange }) {
  const inputId = `crrt-param-${field}`;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-[11px] font-semibold text-slate-400">
        {label} <span className="font-normal text-slate-600">({unit})</span>
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        value={params[field]}
        onChange={(e) => onChange((prev) => ({ ...prev, [field]: e.target.value }))}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500/60 focus:outline-none"
      />
    </div>
  );
}
