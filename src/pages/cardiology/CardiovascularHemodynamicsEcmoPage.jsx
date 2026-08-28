import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, Battery,
  Bell, CheckCircle2, ChevronRight, Clock, Cpu, Download, Droplets, Eye, FileText,
  Filter, Flame, Gauge, Heart, HeartHandshake, HeartPulse, HelpCircle, Info,
  Layers, Lock, Monitor, Pause, Play, Plus, Power, Radio, RefreshCw, RotateCcw,
  Search, ShieldAlert, ShieldCheck, Siren, Sliders, SlidersHorizontal, Sparkles,
  Stethoscope, Thermometer, Timer, TrendingDown, TrendingUp, User, Users, Waves,
  Wind, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard, MiniStat as Vital } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Clinical Seed Data & Presets                                       */
/* ------------------------------------------------------------------ */

const INITIAL_PATIENTS = [
  {
    id: "HEMO-101",
    name: "Eleanor Vance",
    mrn: "MRN-88219",
    age: 62,
    gender: "Female",
    bsa: 1.78, // m^2
    diagnosis: "Acute STEMI s/p PCI with Cardiogenic Shock",
    scaiStage: "D", // SCAI Shock Stage: Deteriorating
    ecmoMode: "VA-ECMO",
    cannulation: "Femoral-Femoral (21 Fr venous / 15 Fr arterial + 6 Fr DPC)",
    rpm: 3850,
    flowLpm: 4.4,
    sweepGasLpm: 4.0,
    fio2Pct: 100,
    pPre: 240, // Pre-membrane pressure mmHg
    pPost: 205, // Post-membrane pressure mmHg
    pVenous: -45, // Drainage pressure mmHg
    hr: 108,
    map: 64,
    sys: 88,
    dia: 52,
    cvp: 16,
    mPap: 34,
    pcwp: 22,
    co: 2.1, // Native L/min
    svo2: 58, // %
    lactate: 4.2, // mmol/L
    act: 195, // seconds (target 180-220)
    antiXa: 0.38, // IU/mL
    heparinRate: 14, // units/kg/hr
    tempC: 36.4,
    dpcFlow: "Patent (Doppler biphasic)",
    status: "Critical - Unstable",
    alerts: [
      { id: "alt-1", type: "critical", msg: "CPO < 0.6 W (0.41 W) - Inotropic Escalate", time: "2m ago" },
      { id: "alt-2", type: "warning", msg: "Delta-P Oxygenator Gradient approaching 35 mmHg", time: "8m ago" },
    ],
  },
  {
    id: "HEMO-102",
    name: "Marcus Thorne",
    mrn: "MRN-99402",
    age: 49,
    gender: "Male",
    bsa: 2.15,
    diagnosis: "Severe Viral ARDS / Refractory Hypoxemia",
    scaiStage: "B",
    ecmoMode: "VV-ECMO",
    cannulation: "Right Internal Jugular Dual-Lumen Crescent (31 Fr)",
    rpm: 3400,
    flowLpm: 5.1,
    sweepGasLpm: 6.5,
    fio2Pct: 90,
    pPre: 195,
    pPost: 175,
    pVenous: -30,
    hr: 86,
    map: 82,
    sys: 118,
    dia: 64,
    cvp: 12,
    mPap: 28,
    pcwp: 14,
    co: 5.4,
    svo2: 74,
    lactate: 1.8,
    act: 210,
    antiXa: 0.42,
    heparinRate: 12,
    tempC: 37.1,
    dpcFlow: "N/A (VV config)",
    status: "Stable on Support",
    alerts: [
      { id: "alt-3", type: "info", msg: "Sweep titration target PaCO2 40 mmHg achieved", time: "14m ago" },
    ],
  },
  {
    id: "HEMO-103",
    name: "Sophia Chen",
    mrn: "MRN-77314",
    age: 38,
    gender: "Female",
    bsa: 1.62,
    diagnosis: "Post-Cardiotomy Shock / Failed CPB Wean",
    scaiStage: "E", // SCAI Extremis
    ecmoMode: "VA-ECMO",
    cannulation: "Central Cannulation (Ascending Aorta 20 Fr / RA 28 Fr)",
    rpm: 4200,
    flowLpm: 4.8,
    sweepGasLpm: 5.0,
    fio2Pct: 100,
    pPre: 290,
    pPost: 235,
    pVenous: -65,
    hr: 122,
    map: 58,
    sys: 76,
    dia: 49,
    cvp: 21,
    mPap: 42,
    pcwp: 28,
    co: 1.6,
    svo2: 49,
    lactate: 6.8,
    act: 165,
    antiXa: 0.24,
    heparinRate: 18,
    tempC: 35.8,
    dpcFlow: "N/A (Central)",
    status: "Extremis - Emergent",
    alerts: [
      { id: "alt-4", type: "critical", msg: "High Delta-P (55 mmHg) - Possible Oxygenator Thrombus", time: "1m ago" },
      { id: "alt-5", type: "critical", msg: "Severe LVEDP overload / PA Wedge > 25 mmHg", time: "5m ago" },
    ],
  },
  {
    id: "HEMO-104",
    name: "Julian Rivera",
    mrn: "MRN-66120",
    age: 57,
    gender: "Male",
    bsa: 1.94,
    diagnosis: "Dilated Cardiomyopathy / Bridge to LVAD/Heart Transplant",
    scaiStage: "C", // Classic Shock
    ecmoMode: "VA-ECMO",
    cannulation: "Axillary Artery Hemashield Graft 8mm / Femoral Vein 25 Fr",
    rpm: 3600,
    flowLpm: 3.8,
    sweepGasLpm: 3.5,
    fio2Pct: 80,
    pPre: 210,
    pPost: 190,
    pVenous: -40,
    hr: 78,
    map: 74,
    sys: 104,
    dia: 59,
    cvp: 14,
    mPap: 31,
    pcwp: 18,
    co: 2.8,
    svo2: 66,
    lactate: 2.3,
    act: 205,
    antiXa: 0.40,
    heparinRate: 11,
    tempC: 36.9,
    dpcFlow: "Patent (Right arm intact)",
    status: "Weaning Assessment",
    alerts: [
      { id: "alt-6", type: "info", msg: "TTE aortic valve opening confirmed every 3 beats", time: "22m ago" },
    ],
  },
];

const SCAI_BADGES = {
  A: { label: "SCAI A: At Risk", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  B: { label: "SCAI B: Beginning", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  C: { label: "SCAI C: Classic", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  D: { label: "SCAI D: Deteriorating", cls: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse" },
  E: { label: "SCAI E: Extremis", cls: "bg-red-600/30 text-red-200 border-red-500/60 animate-bounce" },
};

/* ------------------------------------------------------------------ */
/*  Calculation Helpers (Clinical Math)                               */
/* ------------------------------------------------------------------ */

// Cardiac Power Output (CPO) in Watts = (MAP * CO) / 451
function calcCpo(map, co) {
  if (!map || !co) return 0;
  return Number(((map * co) / 451).toFixed(2));
}

// Cardiac Index (CI) in L/min/m^2 = CO / BSA
function calcCi(co, bsa) {
  if (!co || !bsa) return 0;
  return Number((co / bsa).toFixed(2));
}

// Systemic Vascular Resistance (SVR) in dynes*sec/cm^5 = ((MAP - CVP) * 80) / CO
function calcSvr(map, cvp, co) {
  if (!co || co <= 0) return 0;
  return Math.round(((map - cvp) * 80) / co);
}

// Pulmonary Vascular Resistance (PVR) in dynes*sec/cm^5 = ((mPAP - PCWP) * 80) / CO
function calcPvr(mPap, pcwp, co) {
  if (!co || co <= 0) return 0;
  return Math.round(((mPap - pcwp) * 80) / co);
}

// Transmembrane Pressure Gradient Delta-P = P_pre - P_post (mmHg)
function calcDeltaP(pPre, pPost) {
  return pPre - pPost;
}

export default function CardiovascularHemodynamicsEcmoPage() {
  const { toasts, addToast, removeToast } = useKindToasts();

  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [selectedId, setSelectedId] = useState(INITIAL_PATIENTS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("ALL"); // ALL, VA-ECMO, VV-ECMO
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);

  // Protocols & Inspect Modals
  const [activeModal, setActiveModal] = useState(null); // 'CODE_ECMO', 'DELTA_P_SWAP', 'WEAN_TRIAL', 'HEMO_ADJUST', 'INSPECTOR'
  const [modalPatient, setModalPatient] = useState(null);

  // Parameter adjustments draft
  const [editParams, setEditParams] = useState({
    rpm: 3800,
    sweepGasLpm: 4.0,
    fio2Pct: 100,
    map: 65,
    co: 2.2,
    cvp: 16,
    mPap: 34,
    pcwp: 22,
    heparinRate: 14,
  });

  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedId) || patients[0];
  }, [patients, selectedId]);

  // Derived calculations for active patient
  const totalCardiacOutput = useMemo(() => {
    // Total perfusion = Native CO + ECMO Circuit Flow
    return Number((activePatient.co + (activePatient.ecmoMode === "VA-ECMO" ? activePatient.flowLpm : 0)).toFixed(2));
  }, [activePatient]);

  const activeCpo = useMemo(() => {
    return calcCpo(activePatient.map, totalCardiacOutput);
  }, [activePatient.map, totalCardiacOutput]);

  const activeCi = useMemo(() => {
    return calcCi(totalCardiacOutput, activePatient.bsa);
  }, [totalCardiacOutput, activePatient.bsa]);

  const activeSvr = useMemo(() => {
    return calcSvr(activePatient.map, activePatient.cvp, totalCardiacOutput);
  }, [activePatient.map, activePatient.cvp, totalCardiacOutput]);

  const activePvr = useMemo(() => {
    return calcPvr(activePatient.mPap, activePatient.pcwp, activePatient.co);
  }, [activePatient.mPap, activePatient.pcwp, activePatient.co]);

  const deltaP = useMemo(() => {
    return calcDeltaP(activePatient.pPre, activePatient.pPost);
  }, [activePatient.pPre, activePatient.pPost]);

  /* ------------------------------------------------------------------ */
  /*  Live Simulation Ticker (Hemodynamic Fluctuations)                  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!isLiveSimulating) return;

    const interval = setInterval(() => {
      setPatients((prev) =>
        prev.map((pt) => {
          // Slight physiological variation
          const hrDelta = Math.floor(Math.random() * 3) - 1;
          const mapDelta = Math.floor(Math.random() * 3) - 1;
          const flowJitter = (Math.random() * 0.04 - 0.02);
          const pPreJitter = Math.floor(Math.random() * 3) - 1;

          const newHr = Math.max(45, Math.min(160, pt.hr + hrDelta));
          const newMap = Math.max(40, Math.min(120, pt.map + mapDelta));
          const newFlow = Number(Math.max(1.0, Math.min(7.0, pt.flowLpm + flowJitter)).toFixed(2));
          const newPPre = Math.max(120, Math.min(360, pt.pPre + pPreJitter));

          return {
            ...pt,
            hr: newHr,
            map: newMap,
            flowLpm: newFlow,
            pPre: newPPre,
          };
        })
      );
    }, 2400);

    return () => clearInterval(interval);
  }, [isLiveSimulating]);

  /* ------------------------------------------------------------------ */
  /*  Canvas Waveform Renderer for Arterial & PA Lines                  */
  /* ------------------------------------------------------------------ */

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

      // Dark background with faint clinical grid
      ctx.fillStyle = "#020617"; // slate-950
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#1e293b"; // slate-800 grid
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

      // Arterial Line Trace (Red/Rose)
      ctx.strokeStyle = "#f43f5e"; // rose-500
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.05;
        // Dicrotic notch hemodynamic pulse equation
        const pulse = Math.sin(t) + 0.35 * Math.sin(2 * t + 0.8) - 0.2 * Math.cos(3 * t);
        const y = h * 0.3 - pulse * 24;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // PA Catheter Waveform Trace (Cyan/Sky)
      ctx.strokeStyle = "#38bdf8"; // sky-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.04;
        const paWave = Math.sin(t) * 0.7 + 0.2 * Math.sin(3 * t);
        const y = h * 0.7 - paWave * 16;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Sweeper bar
      const sweepX = (offset * 3) % w;
      ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
      ctx.fillRect(sweepX, 0, 4, h);

      offset += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  User Actions & Handlers                                           */
  /* ------------------------------------------------------------------ */

  const handleOpenAdjustModal = (patient) => {
    setModalPatient(patient);
    setEditParams({
      rpm: patient.rpm,
      sweepGasLpm: patient.sweepGasLpm,
      fio2Pct: patient.fio2Pct,
      map: patient.map,
      co: patient.co,
      cvp: patient.cvp,
      mPap: patient.mPap,
      pcwp: patient.pcwp,
      heparinRate: patient.heparinRate,
    });
    setActiveModal("HEMO_ADJUST");
  };

  const handleSaveAdjustments = () => {
    if (!modalPatient) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== modalPatient.id) return p;
        // Estimated flow change based on RPM
        const calculatedFlow = Number(((editParams.rpm / 4000) * 4.6).toFixed(2));
        return {
          ...p,
          rpm: Number(editParams.rpm),
          sweepGasLpm: Number(editParams.sweepGasLpm),
          fio2Pct: Number(editParams.fio2Pct),
          map: Number(editParams.map),
          co: Number(editParams.co),
          cvp: Number(editParams.cvp),
          mPap: Number(editParams.mPap),
          pcwp: Number(editParams.pcwp),
          heparinRate: Number(editParams.heparinRate),
          flowLpm: calculatedFlow,
        };
      })
    );
    addToast(`Hemodynamic parameters for ${modalPatient.name} adjusted successfully.`, "info");
    setActiveModal(null);
  };

  const triggerEmergencyProtocol = (protocolName) => {
    addToast(`🚨 EMERGENCY PROTOCOL TRIGGERED: ${protocolName} - Notifications dispatched to Cardiac Arrest & Perfusion Teams!`, "error");
    setActiveModal(null);
  };

  const handleExportCsv = () => {
    const exportData = patients.map((p) => {
      const totCo = p.co + (p.ecmoMode === "VA-ECMO" ? p.flowLpm : 0);
      return {
        Patient_ID: p.id,
        Name: p.name,
        MRN: p.mrn,
        Age: p.age,
        Gender: p.gender,
        ECMO_Mode: p.ecmoMode,
        SCAI_Stage: p.scaiStage,
        Cannulation: p.cannulation,
        Pump_RPM: p.rpm,
        ECMO_Flow_LPM: p.flowLpm,
        Sweep_Gas_LPM: p.sweepGasLpm,
        FiO2_Pct: p.fio2Pct,
        Pre_Membrane_P_mmHg: p.pPre,
        Post_Membrane_P_mmHg: p.pPost,
        Delta_P_mmHg: p.pPre - p.pPost,
        HR_BPM: p.hr,
        MAP_mmHg: p.map,
        CVP_mmHg: p.cvp,
        mPAP_mmHg: p.mPap,
        PCWP_mmHg: p.pcwp,
        Native_CO_Lpm: p.co,
        Total_CO_Lpm: totCo.toFixed(2),
        Cardiac_Power_Output_Watts: calcCpo(p.map, totCo),
        Cardiac_Index: calcCi(totCo, p.bsa),
        SVR_dynes: calcSvr(p.map, p.cvp, totCo),
        PVR_dynes: calcPvr(p.mPap, p.pcwp, p.co),
        SvO2_Pct: p.svo2,
        Lactate_mmolL: p.lactate,
        ACT_sec: p.act,
        Heparin_Rate_units_kg_hr: p.heparinRate,
        Status: p.status,
      };
    });

    downloadCsv(exportData, "Cardiovascular_Hemodynamics_ECMO_Telemetry_Export.csv");
    addToast("Clinical hemodynamics & ECMO dataset exported as CSV.", "info");
  };

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMode = filterMode === "ALL" || p.ecmoMode === filterMode;
      return matchSearch && matchMode;
    });
  }, [patients, searchQuery, filterMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-rose-500/30">
      <KindToastTray toasts={toasts} onDismiss={removeToast} />

      {/* ------------------------------------------------------------ */}
      {/*  Top Header & Clinical Control Bar                           */}
      {/* ------------------------------------------------------------ */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent border border-rose-500/40 text-rose-400 shadow-lg shadow-rose-950/40">
              <HeartPulse className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Cardiovascular Hemodynamics & ECMO Station
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/30">
                  <Flame className="h-3 w-3" /> ICU Level 1 Quaternary
                </span>
              </div>
              <p className="text-xs text-slate-400 sm:text-sm mt-0.5">
                Swan-Ganz Thermodilution • VA/VV-ECMO Circuit Telemetry • CPO & Shock Index Classification • ELSO Standards
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsLiveSimulating(!isLiveSimulating)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium border transition-all ${
              isLiveSimulating
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
            }`}
          >
            {isLiveSimulating ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Live Telemetry Streaming
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Simulation Paused
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" /> Export Telemetry CSV
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("CODE_ECMO")}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-semibold shadow-lg shadow-rose-950/50 transition-all border border-rose-400/40 animate-pulse"
          >
            <Siren className="h-4 w-4" /> CODE ECMO CANNULATION
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/*  Top High-Assurance Clinical KPI Cards                       */}
      {/* ------------------------------------------------------------ */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-rose-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active ECMO Fleet</span>
            <Gauge className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">4 In-Situ</span>
            <span className="text-xs text-rose-400 font-semibold">3 VA / 1 VV</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">CentriMag & Cardiohelp consoles active</p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Mean Cardiac Power (CPO)</span>
            <Heart className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-300">0.74 Watts</span>
            <span className="text-xs text-slate-400">Target &gt; 0.60 W</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Shock mortality threshold: &le; 0.6 W</p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Oxygenator Gradient (&Delta;P)</span>
            <Waves className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300">28.5 mmHg</span>
            <span className="text-xs text-amber-400 font-medium">Warning &gt; 35</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">PMP hollow-fiber membrane surveillance</p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Anticoagulation Target</span>
            <Droplets className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-300">100% In-Range</span>
            <span className="text-xs text-slate-400">ACT 180-220s</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Continuous Unfractionated Heparin / Anti-Xa</p>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/*  Main Layout: Left Patient Selector & Right Deep Telemetry   */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Patient Roster & Filter (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-400" /> Monitored Hemodynamic Roster
              </h2>
              <span className="text-xs text-slate-400">{filteredPatients.length} Active</span>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter name, MRN, diagnosis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5 text-xs">
                {["ALL", "VA-ECMO", "VV-ECMO"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMode(mode)}
                    className={`flex-1 rounded-md py-1 font-medium transition-all ${
                      filterMode === mode
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Cards List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredPatients.map((pt) => {
                const isSelected = pt.id === activePatient.id;
                const ptTotCo = pt.co + (pt.ecmoMode === "VA-ECMO" ? pt.flowLpm : 0);
                const ptCpo = calcCpo(pt.map, ptTotCo);
                const ptScai = SCAI_BADGES[pt.scaiStage] || SCAI_BADGES["A"];

                return (
                  <div
                    key={pt.id}
                    onClick={() => setSelectedId(pt.id)}
                    className={`cursor-pointer rounded-lg p-3.5 border transition-all ${
                      isSelected
                        ? "bg-slate-800/90 border-rose-500/60 shadow-md shadow-rose-950/30"
                        : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{pt.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{pt.mrn}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{pt.diagnosis}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ptScai.cls}`}>
                        {pt.scaiStage}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] border-t border-slate-800/60 pt-2">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">ECMO Mode</span>
                        <span className="font-semibold text-cyan-300">{pt.ecmoMode}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Flow / RPM</span>
                        <span className="font-semibold text-rose-300">{pt.flowLpm}L / {pt.rpm}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">CPO (Watts)</span>
                        <span className={`font-semibold ${ptCpo < 0.6 ? "text-rose-400" : "text-emerald-400"}`}>
                          {ptCpo} W
                        </span>
                      </div>
                    </div>

                    {pt.alerts.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{pt.alerts[0].msg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Guidance Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Info className="h-3.5 w-3.5 text-cyan-400" /> Hemodynamic Formula Guide
            </h3>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400">Cardiac Power (CPO):</span>
                <span className="font-mono text-cyan-300">(MAP &times; CO) / 451</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400">Cardiac Index (CI):</span>
                <span className="font-mono text-cyan-300">CO / BSA (L/min/m&sup2;)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400">SVR:</span>
                <span className="font-mono text-cyan-300">((MAP - CVP) &times; 80) / CO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Delta-P (&Delta;P):</span>
                <span className="font-mono text-cyan-300">P_pre - P_post (&le;35 mmHg)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Deep Telemetry & ECMO Circuit Console (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Patient Hero Banner */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-lg relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{activePatient.name}</h2>
                  <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {activePatient.id} • {activePatient.mrn}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${SCAI_BADGES[activePatient.scaiStage]?.cls}`}>
                    {SCAI_BADGES[activePatient.scaiStage]?.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {activePatient.age}yo {activePatient.gender} • BSA {activePatient.bsa} m&sup2; •{" "}
                  <span className="text-rose-400 font-medium">{activePatient.diagnosis}</span>
                </p>
                <p className="text-[11px] text-cyan-400 mt-0.5 flex items-center gap-1 font-mono">
                  <Radio className="h-3 w-3 animate-pulse" /> Cannulation: {activePatient.cannulation}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAdjustModal(activePatient)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-medium border border-slate-700 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-rose-400" /> Titrate Parameters
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal("WEAN_TRIAL")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 px-3 py-1.5 text-xs font-medium border border-cyan-500/40 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" /> Weaning Protocol
                </button>
              </div>
            </div>

            {/* Real-time Hemodynamic Waveform Oscilloscope */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" /> Radial Arterial Line (ABP)
                  </span>
                  <span className="flex items-center gap-1 text-sky-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-sky-400" /> Swan-Ganz PA Catheter Waveform
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">Sweep 25 mm/s • Scale 0-150 mmHg</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
                <canvas ref={canvasRef} width={680} height={140} className="w-full h-[140px] block" />
              </div>
            </div>

            {/* Hemodynamics Multi-Parameter Grid */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Heart Rate / Rhythm</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white">{activePatient.hr}</span>
                  <span className="text-[11px] text-slate-400">BPM</span>
                </div>
                <span className="text-[10px] text-rose-400">Sinus Tachycardia</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Blood Pressure (ABP)</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white">{activePatient.sys}/{activePatient.dia}</span>
                  <span className="text-[11px] text-cyan-300">({activePatient.map})</span>
                </div>
                <span className="text-[10px] text-slate-400">MAP mmHg</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cardiac Power Output</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={`text-xl font-bold ${activeCpo < 0.6 ? "text-rose-400" : "text-emerald-400"}`}>
                    {activeCpo}
                  </span>
                  <span className="text-[11px] text-slate-400">Watts</span>
                </div>
                <span className={`text-[10px] ${activeCpo < 0.6 ? "text-rose-400 font-semibold" : "text-slate-400"}`}>
                  {activeCpo < 0.6 ? "High Shock Mortality" : "Adequate Perfusion"}
                </span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Cardiac Index</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-cyan-300">{activeCi}</span>
                  <span className="text-[11px] text-slate-400">L/min/m&sup2;</span>
                </div>
                <span className="text-[10px] text-slate-400">Total CO: {totalCardiacOutput} L/min</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Central Venous (CVP)</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white">{activePatient.cvp}</span>
                  <span className="text-[11px] text-slate-400">mmHg</span>
                </div>
                <span className="text-[10px] text-amber-400">{activePatient.cvp > 15 ? "Elevated Preload" : "Normal"}</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Mean PAP / PCWP Wedge</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white">{activePatient.mPap}/{activePatient.pcwp}</span>
                  <span className="text-[11px] text-slate-400">mmHg</span>
                </div>
                <span className="text-[10px] text-slate-400">PVR: {activePvr} dynes</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">SVR Systemic Resistance</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white">{activeSvr}</span>
                  <span className="text-[11px] text-slate-400">dynes</span>
                </div>
                <span className="text-[10px] text-slate-400">Norm: 800 - 1200</span>
              </div>

              <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">SvO2 / Serum Lactate</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={`text-xl font-bold ${activePatient.svo2 < 60 ? "text-rose-400" : "text-emerald-400"}`}>
                    {activePatient.svo2}%
                  </span>
                  <span className="text-[11px] text-amber-300">/ {activePatient.lactate} mmol</span>
                </div>
                <span className="text-[10px] text-slate-400">Target SvO2 &ge; 65%</span>
              </div>
            </div>
          </div>

          {/* ECMO Circuit Deep Telemetry Console */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-semibold text-white">
                  ECMO Circuit Console • {activePatient.ecmoMode} Subsystem
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Centrifugal Console Synced
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal("DELTA_P_SWAP")}
                  className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded border border-amber-500/30 transition-colors"
                >
                  Oxygenator Delta-P Protocol
                </button>
              </div>
            </div>

            {/* Circuit Pressures & Sweep Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pump & Flow Telemetry */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Centrifugal Speed</span>
                  <span className="font-mono text-rose-400 font-bold">{activePatient.rpm} RPM</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(activePatient.rpm / 5000) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/60">
                  <span className="text-slate-400">Delivered Circuit Flow</span>
                  <span className="font-mono text-cyan-300 font-bold text-base">{activePatient.flowLpm} L/min</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Venous Drainage Pressure</span>
                  <span className="font-mono text-amber-400 font-semibold">{activePatient.pVenous} mmHg</span>
                </div>
                <p className="text-[10px] text-slate-500">Target &gt; -80 mmHg (prevent cavitation/chatter)</p>
              </div>

              {/* Transmembrane Pressure Gradient (Delta-P) */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Pre-Membrane (P_pre)</span>
                  <span className="font-mono text-white font-semibold">{activePatient.pPre} mmHg</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Post-Membrane (P_post)</span>
                  <span className="font-mono text-white font-semibold">{activePatient.pPost} mmHg</span>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400 block">&Delta;P Gradient</span>
                    <span className={`text-lg font-bold font-mono ${deltaP > 35 ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                      {deltaP} mmHg
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${deltaP > 35 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}>
                    {deltaP > 35 ? "THROMBUS RISK" : "PMP NORMAL"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Threshold for emergency oxygenator swap: &gt; 50 mmHg</p>
              </div>

              {/* Sweep Gas & Anticoagulation */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Sweep Gas Flow</span>
                  <span className="font-mono text-cyan-300 font-semibold">{activePatient.sweepGasLpm} L/min</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Blender FiO2</span>
                  <span className="font-mono text-rose-400 font-semibold">{activePatient.fio2Pct}%</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Heparin Infusion</span>
                  <span className="font-mono text-white font-semibold">{activePatient.heparinRate} u/kg/hr</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">ACT / Anti-Xa</span>
                  <span className="font-mono text-emerald-300 font-semibold">{activePatient.act}s / {activePatient.antiXa}</span>
                </div>
              </div>
            </div>

            {/* Cannulation & Distal Perfusion Status Bar */}
            <div className="mt-4 rounded-lg bg-slate-950/60 border border-slate-800/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <span className="text-slate-300 font-medium">Distal Perfusion Cannula (DPC) Status: </span>
                  <span className="text-emerald-400 font-mono">{activePatient.dpcFlow}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                <span>Patient Core Temp: <strong className="text-white">{activePatient.tempC}&deg;C</strong></span>
                <span>Water Heater-Cooler: <strong className="text-emerald-400">Normothermic 37.0&deg;C</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Interactive Modals                                          */}
      {/* ------------------------------------------------------------ */}

      {/* 1. CODE ECMO EMERGENCY CANNULATION MODAL */}
      {activeModal === "CODE_ECMO" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-rose-500/50 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400">
                <Siren className="h-6 w-6 animate-bounce" />
                <h3 className="text-lg font-bold text-white">EMERGENCY E-CPR / CODE ECMO ACTIVATION</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Activating Code ECMO will immediately broadcast automated audio/pager dispatch to the
              Cardiothoracic Surgery, Perfusion, Interventional Cardiology, and ICU ECMO Specialist teams.
            </p>

            <div className="space-y-2 rounded-lg bg-slate-950 p-3.5 border border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Primary Candidate:</span>
                <span className="font-semibold text-white">{activePatient.name} ({activePatient.mrn})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Indication:</span>
                <span className="text-rose-400 font-semibold">Refractory Cardiogenic Shock / Arrest</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recommended Circuit:</span>
                <span className="text-cyan-300 font-mono font-semibold">VA-ECMO 21Fr Venous / 15Fr Arterial + DPC</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => triggerEmergencyProtocol("CODE ECMO / E-CPR")}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-bold shadow-lg shadow-rose-950/60 flex items-center gap-1.5"
              >
                <Siren className="h-4 w-4" /> DISPATCH ECMO TEAMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OXYGENATOR DELTA-P SWAP MODAL */}
      {activeModal === "DELTA_P_SWAP" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-500/50 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <AlertOctagon className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">Oxygenator Clotting & Delta-P Protocol</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>Current Delta-P gradient for {activePatient.name} is <strong className="text-amber-400">{deltaP} mmHg</strong>.</p>
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-1.5">
                <div className="text-slate-400 font-medium">ELSO Guideline Checklist for Circuit Swap:</div>
                <div className="text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Delta-P &gt; 35 mmHg sustained or rapid rise &gt; 15 mmHg/hr
                </div>
                <div className="text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Visible fibrin deposition on polymethylpentene membrane
                </div>
                <div className="text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Plasma free hemoglobin &gt; 50 mg/dL or falling platelets
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => triggerEmergencyProtocol("RAPID OXYGENATOR SWAP")}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-bold shadow-lg flex items-center gap-1.5"
              >
                <AlertTriangle className="h-4 w-4" /> INITIATE PARALLEL CIRCUIT SWAP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. WEANING PROTOCOL TRIAL MODAL */}
      {activeModal === "WEAN_TRIAL" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-500/50 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <Zap className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">VA/VV-ECMO Weaning Assessment Trial</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3">
              <p>Execute structured step-down protocol under continuous echocardiographic and hemodynamic monitoring:</p>
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">1. Step flow down to:</span>
                  <span className="font-semibold text-cyan-300">1.5 - 2.0 L/min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">2. Increase Heparin ACT target to:</span>
                  <span className="font-semibold text-emerald-400">220 - 240 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">3. Verification Criteria:</span>
                  <span className="font-semibold text-white">LVEF &gt; 25%, VTI &gt; 12 cm, CPO &gt; 0.6 W</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  addToast(`Weaning trial initiated for ${activePatient.name}. Flow reduced to 2.0 L/min with ACT surveillance.`, "info");
                  setActiveModal(null);
                }}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 text-xs font-bold shadow-lg"
              >
                BEGIN 60-MIN WEAN TRIAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. HEMODYNAMIC TITRATION & PARAMETER ADJUSTMENT MODAL */}
      {activeModal === "HEMO_ADJUST" && modalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400">
                <SlidersHorizontal className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">Titrate Hemodynamics • {modalPatient.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Centrifugal Speed (RPM): {editParams.rpm}</label>
                <input
                  type="range"
                  min={1500}
                  max={4800}
                  step={50}
                  value={editParams.rpm}
                  onChange={(e) => setEditParams({ ...editParams, rpm: Number(e.target.value) })}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Sweep Gas Flow (L/min): {editParams.sweepGasLpm}</label>
                <input
                  type="range"
                  min={1.0}
                  max={12.0}
                  step={0.5}
                  value={editParams.sweepGasLpm}
                  onChange={(e) => setEditParams({ ...editParams, sweepGasLpm: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Mean Arterial Pressure (MAP mmHg): {editParams.map}</label>
                <input
                  type="range"
                  min={40}
                  max={120}
                  step={1}
                  value={editParams.map}
                  onChange={(e) => setEditParams({ ...editParams, map: Number(e.target.value) })}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Native Cardiac Output (CO L/min): {editParams.co}</label>
                <input
                  type="range"
                  min={0.8}
                  max={8.0}
                  step={0.1}
                  value={editParams.co}
                  onChange={(e) => setEditParams({ ...editParams, co: Number(e.target.value) })}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Central Venous Pressure (CVP mmHg): {editParams.cvp}</label>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={editParams.cvp}
                  onChange={(e) => setEditParams({ ...editParams, cvp: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">PA Wedge (PCWP mmHg): {editParams.pcwp}</label>
                <input
                  type="range"
                  min={4}
                  max={35}
                  step={1}
                  value={editParams.pcwp}
                  onChange={(e) => setEditParams({ ...editParams, pcwp: Number(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustments}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-bold shadow-lg"
              >
                Apply Parameters & Recalculate CPO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
