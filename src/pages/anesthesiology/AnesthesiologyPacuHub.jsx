import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, HeartPulse,
  Pause, Play, Plus, RefreshCw, ShieldAlert, Stethoscope, Syringe,
  Thermometer, TrendingDown, TrendingUp, User,
} from "lucide-react";
import { ExportCsvButton } from "../../components/common/ExportButton";
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { CompactSearch } from "../../components/common/SearchBox";
import { FilterChips } from "../../components/common/FilterChips";
import { Row } from "../../components/common/InfoRow";
import { EmptyState } from "../../components/common/EmptyState";
import { ToneBadge } from "../../components/common/ToneBadge";
import { TabsBar } from "../../components/common/TabsBar";
import { SimpleModal as Modal } from "../../components/common/Modal";
import { downloadCsv } from "../../utils/csv";

/* ------------------------------------------------------------------ *
 *  MedTrack Anesthesiology & PACU Command Hub
 *  ------------------------------------------------------------------
 *  Three consoles for the perioperative anaesthesia service:
 *
 *    1. OR Anesthesia Board - every operating room with its case in
 *       progress, ASA physical status, airway flags, technique
 *       (general / regional / MAC) and phase progression from
 *       induction through emergence.
 *    2. PACU Recovery Watch - the post-anaesthesia care unit with
 *       modified Aldrete scoring, PONV / respiratory event flags,
 *       and a discharge-readiness engine that refuses to sign off
 *       until every criterion is met.
 *    3. Block & Pain Service - regional anaesthesia blocks with
 *       local-anaesthetic dose against toxicity ceilings, catheter
 *       dwell days, and post-operative pain trending.
 *
 *  The recurring theme is that anaesthesia safety is a discipline of
 *  ceilings: dose ceilings (local anaesthetic mg/kg), time ceilings
 *  (catheter dwell, emergence windows) and score ceilings (Aldrete
 *  must reach 9 before PACU discharge). Every action in this page is
 *  either a ceiling being respected or a ceiling being flagged.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Clinical constants                                                 */
/* ------------------------------------------------------------------ */

/** Maximum weight-based local anaesthetic doses, mg/kg (ASRA/ESRA guidance). */
const LA_DOSE_CEILING = {
  "Bupivacaine 0.5%": 2.5,
  "Ropivacaine 0.5%": 3.0,
  "Lidocaine 2%": 4.5,
  "Mepivacaine 1.5%": 5.0,
  "Liposomal bupivacaine": 2.66,
};

/** Maximum catheter dwell days before removal is mandatory. */
const CATHETER_DWELL_MAX = 4;

/** Aldrete score required for PACU discharge. */
const ALDRETE_DISCHARGE = 9;

/** Emergence window (minutes) beyond which a slow wake is flagged. */
const EMERGENCE_WINDOW_MIN = 25;

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const OR_CASES = [
  { id: "OR-01", room: "OR 1", patient: "R. Mehta", procedure: "Lap cholecystectomy", asa: "II", technique: "General", airway: "Standard", phase: "Induction", mins: 6, surgeon: "Dr. Iyer", anes: "Dr. Kapoor", crit: false },
  { id: "OR-02", room: "OR 2", patient: "S. Alvarez", procedure: "Total knee arthroplasty", asa: "III", technique: "Regional", airway: "Standard", phase: "Maintenance", mins: 41, surgeon: "Dr. Chen", anes: "Dr. Osei", crit: true },
  { id: "OR-03", room: "OR 3", patient: "T. Okafor", procedure: "CABG ×3", asa: "IV", technique: "General", airway: "Difficult", phase: "Emergence", mins: 18, surgeon: "Dr. Rao", anes: "Dr. Nair", crit: true },
  { id: "OR-04", room: "OR 4", patient: "L. Fernandez", procedure: "Cesarean section", asa: "II", technique: "Regional", airway: "Aspiration risk", phase: "Maintenance", mins: 24, surgeon: "Dr. Wu", anes: "Dr. Patel", crit: true },
  { id: "OR-05", room: "OR 5", patient: "M. Kowalski", procedure: "Ventral hernia repair", asa: "II", technique: "General", airway: "Standard", phase: "Pre-op", mins: 0, surgeon: "Dr. Meier", anes: "Dr. Silva", crit: false },
  { id: "OR-06", room: "OR 6", patient: "A. Brooks", procedure: "Thyroidectomy", asa: "III", technique: "General", airway: "Standard", phase: "Induction", mins: 9, surgeon: "Dr. Khan", anes: "Dr. Romano", crit: false },
  { id: "OR-07", room: "OR 7", patient: "D. Petrova", procedure: "Hip fracture ORIF", asa: "III", technique: "Regional", airway: "Standard", phase: "Maintenance", mins: 33, surgeon: "Dr. Jensen", anes: "Dr. Aoki", crit: true },
  { id: "OR-08", room: "OR 8", patient: "G. Mbeki", procedure: "Craniotomy tumor", asa: "IV", technique: "General", airway: "Difficult", phase: "Induction", mins: 12, surgeon: "Dr. Laurent", anes: "Dr. Bose", crit: true },
];

const OR_PHASES = ["Pre-op", "Induction", "Maintenance", "Emergence", "To PACU"];

const PACU_PATIENTS = [
  { id: "PACU-01", patient: "T. Okafor", fromOr: "OR 3", mins: 12, aldrete: 7, ponv: false, resp: "Clear", events: [], nurse: "RN Bhatia", ready: false },
  { id: "PACU-02", patient: "L. Fernandez", fromOr: "OR 4", mins: 8, aldrete: 9, ponv: false, resp: "Clear", events: [], nurse: "RN Whitfield", ready: true },
  { id: "PACU-03", patient: "S. Alvarez", fromOr: "OR 2", mins: 19, aldrete: 6, ponv: true, resp: "Desat 91%", events: ["PONV - ondansetron 4 mg"], nurse: "RN Okonkwo", ready: false },
  { id: "PACU-04", patient: "H. Vidal", fromOr: "OR 5", mins: 5, aldrete: 8, ponv: false, resp: "Clear", events: [], nurse: "RN Sato", ready: false },
  { id: "PACU-05", patient: "K. Lindqvist", fromOr: "OR 6", mins: 27, aldrete: 6, ponv: false, resp: "Hypoventilating", events: ["Opioid-induced - naloxone 40 mcg"], nurse: "RN Das", ready: false },
  { id: "PACU-06", patient: "P. Nguyen", fromOr: "OR 1", mins: 3, aldrete: 9, ponv: false, resp: "Clear", events: [], nurse: "RN Ferreira", ready: true },
  { id: "PACU-07", patient: "J. Moreno", fromOr: "OR 7", mins: 22, aldrete: 8, ponv: true, resp: "Clear", events: ["PONV - dexamethasone 4 mg"], nurse: "RN Almeida", ready: false },
  { id: "PACU-08", patient: "Z. Haddad", fromOr: "OR 8", mins: 14, aldrete: 5, ponv: false, resp: "Delayed wake", events: ["Sedation - titrate to rousable"], nurse: "RN Bello", ready: false },
];

const BLOCKS = [
  { id: "BLK-01", patient: "S. Alvarez", block: "Adductor canal", agent: "Ropivacaine 0.5%", doseMg: 150, weightKg: 82, catheter: false, dwellDays: 0, painNow: 4, painTrend: "down", anes: "Dr. Osei" },
  { id: "BLK-02", patient: "L. Fernandez", block: "Epidural (labor)", agent: "Bupivacaine 0.125%", doseMg: 40, weightKg: 74, catheter: true, dwellDays: 1, painNow: 3, painTrend: "down", anes: "Dr. Patel" },
  { id: "BLK-03", patient: "D. Petrova", block: "Fascia iliaca", agent: "Bupivacaine 0.5%", doseMg: 130, weightKg: 68, catheter: false, dwellDays: 0, painNow: 5, painTrend: "flat", anes: "Dr. Aoki" },
  { id: "BLK-04", patient: "T. Okafor", block: "Serratus plane", agent: "Liposomal bupivacaine", doseMg: 266, weightKg: 92, catheter: false, dwellDays: 0, painNow: 2, painTrend: "down", anes: "Dr. Nair" },
  { id: "BLK-05", patient: "H. Vidal", block: "Interscalene", agent: "Ropivacaine 0.5%", doseMg: 180, weightKg: 71, catheter: true, dwellDays: 2, painNow: 3, painTrend: "down", anes: "Dr. Silva" },
  { id: "BLK-06", patient: "M. Kowalski", block: "TAP", agent: "Bupivacaine 0.25%", doseMg: 120, weightKg: 88, catheter: false, dwellDays: 0, painNow: 6, painTrend: "flat", anes: "Dr. Romano" },
  { id: "BLK-07", patient: "G. Mbeki", block: "Scalp (ring)", agent: "Lidocaine 2%", doseMg: 240, weightKg: 76, catheter: false, dwellDays: 0, painNow: 2, painTrend: "down", anes: "Dr. Bose" },
  { id: "BLK-08", patient: "J. Moreno", block: "Epidural (thoracic)", agent: "Ropivacaine 0.2%", doseMg: 90, weightKg: 79, catheter: true, dwellDays: 3, painNow: 3, painTrend: "down", anes: "Dr. Almeida" },
];

/* ------------------------------------------------------------------ */
/*  Tone vocabulary                                                    */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  const v = String(value);
  if (/^(To PACU|Ready|Clear|down)$/.test(v)) return "green";
  if (/^(Maintenance|Emergence|8|7|flat)$/.test(v)) return "amber";
  if (/^(Difficult|Aspiration risk|Desat|Hypoventilating|Delayed wake|PONV|5|6)$/.test(v)) return "red";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;

/* ------------------------------------------------------------------ */
/*  Derived checks                                                     */
/* ------------------------------------------------------------------ */

const round1 = (n) => Math.round(n * 10) / 10;

const laCeiling = (block) => {
  const ceiling = LA_DOSE_CEILING[block.agent] || 3.0;
  const maxMg = round1(ceiling * block.weightKg);
  const pct = block.catheter && block.dwellDays > 0 ? 100 : Math.round((block.doseMg / maxMg) * 100);
  return { ceiling, maxMg, pct, over: pct > 100 };
};

const aldreteReadiness = (p) => {
  if (p.aldrete >= ALDRETE_DISCHARGE && p.resp === "Clear" && !p.ponv) return { verdict: "Ready", tone: "green", reason: "Aldrete ≥ 9, airway clear, no active PONV." };
  if (p.aldrete >= ALDRETE_DISCHARGE) return { verdict: "Blocked", tone: "amber", reason: "Score is sufficient but the airway or PONV criteria are not." };
  return { verdict: "Not ready", tone: "red", reason: `Aldrete ${p.aldrete} is below the ${ALDRETE_DISCHARGE} discharge threshold.` };
};

const emergenceFlag = (c) => c.phase === "Emergence" && c.mins > EMERGENCE_WINDOW_MIN;

/* ------------------------------------------------------------------ */
/*  Simulation                                                         */
/* ------------------------------------------------------------------ */

function usePacuSimulation({ orRef, pacuRef, blockRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!runningRef.current) return;
      const steps = Math.max(1, Math.round(speedRef.current));

      for (let step = 0; step < steps; step += 1) {
        // OR cases age towards the next phase.
        orRef.current = orRef.current.map((c) => {
          const mins = c.phase === "Pre-op" ? c.mins : c.mins + 1;
          if (c.phase === "Induction" && c.mins >= 15) {
            toast(`${c.id} ${c.patient} — induction complete, moving to maintenance`, "Low");
            return { ...c, phase: "Maintenance", mins: 0 };
          }
          if (c.phase === "Maintenance" && c.mins >= 60) {
            toast(`${c.id} ${c.patient} — surgery closed, beginning emergence`, "Medium");
            return { ...c, phase: "Emergence", mins: 0 };
          }
          if (c.phase === "Emergence" && c.mins >= 20) {
            toast(`${c.id} ${c.patient} — handed to PACU`, "High");
            return { ...c, phase: "To PACU", mins };
          }
          return { ...c, mins };
        });

        // PACU patients score toward discharge.
        pacuRef.current = pacuRef.current.map((p) => {
          const mins = p.mins + 1;
          if (p.aldrete < ALDRETE_DISCHARGE && Math.random() < 0.35) {
            return { ...p, mins, aldrete: Math.min(ALDRETE_DISCHARGE, p.aldrete + 1) };
          }
          if (p.resp === "Desat 91%" && Math.random() < 0.3) {
            toast(`${p.id} ${p.patient} — SpO2 recovered to 96% on 4L`, "Low");
            return { ...p, mins, resp: "Clear" };
          }
          if (p.resp === "Hypoventilating" && Math.random() < 0.3) {
            toast(`${p.id} ${p.patient} — RR normalised after naloxone`, "Low");
            return { ...p, mins, resp: "Clear" };
          }
          return { ...p, mins };
        });

        // Pain scores drift gently; catheters age toward removal.
        blockRef.current = blockRef.current.map((b) => {
          const dwellDays = b.catheter ? b.dwellDays + (Math.random() < 0.2 ? 1 : 0) : 0;
          const painNow = Math.max(0, Math.min(10, b.painNow + (Math.random() - 0.5) * 0.6));
          return { ...b, dwellDays, painNow: round1(painNow) };
        });
      }

      setTick((t) => t + 1);
    }, 1600);

    return () => clearInterval(interval);
  }, [orRef, pacuRef, blockRef, toast]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      orRef.current = OR_CASES.map((c) => ({ ...c }));
      pacuRef.current = PACU_PATIENTS.map((p) => ({ ...p }));
      blockRef.current = BLOCKS.map((b) => ({ ...b }));
      setTick(0);
      toast("Anesthesiology console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function AnesthesiologyPacuHub() {
  const [tab, setTab] = useState("or");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [orFilter, setOrFilter] = useState("All");
  const [pacuFilter, setPacuFilter] = useState("All");
  const [blockFilter, setBlockFilter] = useState("All");

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, severity = "Low") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current.slice(-4), { id, message, severity }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const [orCases, setOrCases] = useState(() => OR_CASES.map((c) => ({ ...c })));
  const [pacu, setPacu] = useState(() => PACU_PATIENTS.map((p) => ({ ...p })));
  const [blocks, setBlocks] = useState(() => BLOCKS.map((b) => ({ ...b })));

  const orRef = useRef(orCases);
  const pacuRef = useRef(pacu);
  const blockRef = useRef(blocks);

  useEffect(() => { orRef.current = orCases; }, [orCases]);
  useEffect(() => { pacuRef.current = pacu; }, [pacu]);
  useEffect(() => { blockRef.current = blocks; }, [blocks]);

  const sim = usePacuSimulation({ orRef, pacuRef, blockRef, toast });

  useEffect(() => {
    setOrCases([...orRef.current]);
    setPacu([...pacuRef.current]);
    setBlocks([...blockRef.current]);
  }, [sim.tick]);

  /* ---------- derived ---------- */

  const stats = useMemo(() => {
    const inProgress = orCases.filter((c) => !["Pre-op", "To PACU"].includes(c.phase)).length;
    const difficultAirways = orCases.filter((c) => ["Difficult", "Aspiration risk"].includes(c.airway)).length;
    const pacuWatch = pacu.filter((p) => aldreteReadiness(p).verdict !== "Ready").length;
    const ceilingFlags = blocks.filter((b) => laCeiling(b).over || b.dwellDays >= CATHETER_DWELL_MAX).length;
    return { inProgress, difficultAirways, pacuWatch, ceilingFlags };
  }, [orCases, pacu, blocks]);

  const filteredOr = useMemo(() => {
    const q = query.toLowerCase();
    return orCases.filter((c) => {
      const matchesQuery = !q || [c.id, c.room, c.patient, c.procedure, c.surgeon, c.anes].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (orFilter === "All") return true;
      if (orFilter === "Difficult airway") return ["Difficult", "Aspiration risk"].includes(c.airway);
      if (orFilter === "Critical") return c.crit;
      return c.phase === orFilter;
    });
  }, [orCases, query, orFilter]);

  const filteredPacu = useMemo(() => {
    const q = query.toLowerCase();
    return pacu.filter((p) => {
      const matchesQuery = !q || [p.id, p.patient, p.fromOr, p.nurse, p.resp].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (pacuFilter === "All") return true;
      if (pacuFilter === "Ready") return aldreteReadiness(p).verdict === "Ready";
      if (pacuFilter === "Respiratory event") return p.resp !== "Clear";
      return p.ponv;
    });
  }, [pacu, query, pacuFilter]);

  const filteredBlocks = useMemo(() => {
    const q = query.toLowerCase();
    return blocks.filter((b) => {
      const matchesQuery = !q || [b.id, b.patient, b.block, b.agent, b.anes].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (blockFilter === "All") return true;
      if (blockFilter === "Dose ceiling") return laCeiling(b).over;
      if (blockFilter === "Catheter ≥ 3d") return b.dwellDays >= 3;
      return b.catheter;
    });
  }, [blocks, query, blockFilter]);

  /* ---------- actions ---------- */

  const advancePhase = (id) => {
    setOrCases((current) =>
      current.map((c) => {
        if (c.id !== id) return c;
        const idx = OR_PHASES.indexOf(c.phase);
        const next = idx < OR_PHASES.length - 1 ? OR_PHASES[idx + 1] : c.phase;
        toast(`${c.id} ${c.patient} — ${c.phase} → ${next}`, next === "To PACU" ? "High" : "Medium");
        return { ...c, phase: next, mins: 0 };
      })
    );
  };

  const treatPonv = (id) => {
    setPacu((current) =>
      current.map((p) => (p.id === id ? { ...p, ponv: false, events: [...p.events, "PONV treated — ondansetron 4 mg"] } : p))
    );
    toast(`${id} PONV treated`, "Medium");
  };

  const fixResp = (id) => {
    setPacu((current) =>
      current.map((p) => (p.id === id ? { ...p, resp: "Clear", events: [...p.events, "Airway event resolved"] } : p))
    );
    toast(`${id} respiratory event resolved`, "High");
  };

  const discharge = (id) => {
    setPacu((current) => current.filter((p) => p.id !== id));
    toast(`${id} discharged from PACU`, "Low");
  };

  const markBlockDone = (id) => {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, catheter: false, dwellDays: 0 } : b)));
    toast(`${id} catheter removed`, "Medium");
  };

  const addPainScore = (id, delta) => {
    setBlocks((current) =>
      current.map((b) => (b.id === id ? { ...b, painNow: round1(Math.max(0, Math.min(10, b.painNow + delta))) } : b))
    );
    toast(`${id} pain score updated`, "Low");
  };

  const exportCsv = () => {
    const table =
      tab === "or"
        ? [
            ["ID", "Room", "Patient", "Procedure", "ASA", "Technique", "Airway", "Phase", "Mins in phase", "Anesthetist"],
            ...filteredOr.map((c) => [c.id, c.room, c.patient, c.procedure, c.asa, c.technique, c.airway, c.phase, c.mins, c.anes]),
          ]
        : tab === "pacu"
          ? [
              ["ID", "Patient", "From OR", "Mins", "Aldrete", "PONV", "Respiratory", "Verdict", "Nurse"],
              ...filteredPacu.map((p) => [p.id, p.patient, p.fromOr, p.mins, p.aldrete, p.ponv ? "Yes" : "No", p.resp, aldreteReadiness(p).verdict, p.nurse]),
            ]
          : [
              ["ID", "Patient", "Block", "Agent", "Dose (mg)", "Weight (kg)", "Ceiling (mg)", "Util %", "Catheter", "Dwell (d)", "Pain now"],
              ...filteredBlocks.map((b) => {
                const la = laCeiling(b);
                return [b.id, b.patient, b.block, b.agent, b.doseMg, b.weightKg, la.maxMg, la.pct, b.catheter ? "Yes" : "No", b.dwellDays, b.painNow];
              }),
            ];

    downloadCsv(`anesthesiology-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "or", label: "OR Anesthesia Board", icon: Stethoscope },
    { id: "pacu", label: "PACU Recovery Watch", icon: HeartPulse },
    { id: "blocks", label: "Block & Pain Service", icon: Syringe },
  ];

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <div className="fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
            {t.severity === "High" ? (
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-400" />
            ) : t.severity === "Medium" ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
            )}
            <p className="text-xs text-slate-300">{t.message}</p>
          </div>
        ))}
      </div>

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
              <Stethoscope size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Anesthesiology &amp; PACU Command Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                OR anesthesia · PACU recovery · regional pain — ASA status, Aldrete scoring, LA dose ceilings
              </p>
            </div>
          </div>
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
          <StatCard icon={Activity} label="Cases in Progress" value={stats.inProgress} sub="across 8 ORs" accent={stats.inProgress > 0 ? "text-emerald-400" : "text-slate-400"} />
          <StatCard icon={AlertTriangle} label="Difficult Airways" value={stats.difficultAirways} sub="difficult / aspiration risk" accent={stats.difficultAirways > 0 ? "text-amber-400" : "text-emerald-400"} />
          <StatCard icon={HeartPulse} label="PACU Not Ready" value={stats.pacuWatch} sub={`Aldrete < ${ALDRETE_DISCHARGE} or flagged`} accent={stats.pacuWatch > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Syringe} label="Block Ceilings Flagged" value={stats.ceilingFlags} sub="dose ceiling or dwell ≥ 4d" accent={stats.ceilingFlags > 0 ? "text-red-400" : "text-emerald-400"} />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search patients, rooms, procedures, blocks…" />
          {tab === "or" && <FilterChips label="Filter theatres by phase" options={["All", "Induction", "Maintenance", "Emergence", "Difficult airway", "Critical"]} value={orFilter} onChange={setOrFilter} />}
          {tab === "pacu" && <FilterChips label="Filter PACU bays by status" options={["All", "Ready", "Not ready", "PONV", "Respiratory event"]} value={pacuFilter} onChange={setPacuFilter} />}
          {tab === "blocks" && <FilterChips label="Filter blocks by status" options={["All", "Catheter", "Dose ceiling", "Catheter ≥ 3d"]} value={blockFilter} onChange={setBlockFilter} />}
        </div>
      </header>

      <main className="px-6 py-6">
        {/* ============================= OR ANESTHESIA BOARD ============================= */}
        {tab === "or" && (
          <section>
            {filteredOr.length === 0 ? (
              <EmptyState icon={Stethoscope} message="No OR cases match the current filters." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredOr.map((c) => {
                  const slowWake = emergenceFlag(c);
                  const tricky = ["Difficult", "Aspiration risk"].includes(c.airway);
                  return (
                    <article
                      key={c.id}
                      className={`rounded-2xl border bg-slate-900/70 p-4 ${tricky ? "border-amber-500/40" : slowWake ? "border-red-500/40" : "border-slate-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => setModal({ kind: "or", data: c })} className="text-left">
                            <p className="text-sm font-semibold text-slate-100 hover:text-emerald-300">{c.patient}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{c.id} · {c.room} · {c.procedure}</p>
                          </button>
                        </div>
                        <Badge tone={c.phase}>{c.phase}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                        <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-300">ASA {c.asa}</span>
                        <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-300">{c.technique}</span>
                        <span className={`rounded-md border px-2 py-1 ${tricky ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}>
                          {c.airway}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={12} /> {c.mins} min in phase
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <User size={12} /> {c.anes}
                        </span>
                      </div>
                      {slowWake && (
                        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-[11px] leading-relaxed text-red-200">
                          Emergence exceeding {EMERGENCE_WINDOW_MIN} min — assess residual blockade, opioids, neuromuscular reversal.
                        </p>
                      )}
                      {c.phase !== "To PACU" && (
                        <button
                          onClick={() => advancePhase(c.id)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <ArrowRight size={13} /> Advance to next phase
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================= PACU RECOVERY WATCH ============================= */}
        {tab === "pacu" && (
          <section>
            {filteredPacu.length === 0 ? (
              <EmptyState icon={HeartPulse} message="No PACU patients match the current filters." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPacu.map((p) => {
                  const readiness = aldreteReadiness(p);
                  const respFlag = p.resp !== "Clear";
                  return (
                    <article
                      key={p.id}
                      className={`rounded-2xl border bg-slate-900/70 p-4 ${readiness.tone === "red" ? "border-red-500/40" : readiness.tone === "amber" ? "border-amber-500/40" : "border-emerald-500/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => setModal({ kind: "pacu", data: p })} className="text-left">
                            <p className="text-sm font-semibold text-slate-100 hover:text-emerald-300">{p.patient}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{p.id} · from {p.fromOr} · {p.nurse}</p>
                          </button>
                        </div>
                        <Badge tone={readiness.verdict}>{readiness.verdict}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60">
                          <span className={`text-xl font-bold ${p.aldrete >= ALDRETE_DISCHARGE ? "text-emerald-300" : "text-amber-300"}`}>{p.aldrete}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <p>Modified Aldrete / 10</p>
                          <p className="mt-1 inline-flex items-center gap-1.5">
                            <Thermometer size={12} /> {p.mins} min in PACU
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                        <span className={`rounded-md border px-2 py-1 ${p.ponv ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}>
                          {p.ponv ? "PONV active" : "No PONV"}
                        </span>
                        <span className={`rounded-md border px-2 py-1 ${respFlag ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}>
                          {p.resp}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.ponv && (
                          <button
                            onClick={() => treatPonv(p.id)}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
                          >
                            Treat PONV
                          </button>
                        )}
                        {respFlag && (
                          <button
                            onClick={() => fixResp(p.id)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            Resolve event
                          </button>
                        )}
                        {readiness.verdict === "Ready" && (
                          <button
                            onClick={() => discharge(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 size={13} /> Discharge
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================= BLOCK & PAIN SERVICE ============================= */}
        {tab === "blocks" && (
          <section>
            {filteredBlocks.length === 0 ? (
              <EmptyState icon={Syringe} message="No blocks match the current filters." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredBlocks.map((b) => {
                  const la = laCeiling(b);
                  const overDose = la.over;
                  const dwellDue = b.dwellDays >= CATHETER_DWELL_MAX;
                  return (
                    <article
                      key={b.id}
                      className={`rounded-2xl border bg-slate-900/70 p-4 ${overDose ? "border-red-500/40" : dwellDue ? "border-amber-500/40" : "border-slate-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => setModal({ kind: "block", data: b })} className="text-left">
                            <p className="text-sm font-semibold text-slate-100 hover:text-emerald-300">{b.patient}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{b.id} · {b.block}</p>
                          </button>
                        </div>
                        {b.catheter ? <Badge tone={`Catheter d${b.dwellDays}`}>Catheter</Badge> : <Badge tone="Clear">Single shot</Badge>}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">{b.agent}</span>
                          <span className={overDose ? "font-semibold text-red-300" : "text-slate-300"}>{b.doseMg} mg</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${overDose ? "bg-red-500" : la.pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, la.pct)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {la.pct}% of {la.maxMg} mg ceiling ({la.ceiling} mg/kg × {b.weightKg} kg)
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-slate-400">
                          {b.painTrend === "down" ? <TrendingDown size={12} className="text-emerald-400" /> : b.painTrend === "up" ? <TrendingUp size={12} className="text-red-400" /> : <Activity size={12} className="text-amber-400" />}
                          Pain {b.painNow}/10
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => addPainScore(b.id, -0.5)} className="rounded-md border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:bg-slate-800" title="Record pain improvement">−</button>
                          <button onClick={() => addPainScore(b.id, 0.5)} className="rounded-md border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:bg-slate-800" title="Record pain increase">+</button>
                        </span>
                      </div>
                      {dwellDue && (
                        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-amber-200">
                          Catheter dwell ≥ {CATHETER_DWELL_MAX} days — remove per infection-prevention protocol.
                        </p>
                      )}
                      {b.catheter && (
                        <button
                          onClick={() => markBlockDone(b.id)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          <Plus size={13} /> Remove catheter
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ============================= INSPECTION MODAL ============================= */}
      {modal && modal.kind === "or" && (
        <Modal title={modal.data.patient} subtitle={`${modal.data.id} · ${modal.data.room} · ${modal.data.procedure}`} onClose={() => setModal(null)}>
          <Row label="ASA physical status" value={modal.data.asa} />
          <Row label="Technique" value={modal.data.technique} />
          <Row label="Airway" value={modal.data.airway} accent={modal.data.airway !== "Standard" ? "text-amber-300" : undefined} />
          <Row label="Phase" value={modal.data.phase} />
          <Row label="Minutes in phase" value={modal.data.mins} />
          <Row label="Surgeon" value={modal.data.surgeon} />
          <Row label="Anesthetist" value={modal.data.anes} />
          {emergenceFlag(modal.data) && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-[11px] leading-relaxed text-red-200">
              Emergence beyond {EMERGENCE_WINDOW_MIN} minutes. Work through residual neuromuscular blockade, opioid depression,
              hypothermia and metabolic causes before blaming the anaesthetic itself — the wake-up is the last reversible part of
              the case and the part where most of the harm is done.
            </p>
          )}
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
            {modal.data.airway === "Difficult"
              ? "A documented difficult airway changes the whole induction: the plan for a failed intubation, the rescue device at hand, and the decision threshold for waking the patient up and aborting rather than pressing on. The flag is carried here so the OR team sees it before the knife does."
              : modal.data.airway === "Aspiration risk"
                ? "Aspiration risk (obstetric, full stomach, reflux) means rapid-sequence induction, cricoid pressure or its modern equivalent, and a plan for the airway that assumes the worst case. Regional anaesthesia where possible removes the airway from the equation entirely."
                : "Standard airway, but the checklist still matters: the ASA physical status and the technique determine which monitors are mandatory and which rescue drugs are drawn up before induction begins."}
          </p>
        </Modal>
      )}

      {modal && modal.kind === "pacu" && (
        <Modal title={modal.data.patient} subtitle={`${modal.data.id} · from ${modal.data.fromOr} · ${modal.data.nurse}`} onClose={() => setModal(null)}>
          <Row label="Minutes in PACU" value={modal.data.mins} />
          <Row label="Modified Aldrete" value={`${modal.data.aldrete} / 10`} accent={modal.data.aldrete >= ALDRETE_DISCHARGE ? "text-emerald-300" : "text-amber-300"} />
          <Row label="PONV" value={modal.data.ponv ? "Active" : "None"} accent={modal.data.ponv ? "text-amber-300" : undefined} />
          <Row label="Respiratory status" value={modal.data.resp} accent={modal.data.resp !== "Clear" ? "text-red-300" : undefined} />
          <Row label="Discharge verdict" value={aldreteReadiness(modal.data).verdict} accent={aldreteReadiness(modal.data).tone === "green" ? "text-emerald-300" : aldreteReadiness(modal.data).tone === "amber" ? "text-amber-300" : "text-red-300"} />
          {modal.data.events.length > 0 && (
            <ul className="mt-3 space-y-2">
              {modal.data.events.map((event, i) => (
                <li key={i} className="rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
                  {event}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
            {aldreteReadiness(modal.data).reason} The modified Aldrete scores activity, respiration, circulation, consciousness
            and SpO₂ from 0–2 each. The engine will not sign a patient out on score alone — an airway event or active PONV holds
            discharge even at a 9, because the two biggest causes of PACU re-admission are exactly the things the score cannot see.
          </p>
        </Modal>
      )}

      {modal && modal.kind === "block" && (
        <Modal title={modal.data.patient} subtitle={`${modal.data.id} · ${modal.data.block}`} onClose={() => setModal(null)}>
          <Row label="Agent" value={modal.data.agent} />
          <Row label="Dose" value={`${modal.data.doseMg} mg`} />
          <Row label="Weight" value={`${modal.data.weightKg} kg`} />
          <Row label="Ceiling" value={`${laCeiling(modal.data).maxMg} mg (${laCeiling(modal.data).ceiling} mg/kg)`} />
          <Row label="Ceiling utilisation" value={`${laCeiling(modal.data).pct}%`} accent={laCeiling(modal.data).over ? "text-red-300" : laCeiling(modal.data).pct > 80 ? "text-amber-300" : "text-emerald-300"} />
          <Row label="Catheter" value={modal.data.catheter ? `In situ · day ${modal.data.dwellDays}` : "No"} accent={modal.data.dwellDays >= CATHETER_DWELL_MAX ? "text-amber-300" : undefined} />
          <Row label="Current pain" value={`${modal.data.painNow} / 10`} />
          <Row label="Anesthetist" value={modal.data.anes} />
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
            {laCeiling(modal.data).over
              ? `This dose sits above the ${laCeiling(modal.data).ceiling} mg/kg ceiling for ${modal.data.agent}. Local anaesthetic systemic toxicity is dose-dependent and the treatment is lipid emulsion — it is far easier to stay under the ceiling than to rescue the patient who crossed it.`
              : modal.data.dwellDays >= CATHETER_DWELL_MAX
                ? `The catheter has been in for ${modal.data.dwellDays} days. Infection risk rises steeply with dwell time, so the protocol mandates removal at ${CATHETER_DWELL_MAX} days regardless of how well the block is working.`
                : "Dose is inside the weight-based ceiling and the catheter (if any) is inside its dwell window. The pain trend tells the next move: a falling score means the block is working, a flat one means reassess catheter position and concentration."}
          </p>
        </Modal>
      )}

      {/* footer strip */}
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${sim.running ? "bg-emerald-400" : "bg-amber-400"}`} />
          {sim.running ? `Live simulation at ${sim.speed}× · tick #${sim.tick}` : "Simulation paused"}
        </span>
        <span className="hidden md:inline">ASA physical status · modified Aldrete scoring · ASRA/ESRA local anaesthetic ceilings</span>
        <span className="inline-flex items-center gap-1.5">
          <FileText size={12} /> {orCases.length} OR cases · {pacu.length} PACU beds · {blocks.length} blocks
        </span>
      </footer>
    </div>
  );
}
