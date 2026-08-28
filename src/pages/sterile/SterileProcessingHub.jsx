import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Boxes, CheckCircle2, ClipboardCheck, Clock, Download,
  FileText, Flame, Gauge, Hourglass, Info, Layers, Lock, Package, Pause, Play, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Siren, Thermometer, Timer, TrendingUp, Waves, Wrench, X,
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
 *  Sterile Processing (CSSD) & Instrument Tray Traceability Hub
 *
 *  Four consoles over the reprocessing loop a surgical instrument runs every
 *  time it is used:
 *
 *    decontamination -> assembly -> sterilisation -> release -> storage -> OR
 *
 *  Standards the model follows: ANSI/AAMI ST79 for steam sterilisation and
 *  sterility assurance in health care facilities, ISO 17665-1 for moist heat
 *  process definition and the F0 lethality model, ISO 11138 for biological
 *  indicators, ISO 11140 for chemical indicator classes, ISO 15883 for
 *  washer-disinfectors and their A0 value, and EN 285 for large steam
 *  sterilisers and the daily Bowie-Dick air removal test.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

/**
 * Reference temperature and z-value for saturated steam, per ISO 17665-1.
 *
 * The z-value is the temperature change that alters the microbial death rate
 * tenfold; for moist heat against Geobacillus stearothermophilus it is 10 °C.
 * Both constants are what make F0 comparable across cycles that ran at
 * different temperatures for different times.
 */
const F0_REFERENCE_TEMP_C = 121.1;
const F0_Z_VALUE_C = 10;

/** Minimum accumulated lethality for a load to be considered sterilised. */
const F0_RELEASE_THRESHOLD = 15;

/**
 * A0 is the washer-disinfector analogue of F0, per ISO 15883-1: the equivalent
 * seconds at 80 °C, with a z-value of 10 °C. A0 = 600 is the general
 * requirement for non-critical items; A0 = 3000 is required where thermolabile
 * viruses may be present.
 */
const A0_REFERENCE_TEMP_C = 80;
const A0_RELEASE_THRESHOLD = 600;

const CYCLE_TYPES = {
  "Pre-vacuum 134 °C": { holdTemp: 134, holdMinutes: 4, dryMinutes: 30, class: "Steam" },
  "Pre-vacuum 132 °C": { holdTemp: 132, holdMinutes: 4, dryMinutes: 25, class: "Steam" },
  "Gravity 121 °C": { holdTemp: 121, holdMinutes: 30, dryMinutes: 20, class: "Steam" },
  "Immediate use 134 °C": { holdTemp: 134, holdMinutes: 3, dryMinutes: 1, class: "Steam" },
  "Low-temperature H2O2": { holdTemp: 50, holdMinutes: 28, dryMinutes: 5, class: "Plasma" },
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const TRAYS = [
  { id: "TR-1001", name: "Major Orthopaedic Set", specialty: "Orthopaedics", instruments: 148, counted: 148, weight: 9.8, owner: "Theatre 1", stage: "Sterile storage", cycles: 412, lastRelease: "2 h ago", implant: true, priority: "Routine", note: "" },
  { id: "TR-1002", name: "Laparoscopic Cholecystectomy", specialty: "General surgery", instruments: 62, counted: 62, weight: 4.2, owner: "Theatre 2", stage: "Assembly", cycles: 733, lastRelease: "6 h ago", implant: false, priority: "Urgent", note: "" },
  { id: "TR-1003", name: "Craniotomy Set A", specialty: "Neurosurgery", instruments: 96, counted: 94, weight: 7.1, owner: "Theatre 4", stage: "Assembly", cycles: 208, lastRelease: "1 d ago", implant: false, priority: "Urgent", note: "2 instruments unaccounted at count" },
  { id: "TR-1004", name: "Cardiac Bypass Set", specialty: "Cardiothoracic", instruments: 174, counted: 174, weight: 11.4, owner: "Theatre 3", stage: "Sterilisation", cycles: 297, lastRelease: "4 h ago", implant: true, priority: "Emergency", note: "" },
  { id: "TR-1005", name: "Basic Suture Set", specialty: "General surgery", instruments: 24, counted: 24, weight: 1.6, owner: "Day surgery", stage: "Sterile storage", cycles: 1841, lastRelease: "30 m ago", implant: false, priority: "Routine", note: "" },
  { id: "TR-1006", name: "Arthroscopy Shaver Set", specialty: "Orthopaedics", instruments: 38, counted: 38, weight: 3.4, owner: "Theatre 1", stage: "Decontamination", cycles: 654, lastRelease: "8 h ago", implant: false, priority: "Routine", note: "" },
  { id: "TR-1007", name: "Paediatric ENT Set", specialty: "ENT", instruments: 41, counted: 41, weight: 2.2, owner: "Theatre 5", stage: "Sterile storage", cycles: 388, lastRelease: "3 h ago", implant: false, priority: "Routine", note: "" },
  { id: "TR-1008", name: "Spinal Instrumentation Set", specialty: "Orthopaedics", instruments: 132, counted: 132, weight: 12.9, owner: "Theatre 4", stage: "Quarantine", cycles: 176, lastRelease: "1 d ago", implant: true, priority: "Urgent", note: "Held pending biological indicator result" },
  { id: "TR-1009", name: "Flexible Endoscope Channel Set", specialty: "Endoscopy", instruments: 12, counted: 12, weight: 1.1, owner: "Endoscopy", stage: "Decontamination", cycles: 2210, lastRelease: "45 m ago", implant: false, priority: "Urgent", note: "" },
  { id: "TR-1010", name: "Obstetric Emergency Set", specialty: "Obstetrics", instruments: 54, counted: 54, weight: 3.9, owner: "Maternity", stage: "Sterile storage", cycles: 921, lastRelease: "5 h ago", implant: false, priority: "Emergency", note: "" },
  { id: "TR-1011", name: "Vascular Access Set", specialty: "Vascular", instruments: 29, counted: 27, weight: 2.0, owner: "Theatre 2", stage: "Assembly", cycles: 502, lastRelease: "12 h ago", implant: false, priority: "Routine", note: "2 instruments sent for repair" },
  { id: "TR-1012", name: "Robotic Arm Instrument Kit", specialty: "Robotics", instruments: 18, counted: 18, weight: 2.6, owner: "Theatre 6", stage: "Sterilisation", cycles: 148, lastRelease: "7 h ago", implant: false, priority: "Urgent", note: "" },
];

const LOADS = [
  { id: "LD-8801", steriliser: "AUT-01", cycle: "Pre-vacuum 134 °C", trays: ["TR-1004"], phase: "Sterilise", elapsedMin: 3, peakTemp: 134.4, pressure: 3.13, f0: 11.2, bowieDick: "Pass", chemicalIndicator: "Class 6 pass", biological: "Incubating", release: "Quarantined", operator: "S. Iqbal" },
  { id: "LD-8802", steriliser: "AUT-02", cycle: "Pre-vacuum 132 °C", trays: ["TR-1012", "TR-1002"], phase: "Dry", elapsedMin: 18, peakTemp: 132.6, pressure: 2.92, f0: 19.4, bowieDick: "Pass", chemicalIndicator: "Class 6 pass", biological: "Not required", release: "Released", operator: "S. Iqbal" },
  { id: "LD-8803", steriliser: "AUT-03", cycle: "Gravity 121 °C", trays: ["TR-1005", "TR-1007"], phase: "Complete", elapsedMin: 52, peakTemp: 121.8, pressure: 2.11, f0: 34.7, bowieDick: "Pass", chemicalIndicator: "Class 5 pass", biological: "Negative", release: "Released", operator: "R. Okafor" },
  { id: "LD-8804", steriliser: "AUT-01", cycle: "Pre-vacuum 134 °C", trays: ["TR-1008"], phase: "Complete", elapsedMin: 41, peakTemp: 133.9, pressure: 3.09, f0: 21.6, bowieDick: "Pass", chemicalIndicator: "Class 6 pass", biological: "Incubating", release: "Quarantined", operator: "R. Okafor" },
  { id: "LD-8805", steriliser: "AUT-04", cycle: "Low-temperature H2O2", trays: ["TR-1009"], phase: "Aerate", elapsedMin: 12, peakTemp: 50.2, pressure: 0.01, f0: 0, bowieDick: "Not applicable", chemicalIndicator: "Class 5 pass", biological: "Incubating", release: "Quarantined", operator: "M. Dube" },
  { id: "LD-8806", steriliser: "AUT-02", cycle: "Pre-vacuum 134 °C", trays: ["TR-1001"], phase: "Complete", elapsedMin: 47, peakTemp: 130.2, pressure: 2.71, f0: 8.9, bowieDick: "Fail", chemicalIndicator: "Class 6 fail", biological: "Positive", release: "Failed", operator: "M. Dube" },
];

const WASHERS = [
  { id: "WD-01", model: "Getinge 8666", phase: "Thermal disinfection", loadTrays: 4, temp: 90.4, a0: 812, detergent: "Enzymatic, 0.8%", cycleMin: 54, status: "Running", lastValidated: "8 d ago" },
  { id: "WD-02", model: "Miele PG 8528", phase: "Pre-wash", loadTrays: 3, temp: 34.1, a0: 0, detergent: "Enzymatic, 0.8%", cycleMin: 6, status: "Running", lastValidated: "3 d ago" },
  { id: "WD-03", model: "Steris Reliance", phase: "Idle", loadTrays: 0, temp: 21.0, a0: 0, detergent: "—", cycleMin: 0, status: "Idle", lastValidated: "21 d ago" },
  { id: "WD-04", model: "Getinge 8666", phase: "Thermal disinfection", loadTrays: 5, temp: 82.6, a0: 421, detergent: "Alkaline, 0.5%", cycleMin: 38, status: "Running", lastValidated: "12 d ago" },
  { id: "WD-05", model: "Belimed WD290", phase: "Fault", loadTrays: 2, temp: 44.8, a0: 0, detergent: "Enzymatic, 0.8%", cycleMin: 11, status: "Fault", lastValidated: "5 d ago" },
];

const STERILISERS = [
  { id: "AUT-01", model: "Getinge GSS67", chamberL: 670, bowieDick: "Pass", bowieDickAt: "06:12 today", cyclesToday: 7, leakRate: 0.9, nextValidation: "in 4 d" },
  { id: "AUT-02", model: "Steris Amsco 400", chamberL: 610, bowieDick: "Fail", bowieDickAt: "06:20 today", cyclesToday: 5, leakRate: 1.6, nextValidation: "overdue" },
  { id: "AUT-03", model: "Belimed MST-H", chamberL: 580, bowieDick: "Pass", bowieDickAt: "06:05 today", cyclesToday: 6, leakRate: 0.7, nextValidation: "in 19 d" },
  { id: "AUT-04", model: "Steris V-PRO maX", chamberL: 136, bowieDick: "Not applicable", bowieDickAt: "—", cyclesToday: 4, leakRate: 0.0, nextValidation: "in 11 d" },
];

/* ------------------------------------------------------------------ */
/*  Domain calculations                                                */
/* ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Accumulated lethality contributed by one minute at a given temperature.
 *
 * F0 = ∫ 10^((T − 121.1) / z) dt, so a minute at 134 °C is worth roughly 20
 * minutes at 121.1 °C, and a minute at 110 °C is worth about four seconds. That
 * exponential is why "the cycle ran for 40 minutes" says nothing on its own and
 * why release is judged on F0 rather than on elapsed time.
 */
function lethalityPerMinute(temperatureC) {
  return Math.pow(10, (temperatureC - F0_REFERENCE_TEMP_C) / F0_Z_VALUE_C);
}

/** The washer-disinfector equivalent, referenced to 80 °C and expressed in seconds. */
function a0PerSecond(temperatureC) {
  return Math.pow(10, (temperatureC - A0_REFERENCE_TEMP_C) / F0_Z_VALUE_C);
}

/**
 * Whether a load may be released to sterile storage.
 *
 * ST79 makes this a conjunction, not a judgement call, and the implant rule is
 * the one that most often gets bent under theatre pressure: a load containing an
 * implant must be quarantined until its biological indicator reads negative.
 * "The chemical indicator passed and the surgeon is waiting" is not a release
 * criterion, so the check returns every unmet condition rather than the first.
 */
function releaseBlockers(load, trays) {
  const blockers = [];
  const spec = CYCLE_TYPES[load.cycle];

  if (load.phase !== "Complete") {
    blockers.push(`Cycle still in ${load.phase.toLowerCase()} phase`);
  }
  if (spec.class === "Steam" && load.f0 < F0_RELEASE_THRESHOLD) {
    blockers.push(`F0 ${load.f0.toFixed(1)} below the ${F0_RELEASE_THRESHOLD} minute threshold`);
  }
  if (load.bowieDick === "Fail") {
    blockers.push("Steriliser failed its Bowie-Dick air removal test today");
  }
  if (load.chemicalIndicator.includes("fail")) {
    blockers.push("Chemical indicator did not reach its end point");
  }
  if (load.biological === "Positive") {
    blockers.push("Biological indicator grew — sterilisation failure");
  }

  const carriesImplant = load.trays.some((trayId) => trays.find((tray) => tray.id === trayId)?.implant);
  if (carriesImplant && load.biological !== "Negative") {
    blockers.push("Implant load: biological indicator must read negative before release");
  }

  return blockers;
}

/**
 * Instrument count reconciliation.
 *
 * A tray that assembles short is not a paperwork problem: the missing
 * instrument is either still inside a patient, in the bin, or in another tray,
 * and all three outcomes require the tray to be held rather than wrapped.
 */
function countVariance(tray) {
  return tray.counted - tray.instruments;
}

/** Trays that cannot proceed out of assembly because their count does not reconcile. */
function assemblyHolds(trays) {
  return trays.filter((tray) => countVariance(tray) !== 0);
}

/**
 * Turnaround pressure: how much of the tray pool is unavailable to theatres.
 *
 * Anything not in sterile storage is in the loop somewhere and cannot be
 * booked, so this is the number that decides whether tomorrow's list is
 * deliverable with the sets the hospital owns.
 */
function circulationLoad(trays) {
  const inLoop = trays.filter((tray) => tray.stage !== "Sterile storage").length;
  return {
    inLoop,
    available: trays.length - inLoop,
    pct: trays.length ? Math.round((inLoop / trays.length) * 100) : 0,
  };
}

const stageOrder = ["Decontamination", "Assembly", "Sterilisation", "Quarantine", "Sterile storage"];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  if (["Failed", "Fail", "Positive", "Fault", "Emergency", "overdue"].includes(value)) return "red";
  if (["Quarantined", "Incubating", "Urgent", "Quarantine", "Assembly"].includes(value)) return "amber";
  if (["Released", "Pass", "Negative", "Sterile storage", "Complete", "Idle"].includes(value)) return "green";
  if (["Running", "Routine", "Sterilisation", "Decontamination", "Not required", "Not applicable"].includes(value)) return "sky";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge tone={tone} toneOf={toneOf}>{children}</ToneBadge>;



/* ------------------------------------------------------------------ */
/*  Live simulation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Advances sterilisation cycles and washer programmes.
 *
 * F0 is accumulated rather than assigned: each tick adds the lethality earned by
 * one minute at the chamber's current temperature, so a cycle that runs cool
 * genuinely fails to reach the release threshold instead of being flagged by a
 * hard-coded verdict.
 */
function useSimulation({ loadsRef, washersRef, traysRef, toast }) {
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

    const phaseOrder = ["Condition", "Sterilise", "Exhaust", "Dry", "Aerate", "Complete"];

    loadsRef.current = loadsRef.current.map((load) => {
      if (load.phase === "Complete") return load;
      const spec = CYCLE_TYPES[load.cycle];
      const elapsedMin = load.elapsedMin + 1;

      // Only the sterilise hold accumulates meaningful lethality; conditioning and
      // drying run below the reference temperature and contribute almost nothing.
      const chamberTemp = load.phase === "Sterilise" ? spec.holdTemp + (Math.random() - 0.5) * 0.6 : 60;
      const f0 =
        spec.class === "Steam" && load.phase === "Sterilise"
          ? Number((load.f0 + lethalityPerMinute(chamberTemp)).toFixed(1))
          : load.f0;

      const index = phaseOrder.indexOf(load.phase);
      const advance = Math.random() < 0.3;
      const phase = advance ? phaseOrder[Math.min(phaseOrder.length - 1, index + 1)] : load.phase;

      if (phase === "Complete" && load.phase !== "Complete") {
        toast(`${load.id} finished on ${load.steriliser} — F0 ${f0.toFixed(1)}`, "Low");
      }

      return { ...load, elapsedMin, f0, phase, peakTemp: Math.max(load.peakTemp, chamberTemp) };
    });

    washersRef.current = washersRef.current.map((washer) => {
      if (washer.status !== "Running") return washer;
      const temp = Number(clamp(washer.temp + (Math.random() * 2.4 - 0.6), 20, 93).toFixed(1));
      // A0 accrues in equivalent seconds at 80 °C, so a wash held at 90 °C banks
      // ten seconds of credit for every real second.
      const a0 = temp > 65 ? Math.round(washer.a0 + a0PerSecond(temp) * 20) : washer.a0;
      const phase = a0 >= A0_RELEASE_THRESHOLD && washer.phase !== "Complete" ? "Complete" : washer.phase;
      if (phase === "Complete" && washer.phase !== "Complete") {
        toast(`${washer.id} reached A0 ${a0} — thermal disinfection satisfied`, "Low");
      }
      return { ...washer, temp, a0, phase, cycleMin: washer.cycleMin + 1 };
    });

    traysRef.current = traysRef.current.map((tray) => {
      if (tray.stage === "Sterile storage" || Math.random() > 0.12) return tray;
      if (countVariance(tray) !== 0 && tray.stage === "Assembly") {
        // Held on purpose: the count has to reconcile before the tray is wrapped.
        return tray;
      }
      const index = stageOrder.indexOf(tray.stage);
      const stage = stageOrder[Math.min(stageOrder.length - 1, index + 1)];
      return { ...tray, stage };
    });
  }, [loadsRef, washersRef, traysRef, toast]);

  useEffect(() => {
    const interval = setInterval(loop, Math.round(2200 / speedRef.current));
    return () => clearInterval(interval);
  }, [loop]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      loadsRef.current = LOADS.map((load) => ({ ...load }));
      washersRef.current = WASHERS.map((washer) => ({ ...washer }));
      traysRef.current = TRAYS.map((tray) => ({ ...tray }));
      setTick(0);
      toast("Sterile processing console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SterileProcessingHub() {
  const [tab, setTab] = useState("trays");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [releaseFilter, setReleaseFilter] = useState("All");

  const { toasts, toast, removeToast } = useSeverityToasts();

  const [trays, setTrays] = useState(() => TRAYS.map((tray) => ({ ...tray })));
  const [loads, setLoads] = useState(() => LOADS.map((load) => ({ ...load })));
  const [washers, setWashers] = useState(() => WASHERS.map((washer) => ({ ...washer })));

  const traysRef = useRef(trays);
  const loadsRef = useRef(loads);
  const washersRef = useRef(washers);

  useEffect(() => {
    traysRef.current = trays;
  }, [trays]);
  useEffect(() => {
    loadsRef.current = loads;
  }, [loads]);
  useEffect(() => {
    washersRef.current = washers;
  }, [washers]);

  const simulation = useSimulation({ loadsRef, washersRef, traysRef, toast });

  useEffect(() => {
    setTrays([...traysRef.current]);
    setLoads([...loadsRef.current]);
    setWashers([...washersRef.current]);
  }, [simulation.tick]);

  /* ---------- derived ---------- */

  const holds = useMemo(() => assemblyHolds(trays), [trays]);
  const circulation = useMemo(() => circulationLoad(trays), [trays]);

  const quarantined = useMemo(() => loads.filter((load) => load.release === "Quarantined").length, [loads]);
  const failedLoads = useMemo(() => loads.filter((load) => load.release === "Failed").length, [loads]);

  const filteredTrays = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return trays.filter((tray) => {
      const matchesQuery =
        !needle ||
        [tray.id, tray.name, tray.specialty, tray.owner, tray.stage].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesStage = stageFilter === "All" || tray.stage === stageFilter;
      return matchesQuery && matchesStage;
    });
  }, [trays, query, stageFilter]);

  const filteredLoads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return loads.filter((load) => {
      const matchesQuery =
        !needle ||
        [load.id, load.steriliser, load.cycle, load.operator, ...load.trays].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesRelease = releaseFilter === "All" || load.release === releaseFilter;
      return matchesQuery && matchesRelease;
    });
  }, [loads, query, releaseFilter]);

  const filteredWashers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return washers.filter(
      (washer) =>
        !needle ||
        [washer.id, washer.model, washer.phase, washer.status].some((field) => field.toLowerCase().includes(needle))
    );
  }, [washers, query]);

  /* ---------- actions ---------- */

  const releaseLoad = (load) => {
    const blockers = releaseBlockers(load, trays);
    if (blockers.length > 0) {
      toast(`${load.id} cannot be released: ${blockers[0]}`, "High");
      setModal({ kind: "release", load, blockers });
      return;
    }
    setLoads((current) => current.map((item) => (item.id === load.id ? { ...item, release: "Released" } : item)));
    setTrays((current) =>
      current.map((tray) => (load.trays.includes(tray.id) ? { ...tray, stage: "Sterile storage" } : tray))
    );
    toast(`${load.id} released to sterile storage`, "Low");
  };

  const recordBiological = (loadId, result) => {
    setLoads((current) =>
      current.map((load) =>
        load.id === loadId
          ? { ...load, biological: result, release: result === "Positive" ? "Failed" : load.release }
          : load
      )
    );
    toast(
      result === "Negative"
        ? `${loadId}: biological indicator negative, load eligible for release`
        : `${loadId}: biological indicator POSITIVE — recall the load`,
      result === "Negative" ? "Low" : "High"
    );
  };

  const resolveCount = (trayId) => {
    setTrays((current) =>
      current.map((tray) =>
        tray.id === trayId ? { ...tray, counted: tray.instruments, note: "Count reconciled at assembly" } : tray
      )
    );
    toast(`${trayId}: instrument count reconciled`, "Low");
  };

  const exportCsv = () => {
    const table =
      tab === "trays"
        ? [
            ["Tray", "Name", "Specialty", "Owner", "Stage", "Instruments", "Counted", "Variance", "Cycles"],
            ...filteredTrays.map((tray) => [
              tray.id,
              tray.name,
              tray.specialty,
              tray.owner,
              tray.stage,
              tray.instruments,
              tray.counted,
              countVariance(tray),
              tray.cycles,
            ]),
          ]
        : tab === "loads"
        ? [
            ["Load", "Steriliser", "Cycle", "Phase", "Peak °C", "F0", "Bowie-Dick", "Chemical", "Biological", "Release"],
            ...filteredLoads.map((load) => [
              load.id,
              load.steriliser,
              load.cycle,
              load.phase,
              load.peakTemp.toFixed(1),
              load.f0.toFixed(1),
              load.bowieDick,
              load.chemicalIndicator,
              load.biological,
              load.release,
            ]),
          ]
        : [
            ["Washer", "Model", "Phase", "Trays", "Temp °C", "A0", "Detergent", "Status", "Validated"],
            ...filteredWashers.map((washer) => [
              washer.id,
              washer.model,
              washer.phase,
              washer.loadTrays,
              washer.temp,
              washer.a0,
              washer.detergent,
              washer.status,
              washer.lastValidated,
            ]),
          ];

    downloadCsv(`sterile-processing-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "trays", label: "Tray Traceability", icon: Boxes },
    { id: "loads", label: "Steriliser Loads", icon: Flame },
    { id: "release", label: "Load Release", icon: ClipboardCheck },
    { id: "decon", label: "Decontamination & Washers", icon: Waves },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <SeverityToastTray toasts={toasts} onDismiss={removeToast} />

      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-cyan-400">
              <Package size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Sterile Processing &amp; Instrument Tray Traceability Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Tray traceability · steriliser loads · release · decontamination — AAMI ST79 / ISO 17665 aligned
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
                    simulation.speed === factor ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:bg-slate-800"
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
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Boxes}
            label="Trays in circulation"
            value={circulation.inLoop}
            sub={`${circulation.available} sets available to book`}
            accent={circulation.pct > 60 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Assembly holds"
            value={holds.length}
            sub="instrument count does not reconcile"
            accent={holds.length > 0 ? "text-red-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Hourglass}
            label="Loads quarantined"
            value={quarantined}
            sub="awaiting release criteria"
            accent={quarantined > 0 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Siren}
            label="Failed loads"
            value={failedLoads}
            sub="recall and reprocess"
            accent={failedLoads > 0 ? "text-red-400" : "text-emerald-400"}
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
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
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
              placeholder="Search trays, loads, sterilisers…"
              aria-label="Search sterile processing"
              className="w-72 rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          {tab === "trays" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", ...stageOrder].map((option) => (
                <button
                  key={option}
                  onClick={() => setStageFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    stageFilter === option
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {(tab === "loads" || tab === "release") && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Released", "Quarantined", "Failed"].map((option) => (
                <button
                  key={option}
                  onClick={() => setReleaseFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    releaseFilter === option
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
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
        {tab === "trays" && (
          <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <Activity size={15} className="text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Where the tray pool is right now</h2>
                </div>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                  Anything not in sterile storage is somewhere in the reprocessing loop and cannot be booked against
                  tomorrow&rsquo;s list. When circulation load climbs past about 60 %, the constraint on theatre
                  scheduling stops being staffing and starts being the number of sets the hospital owns.
                </p>
                <div className="space-y-3">
                  {stageOrder.map((stage) => {
                    const count = trays.filter((tray) => tray.stage === stage).length;
                    return (
                      <div key={stage} className="flex items-center gap-4">
                        <span className="w-36 text-xs text-slate-400">{stage}</span>
                        <Meter
                          value={(count / trays.length) * 100}
                          color={stage === "Sterile storage" ? "bg-emerald-400" : stage === "Quarantine" ? "bg-amber-400" : "bg-cyan-400"}
                        />
                        <span className="text-xs font-medium text-slate-200">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Wrench size={15} className="text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Trays held at assembly</h2>
                </div>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                  A tray that assembles short is not a paperwork problem. The missing instrument is either still
                  inside a patient, in the waste stream, or in someone else&rsquo;s tray, so the set is held rather
                  than wrapped.
                </p>
                {holds.length === 0 ? (
                  <p className="text-xs text-emerald-400">Every tray reconciles.</p>
                ) : (
                  <div className="space-y-2">
                    {holds.map((tray) => (
                      <div key={tray.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">{tray.id}</span>
                          <Badge tone="amber">{countVariance(tray)} instruments</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{tray.note || tray.name}</p>
                        <button
                          onClick={() => resolveCount(tray.id)}
                          className="mt-2 w-full rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                        >
                          Reconcile count
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tray</th>
                    <th className="px-4 py-3 font-medium">Set</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Count</th>
                    <th className="px-4 py-3 font-medium">Cycles</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
                  {filteredTrays.map((tray) => {
                    const variance = countVariance(tray);
                    return (
                      <tr key={tray.id} className="hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-300">{tray.id}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-200">{tray.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {tray.specialty} · {tray.weight} kg{tray.implant ? " · carries implants" : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{tray.owner}</td>
                        <td className="px-4 py-3">
                          <Badge>{tray.stage}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={variance === 0 ? "text-slate-300" : "text-amber-400"}>
                            {tray.counted}/{tray.instruments}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{tray.cycles}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setModal({ kind: "tray", tray })}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTrays.length === 0 && <EmptyState message="No trays match the current search and filter." icon={Package} />}
            </section>
          </div>
        )}

        {tab === "loads" && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STERILISERS.map((unit) => (
                <div key={unit.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{unit.id}</div>
                      <div className="text-[11px] text-slate-500">{unit.model}</div>
                    </div>
                    <Badge>{unit.bowieDick}</Badge>
                  </div>
                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Chamber</span>
                      <span className="text-slate-300">{unit.chamberL} L</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cycles today</span>
                      <span className="text-slate-300">{unit.cyclesToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leak rate</span>
                      <span className={unit.leakRate > 1.3 ? "text-red-400" : "text-slate-300"}>
                        {unit.leakRate} mbar/min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revalidation</span>
                      <span className={unit.nextValidation === "overdue" ? "text-red-400" : "text-slate-300"}>
                        {unit.nextValidation}
                      </span>
                    </div>
                  </div>
                  {unit.bowieDick === "Fail" && (
                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
                      Air removal test failed at {unit.bowieDickAt}. Every load run since is unreleasable.
                    </p>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-3">
              {filteredLoads.map((load) => {
                const spec = CYCLE_TYPES[load.cycle];
                const f0Progress = spec.class === "Steam" ? (load.f0 / F0_RELEASE_THRESHOLD) * 100 : 100;
                return (
                  <div key={load.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-100">{load.id}</h3>
                          <Badge tone="sky">{load.steriliser}</Badge>
                          <Badge>{load.phase}</Badge>
                          <Badge>{load.release}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {load.cycle} · hold {spec.holdMinutes} min at {spec.holdTemp} °C · operator {load.operator}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">Trays: {load.trays.join(", ")}</p>
                      </div>
                      <button
                        onClick={() => setModal({ kind: "load", load, blockers: releaseBlockers(load, trays) })}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                      >
                        Cycle record
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          Peak temperature <Thermometer size={13} />
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">{load.peakTemp.toFixed(1)} °C</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          Accumulated F0 <Timer size={13} />
                        </div>
                        <div
                          className={`mt-1 text-sm font-semibold ${
                            spec.class !== "Steam"
                              ? "text-slate-400"
                              : load.f0 >= F0_RELEASE_THRESHOLD
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {spec.class === "Steam" ? `${load.f0.toFixed(1)} min` : "n/a"}
                        </div>
                        {spec.class === "Steam" && (
                          <Meter value={f0Progress} color={load.f0 >= F0_RELEASE_THRESHOLD ? "bg-emerald-400" : "bg-amber-400"} />
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          Chemical indicator <ClipboardCheck size={13} />
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-200">{load.chemicalIndicator}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          Biological indicator <ShieldCheck size={13} />
                        </div>
                        <div
                          className={`mt-1 text-xs font-medium ${
                            load.biological === "Positive"
                              ? "text-red-400"
                              : load.biological === "Negative"
                              ? "text-emerald-400"
                              : "text-slate-300"
                          }`}
                        >
                          {load.biological}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredLoads.length === 0 && <EmptyState message="No loads match the current search and filter." icon={Package} />}
            </section>
          </div>
        )}

        {tab === "release" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Lock size={15} className="text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">Release is a conjunction, not a judgement call</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                ST79 requires every condition to hold before a load leaves quarantine: the cycle complete, lethality
                at or above the {F0_RELEASE_THRESHOLD}-minute F0 threshold, the day&rsquo;s Bowie-Dick test passed on
                that steriliser, the chemical indicator at its end point, and — for any load carrying an implant — a
                negative biological indicator. The implant rule is the one that gets bent under theatre pressure, so
                the console lists every unmet condition rather than stopping at the first.
              </p>
            </div>

            {filteredLoads.map((load) => {
              const blockers = releaseBlockers(load, trays);
              const carriesImplant = load.trays.some((trayId) => trays.find((tray) => tray.id === trayId)?.implant);
              return (
                <div key={load.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{load.id}</h3>
                        <Badge>{load.release}</Badge>
                        {carriesImplant && <Badge tone="amber">Implant load</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {load.steriliser} · {load.cycle} · {load.trays.length} tray{load.trays.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {load.biological === "Incubating" && (
                        <>
                          <button
                            onClick={() => recordBiological(load.id, "Negative")}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                          >
                            BI negative
                          </button>
                          <button
                            onClick={() => recordBiological(load.id, "Positive")}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                          >
                            BI positive
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => releaseLoad(load)}
                        disabled={load.release === "Released"}
                        className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Release load
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {blockers.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] text-emerald-300">
                        <CheckCircle2 size={14} /> Every release criterion is satisfied.
                      </div>
                    ) : (
                      blockers.map((blocker) => (
                        <div
                          key={blocker}
                          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-300"
                        >
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          {blocker}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            {filteredLoads.length === 0 && <EmptyState message="No loads match the current search and filter." icon={Package} />}
          </div>
        )}

        {tab === "decon" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Info size={15} className="text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">A0: the washer&rsquo;s lethality currency</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                ISO 15883 expresses thermal disinfection as A0 — equivalent seconds at 80 °C, with the same tenfold
                per 10 °C relationship that governs F0. A wash held at 90 °C therefore banks ten seconds of credit for
                every real second, and A0 {A0_RELEASE_THRESHOLD} is the general requirement before an instrument may be
                handled at assembly.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredWashers.map((washer) => (
                <div key={washer.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{washer.id}</h3>
                        <Badge>{washer.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {washer.model} · {washer.phase}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-100">{washer.temp} °C</div>
                      <div className="text-[11px] text-slate-500">{washer.loadTrays} trays</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>A0 accumulated</span>
                      <span className={washer.a0 >= A0_RELEASE_THRESHOLD ? "text-emerald-400" : "text-amber-400"}>
                        {washer.a0} / {A0_RELEASE_THRESHOLD}
                      </span>
                    </div>
                    <Meter
                      value={(washer.a0 / A0_RELEASE_THRESHOLD) * 100}
                      color={washer.a0 >= A0_RELEASE_THRESHOLD ? "bg-emerald-400" : "bg-amber-400"}
                    />
                    <Row label="Detergent" value={washer.detergent} />
                    <Row label="Cycle elapsed" value={`${washer.cycleMin} min`} />
                    <Row
                      label="Last validated"
                      value={washer.lastValidated}
                      accent={washer.lastValidated.startsWith("21") ? "text-amber-400" : "text-slate-200"}
                    />
                  </div>

                  {washer.status === "Fault" && (
                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
                      Cycle aborted. The load must be reprocessed from the start — a part-completed disinfection
                      cannot be credited toward A0.
                    </p>
                  )}
                </div>
              ))}
            </div>
            {filteredWashers.length === 0 && <EmptyState message="No washer-disinfectors match the search." icon={Package} />}
          </div>
        )}
      </main>

      {modal?.kind === "tray" && (
        <Modal title={modal.tray.id} subtitle={modal.tray.name} onClose={() => setModal(null)}>
          <Row label="Specialty" value={modal.tray.specialty} />
          <Row label="Owning theatre" value={modal.tray.owner} />
          <Row label="Current stage" value={modal.tray.stage} />
          <Row label="Instruments expected" value={modal.tray.instruments} />
          <Row
            label="Instruments counted"
            value={modal.tray.counted}
            accent={countVariance(modal.tray) === 0 ? "text-emerald-400" : "text-amber-400"}
          />
          <Row label="Assembled weight" value={`${modal.tray.weight} kg`} />
          <Row label="Carries implants" value={modal.tray.implant ? "Yes" : "No"} />
          <Row label="Lifetime cycles" value={modal.tray.cycles} />
          <Row label="Last release" value={modal.tray.lastRelease} />
          {modal.tray.note && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
              {modal.tray.note}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <FileText size={14} className="mt-0.5 shrink-0 text-cyan-400" />
            <span>
              Every cycle this set has run is retained against the tray identifier, so a positive biological indicator
              on any load can be traced forward to the patients its trays were opened on.
            </span>
          </div>
        </Modal>
      )}

      {(modal?.kind === "load" || modal?.kind === "release") && (
        <Modal
          title={`${modal.load.id} cycle record`}
          subtitle={`${modal.load.steriliser} · ${modal.load.cycle}`}
          onClose={() => setModal(null)}
        >
          <Row label="Phase" value={modal.load.phase} />
          <Row label="Elapsed" value={`${modal.load.elapsedMin} min`} />
          <Row label="Peak chamber temperature" value={`${modal.load.peakTemp.toFixed(1)} °C`} />
          <Row label="Chamber pressure" value={`${modal.load.pressure} bar`} />
          <Row
            label="Accumulated F0"
            value={CYCLE_TYPES[modal.load.cycle].class === "Steam" ? `${modal.load.f0.toFixed(1)} min` : "n/a (low temperature)"}
            accent={modal.load.f0 >= F0_RELEASE_THRESHOLD ? "text-emerald-400" : "text-amber-400"}
          />
          <Row label="Bowie-Dick" value={modal.load.bowieDick} />
          <Row label="Chemical indicator" value={modal.load.chemicalIndicator} />
          <Row label="Biological indicator" value={modal.load.biological} />
          <Row label="Operator" value={modal.load.operator} />
          <Row label="Trays" value={modal.load.trays.join(", ")} />
          <div className="pt-1 text-[11px] font-medium text-slate-400">Release criteria</div>
          {modal.blockers.length === 0 ? (
            <p className="text-xs text-emerald-400">All criteria satisfied — the load may be released.</p>
          ) : (
            <ul className="space-y-1.5">
              {modal.blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2 text-[11px] text-amber-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {blocker}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      <footer className="border-t border-slate-800 px-6 py-4 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} /> ANSI/AAMI ST79 sterility assurance
          </span>
          <span className="flex items-center gap-1.5">
            <Gauge size={12} /> ISO 17665-1 F0 lethality model
          </span>
          <span className="flex items-center gap-1.5">
            <Waves size={12} /> ISO 15883 A0 thermal disinfection
          </span>
          <span className="flex items-center gap-1.5">
            <Bell size={12} /> EN 285 Bowie-Dick air removal
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp size={12} /> ISO 11138 biological indicators
          </span>
          <span className="flex items-center gap-1.5">
            <Layers size={12} /> ISO 11140 chemical indicator classes
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> Tray-level lifetime cycle history
          </span>
        </div>
      </footer>
    </div>
  );
}
