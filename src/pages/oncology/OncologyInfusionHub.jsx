import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Beaker, Bell, Biohazard, Calculator, CheckCircle2, Clock,
  Download, Droplet, FileText, FlaskConical, Gauge, Info, Layers, Pause, Play, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Siren, Syringe, Timer, TrendingDown, User, Wind, X,
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
 *  Oncology Infusion & Hazardous Drug Safety Hub
 *
 *  Four consoles over a systemic anti-cancer therapy day unit:
 *
 *    1. Infusion Floor      - chairs, running regimens, vesicant handling
 *    2. Dose Verification   - BSA and AUC dosing, independent double check
 *    3. Containment         - USP <800> engineering controls and wipe sampling
 *    4. Toxicity Governance - CTCAE grading and the dose modifications it forces
 *
 *  Standards the model follows: USP <800> for handling hazardous drugs in
 *  healthcare settings, USP <797> for sterile compounding beyond-use dating, the
 *  NIOSH list of antineoplastic and other hazardous drugs, the ASCO/ONS
 *  chemotherapy administration safety standards for independent verification and
 *  vesicant policy, and CTCAE v5.0 for adverse event grading.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

/**
 * Tolerance between the independently recalculated dose and the prescribed one.
 *
 * ASCO/ONS requires two practitioners to verify the dose independently. A
 * console that only flagged exact mismatches would fire on every rounding
 * decision; one with a loose tolerance would wave through a real error. Five per
 * cent is the band most units use, and anything outside it holds the bag rather
 * than warning about it.
 */
const DOSE_VARIANCE_TOLERANCE_PCT = 5;

/**
 * NIOSH surface contamination action level for antineoplastic residue, ng/cm².
 *
 * There is no regulatory "safe" level for a hazardous drug on a work surface, so
 * the number below is an internal action threshold rather than a limit: crossing
 * it triggers decontamination and a review of technique, not a citation.
 */
const WIPE_ACTION_NG_CM2 = 1.0;

/** Absolute neutrophil count floor, ×10⁹/L, below which myelosuppressive therapy is held. */
const ANC_HOLD_THRESHOLD = 1.0;

/** Platelet floor, ×10⁹/L, below which therapy is held. */
const PLATELET_HOLD_THRESHOLD = 100;

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const CHAIRS = [
  { chair: "C-01", patient: "P-3301", regimen: "FOLFOX6", cycle: 4, ofCycles: 12, drug: "Oxaliplatin", vesicant: "Irritant", route: "Peripheral cannula", volumeMl: 500, infusedMl: 210, ratePerHour: 250, premedication: "Complete", status: "Infusing", alarm: "" },
  { chair: "C-02", patient: "P-7742", regimen: "AC-T (doxorubicin/cyclophosphamide)", cycle: 2, ofCycles: 4, drug: "Doxorubicin", vesicant: "Vesicant", route: "Implanted port", volumeMl: 250, infusedMl: 88, ratePerHour: 125, premedication: "Complete", status: "Infusing", alarm: "" },
  { chair: "C-03", patient: "P-1188", regimen: "R-CHOP", cycle: 1, ofCycles: 6, drug: "Rituximab", vesicant: "Non-vesicant", route: "Peripheral cannula", volumeMl: 500, infusedMl: 42, ratePerHour: 50, premedication: "Complete", status: "Infusing", alarm: "Infusion reaction — rate reduced" },
  { chair: "C-04", patient: "P-9925", regimen: "Carboplatin + paclitaxel", cycle: 3, ofCycles: 6, drug: "Carboplatin", vesicant: "Non-vesicant", route: "Implanted port", volumeMl: 500, infusedMl: 480, ratePerHour: 500, premedication: "Complete", status: "Infusing", alarm: "" },
  { chair: "C-05", patient: "P-4460", regimen: "Vincristine (single agent)", cycle: 7, ofCycles: 8, drug: "Vincristine", vesicant: "Vesicant", route: "Implanted port", volumeMl: 50, infusedMl: 50, ratePerHour: 100, premedication: "Complete", status: "Complete", alarm: "" },
  { chair: "C-06", patient: "P-2073", regimen: "Pembrolizumab", cycle: 9, ofCycles: 35, drug: "Pembrolizumab", vesicant: "Non-vesicant", route: "Peripheral cannula", volumeMl: 100, infusedMl: 0, ratePerHour: 200, premedication: "Not required", status: "Awaiting release", alarm: "" },
  { chair: "C-07", patient: "P-6614", regimen: "Cisplatin + etoposide", cycle: 2, ofCycles: 4, drug: "Cisplatin", vesicant: "Irritant", route: "Peripheral cannula", volumeMl: 1000, infusedMl: 640, ratePerHour: 333, premedication: "Complete", status: "Infusing", alarm: "" },
  { chair: "C-08", patient: "—", regimen: "—", cycle: 0, ofCycles: 0, drug: "—", vesicant: "—", route: "—", volumeMl: 0, infusedMl: 0, ratePerHour: 0, premedication: "—", status: "Vacant", alarm: "" },
];

/**
 * Each preparation carries the parameters the dose was derived from, so the
 * console can recalculate it independently rather than trusting the number.
 */
const PREPARATIONS = [
  { id: "RX-9101", patient: "P-3301", drug: "Oxaliplatin", basis: "BSA", perUnit: 85, heightCm: 174, weightKg: 78, gfr: null, targetAuc: null, capMg: null, prescribedMg: 165, hood: "BSC-2", beyondUseHours: 24, preparedAgo: 2, verifiedBy: "A. Whitfield", status: "Released" },
  { id: "RX-9102", patient: "P-7742", drug: "Doxorubicin", basis: "BSA", perUnit: 60, heightCm: 162, weightKg: 65, gfr: null, targetAuc: null, capMg: null, prescribedMg: 102, hood: "BSC-1", beyondUseHours: 24, preparedAgo: 1, verifiedBy: "A. Whitfield", status: "Released" },
  { id: "RX-9103", patient: "P-9925", drug: "Carboplatin", basis: "AUC", perUnit: null, heightCm: 168, weightKg: 71, gfr: 82, targetAuc: 5, capMg: null, prescribedMg: 535, hood: "BSC-2", beyondUseHours: 12, preparedAgo: 3, verifiedBy: "K. Osei", status: "Released" },
  { id: "RX-9104", patient: "P-6614", drug: "Cisplatin", basis: "BSA", perUnit: 75, heightCm: 181, weightKg: 92, gfr: null, targetAuc: null, capMg: null, prescribedMg: 178, hood: "BSC-1", beyondUseHours: 24, preparedAgo: 4, verifiedBy: "K. Osei", status: "Held" },
  { id: "RX-9105", patient: "P-2073", drug: "Pembrolizumab", basis: "Flat", perUnit: 200, heightCm: 170, weightKg: 74, gfr: null, targetAuc: null, capMg: null, prescribedMg: 200, hood: "BSC-2", beyondUseHours: 24, preparedAgo: 1, verifiedBy: "A. Whitfield", status: "Awaiting check" },
  { id: "RX-9106", patient: "P-1188", drug: "Rituximab", basis: "BSA", perUnit: 375, heightCm: 158, weightKg: 54, gfr: null, targetAuc: null, capMg: null, prescribedMg: 587, hood: "BSC-1", beyondUseHours: 24, preparedAgo: 2, verifiedBy: "K. Osei", status: "Released" },
  { id: "RX-9107", patient: "P-4460", drug: "Vincristine", basis: "BSA", perUnit: 1.4, heightCm: 176, weightKg: 80, gfr: null, targetAuc: null, capMg: 2, prescribedMg: 2.0, hood: "BSC-2", beyondUseHours: 24, preparedAgo: 5, verifiedBy: "A. Whitfield", status: "Released" },
];

const CONTAINMENT = [
  { id: "BSC-1", type: "Class II B2 biological safety cabinet", room: "Cleanroom A", pressureDiffPa: -13.2, airChanges: 32, hepaLastTested: "41 d ago", cstdInUse: true, status: "Operational" },
  { id: "BSC-2", type: "Class II B2 biological safety cabinet", room: "Cleanroom A", pressureDiffPa: -12.6, airChanges: 30, hepaLastTested: "41 d ago", cstdInUse: true, status: "Operational" },
  { id: "CACI-1", type: "Compounding aseptic containment isolator", room: "Cleanroom B", pressureDiffPa: -8.4, airChanges: 24, hepaLastTested: "118 d ago", cstdInUse: true, status: "Recertification due" },
  { id: "ANTE-A", type: "Anteroom to Cleanroom A", room: "Anteroom", pressureDiffPa: 11.4, airChanges: 22, hepaLastTested: "41 d ago", cstdInUse: false, status: "Operational" },
  { id: "STORE-HD", type: "Hazardous drug storage room", room: "Store", pressureDiffPa: -4.1, airChanges: 13, hepaLastTested: "n/a", cstdInUse: false, status: "Operational" },
];

const WIPE_SAMPLES = [
  { id: "WS-201", location: "BSC-1 work surface", drug: "Cyclophosphamide", ngPerCm2: 0.12, sampled: "7 d ago" },
  { id: "WS-202", location: "BSC-2 work surface", drug: "5-Fluorouracil", ngPerCm2: 0.41, sampled: "7 d ago" },
  { id: "WS-203", location: "Pass-through hatch, Cleanroom A", drug: "Cyclophosphamide", ngPerCm2: 1.84, sampled: "7 d ago" },
  { id: "WS-204", location: "Infusion chair C-02 armrest", drug: "Doxorubicin", ngPerCm2: 0.06, sampled: "14 d ago" },
  { id: "WS-205", location: "Hazardous waste bin lid", drug: "Cyclophosphamide", ngPerCm2: 2.31, sampled: "7 d ago" },
  { id: "WS-206", location: "Cleanroom A floor, front of BSC-1", drug: "5-Fluorouracil", ngPerCm2: 0.88, sampled: "7 d ago" },
];

const TOXICITIES = [
  { id: "TX-3301", patient: "P-3301", event: "Peripheral sensory neuropathy", grade: 2, cycle: 4, attributed: "Oxaliplatin", action: "Reduce to 65 mg/m² next cycle", resolved: false },
  { id: "TX-7742", patient: "P-7742", event: "Febrile neutropenia", grade: 3, cycle: 2, attributed: "Doxorubicin / cyclophosphamide", action: "Hold, add G-CSF primary prophylaxis", resolved: false },
  { id: "TX-6614", patient: "P-6614", event: "Acute kidney injury", grade: 2, cycle: 2, attributed: "Cisplatin", action: "Switch to carboplatin, hydrate", resolved: false },
  { id: "TX-1188", patient: "P-1188", event: "Infusion-related reaction", grade: 1, cycle: 1, attributed: "Rituximab", action: "Halve rate, continue", resolved: true },
  { id: "TX-4460", patient: "P-4460", event: "Constipation", grade: 1, cycle: 6, attributed: "Vincristine", action: "Laxative prophylaxis", resolved: true },
  { id: "TX-9925", patient: "P-9925", event: "Thrombocytopenia", grade: 2, cycle: 3, attributed: "Carboplatin", action: "Monitor, no change", resolved: false },
];

const BLOODS = [
  { patient: "P-3301", anc: 2.4, platelets: 188, creatinine: 82, bilirubin: 9, drawn: "today 07:40" },
  { patient: "P-7742", anc: 0.7, platelets: 143, creatinine: 71, bilirubin: 11, drawn: "today 07:52" },
  { patient: "P-1188", anc: 3.1, platelets: 221, creatinine: 66, bilirubin: 8, drawn: "today 08:04" },
  { patient: "P-9925", anc: 1.6, platelets: 88, creatinine: 79, bilirubin: 10, drawn: "today 08:10" },
  { patient: "P-4460", anc: 2.9, platelets: 205, creatinine: 74, bilirubin: 7, drawn: "today 08:15" },
  { patient: "P-2073", anc: 4.2, platelets: 260, creatinine: 69, bilirubin: 6, drawn: "today 08:20" },
  { patient: "P-6614", anc: 1.9, platelets: 176, creatinine: 148, bilirubin: 12, drawn: "today 08:26" },
];

const EXTRAVASATIONS = [
  { id: "EX-77", patient: "P-7742", drug: "Doxorubicin", classification: "Vesicant", site: "Left forearm cannula", volumeMl: 3, antidote: "Dexrazoxane started within 6 h", outcome: "Under plastic surgery review", when: "9 d ago" },
  { id: "EX-78", patient: "P-4460", drug: "Vincristine", classification: "Vesicant", site: "Right antecubital fossa", volumeMl: 1, antidote: "Hyaluronidase, warm compress", outcome: "Resolved without ulceration", when: "26 d ago" },
];

/* ------------------------------------------------------------------ */
/*  Domain calculations                                                */
/* ------------------------------------------------------------------ */


/**
 * Body surface area by the Mosteller formula: √(height_cm × weight_kg / 3600).
 *
 * Almost every cytotoxic is dosed per square metre, so BSA is the quantity the
 * whole prescription hangs off. Mosteller is the formula most oncology services
 * standardise on because it is simple enough to be checked by hand at the chair,
 * which matters when the check is the safety control.
 */
function bodySurfaceArea(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  return Number(Math.sqrt((heightCm * weightKg) / 3600).toFixed(2));
}

/**
 * Carboplatin dose by the Calvert formula: dose_mg = AUC × (GFR + 25).
 *
 * Carboplatin is the standing exception to per-square-metre dosing. It is
 * cleared almost entirely by the kidney, so the dose is derived from renal
 * function and a target exposure rather than from body size — dosing it by BSA
 * badly over-treats a patient with poor clearance.
 */
function calvertDose(targetAuc, gfr) {
  if (!targetAuc || !gfr) return null;
  return Math.round(targetAuc * (gfr + 25));
}

/**
 * Recalculates a preparation's dose from first principles.
 *
 * This is the independent half of the ASCO/ONS double check: the console does
 * not read the prescribed milligrams, it derives them from the dosing basis and
 * then compares. Returning the basis alongside the number is what lets the
 * pharmacist see *why* the two disagree rather than only that they do.
 */
function recalculateDose(preparation) {
  if (preparation.basis === "AUC") {
    const dose = calvertDose(preparation.targetAuc, preparation.gfr);
    return { dose, workings: `AUC ${preparation.targetAuc} × (GFR ${preparation.gfr} + 25)` };
  }
  if (preparation.basis === "Flat") {
    return { dose: preparation.perUnit, workings: `Flat dose ${preparation.perUnit} mg` };
  }
  const bsa = bodySurfaceArea(preparation.heightCm, preparation.weightKg);
  if (bsa === null) return { dose: null, workings: "insufficient anthropometrics" };

  const uncapped = Math.round(preparation.perUnit * bsa * 10) / 10;

  // Some agents carry an absolute ceiling that overrides the per-square-metre
  // calculation. Vincristine's 2 mg cap is the best known: above it the risk of
  // severe neurotoxicity climbs without any gain in efficacy, so a tall patient
  // does not get a larger dose. Without the cap here the recalculation would
  // flag every correctly capped prescription as a 25-30% under-dose, and an
  // alert that fires on correct practice is an alert nobody reads.
  if (preparation.capMg !== null && preparation.capMg !== undefined && uncapped > preparation.capMg) {
    return {
      dose: preparation.capMg,
      workings: `${preparation.perUnit} mg/m² × BSA ${bsa} m² = ${uncapped} mg, capped at ${preparation.capMg} mg`,
    };
  }

  return {
    dose: uncapped,
    workings: `${preparation.perUnit} mg/m² × BSA ${bsa} m²`,
  };
}

/** Signed percentage by which the prescribed dose departs from the recalculated one. */
function doseVariancePct(preparation) {
  const { dose } = recalculateDose(preparation);
  if (!dose) return null;
  return Number((((preparation.prescribedMg - dose) / dose) * 100).toFixed(1));
}

function doseVerdict(preparation) {
  const variance = doseVariancePct(preparation);
  if (variance === null) return "Not verifiable";
  return Math.abs(variance) > DOSE_VARIANCE_TOLERANCE_PCT ? "Outside tolerance" : "Within tolerance";
}

/**
 * Haematology and organ-function gates that hold therapy for the day.
 *
 * Every gate is evaluated, not short-circuited: a patient can be held for two
 * independent reasons and the unit needs to see both, because fixing one of them
 * does not make the day's treatment safe.
 */
function fitnessBlockers(bloods) {
  if (!bloods) return ["No same-day bloods on file"];
  const blockers = [];
  if (bloods.anc < ANC_HOLD_THRESHOLD) {
    blockers.push(`Neutrophils ${bloods.anc} ×10⁹/L below the ${ANC_HOLD_THRESHOLD} hold threshold`);
  }
  if (bloods.platelets < PLATELET_HOLD_THRESHOLD) {
    blockers.push(`Platelets ${bloods.platelets} ×10⁹/L below the ${PLATELET_HOLD_THRESHOLD} hold threshold`);
  }
  if (bloods.creatinine > 120) {
    blockers.push(`Creatinine ${bloods.creatinine} µmol/L — review renally cleared agents`);
  }
  return blockers;
}

/** Whether a wipe sample is above the internal decontamination action level. */
function wipeExceeds(sample) {
  return sample.ngPerCm2 >= WIPE_ACTION_NG_CM2;
}

/**
 * Whether a containment control is doing its job.
 *
 * USP <800> requires the compounding room to be at negative pressure relative to
 * the anteroom, so a positive or insufficiently negative reading is a
 * containment failure regardless of what the certificate on the wall says. The
 * anteroom itself is the one space that is meant to be positive.
 */
function containmentFault(control) {
  const isAnteroom = control.id.startsWith("ANTE");
  if (isAnteroom) return control.pressureDiffPa < 2.5 ? "Anteroom pressure cascade lost" : null;
  if (control.pressureDiffPa > -2.5) return "Room is not at negative pressure";
  if (control.status === "Recertification due") return "HEPA certification overdue";
  return null;
}

/** Remaining infusion time at the current rate, in minutes. */
function minutesRemaining(chair) {
  if (!chair.ratePerHour || chair.infusedMl >= chair.volumeMl) return 0;
  return Math.round(((chair.volumeMl - chair.infusedMl) / chair.ratePerHour) * 60);
}

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  if (["Vesicant", "Outside tolerance", "Held", "Recertification due"].includes(value)) return "red";
  if (["Irritant", "Awaiting check", "Awaiting release"].includes(value)) return "amber";
  if (["Non-vesicant", "Within tolerance", "Released", "Operational", "Complete"].includes(value)) return "green";
  if (["Infusing", "Vacant", "Not required"].includes(value)) return "sky";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge tone={tone} toneOf={toneOf}>{children}</ToneBadge>;



/* ------------------------------------------------------------------ */
/*  Live simulation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Advances running infusions at their prescribed rate.
 *
 * Volume infused is driven by the rate rather than a fixed step, so the time
 * remaining the console reports stays consistent with the pump setting shown
 * next to it — a chair running at 50 mL/h genuinely takes ten times as long as
 * one at 500.
 */
function useSimulation({ chairsRef, toast }) {
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

    chairsRef.current = chairsRef.current.map((chair) => {
      if (chair.status !== "Infusing") return chair;

      // Five simulated minutes per tick, at the rate actually set on the pump.
      const delivered = (chair.ratePerHour / 60) * 5;
      const infusedMl = Math.min(chair.volumeMl, Math.round(chair.infusedMl + delivered));

      if (infusedMl >= chair.volumeMl) {
        toast(`${chair.chair}: ${chair.drug} complete, line flushed`, "Low");
        return { ...chair, infusedMl, status: "Complete", alarm: "" };
      }
      return { ...chair, infusedMl };
    });
  }, [chairsRef, toast]);

  useEffect(() => {
    const interval = setInterval(loop, Math.round(2500 / speedRef.current));
    return () => clearInterval(interval);
  }, [loop]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      chairsRef.current = CHAIRS.map((chair) => ({ ...chair }));
      setTick(0);
      toast("Infusion console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OncologyInfusionHub() {
  const [tab, setTab] = useState("floor");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [vesicantFilter, setVesicantFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");

  const { toasts, toast, removeToast } = useSeverityToasts();

  const [chairs, setChairs] = useState(() => CHAIRS.map((chair) => ({ ...chair })));
  const [preparations, setPreparations] = useState(() => PREPARATIONS.map((preparation) => ({ ...preparation })));
  const [toxicities, setToxicities] = useState(() => TOXICITIES.map((toxicity) => ({ ...toxicity })));

  const chairsRef = useRef(chairs);
  useEffect(() => {
    chairsRef.current = chairs;
  }, [chairs]);

  const simulation = useSimulation({ chairsRef, toast });

  useEffect(() => {
    setChairs([...chairsRef.current]);
  }, [simulation.tick]);

  /* ---------- derived ---------- */

  const bloodsByPatient = useMemo(
    () => BLOODS.reduce((accumulator, entry) => ({ ...accumulator, [entry.patient]: entry }), {}),
    []
  );

  const stats = useMemo(() => {
    const infusing = chairs.filter((chair) => chair.status === "Infusing").length;
    const vesicants = chairs.filter((chair) => chair.vesicant === "Vesicant" && chair.status === "Infusing").length;
    const outOfTolerance = preparations.filter((preparation) => doseVerdict(preparation) === "Outside tolerance").length;
    const exceedances = WIPE_SAMPLES.filter(wipeExceeds).length;
    return { infusing, vesicants, outOfTolerance, exceedances };
  }, [chairs, preparations]);

  const filteredChairs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chairs.filter((chair) => {
      const matchesQuery =
        !needle ||
        [chair.chair, chair.patient, chair.regimen, chair.drug].some((field) => field.toLowerCase().includes(needle));
      const matchesVesicant = vesicantFilter === "All" || chair.vesicant === vesicantFilter;
      return matchesQuery && matchesVesicant;
    });
  }, [chairs, query, vesicantFilter]);

  const filteredPreparations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return preparations.filter(
      (preparation) =>
        !needle ||
        [preparation.id, preparation.patient, preparation.drug, preparation.basis].some((field) =>
          String(field).toLowerCase().includes(needle)
        )
    );
  }, [preparations, query]);

  const filteredToxicities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return toxicities.filter((toxicity) => {
      const matchesQuery =
        !needle ||
        [toxicity.id, toxicity.patient, toxicity.event, toxicity.attributed].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesGrade = gradeFilter === "All" || `Grade ${toxicity.grade}` === gradeFilter;
      return matchesQuery && matchesGrade;
    });
  }, [toxicities, query, gradeFilter]);

  /* ---------- actions ---------- */

  const releasePreparation = (preparation) => {
    if (doseVerdict(preparation) === "Outside tolerance") {
      toast(`${preparation.id} held — recalculated dose disagrees with the prescription`, "High");
      setModal({ kind: "dose", preparation });
      return;
    }
    setPreparations((current) =>
      current.map((item) => (item.id === preparation.id ? { ...item, status: "Released" } : item))
    );
    toast(`${preparation.id} released to the floor after independent check`, "Low");
  };

  const holdPreparation = (id) => {
    setPreparations((current) => current.map((item) => (item.id === id ? { ...item, status: "Held" } : item)));
    toast(`${id} held pending pharmacist review`, "Medium");
  };

  const resolveToxicity = (id) => {
    setToxicities((current) => current.map((item) => (item.id === id ? { ...item, resolved: true } : item)));
    toast(`${id} marked resolved`, "Low");
  };

  const exportCsv = () => {
    const table =
      tab === "floor"
        ? [
            ["Chair", "Patient", "Regimen", "Cycle", "Drug", "Vesicant class", "Route", "Infused", "Volume", "Rate", "Status"],
            ...filteredChairs.map((chair) => [
              chair.chair,
              chair.patient,
              chair.regimen,
              `${chair.cycle}/${chair.ofCycles}`,
              chair.drug,
              chair.vesicant,
              chair.route,
              chair.infusedMl,
              chair.volumeMl,
              chair.ratePerHour,
              chair.status,
            ]),
          ]
        : tab === "doses"
        ? [
            ["Preparation", "Patient", "Drug", "Basis", "Prescribed mg", "Recalculated mg", "Variance %", "Verdict", "Status"],
            ...filteredPreparations.map((preparation) => [
              preparation.id,
              preparation.patient,
              preparation.drug,
              preparation.basis,
              preparation.prescribedMg,
              recalculateDose(preparation).dose ?? "n/a",
              doseVariancePct(preparation) ?? "n/a",
              doseVerdict(preparation),
              preparation.status,
            ]),
          ]
        : tab === "containment"
        ? [
            ["Control", "Type", "Room", "Pressure Pa", "Air changes", "HEPA tested", "Status", "Fault"],
            ...CONTAINMENT.map((control) => [
              control.id,
              control.type,
              control.room,
              control.pressureDiffPa,
              control.airChanges,
              control.hepaLastTested,
              control.status,
              containmentFault(control) ?? "none",
            ]),
          ]
        : [
            ["Case", "Patient", "Event", "CTCAE grade", "Cycle", "Attributed to", "Action", "Resolved"],
            ...filteredToxicities.map((toxicity) => [
              toxicity.id,
              toxicity.patient,
              toxicity.event,
              toxicity.grade,
              toxicity.cycle,
              toxicity.attributed,
              toxicity.action,
              toxicity.resolved ? "Yes" : "No",
            ]),
          ];

    downloadCsv(`oncology-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "floor", label: "Infusion Floor", icon: Syringe },
    { id: "doses", label: "Dose Verification", icon: Calculator },
    { id: "containment", label: "Hazardous Containment", icon: Biohazard },
    { id: "toxicity", label: "Toxicity Governance", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <SeverityToastTray toasts={toasts} onDismiss={removeToast} />

      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-violet-400">
              <Syringe size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Oncology Infusion &amp; Hazardous Drug Safety Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Infusion floor · dose verification · containment · toxicity — USP &lt;800&gt; / ASCO-ONS aligned
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
                    simulation.speed === factor ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:bg-slate-800"
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
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-violet-500/40 hover:text-violet-300"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Syringe}
            label="Infusions running"
            value={stats.infusing}
            sub={`${chairs.length} chairs on the floor`}
            accent="text-violet-400"
          />
          <StatCard
            icon={Droplet}
            label="Vesicants running"
            value={stats.vesicants}
            sub="extravasation kit at the chair"
            accent={stats.vesicants > 0 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Calculator}
            label="Doses outside tolerance"
            value={stats.outOfTolerance}
            sub={`independent check, ±${DOSE_VARIANCE_TOLERANCE_PCT}%`}
            accent={stats.outOfTolerance > 0 ? "text-red-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Biohazard}
            label="Surface exceedances"
            value={stats.exceedances}
            sub={`wipe samples ≥ ${WIPE_ACTION_NG_CM2} ng/cm²`}
            accent={stats.exceedances > 0 ? "text-red-400" : "text-emerald-400"}
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
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
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
              placeholder="Search chairs, patients, regimens, preparations…"
              aria-label="Search the day unit"
              className="w-80 rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          {tab === "floor" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Vesicant", "Irritant", "Non-vesicant"].map((option) => (
                <button
                  key={option}
                  onClick={() => setVesicantFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    vesicantFilter === option
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {tab === "toxicity" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Grade 1", "Grade 2", "Grade 3"].map((option) => (
                <button
                  key={option}
                  onClick={() => setGradeFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    gradeFilter === option
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
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
            {filteredChairs.map((chair) => {
              const bloods = bloodsByPatient[chair.patient];
              const blockers = chair.patient === "—" ? [] : fitnessBlockers(bloods);
              const remaining = minutesRemaining(chair);
              return (
                <div
                  key={chair.chair}
                  className={`rounded-2xl border bg-slate-900/60 p-5 ${
                    chair.vesicant === "Vesicant" ? "border-amber-500/40" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{chair.chair}</h3>
                        <Badge>{chair.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {chair.patient === "—" ? "Chair vacant" : `${chair.patient} · cycle ${chair.cycle} of ${chair.ofCycles}`}
                      </p>
                      {chair.regimen !== "—" && <p className="mt-0.5 text-[11px] text-slate-500">{chair.regimen}</p>}
                    </div>
                    {chair.patient !== "—" && (
                      <button
                        onClick={() => setModal({ kind: "chair", chair, bloods, blockers })}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-violet-500/40 hover:text-violet-300"
                      >
                        Detail
                      </button>
                    )}
                  </div>

                  {chair.status === "Vacant" ? (
                    <p className="mt-6 text-center text-xs text-slate-500">Chair vacant — available for booking.</p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge>{chair.vesicant}</Badge>
                        <span className="text-[11px] text-slate-500">{chair.drug}</span>
                        <span className="text-[11px] text-slate-600">· {chair.route}</span>
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Volume infused</span>
                          <span className="text-slate-300">
                            {chair.infusedMl} / {chair.volumeMl} mL
                          </span>
                        </div>
                        <Meter
                          value={(chair.infusedMl / Math.max(1, chair.volumeMl)) * 100}
                          color={chair.status === "Complete" ? "bg-emerald-400" : "bg-violet-400"}
                          full
                        />
                        <div className="flex items-center justify-between text-[10px] text-slate-600">
                          <span>{chair.ratePerHour} mL/h</span>
                          <span>{remaining === 0 ? "complete" : `${remaining} min remaining`}</span>
                        </div>
                      </div>

                      {chair.vesicant === "Vesicant" && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-amber-300">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          Vesicant: central access preferred, extravasation kit at the chair, blood return checked every
                          {" "}
                          5 mL by policy.
                        </div>
                      )}

                      {blockers.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {blockers.map((blocker) => (
                            <div key={blocker} className="flex items-start gap-1.5 text-[10px] text-red-300">
                              <ShieldAlert size={11} className="mt-0.5 shrink-0" />
                              {blocker}
                            </div>
                          ))}
                        </div>
                      )}

                      {chair.alarm && (
                        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
                          <Bell size={12} /> {chair.alarm}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {filteredChairs.length === 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState message="No chairs match the current search and filter." icon={Syringe} />
              </div>
            )}
          </div>
        )}

        {tab === "doses" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Info size={15} className="text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-200">The check is independent, not a re-read</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Each preparation carries the parameters its dose was derived from, so the console recalculates the
                milligrams from first principles and then compares — it never reads the prescribed figure and agrees
                with it. Body surface area uses the Mosteller formula, √(height × weight / 3600), because it is simple
                enough to be checked by hand at the chair. Carboplatin is the standing exception: it is cleared almost
                entirely by the kidney, so Calvert dosing derives the dose from renal function and a target exposure,
                and dosing it per square metre badly over-treats a patient with poor clearance.
              </p>
            </div>

            {filteredPreparations.map((preparation) => {
              const { dose, workings } = recalculateDose(preparation);
              const variance = doseVariancePct(preparation);
              const verdict = doseVerdict(preparation);
              const bsa = bodySurfaceArea(preparation.heightCm, preparation.weightKg);
              return (
                <div
                  key={preparation.id}
                  className={`rounded-2xl border bg-slate-900/60 p-5 ${
                    verdict === "Outside tolerance" ? "border-red-500/40" : "border-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{preparation.id}</h3>
                        <Badge>{preparation.status}</Badge>
                        <Badge tone={verdict === "Outside tolerance" ? "red" : "green"}>{verdict}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {preparation.patient} · {preparation.drug} · {preparation.basis} dosing
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Compounded in {preparation.hood} {preparation.preparedAgo} h ago · beyond-use{" "}
                        {preparation.beyondUseHours} h · checked by {preparation.verifiedBy}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {preparation.status !== "Released" && (
                        <button
                          onClick={() => releasePreparation(preparation)}
                          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/20"
                        >
                          Release
                        </button>
                      )}
                      {preparation.status !== "Held" && (
                        <button
                          onClick={() => holdPreparation(preparation.id)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                        >
                          Hold
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ kind: "dose", preparation })}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-violet-500/40 hover:text-violet-300"
                      >
                        Workings
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] text-slate-500">Prescribed</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{preparation.prescribedMg} mg</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] text-slate-500">Recalculated</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{dose ?? "n/a"} mg</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] text-slate-500">Variance</div>
                      <div
                        className={`mt-1 text-sm font-semibold ${
                          verdict === "Outside tolerance" ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {variance === null ? "n/a" : `${variance > 0 ? "+" : ""}${variance}%`}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] text-slate-500">Basis</div>
                      <div className="mt-1 text-xs font-medium text-slate-200">{workings}</div>
                      {bsa !== null && preparation.basis === "BSA" && (
                        <div className="mt-0.5 text-[10px] text-slate-600">Mosteller BSA {bsa} m²</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredPreparations.length === 0 && <EmptyState message="No preparations match the search." icon={Syringe} />}
          </div>
        )}

        {tab === "containment" && (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Wind size={15} className="text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-200">Engineering controls</h2>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                USP &lt;800&gt; requires the compounding room to sit at negative pressure relative to its anteroom, so
                that air — and anything aerosolised in it — flows inward. A reading that is positive, or not negative
                enough, is a containment failure whatever the certificate on the wall says. The anteroom is the one
                space in the suite that is meant to be positive.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CONTAINMENT.map((control) => {
                  const fault = containmentFault(control);
                  return (
                    <div
                      key={control.id}
                      className={`rounded-2xl border bg-slate-900/60 p-4 ${fault ? "border-red-500/30" : "border-slate-800"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{control.id}</div>
                          <div className="text-[11px] text-slate-500">{control.type}</div>
                        </div>
                        <Badge>{control.status}</Badge>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <Row label="Location" value={control.room} />
                        <Row
                          label="Pressure differential"
                          value={`${control.pressureDiffPa} Pa`}
                          accent={fault ? "text-red-400" : "text-emerald-400"}
                        />
                        <Row label="Air changes per hour" value={control.airChanges} />
                        <Row label="HEPA last tested" value={control.hepaLastTested} />
                        <Row label="Closed-system transfer" value={control.cstdInUse ? "In use" : "Not applicable"} />
                      </div>
                      {fault && (
                        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-300">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          {fault}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Biohazard size={15} className="text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-200">Surface wipe sampling</h2>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                There is no regulatory safe level for antineoplastic residue on a work surface, so{" "}
                {WIPE_ACTION_NG_CM2} ng/cm² below is an internal action threshold rather than a limit: crossing it
                triggers decontamination and a review of technique. The pattern is as informative as the numbers — the
                highest readings here are on the waste bin lid and the pass-through hatch, not inside the cabinets,
                which points at handling rather than at the engineering controls.
              </p>
              <div className="overflow-hidden rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Sample</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Marker drug</th>
                      <th className="px-4 py-3 font-medium">Residue</th>
                      <th className="px-4 py-3 font-medium">Sampled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
                    {WIPE_SAMPLES.map((sample) => {
                      const exceeds = wipeExceeds(sample);
                      return (
                        <tr key={sample.id} className="hover:bg-slate-900/50">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-300">{sample.id}</td>
                          <td className="px-4 py-3 text-slate-200">{sample.location}</td>
                          <td className="px-4 py-3 text-slate-400">{sample.drug}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={exceeds ? "font-semibold text-red-400" : "text-slate-300"}>
                                {sample.ngPerCm2} ng/cm²
                              </span>
                              {exceeds && <Badge tone="red">Action</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{sample.sampled}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "toxicity" && (
          <div className="space-y-6">
            <section className="space-y-3">
              {filteredToxicities.map((toxicity) => (
                <div key={toxicity.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{toxicity.event}</h3>
                        <Badge tone={toxicity.grade >= 3 ? "red" : toxicity.grade === 2 ? "amber" : "green"}>
                          Grade {toxicity.grade}
                        </Badge>
                        {toxicity.resolved && <Badge tone="green">Resolved</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {toxicity.id} · {toxicity.patient} · cycle {toxicity.cycle} · attributed to {toxicity.attributed}
                      </p>
                      <p className="mt-1 text-[11px] text-violet-300">{toxicity.action}</p>
                    </div>
                    {!toxicity.resolved && (
                      <button
                        onClick={() => resolveToxicity(toxicity.id)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredToxicities.length === 0 && <EmptyState message="No toxicity cases match the current filter." icon={Syringe} />}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Droplet size={15} className="text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-200">Extravasation register</h2>
              </div>
              <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                Vesicant extravasation is the injury this whole console exists to avoid: a few millilitres of
                doxorubicin outside the vein can take months and a plastic surgeon to resolve. Every event is kept on
                the register with the time to antidote, because that interval is the single best predictor of the
                outcome.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {EXTRAVASATIONS.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{event.id}</div>
                        <div className="text-[11px] text-slate-500">
                          {event.patient} · {event.when}
                        </div>
                      </div>
                      <Badge tone="red">{event.classification}</Badge>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Row label="Drug" value={event.drug} />
                      <Row label="Site" value={event.site} />
                      <Row label="Estimated volume" value={`${event.volumeMl} mL`} />
                      <Row label="Antidote" value={event.antidote} />
                      <Row label="Outcome" value={event.outcome} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {modal?.kind === "chair" && (
        <Modal
          title={modal.chair.chair}
          subtitle={`${modal.chair.patient} · ${modal.chair.regimen}`}
          onClose={() => setModal(null)}
        >
          <Row label="Cycle" value={`${modal.chair.cycle} of ${modal.chair.ofCycles}`} />
          <Row label="Drug" value={modal.chair.drug} />
          <Row
            label="Vesicant classification"
            value={modal.chair.vesicant}
            accent={modal.chair.vesicant === "Vesicant" ? "text-red-400" : "text-slate-200"}
          />
          <Row label="Vascular access" value={modal.chair.route} />
          <Row label="Premedication" value={modal.chair.premedication} />
          <Row label="Rate" value={`${modal.chair.ratePerHour} mL/h`} />
          <Row label="Volume infused" value={`${modal.chair.infusedMl} of ${modal.chair.volumeMl} mL`} />
          <Row label="Time remaining" value={`${minutesRemaining(modal.chair)} min`} />
          {modal.bloods && (
            <>
              <div className="pt-1 text-[11px] font-medium text-slate-400">Same-day bloods ({modal.bloods.drawn})</div>
              <Row
                label="Neutrophils"
                value={`${modal.bloods.anc} ×10⁹/L`}
                accent={modal.bloods.anc < ANC_HOLD_THRESHOLD ? "text-red-400" : "text-emerald-400"}
              />
              <Row
                label="Platelets"
                value={`${modal.bloods.platelets} ×10⁹/L`}
                accent={modal.bloods.platelets < PLATELET_HOLD_THRESHOLD ? "text-red-400" : "text-emerald-400"}
              />
              <Row label="Creatinine" value={`${modal.bloods.creatinine} µmol/L`} />
              <Row label="Bilirubin" value={`${modal.bloods.bilirubin} µmol/L`} />
            </>
          )}
          {modal.blockers.length > 0 ? (
            <ul className="space-y-1.5">
              {modal.blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2 text-[11px] text-red-300">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-400">Counts and organ function are inside treatment thresholds.</p>
          )}
        </Modal>
      )}

      {modal?.kind === "dose" && (
        <Modal
          title={`${modal.preparation.id} dose check`}
          subtitle={`${modal.preparation.patient} · ${modal.preparation.drug}`}
          onClose={() => setModal(null)}
        >
          <Row label="Dosing basis" value={modal.preparation.basis} />
          {modal.preparation.basis === "BSA" && (
            <>
              <Row label="Height" value={`${modal.preparation.heightCm} cm`} />
              <Row label="Weight" value={`${modal.preparation.weightKg} kg`} />
              <Row
                label="Mosteller BSA"
                value={`${bodySurfaceArea(modal.preparation.heightCm, modal.preparation.weightKg)} m²`}
              />
              <Row label="Protocol dose" value={`${modal.preparation.perUnit} mg/m²`} />
            </>
          )}
          {modal.preparation.basis === "AUC" && (
            <>
              <Row label="Target AUC" value={`${modal.preparation.targetAuc} mg·min/mL`} />
              <Row label="Measured GFR" value={`${modal.preparation.gfr} mL/min`} />
              <Row label="Calvert formula" value="dose = AUC × (GFR + 25)" />
            </>
          )}
          <Row label="Independent recalculation" value={`${recalculateDose(modal.preparation).dose} mg`} />
          <Row label="Prescribed" value={`${modal.preparation.prescribedMg} mg`} />
          <Row
            label="Variance"
            value={`${doseVariancePct(modal.preparation)}%`}
            accent={doseVerdict(modal.preparation) === "Outside tolerance" ? "text-red-400" : "text-emerald-400"}
          />
          <Row label="Verdict" value={doseVerdict(modal.preparation)} />
          <Row label="Compounded in" value={modal.preparation.hood} />
          <Row label="Beyond-use period" value={`${modal.preparation.beyondUseHours} h`} />
          <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Beaker size={14} className="mt-0.5 shrink-0 text-violet-400" />
            <span>
              A variance outside ±{DOSE_VARIANCE_TOLERANCE_PCT}% holds the preparation rather than warning about it.
              Tighter than that and every legitimate rounding decision would fire the alert; looser, and a real error
              passes.
            </span>
          </div>
        </Modal>
      )}

      <footer className="border-t border-slate-800 px-6 py-4 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <Biohazard size={12} /> USP &lt;800&gt; hazardous drug handling
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical size={12} /> USP &lt;797&gt; beyond-use dating
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} /> NIOSH hazardous drug list
          </span>
          <span className="flex items-center gap-1.5">
            <Calculator size={12} /> Mosteller BSA and Calvert AUC dosing
          </span>
          <span className="flex items-center gap-1.5">
            <FileText size={12} /> ASCO/ONS independent dose verification
          </span>
          <span className="flex items-center gap-1.5">
            <Activity size={12} /> CTCAE v5.0 adverse event grading
          </span>
          <span className="flex items-center gap-1.5">
            <Wind size={12} /> Negative-pressure containment monitoring
          </span>
          <span className="flex items-center gap-1.5">
            <Siren size={12} /> Vesicant extravasation register
          </span>
          <span className="flex items-center gap-1.5">
            <Layers size={12} /> Closed-system transfer device tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Gauge size={12} /> Surface residue trending
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingDown size={12} /> Count-based treatment holds
          </span>
          <span className="flex items-center gap-1.5">
            <User size={12} /> Cycle and regimen tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Timer size={12} /> Infusion rate and time-remaining projection
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> Same-day bloods gating
          </span>
        </div>
      </footer>
    </div>
  );
}
