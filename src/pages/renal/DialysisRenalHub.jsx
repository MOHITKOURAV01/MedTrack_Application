import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRightLeft, Bell, Beaker, CheckCircle2, Clock, Download,
  Droplet, Droplets, FileText, FlaskConical, Gauge, HeartPulse, Info, Layers, Pause, Play,
  Recycle, RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, Thermometer, Timer,
  TrendingDown, TrendingUp, Waves, Wrench, X,
} from "lucide-react";
import { ToneBadge } from "../../components/common/ToneBadge";
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { Row } from "../../components/common/InfoRow";
import { DetailModal as Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { Meter } from "../../components/common/MeterBar";
import { useSeverityToasts, SeverityToastTray } from "../../components/common/HubToasts";
import { downloadCsv } from "../../utils/csv";

/* ------------------------------------------------------------------ *
 *  Dialysis & Renal Replacement Therapy Fleet Hub
 *
 *  Four consoles over an outpatient haemodialysis unit:
 *
 *    1. Treatment Floor  - live sessions, delivered dose, ultrafiltration rate
 *    2. Water Treatment  - the RO loop that every one of those sessions depends on
 *    3. Machine Fleet    - disinfection state, running hours, preventive maintenance
 *    4. Reuse & Access   - dialyser reprocessing and vascular access surveillance
 *
 *  Standards the model follows: ISO 23500 for the preparation and quality
 *  management of fluids for haemodialysis, ISO 11663 for dialysis fluid quality,
 *  ISO 26722 for water treatment equipment, ISO 8637 for dialysers and their
 *  total cell volume, and the KDOQI adequacy targets for delivered dose.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Reference limits                                                   */
/* ------------------------------------------------------------------ */

/**
 * ISO 23500 water quality limits, as maximum allowable and action level.
 *
 * The action level exists because a result at the maximum is already a failure:
 * microbiology takes days to come back, so the unit intervenes at roughly half
 * the limit while there is still time to act before a patient is exposed. A
 * console that only showed the maximum would report every trend as fine right up
 * to the moment it was not.
 */
const WATER_LIMITS = {
  bacteria: { max: 100, action: 50, unit: "CFU/mL", label: "Total viable count" },
  endotoxin: { max: 0.25, action: 0.125, unit: "EU/mL", label: "Endotoxin" },
  chlorine: { max: 0.1, action: 0.05, unit: "mg/L", label: "Total chlorine" },
  hardness: { max: 2, action: 1, unit: "mg/L CaCO₃", label: "Hardness" },
  conductivity: { max: 20, action: 15, unit: "µS/cm", label: "Product conductivity" },
};

/**
 * Ultrafiltration rate thresholds in mL/kg/h.
 *
 * Pulling fluid faster than the interstitium can refill the vascular space is
 * what causes intradialytic hypotension, and sustained rates above 13 mL/kg/h
 * are associated with higher mortality in the observational literature. The
 * limit is per kilogram of body weight, not per session, which is why a 3-litre
 * removal is routine in one patient and dangerous in another.
 */
const UF_RATE_WARNING = 10;
const UF_RATE_CRITICAL = 13;

/** KDOQI minimum delivered dose for thrice-weekly haemodialysis. */
const KTV_TARGET = 1.2;

/** ISO 8637 minimum retained fibre bundle volume for a reprocessed dialyser. */
const TCV_MINIMUM_PCT = 80;

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const SESSIONS = [
  { station: "S-01", patient: "P-2201", weightKg: 78, dryWeightKg: 74.5, access: "AVF left radiocephalic", prescribedMin: 240, elapsedMin: 132, bloodFlow: 380, dialysateFlow: 500, ufRemovedMl: 1900, ufTargetMl: 3500, preBun: 62, postBun: 0, sbp: 128, hr: 74, temp: 36.6, machine: "HD-01", status: "Running", alarm: "" },
  { station: "S-02", patient: "P-4417", weightKg: 61, dryWeightKg: 58.0, access: "AVG right upper arm", prescribedMin: 240, elapsedMin: 208, bloodFlow: 350, dialysateFlow: 500, ufRemovedMl: 2600, ufTargetMl: 3000, preBun: 71, postBun: 0, sbp: 104, hr: 88, temp: 36.9, machine: "HD-02", status: "Running", alarm: "" },
  { station: "S-03", patient: "P-8890", weightKg: 94, dryWeightKg: 90.2, access: "Tunnelled CVC right IJ", prescribedMin: 210, elapsedMin: 61, bloodFlow: 280, dialysateFlow: 500, ufRemovedMl: 900, ufTargetMl: 3800, preBun: 58, postBun: 0, sbp: 142, hr: 69, temp: 36.4, machine: "HD-03", status: "Running", alarm: "Arterial pressure low" },
  { station: "S-04", patient: "P-1102", weightKg: 52, dryWeightKg: 49.8, access: "AVF left brachiocephalic", prescribedMin: 240, elapsedMin: 240, bloodFlow: 400, dialysateFlow: 700, ufRemovedMl: 2200, ufTargetMl: 2200, preBun: 66, postBun: 19, sbp: 118, hr: 71, temp: 36.5, machine: "HD-04", status: "Complete", alarm: "" },
  { station: "S-05", patient: "P-6634", weightKg: 88, dryWeightKg: 84.0, access: "AVF right radiocephalic", prescribedMin: 240, elapsedMin: 95, bloodFlow: 360, dialysateFlow: 500, ufRemovedMl: 1600, ufTargetMl: 4000, preBun: 74, postBun: 0, sbp: 96, hr: 102, temp: 36.8, machine: "HD-05", status: "Running", alarm: "Hypotension — UF paused" },
  { station: "S-06", patient: "P-3327", weightKg: 70, dryWeightKg: 67.5, access: "AVG left forearm", prescribedMin: 210, elapsedMin: 210, bloodFlow: 340, dialysateFlow: 500, ufRemovedMl: 2500, ufTargetMl: 2500, preBun: 69, postBun: 28, sbp: 124, hr: 76, temp: 36.6, machine: "HD-06", status: "Complete", alarm: "" },
  { station: "S-07", patient: "P-9915", weightKg: 58, dryWeightKg: 54.6, access: "Tunnelled CVC left IJ", prescribedMin: 200, elapsedMin: 18, bloodFlow: 250, dialysateFlow: 500, ufRemovedMl: 200, ufTargetMl: 3400, preBun: 81, postBun: 0, sbp: 136, hr: 80, temp: 36.7, machine: "HD-07", status: "Running", alarm: "" },
  { station: "S-08", patient: "—", weightKg: 0, dryWeightKg: 0, access: "—", prescribedMin: 0, elapsedMin: 0, bloodFlow: 0, dialysateFlow: 0, ufRemovedMl: 0, ufTargetMl: 0, preBun: 0, postBun: 0, sbp: 0, hr: 0, temp: 0, machine: "HD-08", status: "Turnaround", alarm: "" },
];

const WATER_SAMPLES = [
  { id: "WQ-501", point: "RO product — loop feed", bacteria: 12, endotoxin: 0.04, chlorine: 0.01, hardness: 0.2, conductivity: 7.4, sampled: "06:10 today", method: "TSA 35 °C / 48 h" },
  { id: "WQ-502", point: "Loop return", bacteria: 41, endotoxin: 0.09, chlorine: 0.01, hardness: 0.3, conductivity: 8.1, sampled: "06:14 today", method: "TSA 35 °C / 48 h" },
  { id: "WQ-503", point: "Station S-05 dialysate", bacteria: 68, endotoxin: 0.14, chlorine: 0.02, hardness: 0.4, conductivity: 13.9, sampled: "06:22 today", method: "TSA 35 °C / 48 h" },
  { id: "WQ-504", point: "Station S-03 dialysate", bacteria: 22, endotoxin: 0.05, chlorine: 0.02, hardness: 0.3, conductivity: 9.0, sampled: "06:26 today", method: "TSA 35 °C / 48 h" },
  { id: "WQ-505", point: "Softener outlet", bacteria: 94, endotoxin: 0.19, chlorine: 0.12, hardness: 1.6, conductivity: 18.2, sampled: "06:31 today", method: "TSA 35 °C / 48 h" },
  { id: "WQ-506", point: "Carbon tank 2 outlet", bacteria: 55, endotoxin: 0.11, chlorine: 0.04, hardness: 0.9, conductivity: 16.4, sampled: "06:35 today", method: "TSA 35 °C / 48 h" },
];

const MACHINES = [
  { id: "HD-01", model: "Fresenius 5008S", hours: 12840, station: "S-01", disinfection: "Heat citric", lastDisinfect: "5 h ago", nextService: "in 210 h", conductivityCal: "in range", status: "In service", faults: 0 },
  { id: "HD-02", model: "Fresenius 5008S", hours: 14102, station: "S-02", disinfection: "Heat citric", lastDisinfect: "6 h ago", nextService: "in 98 h", conductivityCal: "in range", status: "In service", faults: 1 },
  { id: "HD-03", model: "Nikkiso DBB-27", hours: 9611, station: "S-03", disinfection: "Chemical peracetic", lastDisinfect: "18 h ago", nextService: "in 389 h", conductivityCal: "drift 1.2%", status: "In service", faults: 2 },
  { id: "HD-04", model: "Baxter Artis Physio", hours: 16330, station: "S-04", disinfection: "Heat citric", lastDisinfect: "2 h ago", nextService: "overdue", conductivityCal: "in range", status: "In service", faults: 0 },
  { id: "HD-05", model: "Fresenius 6008 CAREsystem", hours: 4208, station: "S-05", disinfection: "Heat citric", lastDisinfect: "7 h ago", nextService: "in 812 h", conductivityCal: "in range", status: "In service", faults: 0 },
  { id: "HD-06", model: "Nikkiso DBB-27", hours: 11077, station: "S-06", disinfection: "Chemical peracetic", lastDisinfect: "20 h ago", nextService: "in 145 h", conductivityCal: "in range", status: "In service", faults: 0 },
  { id: "HD-07", model: "Baxter Artis Physio", hours: 15984, station: "S-07", disinfection: "Heat citric", lastDisinfect: "4 h ago", nextService: "in 62 h", conductivityCal: "in range", status: "In service", faults: 1 },
  { id: "HD-08", model: "Fresenius 5008S", hours: 13750, station: "S-08", disinfection: "Heat citric", lastDisinfect: "in progress", nextService: "in 300 h", conductivityCal: "in range", status: "Disinfecting", faults: 0 },
  { id: "HD-09", model: "Nikkiso DBB-27", hours: 18220, station: "spare", disinfection: "Chemical peracetic", lastDisinfect: "2 d ago", nextService: "overdue", conductivityCal: "drift 2.8%", status: "Out of service", faults: 4 },
  { id: "HD-10", model: "Fresenius 6008 CAREsystem", hours: 2100, station: "spare", disinfection: "Heat citric", lastDisinfect: "1 d ago", nextService: "in 940 h", conductivityCal: "in range", status: "Standby", faults: 0 },
];

const DIALYSERS = [
  { id: "DZ-7701", patient: "P-2201", model: "Fresenius FX80", uses: 4, maxUses: 12, tcvPct: 94, pressureTest: "Pass", sterilant: "Peracetic 3.5%", lastReprocessed: "2 d ago" },
  { id: "DZ-7702", patient: "P-4417", model: "Baxter Revaclear 400", uses: 9, maxUses: 12, tcvPct: 86, pressureTest: "Pass", sterilant: "Peracetic 3.5%", lastReprocessed: "1 d ago" },
  { id: "DZ-7703", patient: "P-8890", model: "Fresenius FX100", uses: 11, maxUses: 12, tcvPct: 79, pressureTest: "Pass", sterilant: "Peracetic 3.5%", lastReprocessed: "1 d ago" },
  { id: "DZ-7704", patient: "P-1102", model: "Nipro Elisio 17H", uses: 2, maxUses: 12, tcvPct: 97, pressureTest: "Pass", sterilant: "Peracetic 3.5%", lastReprocessed: "3 d ago" },
  { id: "DZ-7705", patient: "P-6634", model: "Fresenius FX80", uses: 7, maxUses: 12, tcvPct: 88, pressureTest: "Fail", sterilant: "Peracetic 3.5%", lastReprocessed: "2 d ago" },
  { id: "DZ-7706", patient: "P-3327", model: "Baxter Revaclear 400", uses: 12, maxUses: 12, tcvPct: 83, pressureTest: "Pass", sterilant: "Peracetic 3.5%", lastReprocessed: "1 d ago" },
];

const ACCESS_SURVEILLANCE = [
  { patient: "P-2201", type: "AVF", site: "Left radiocephalic", flowMlMin: 940, recirculationPct: 4, venousPressure: 118, ageMonths: 34, trend: "stable", note: "" },
  { patient: "P-4417", type: "AVG", site: "Right upper arm", flowMlMin: 580, recirculationPct: 11, venousPressure: 191, ageMonths: 19, trend: "falling", note: "Flow down 32% over 8 weeks — refer for fistulogram" },
  { patient: "P-8890", type: "CVC", site: "Right internal jugular", flowMlMin: 0, recirculationPct: 0, venousPressure: 164, ageMonths: 7, trend: "stable", note: "Catheter — highest infection risk, convert when vein mapping allows" },
  { patient: "P-1102", type: "AVF", site: "Left brachiocephalic", flowMlMin: 1180, recirculationPct: 3, venousPressure: 102, ageMonths: 52, trend: "stable", note: "" },
  { patient: "P-6634", type: "AVF", site: "Right radiocephalic", flowMlMin: 490, recirculationPct: 16, venousPressure: 205, ageMonths: 28, trend: "falling", note: "Recirculation above 15% — dose is being wasted" },
  { patient: "P-3327", type: "AVG", site: "Left forearm", flowMlMin: 720, recirculationPct: 7, venousPressure: 148, ageMonths: 11, trend: "stable", note: "" },
  { patient: "P-9915", type: "CVC", site: "Left internal jugular", flowMlMin: 0, recirculationPct: 0, venousPressure: 177, ageMonths: 3, trend: "stable", note: "Catheter — highest infection risk" },
];

/* ------------------------------------------------------------------ */
/*  Domain calculations                                                */
/* ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Single-pool Kt/V by the Daugirdas second-generation formula.
 *
 *   Kt/V = −ln(R − 0.008·t) + (4 − 3.5·R) · UF/W
 *
 * where R is the post/pre urea ratio, t is session hours, UF is the volume
 * removed in litres and W is post-dialysis weight in kilograms. The convective
 * term matters: two patients with identical urea reduction get different doses
 * if one had four litres pulled and the other had none, and a urea-reduction
 * ratio alone hides that entirely.
 *
 * Returns null before the post-dialysis sample exists, which is the honest
 * answer mid-session — a partial dose is not a dose.
 */
function singlePoolKtV(session) {
  if (!session.postBun || !session.preBun || session.status !== "Complete") {
    return null;
  }
  const ratio = session.postBun / session.preBun;
  const hours = session.elapsedMin / 60;
  const ultrafiltrationL = session.ufRemovedMl / 1000;
  const postWeight = session.weightKg - ultrafiltrationL;
  if (postWeight <= 0) return null;
  const value = -Math.log(ratio - 0.008 * hours) + (4 - 3.5 * ratio) * (ultrafiltrationL / postWeight);
  return Number(value.toFixed(2));
}

/** Urea reduction ratio, the simpler measure Kt/V refines. */
function ureaReductionRatio(session) {
  if (!session.postBun || !session.preBun) return null;
  return Math.round((1 - session.postBun / session.preBun) * 100);
}

/**
 * Ultrafiltration rate in mL/kg/h, projected over the whole prescription.
 *
 * Normalising by weight is the point: removing 3.5 litres over four hours is
 * routine in a 90 kg patient (9.7 mL/kg/h) and dangerous in a 50 kg one
 * (17.5 mL/kg/h). Projecting over the prescribed time rather than the elapsed
 * time answers the question the nurse actually has, which is whether the plan
 * for the rest of the session is safe.
 */
function ultrafiltrationRate(session) {
  if (!session.weightKg || !session.prescribedMin) return null;
  const hours = session.prescribedMin / 60;
  return Number((session.ufTargetMl / session.weightKg / hours).toFixed(1));
}

function ufRateBand(rate) {
  if (rate === null) return "n/a";
  if (rate >= UF_RATE_CRITICAL) return "Critical";
  if (rate >= UF_RATE_WARNING) return "Elevated";
  return "Within target";
}

/** Fraction of the prescribed treatment time actually delivered so far. */
function sessionProgress(session) {
  if (!session.prescribedMin) return 0;
  return clamp(Math.round((session.elapsedMin / session.prescribedMin) * 100), 0, 100);
}

/**
 * Grades one water sample against ISO 23500.
 *
 * Every analyte is graded, and the sample takes the worst grade of any of them —
 * a sample that passes on five analytes and exceeds on one is a failing sample,
 * not a mostly-fine one.
 */
function gradeWaterSample(sample) {
  const analytes = Object.entries(WATER_LIMITS).map(([key, limit]) => {
    const value = sample[key];
    const grade = value > limit.max ? "Exceeds" : value >= limit.action ? "Action level" : "In range";
    return { key, value, grade, ...limit };
  });
  const worst = analytes.some((a) => a.grade === "Exceeds")
    ? "Exceeds"
    : analytes.some((a) => a.grade === "Action level")
    ? "Action level"
    : "In range";
  return { analytes, worst };
}

/**
 * Whether a reprocessed dialyser may go back on a patient.
 *
 * Three independent gates, all of which have to hold: retained fibre bundle
 * volume at or above 80 % of original (below that, clearance has measurably
 * fallen), an intact pressure test, and the reuse count within the labelled
 * maximum. Failing any one of them condemns the device.
 */
function dialyserBlockers(dialyser) {
  const blockers = [];
  if (dialyser.tcvPct < TCV_MINIMUM_PCT) {
    blockers.push(`Total cell volume ${dialyser.tcvPct}% is below the ${TCV_MINIMUM_PCT}% minimum`);
  }
  if (dialyser.pressureTest !== "Pass") {
    blockers.push("Pressure integrity test failed — fibre leak suspected");
  }
  if (dialyser.uses >= dialyser.maxUses) {
    blockers.push(`Reuse count ${dialyser.uses} has reached the labelled maximum of ${dialyser.maxUses}`);
  }
  return blockers;
}

/**
 * Vascular access risk.
 *
 * Recirculation above 15 % means dialysed blood is being pulled straight back
 * into the dialyser, so the delivered dose is lower than the machine reports.
 * Falling access flow on a graft is the classic precursor to thrombosis, and a
 * catheter is always the highest-risk option regardless of how well it runs.
 */
function accessRisk(access) {
  if (access.recirculationPct > 15) return "High";
  if (access.type === "AVG" && access.trend === "falling") return "High";
  if (access.type === "CVC") return "Elevated";
  if (access.trend === "falling") return "Elevated";
  return "Low";
}

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  if (["Critical", "Exceeds", "High", "Out of service", "Fail", "overdue"].includes(value)) return "red";
  if (["Elevated", "Action level", "Disinfecting", "falling"].includes(value)) return "amber";
  if (["Within target", "In range", "Low", "In service", "Complete", "Pass", "stable"].includes(value)) return "green";
  if (["Running", "Standby", "Turnaround"].includes(value)) return "sky";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge tone={tone} toneOf={toneOf}>{children}</ToneBadge>;



/* ------------------------------------------------------------------ */
/*  Live simulation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Advances running sessions.
 *
 * Fluid removal tracks the prescription rather than a fixed increment, so a
 * session with an aggressive UF target genuinely pulls faster and the rate the
 * console reports stays consistent with the volume it shows. A hypotensive
 * patient has ultrafiltration paused, which is what the floor actually does.
 */
function useSimulation({ sessionsRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    setTick((current) => current + 1);

    sessionsRef.current = sessionsRef.current.map((session) => {
      if (session.status !== "Running") return session;

      const elapsedMin = Math.min(session.prescribedMin, session.elapsedMin + 5);
      const remainingMin = Math.max(1, session.prescribedMin - session.elapsedMin);
      const perMinute = (session.ufTargetMl - session.ufRemovedMl) / remainingMin;

      // Ultrafiltration is held while the patient is hypotensive: the plasma
      // refill rate, not the pump, is the binding constraint.
      const hypotensive = session.sbp < 100;
      const ufRemovedMl = hypotensive
        ? session.ufRemovedMl
        : Math.min(session.ufTargetMl, Math.round(session.ufRemovedMl + perMinute * 5));

      const sbp = clamp(Math.round(session.sbp + (Math.random() * 8 - 4.6)), 78, 175);
      const hr = clamp(Math.round(session.hr + (Math.random() * 6 - 3)), 52, 128);

      let alarm = session.alarm;
      if (sbp < 100 && !session.alarm) {
        alarm = "Hypotension — UF paused";
        toast(`${session.station}: systolic ${sbp} mmHg, ultrafiltration paused`, "High");
      } else if (sbp >= 105 && session.alarm.startsWith("Hypotension")) {
        alarm = "";
        toast(`${session.station}: pressure recovered, ultrafiltration resumed`, "Low");
      }

      if (elapsedMin >= session.prescribedMin) {
        // The post-dialysis urea sample is what makes a delivered dose
        // computable; before it exists, Kt/V is genuinely unknown.
        const postBun = Math.round(session.preBun * (0.26 + Math.random() * 0.12));
        toast(`${session.station}: treatment complete, post-dialysis sample drawn`, "Low");
        return { ...session, elapsedMin, ufRemovedMl, sbp, hr, alarm: "", postBun, status: "Complete" };
      }

      return { ...session, elapsedMin, ufRemovedMl, sbp, hr, alarm };
    });
  }, [sessionsRef, toast]);

  useEffect(() => {
    const interval = setInterval(loop, Math.round(2300 / speedRef.current));
    return () => clearInterval(interval);
  }, [loop]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      sessionsRef.current = SESSIONS.map((session) => ({ ...session }));
      setTick(0);
      toast("Renal console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DialysisRenalHub() {
  const [tab, setTab] = useState("floor");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [machineFilter, setMachineFilter] = useState("All");

  const { toasts, toast, removeToast } = useSeverityToasts();

  const [sessions, setSessions] = useState(() => SESSIONS.map((session) => ({ ...session })));
  const [dialysers, setDialysers] = useState(() => DIALYSERS.map((dialyser) => ({ ...dialyser })));

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const simulation = useSimulation({ sessionsRef, toast });

  useEffect(() => {
    setSessions([...sessionsRef.current]);
  }, [simulation.tick]);

  /* ---------- derived ---------- */

  const activeSessions = useMemo(() => sessions.filter((session) => session.status === "Running"), [sessions]);

  const stats = useMemo(() => {
    const unsafeUf = sessions.filter((session) => {
      const rate = ultrafiltrationRate(session);
      return rate !== null && rate >= UF_RATE_CRITICAL;
    }).length;
    const alarms = sessions.filter((session) => session.alarm).length;
    const belowTarget = sessions.filter((session) => {
      const dose = singlePoolKtV(session);
      return dose !== null && dose < KTV_TARGET;
    }).length;
    return { running: activeSessions.length, unsafeUf, alarms, belowTarget };
  }, [sessions, activeSessions]);

  const waterGrades = useMemo(
    () => WATER_SAMPLES.map((sample) => ({ ...sample, ...gradeWaterSample(sample) })),
    []
  );

  const loopStatus = useMemo(() => {
    if (waterGrades.some((sample) => sample.worst === "Exceeds")) return "Exceeds";
    if (waterGrades.some((sample) => sample.worst === "Action level")) return "Action level";
    return "In range";
  }, [waterGrades]);

  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesQuery =
        !needle ||
        [session.station, session.patient, session.access, session.machine].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesStatus = statusFilter === "All" || session.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [sessions, query, statusFilter]);

  const filteredWater = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return waterGrades.filter(
      (sample) => !needle || [sample.id, sample.point, sample.worst].some((field) => field.toLowerCase().includes(needle))
    );
  }, [waterGrades, query]);

  const filteredMachines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MACHINES.filter((machine) => {
      const matchesQuery =
        !needle ||
        [machine.id, machine.model, machine.station, machine.status].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesStatus = machineFilter === "All" || machine.status === machineFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, machineFilter]);

  const filteredDialysers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dialysers.filter(
      (dialyser) =>
        !needle || [dialyser.id, dialyser.patient, dialyser.model].some((field) => field.toLowerCase().includes(needle))
    );
  }, [dialysers, query]);

  /* ---------- actions ---------- */

  const condemnDialyser = (id) => {
    setDialysers((current) => current.map((item) => (item.id === id ? { ...item, uses: item.maxUses, tcvPct: 0 } : item)));
    toast(`${id} condemned and removed from the reuse pool`, "Medium");
  };

  const acknowledgeAlarm = (station) => {
    setSessions((current) => current.map((session) => (session.station === station ? { ...session, alarm: "" } : session)));
    toast(`${station}: alarm acknowledged`, "Low");
  };

  const exportCsv = () => {
    const table =
      tab === "floor"
        ? [
            ["Station", "Patient", "Access", "Machine", "Status", "Elapsed", "Prescribed", "UF removed", "UF target", "UF rate", "Kt/V"],
            ...filteredSessions.map((session) => [
              session.station,
              session.patient,
              session.access,
              session.machine,
              session.status,
              session.elapsedMin,
              session.prescribedMin,
              session.ufRemovedMl,
              session.ufTargetMl,
              ultrafiltrationRate(session) ?? "n/a",
              singlePoolKtV(session) ?? "pending",
            ]),
          ]
        : tab === "water"
        ? [
            ["Sample", "Point", "Bacteria", "Endotoxin", "Chlorine", "Hardness", "Conductivity", "Grade"],
            ...filteredWater.map((sample) => [
              sample.id,
              sample.point,
              sample.bacteria,
              sample.endotoxin,
              sample.chlorine,
              sample.hardness,
              sample.conductivity,
              sample.worst,
            ]),
          ]
        : tab === "fleet"
        ? [
            ["Machine", "Model", "Station", "Hours", "Disinfection", "Last disinfected", "Next service", "Status", "Faults"],
            ...filteredMachines.map((machine) => [
              machine.id,
              machine.model,
              machine.station,
              machine.hours,
              machine.disinfection,
              machine.lastDisinfect,
              machine.nextService,
              machine.status,
              machine.faults,
            ]),
          ]
        : [
            ["Dialyser", "Patient", "Model", "Uses", "Max", "TCV %", "Pressure test", "Releasable"],
            ...filteredDialysers.map((dialyser) => [
              dialyser.id,
              dialyser.patient,
              dialyser.model,
              dialyser.uses,
              dialyser.maxUses,
              dialyser.tcvPct,
              dialyser.pressureTest,
              dialyserBlockers(dialyser).length === 0 ? "Yes" : "No",
            ]),
          ];

    downloadCsv(`dialysis-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "floor", label: "Treatment Floor", icon: HeartPulse },
    { id: "water", label: "Water Treatment", icon: Waves },
    { id: "fleet", label: "Machine Fleet", icon: Wrench },
    { id: "reuse", label: "Reuse & Vascular Access", icon: Recycle },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <SeverityToastTray toasts={toasts} onDismiss={removeToast} />

      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-400">
              <Droplets size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Dialysis &amp; Renal Replacement Therapy Fleet Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Treatment floor · water treatment · machine fleet · reuse and access — ISO 23500 / KDOQI aligned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5">
              <button
                onClick={() => simulation.setRunning(!simulation.running)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
                title={simulation.running ? "Pause simulation" : "Resume simulation"}
                aria-label={simulation.running ? "Pause simulation" : "Resume simulation"}
              >
                {simulation.running ? <Pause size={15} /> : <Play size={15} />}
              </button>
              {[1, 2, 4].map((factor) => (
                <button
                  key={factor}
                  onClick={() => simulation.setSpeed(factor)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    simulation.speed === factor ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {factor}×
                </button>
              ))}
              <button
                onClick={simulation.reset}
                className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Reset simulation"
                aria-label="Reset simulation"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-sky-500/40 hover:text-sky-300"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={HeartPulse}
            label="Sessions running"
            value={stats.running}
            sub={`${sessions.length} stations on the floor`}
            accent="text-sky-400"
          />
          <StatCard
            icon={TrendingUp}
            label="UF rate over 13 mL/kg/h"
            value={stats.unsafeUf}
            sub="prescriptions above the safety ceiling"
            accent={stats.unsafeUf > 0 ? "text-red-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Siren}
            label="Active alarms"
            value={stats.alarms}
            sub="hypotension and pressure alerts"
            accent={stats.alarms > 0 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Gauge}
            label="Water loop"
            value={loopStatus}
            sub="worst grade across all sample points"
            accent={loopStatus === "In range" ? "text-emerald-400" : loopStatus === "Action level" ? "text-amber-400" : "text-red-400"}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon size={15} />
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stations, patients, machines, sample points…"
              aria-label="Search the renal unit"
              className="w-80 rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
            />
          </div>
          {tab === "floor" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Running", "Complete", "Turnaround"].map((option) => (
                <button
                  key={option}
                  onClick={() => setStatusFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    statusFilter === option
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {tab === "fleet" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "In service", "Disinfecting", "Standby", "Out of service"].map((option) => (
                <button
                  key={option}
                  onClick={() => setMachineFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    machineFilter === option
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-6">
        {tab === "floor" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSessions.map((session) => {
              const rate = ultrafiltrationRate(session);
              const band = ufRateBand(rate);
              const dose = singlePoolKtV(session);
              const progress = sessionProgress(session);
              return (
                <div
                  key={session.station}
                  className={`rounded-2xl border bg-slate-900/60 p-5 ${
                    session.alarm ? "border-amber-500/40" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{session.station}</h3>
                        <Badge>{session.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {session.patient === "—" ? "Station empty" : `${session.patient} · ${session.machine}`}
                      </p>
                      {session.access !== "—" && <p className="mt-0.5 text-[11px] text-slate-500">{session.access}</p>}
                    </div>
                    <button
                      onClick={() => setModal({ kind: "session", session })}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-500/40 hover:text-sky-300"
                    >
                      Detail
                    </button>
                  </div>

                  {session.status === "Turnaround" ? (
                    <p className="mt-6 text-center text-xs text-slate-500">Station in turnaround — machine disinfecting.</p>
                  ) : (
                    <>
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Treatment time</span>
                          <span className="text-slate-300">
                            {session.elapsedMin} / {session.prescribedMin} min
                          </span>
                        </div>
                        <Meter value={progress} color={progress >= 100 ? "bg-emerald-400" : "bg-sky-400"} full />
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Fluid removed</span>
                          <span className="text-slate-300">
                            {session.ufRemovedMl} / {session.ufTargetMl} mL
                          </span>
                        </div>
                        <Meter
                          value={(session.ufRemovedMl / Math.max(1, session.ufTargetMl)) * 100}
                          color="bg-cyan-400"
                          full
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-[10px] text-slate-500">UF rate</div>
                          <div
                            className={`mt-0.5 text-sm font-semibold ${
                              band === "Critical" ? "text-red-400" : band === "Elevated" ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            {rate ?? "—"}
                          </div>
                          <div className="text-[10px] text-slate-600">mL/kg/h</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-[10px] text-slate-500">Systolic</div>
                          <div className={`mt-0.5 text-sm font-semibold ${session.sbp < 100 ? "text-red-400" : "text-slate-100"}`}>
                            {session.sbp}
                          </div>
                          <div className="text-[10px] text-slate-600">mmHg</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-[10px] text-slate-500">Kt/V</div>
                          <div
                            className={`mt-0.5 text-sm font-semibold ${
                              dose === null ? "text-slate-500" : dose >= KTV_TARGET ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {dose ?? "—"}
                          </div>
                          <div className="text-[10px] text-slate-600">{dose === null ? "pending" : `target ${KTV_TARGET}`}</div>
                        </div>
                      </div>

                      {session.alarm && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-[11px] text-amber-300">
                            <AlertTriangle size={13} /> {session.alarm}
                          </span>
                          <button
                            onClick={() => acknowledgeAlarm(session.station)}
                            className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:text-amber-300"
                          >
                            Ack
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {filteredSessions.length === 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState message="No stations match the current search and filter." icon={Droplets} />
              </div>
            )}
          </div>
        )}

        {tab === "water" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Info size={15} className="text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-200">Action level versus maximum</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A patient meets roughly 120 litres of dialysis fluid a week across a membrane, so the water loop is the
                single most consequential piece of plant in the unit. ISO 23500 pairs every limit with an action level
                at about half of it, because microbiology takes 48 hours to come back: intervening at the maximum means
                intervening two days after the exposure. Each sample below takes the worst grade of any of its analytes
                — one exceedance makes the sample a failure, not a mostly-fine result.
              </p>
            </div>

            <div className="space-y-3">
              {filteredWater.map((sample) => (
                <div key={sample.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{sample.point}</h3>
                        <Badge>{sample.worst}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {sample.id} · sampled {sample.sampled} · {sample.method}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {sample.analytes.map((analyte) => (
                      <div key={analyte.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="text-[10px] text-slate-500">{analyte.label}</div>
                        <div
                          className={`mt-1 text-sm font-semibold ${
                            analyte.grade === "Exceeds"
                              ? "text-red-400"
                              : analyte.grade === "Action level"
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {analyte.value} <span className="text-[10px] font-normal text-slate-500">{analyte.unit}</span>
                        </div>
                        <div className="mt-1.5">
                          <Meter
                            value={(analyte.value / analyte.max) * 100}
                            full
                            color={
                              analyte.grade === "Exceeds"
                                ? "bg-red-400"
                                : analyte.grade === "Action level"
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            }
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600">
                          action {analyte.action} · max {analyte.max}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredWater.length === 0 && <EmptyState message="No sample points match the search." icon={Droplets} />}
            </div>
          </div>
        )}

        {tab === "fleet" && (
          <section className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Machine</th>
                  <th className="px-4 py-3 font-medium">Station</th>
                  <th className="px-4 py-3 font-medium">Running hours</th>
                  <th className="px-4 py-3 font-medium">Disinfection</th>
                  <th className="px-4 py-3 font-medium">Next service</th>
                  <th className="px-4 py-3 font-medium">Conductivity cal.</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
                {filteredMachines.map((machine) => (
                  <tr key={machine.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{machine.id}</div>
                      <div className="text-[11px] text-slate-500">{machine.model}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{machine.station}</td>
                    <td className="px-4 py-3 text-slate-300">{machine.hours.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300">{machine.disinfection}</div>
                      <div className="text-[11px] text-slate-500">last {machine.lastDisinfect}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={machine.nextService === "overdue" ? "text-red-400" : "text-slate-300"}>
                        {machine.nextService}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={machine.conductivityCal === "in range" ? "text-slate-300" : "text-amber-400"}>
                        {machine.conductivityCal}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{machine.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMachines.length === 0 && <EmptyState message="No machines match the current search and filter." icon={Droplets} />}
          </section>
        )}

        {tab === "reuse" && (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Recycle size={15} className="text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-200">Dialyser reprocessing</h2>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                Three independent gates decide whether a reprocessed dialyser goes back on its patient: retained fibre
                bundle volume at or above {TCV_MINIMUM_PCT} % of original, an intact pressure test, and a reuse count
                inside the labelled maximum. Failing any one condemns the device — they are not weighed against one
                another.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredDialysers.map((dialyser) => {
                  const blockers = dialyserBlockers(dialyser);
                  return (
                    <div
                      key={dialyser.id}
                      className={`rounded-2xl border bg-slate-900/60 p-4 ${
                        blockers.length > 0 ? "border-red-500/30" : "border-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{dialyser.id}</div>
                          <div className="text-[11px] text-slate-500">
                            {dialyser.model} · {dialyser.patient}
                          </div>
                        </div>
                        <Badge tone={blockers.length > 0 ? "red" : "green"}>
                          {blockers.length > 0 ? "Condemned" : "Releasable"}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Total cell volume</span>
                          <span className={dialyser.tcvPct < TCV_MINIMUM_PCT ? "text-red-400" : "text-slate-300"}>
                            {dialyser.tcvPct}%
                          </span>
                        </div>
                        <Meter
                          value={dialyser.tcvPct}
                          color={dialyser.tcvPct < TCV_MINIMUM_PCT ? "bg-red-400" : "bg-emerald-400"}
                          full
                        />
                        <Row label="Reuse count" value={`${dialyser.uses} of ${dialyser.maxUses}`} />
                        <Row
                          label="Pressure test"
                          value={dialyser.pressureTest}
                          accent={dialyser.pressureTest === "Pass" ? "text-emerald-400" : "text-red-400"}
                        />
                        <Row label="Sterilant" value={dialyser.sterilant} />
                      </div>

                      {blockers.length > 0 ? (
                        <ul className="mt-3 space-y-1">
                          {blockers.map((blocker) => (
                            <li key={blocker} className="flex items-start gap-1.5 text-[10px] text-red-300">
                              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                              {blocker}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <button
                          onClick={() => condemnDialyser(dialyser.id)}
                          className="mt-3 w-full rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-red-500/40 hover:text-red-300"
                        >
                          Condemn
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {filteredDialysers.length === 0 && <EmptyState message="No dialysers match the search." icon={Droplets} />}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <ArrowRightLeft size={15} className="text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-200">Vascular access surveillance</h2>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Access</th>
                      <th className="px-4 py-3 font-medium">Flow</th>
                      <th className="px-4 py-3 font-medium">Recirculation</th>
                      <th className="px-4 py-3 font-medium">Venous pressure</th>
                      <th className="px-4 py-3 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
                    {ACCESS_SURVEILLANCE.map((access) => {
                      const risk = accessRisk(access);
                      return (
                        <tr key={access.patient} className="hover:bg-slate-900/50">
                          <td className="px-4 py-3 text-slate-300">{access.patient}</td>
                          <td className="px-4 py-3">
                            <div className="text-slate-200">
                              {access.type} · {access.site}
                            </div>
                            <div className="text-[11px] text-slate-500">{access.ageMonths} months old</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {access.flowMlMin === 0 ? "n/a" : `${access.flowMlMin} mL/min`}
                          </td>
                          <td className="px-4 py-3">
                            <span className={access.recirculationPct > 15 ? "text-red-400" : "text-slate-300"}>
                              {access.recirculationPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{access.venousPressure} mmHg</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge>{risk}</Badge>
                              {access.trend === "falling" && <TrendingDown size={13} className="text-amber-400" />}
                            </div>
                            {access.note && <div className="mt-1 text-[10px] text-slate-500">{access.note}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {modal?.kind === "session" && (
        <Modal
          title={modal.session.station}
          subtitle={modal.session.patient === "—" ? "Station empty" : `${modal.session.patient} · ${modal.session.machine}`}
          onClose={() => setModal(null)}
        >
          <Row label="Vascular access" value={modal.session.access} />
          <Row label="Prescribed time" value={`${modal.session.prescribedMin} min`} />
          <Row label="Elapsed" value={`${modal.session.elapsedMin} min`} />
          <Row label="Blood flow" value={`${modal.session.bloodFlow} mL/min`} />
          <Row label="Dialysate flow" value={`${modal.session.dialysateFlow} mL/min`} />
          <Row label="Current weight" value={`${modal.session.weightKg} kg`} />
          <Row label="Dry weight" value={`${modal.session.dryWeightKg} kg`} />
          <Row label="Fluid removed" value={`${modal.session.ufRemovedMl} mL`} />
          <Row label="Fluid target" value={`${modal.session.ufTargetMl} mL`} />
          <Row
            label="Ultrafiltration rate"
            value={`${ultrafiltrationRate(modal.session) ?? "n/a"} mL/kg/h`}
            accent={
              ufRateBand(ultrafiltrationRate(modal.session)) === "Critical"
                ? "text-red-400"
                : ufRateBand(ultrafiltrationRate(modal.session)) === "Elevated"
                ? "text-amber-400"
                : "text-emerald-400"
            }
          />
          <Row label="Pre-dialysis urea" value={modal.session.preBun || "—"} />
          <Row label="Post-dialysis urea" value={modal.session.postBun || "pending"} />
          <Row label="Urea reduction ratio" value={ureaReductionRatio(modal.session) === null ? "pending" : `${ureaReductionRatio(modal.session)}%`} />
          <Row
            label="Delivered Kt/V"
            value={singlePoolKtV(modal.session) ?? "pending post-dialysis sample"}
            accent={
              singlePoolKtV(modal.session) === null
                ? "text-slate-400"
                : singlePoolKtV(modal.session) >= KTV_TARGET
                ? "text-emerald-400"
                : "text-amber-400"
            }
          />
          <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Beaker size={14} className="mt-0.5 shrink-0 text-sky-400" />
            <span>
              Kt/V includes a convective term for the fluid removed, so two patients with the same urea reduction get
              different delivered doses if one had four litres pulled and the other none. The reduction ratio alone
              hides that.
            </span>
          </div>
        </Modal>
      )}

      <footer className="border-t border-slate-800 px-6 py-4 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} /> ISO 23500 fluid quality management
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical size={12} /> ISO 11663 dialysis fluid
          </span>
          <span className="flex items-center gap-1.5">
            <Waves size={12} /> ISO 26722 water treatment equipment
          </span>
          <span className="flex items-center gap-1.5">
            <Layers size={12} /> ISO 8637 dialyser total cell volume
          </span>
          <span className="flex items-center gap-1.5">
            <Activity size={12} /> KDOQI Kt/V ≥ {KTV_TARGET} adequacy target
          </span>
          <span className="flex items-center gap-1.5">
            <Timer size={12} /> Daugirdas second-generation dose model
          </span>
          <span className="flex items-center gap-1.5">
            <Thermometer size={12} /> Heat and chemical disinfection tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Bell size={12} /> Intradialytic hypotension alerting
          </span>
          <span className="flex items-center gap-1.5">
            <Droplet size={12} /> Vascular access surveillance
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> Machine running-hour service planning
          </span>
        </div>
      </footer>
    </div>
  );
}
