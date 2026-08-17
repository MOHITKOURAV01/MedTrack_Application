import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Calculator, CheckCircle2, Cpu, Eye, FileText, Gauge, Info,
  Lock, Pause, Play, RefreshCw, ScanLine, ShieldAlert, Siren, Zap,
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
 *  MedTrack Ophthalmology & Vision Diagnostics Hub
 *  ------------------------------------------------------------------
 *  Four consoles for an eye unit, which is unusual in MedTrack's estate
 *  in that almost every clinical decision it makes is produced by a
 *  device rather than merely recorded on one. An OCT that has drifted
 *  does not fail loudly - it reports a retinal thickness that is
 *  plausible and wrong, and a treatment decision is made on it.
 *
 *    1. Imaging Fleet   - OCT, fundus, visual field and biometry units
 *                         with calibration due dates, throughput and the
 *                         queue each is carrying.
 *    2. Laser Suite     - YAG, SLT, femtosecond and excimer lasers with
 *                         shot counters, delivered-energy calibration,
 *                         interlock and key control.
 *    3. DR Screening    - diabetic retinopathy grading to the UK NSC
 *                         R/M scale, with AI pre-screen agreement and
 *                         referral clocks.
 *    4. IOL Biometry    - cataract lens power, independently recalculated
 *                         rather than read back from the plan.
 *
 *  The biometry console is the substance of this page, and it is
 *  deliberately independent: it never reads the planned dioptres and
 *  agree with them. It recalculates from the measurements the plan was
 *  built on and then compares. See iolPower() for the formula and for
 *  why the eyes it refuses to calculate matter more than the ones it
 *  does.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Clinical constants                                                 */
/* ------------------------------------------------------------------ */

/**
 * Axial lengths outside this window are where regression formulas stop being trustworthy.
 *
 * SRK and its descendants are regressions fitted to eyes of ordinary length. In a short eye they
 * under-power and in a long eye they over-power, and the error is systematic rather than random -
 * it does not average out across a list. Modern vergence formulas (Barrett Universal II, Haigis,
 * Olsen) exist for exactly this range, so the honest thing for a checking console to do at the
 * extremes is decline to check rather than produce a number that looks like agreement.
 */
const REGRESSION_SAFE_AXIAL = { min: 22.0, max: 26.0 };

/**
 * Keratometry outside this window suggests a cornea that is not what the formula assumes - most
 * often a previous refractive procedure, which invalidates the keratometric index the device uses
 * to convert curvature to power. Those eyes need a post-refractive method and a history the console
 * does not have.
 */
const PLAUSIBLE_KERATOMETRY = { min: 40.0, max: 48.0 };

/**
 * The largest inter-eye axial length difference that is ordinarily real.
 *
 * Eyes are close to symmetrical. A difference beyond this is far more often a measurement taken
 * through a dense cataract, a poor fixation, or the second eye's scan filed against the first, than
 * it is genuine anisometropia - and each of those produces a lens power that is wrong by dioptres.
 * The instruction is to re-measure, not to proceed carefully.
 */
const INTEROCULAR_AXIAL_TOLERANCE = 0.3;

/** Dioptres of disagreement between the plan and the recalculation before the case is held. */
const IOL_POWER_TOLERANCE = 0.5;

/**
 * Delivered energy may sit this far from the set point before the laser is out of service.
 *
 * ±20% is the tolerance most manufacturers specify for the annual output check. It sounds generous
 * and is not: below it the surgeon titrates to effect and the difference is invisible; above it the
 * same nominal setting is a different treatment.
 */
const LASER_ENERGY_TOLERANCE_PCT = 20;

/**
 * UK NSC diabetic retinopathy grading, and what each grade is a clock for.
 *
 * The referral windows are the point. R3 is proliferative disease and the eye can lose vision in
 * the time an ordinary clinic appointment takes to arrive, so it is a two-week referral rather than
 * a routine one. Grading without the clock attached is just a label.
 */
const DR_GRADES = {
  R0: { label: "R0 — no retinopathy", tone: "green", referralDays: null, note: "Routine rescreen in 12 months." },
  R1: { label: "R1 — background", tone: "green", referralDays: null, note: "Routine rescreen in 12 months; no referral." },
  R2: { label: "R2 — pre-proliferative", tone: "amber", referralDays: 91, note: "Refer to ophthalmology, routine (13 weeks)." },
  R3: { label: "R3 — proliferative", tone: "red", referralDays: 14, note: "Refer urgently. Sight-threatening within weeks." },
};

const MACULOPATHY = {
  M0: { label: "M0 — no maculopathy", tone: "green", referralDays: null },
  M1: { label: "M1 — maculopathy", tone: "amber", referralDays: 91 },
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const IMAGING_UNITS = [
  { id: "OPH-OCT-01", name: "Spectral-domain OCT", model: "Cirrus 6000", room: "Imaging 1", modality: "OCT", status: "Running", scansToday: 41, queue: 6, calibrationDueDays: 34, uptimePct: 99.1 },
  { id: "OPH-OCT-02", name: "Swept-source OCT-A", model: "Triton DRI", room: "Imaging 2", modality: "OCT", status: "Running", scansToday: 28, queue: 4, calibrationDueDays: 8, uptimePct: 97.4 },
  { id: "OPH-FUN-01", name: "Non-mydriatic fundus camera", model: "CR-2 AF", room: "Screening A", modality: "Fundus", status: "Running", scansToday: 96, queue: 11, calibrationDueDays: 61, uptimePct: 99.6 },
  { id: "OPH-FUN-02", name: "Ultra-widefield retinal imager", model: "Optos California", room: "Imaging 3", modality: "Fundus", status: "Idle", scansToday: 12, queue: 0, calibrationDueDays: 120, uptimePct: 98.8 },
  { id: "OPH-VF-01", name: "Static perimeter", model: "HFA3 860", room: "Fields 1", modality: "Visual field", status: "Running", scansToday: 19, queue: 5, calibrationDueDays: -3, uptimePct: 96.2 },
  { id: "OPH-VF-02", name: "Static perimeter", model: "Octopus 900", room: "Fields 2", modality: "Visual field", status: "Maintenance", scansToday: 0, queue: 7, calibrationDueDays: 45, uptimePct: 91.5 },
  { id: "OPH-BIO-01", name: "Optical biometer", model: "IOLMaster 700", room: "Pre-op", modality: "Biometry", status: "Running", scansToday: 23, queue: 3, calibrationDueDays: 17, uptimePct: 99.9 },
  { id: "OPH-BIO-02", name: "Optical biometer", model: "Lenstar LS 900", room: "Pre-op", modality: "Biometry", status: "Idle", scansToday: 7, queue: 0, calibrationDueDays: 5, uptimePct: 99.2 },
  { id: "OPH-TOP-01", name: "Corneal topographer", model: "Pentacam AXL", room: "Cornea", modality: "Topography", status: "Running", scansToday: 14, queue: 2, calibrationDueDays: 78, uptimePct: 98.1 },
  { id: "OPH-SPC-01", name: "Specular microscope", model: "CEM-530", room: "Cornea", modality: "Endothelium", status: "Idle", scansToday: 5, queue: 0, calibrationDueDays: 22, uptimePct: 99.4 },
];

const LASERS = [
  { id: "OPH-LAS-01", name: "Nd:YAG capsulotomy", model: "Ultra Q Reflex", room: "Laser 1", wavelengthNm: 1064, shots: 184_220, shotLimit: 250_000, setEnergyMj: 1.8, deliveredMj: 1.76, interlock: true, keyOut: true, eyewearOd: 5, lastServiceDays: 41 },
  { id: "OPH-LAS-02", name: "SLT trabeculoplasty", model: "Tango Reflex", room: "Laser 1", wavelengthNm: 532, shots: 96_540, shotLimit: 200_000, setEnergyMj: 0.9, deliveredMj: 1.16, interlock: true, keyOut: true, eyewearOd: 5, lastServiceDays: 118 },
  { id: "OPH-LAS-03", name: "Femtosecond cataract", model: "LenSx", room: "Theatre 4", wavelengthNm: 1030, shots: 21_880, shotLimit: 60_000, setEnergyMj: 6.0, deliveredMj: 5.94, interlock: true, keyOut: false, eyewearOd: 6, lastServiceDays: 12 },
  { id: "OPH-LAS-04", name: "Excimer refractive", model: "Amaris 1050RS", room: "Refractive", wavelengthNm: 193, shots: 402_115, shotLimit: 500_000, setEnergyMj: 2.4, deliveredMj: 2.31, interlock: false, keyOut: true, eyewearOd: 6, lastServiceDays: 9 },
  { id: "OPH-LAS-05", name: "Pattern scan retinal", model: "PASCAL Synthesis", room: "Laser 2", wavelengthNm: 577, shots: 311_470, shotLimit: 300_000, setEnergyMj: 4.5, deliveredMj: 4.42, interlock: true, keyOut: true, eyewearOd: 5, lastServiceDays: 63 },
  { id: "OPH-LAS-06", name: "Micropulse subthreshold", model: "IQ 577", room: "Laser 2", wavelengthNm: 577, shots: 58_900, shotLimit: 250_000, setEnergyMj: 3.0, deliveredMj: 2.05, interlock: true, keyOut: true, eyewearOd: 5, lastServiceDays: 201 },
];

const SCREENING = [
  { id: "DRS-4471", patient: "PT-8801 — L. Mwangi", eye: "OD", grade: "R1", maculopathy: "M0", aiGrade: "R1", gradable: true, waitingDays: 4, grader: "S. Ali", diabetesYears: 6 },
  { id: "DRS-4472", patient: "PT-8801 — L. Mwangi", eye: "OS", grade: "R2", maculopathy: "M0", aiGrade: "R1", gradable: true, waitingDays: 4, grader: "S. Ali", diabetesYears: 6 },
  { id: "DRS-4473", patient: "PT-8817 — D. Petrov", eye: "OD", grade: "R3", maculopathy: "M1", aiGrade: "R3", gradable: true, waitingDays: 11, grader: "S. Ali", diabetesYears: 19 },
  { id: "DRS-4474", patient: "PT-8817 — D. Petrov", eye: "OS", grade: "R2", maculopathy: "M1", aiGrade: "R2", gradable: true, waitingDays: 11, grader: "J. Okonkwo", diabetesYears: 19 },
  { id: "DRS-4475", patient: "PT-8823 — R. Iyer", eye: "OD", grade: "R0", maculopathy: "M0", aiGrade: "R0", gradable: true, waitingDays: 2, grader: "J. Okonkwo", diabetesYears: 2 },
  { id: "DRS-4476", patient: "PT-8823 — R. Iyer", eye: "OS", grade: "R0", maculopathy: "M0", aiGrade: "R0", gradable: true, waitingDays: 2, grader: "J. Okonkwo", diabetesYears: 2 },
  { id: "DRS-4477", patient: "PT-8834 — F. Costa", eye: "OD", grade: "R1", maculopathy: "M0", aiGrade: "R2", gradable: true, waitingDays: 7, grader: "S. Ali", diabetesYears: 11 },
  { id: "DRS-4478", patient: "PT-8834 — F. Costa", eye: "OS", grade: "U", maculopathy: "M0", aiGrade: "U", gradable: false, waitingDays: 7, grader: "S. Ali", diabetesYears: 11 },
  { id: "DRS-4479", patient: "PT-8840 — H. Nakamura", eye: "OD", grade: "R3", maculopathy: "M0", aiGrade: "R2", gradable: true, waitingDays: 16, grader: "J. Okonkwo", diabetesYears: 24 },
  { id: "DRS-4480", patient: "PT-8840 — H. Nakamura", eye: "OS", grade: "R2", maculopathy: "M0", aiGrade: "R2", gradable: true, waitingDays: 16, grader: "J. Okonkwo", diabetesYears: 24 },
];

/**
 * Cataract cases awaiting theatre. `plannedPower` is what is on the surgical plan; the console
 * never treats it as an input to the check.
 *
 * `fellowAxial` is the other eye's axial length, which is what makes the symmetry check possible at
 * all - a single eye's measurement carries no evidence about whether it is right.
 */
const BIOMETRY = [
  { id: "BIO-2201", patient: "PT-9001 — A. Rahman", eye: "OD", axial: 23.42, keratometry: 43.75, aConstant: 118.9, lens: "SN60WF", targetRefraction: -0.25, plannedPower: 21.5, fellowAxial: 23.51, constantOptimised: true, biometer: "IOLMaster 700" },
  { id: "BIO-2202", patient: "PT-9014 — M. Duarte", eye: "OS", axial: 25.88, keratometry: 42.10, aConstant: 118.7, lens: "ZCB00", targetRefraction: 0.0, plannedPower: 17.0, fellowAxial: 25.79, constantOptimised: true, biometer: "IOLMaster 700" },
  { id: "BIO-2203", patient: "PT-9022 — S. Bello", eye: "OD", axial: 21.36, keratometry: 46.20, aConstant: 118.9, lens: "SN60WF", targetRefraction: -0.50, plannedPower: 27.0, fellowAxial: 21.44, constantOptimised: true, biometer: "Lenstar LS 900" },
  { id: "BIO-2204", patient: "PT-9035 — T. Novak", eye: "OS", axial: 24.10, keratometry: 44.50, aConstant: 119.0, lens: "MX60", targetRefraction: -0.25, plannedPower: 19.0, fellowAxial: 24.02, constantOptimised: false, biometer: "IOLMaster 700" },
  { id: "BIO-2205", patient: "PT-9048 — K. Adeyemi", eye: "OD", axial: 23.05, keratometry: 38.90, aConstant: 118.9, lens: "SN60WF", targetRefraction: 0.0, plannedPower: 23.5, fellowAxial: 23.11, constantOptimised: true, biometer: "IOLMaster 700" },
  { id: "BIO-2206", patient: "PT-9059 — P. Lindqvist", eye: "OS", axial: 23.90, keratometry: 43.20, aConstant: 118.4, lens: "CT Lucia", targetRefraction: -1.50, plannedPower: 20.0, fellowAxial: 24.85, constantOptimised: true, biometer: "Lenstar LS 900" },
  { id: "BIO-2207", patient: "PT-9063 — E. Haddad", eye: "OD", axial: 22.74, keratometry: 45.05, aConstant: 118.9, lens: "SN60WF", targetRefraction: -0.25, plannedPower: 24.0, fellowAxial: 22.80, constantOptimised: true, biometer: "IOLMaster 700" },
  { id: "BIO-2208", patient: "PT-9071 — G. Weber", eye: "OS", axial: 24.60, keratometry: 41.85, aConstant: 118.7, lens: "ZCB00", targetRefraction: 0.0, plannedPower: 21.0, fellowAxial: 24.55, constantOptimised: true, biometer: "IOLMaster 700" },
];

/* ------------------------------------------------------------------ */
/*  Clinical calculations                                              */
/* ------------------------------------------------------------------ */

const round2 = (v) => Math.round(v * 100) / 100;

/** IOL powers are supplied in quarter-dioptre steps, so a recalculation that is not is not orderable. */
const toQuarterDioptre = (v) => Math.round(v * 4) / 4;

/**
 * SRK II lens power, for an eye the formula is entitled to be used on.
 *
 * SRK II adjusts the manufacturer's A-constant by axial length before applying the SRK regression:
 *
 *   A1 = A + 3    L < 20.0
 *      = A + 2    20.0 <= L < 21.0
 *      = A + 1    21.0 <= L < 22.0
 *      = A        22.0 <= L <= 24.5
 *      = A - 0.5  L > 24.5
 *
 *   P(emmetropia) = A1 - 2.5L - 0.9K
 *
 * and then corrects to the surgeon's target refraction using the refractive correction factor,
 * 1.5 for a high-power lens and 1.0 otherwise:
 *
 *   P(target) = P(emmetropia) - target x CR
 *
 * The banded A-constant is why SRK II is worth implementing rather than plain SRK: plain SRK is a
 * single line fitted through eyes of every length, and the bands are the acknowledgement that one
 * line does not fit. It is still a regression, which is why the caller checks the axial length
 * against REGRESSION_SAFE_AXIAL before trusting any of this.
 */
export function iolPower({ axial, keratometry, aConstant, targetRefraction = 0 }) {
  let adjustedA = aConstant;
  if (axial < 20.0) adjustedA = aConstant + 3;
  else if (axial < 21.0) adjustedA = aConstant + 2;
  else if (axial < 22.0) adjustedA = aConstant + 1;
  else if (axial > 24.5) adjustedA = aConstant - 0.5;

  const emmetropic = adjustedA - 2.5 * axial - 0.9 * keratometry;
  const correctionFactor = emmetropic > 14 ? 1.5 : 1.0;
  const forTarget = emmetropic - targetRefraction * correctionFactor;

  return {
    adjustedA: round2(adjustedA),
    emmetropic: round2(emmetropic),
    correctionFactor,
    power: toQuarterDioptre(forTarget),
  };
}

/**
 * Everything that makes a case unsafe to check, evaluated together rather than short-circuited.
 *
 * The short-circuit is the tempting mistake: return on the first problem and the reviewer fixes it,
 * re-runs, and meets the second. An eye can be both long and asymmetric, and knowing only that it
 * is long produces a second round trip for information that was available the first time.
 */
export function biometryFlags(record) {
  const flags = [];

  if (record.axial < REGRESSION_SAFE_AXIAL.min || record.axial > REGRESSION_SAFE_AXIAL.max) {
    flags.push({
      code: "AXIAL_OUT_OF_RANGE",
      tone: "red",
      text: `Axial length ${record.axial.toFixed(2)} mm is outside ${REGRESSION_SAFE_AXIAL.min}–${REGRESSION_SAFE_AXIAL.max} mm. SRK II is a regression and is systematically wrong at the extremes — plan on an optimised vergence formula (Barrett Universal II or Haigis).`,
    });
  }

  if (record.keratometry < PLAUSIBLE_KERATOMETRY.min || record.keratometry > PLAUSIBLE_KERATOMETRY.max) {
    flags.push({
      code: "KERATOMETRY_IMPLAUSIBLE",
      tone: "red",
      text: `Mean K ${record.keratometry.toFixed(2)} D is outside ${PLAUSIBLE_KERATOMETRY.min}–${PLAUSIBLE_KERATOMETRY.max} D. Most often a previous refractive procedure, which invalidates the keratometric index — a post-refractive method and the operative history are needed.`,
    });
  }

  const interocular = Math.abs(record.axial - record.fellowAxial);
  if (interocular > INTEROCULAR_AXIAL_TOLERANCE) {
    flags.push({
      code: "INTEROCULAR_ASYMMETRY",
      tone: "amber",
      text: `Axial lengths differ by ${interocular.toFixed(2)} mm between eyes (tolerance ${INTEROCULAR_AXIAL_TOLERANCE.toFixed(2)} mm). Re-measure before proceeding — a dense cataract, poor fixation or a scan filed against the wrong eye all present this way.`,
    });
  }

  if (!record.constantOptimised) {
    flags.push({
      code: "CONSTANT_NOT_OPTIMISED",
      tone: "amber",
      text: `The A-constant for ${record.lens} has not been optimised against this surgeon's outcomes. The manufacturer's value carries the manufacturer's technique, not this theatre's.`,
    });
  }

  return flags;
}

/**
 * The independent check: recalculate, compare with the plan, and decide.
 *
 * `blocked` means the console will not produce a comparison at all, which is a different answer from
 * "the plan disagrees". An eye outside the formula's range does not get a number here, because a
 * number would be read as agreement or disagreement and it is neither.
 */
export function verifyBiometry(record) {
  const flags = biometryFlags(record);
  const blocked = flags.some((f) => f.tone === "red");

  if (blocked) {
    return { flags, blocked, calculated: null, variance: null, verdict: "Not calculable" };
  }

  const calculated = iolPower(record);
  const variance = round2(calculated.power - record.plannedPower);
  const verdict = Math.abs(variance) > IOL_POWER_TOLERANCE ? "Held" : "Verified";

  return { flags, blocked, calculated, variance, verdict };
}

/** Delivered energy as a percentage of the set point, and whether that is inside service tolerance. */
export function laserEnergyDeviation(laser) {
  const deviationPct = ((laser.deliveredMj - laser.setEnergyMj) / laser.setEnergyMj) * 100;
  return {
    deviationPct: round2(deviationPct),
    inTolerance: Math.abs(deviationPct) <= LASER_ENERGY_TOLERANCE_PCT,
  };
}

/**
 * Everything that takes a laser out of service, in the order a safety officer reads them.
 *
 * The interlock comes first because it is the only one that endangers somebody who is not the
 * patient: a defeated door interlock means the beam can be fired into an unprotected room.
 */
export function laserFaults(laser) {
  const faults = [];
  if (!laser.interlock) faults.push({ code: "INTERLOCK_OPEN", tone: "red", text: "Door interlock not proven. The beam can be fired into an unprotected room — out of service until proven." });
  if (laser.shots > laser.shotLimit) faults.push({ code: "SHOT_LIMIT", tone: "red", text: `${laser.shots.toLocaleString()} shots against a ${laser.shotLimit.toLocaleString()} service limit. Cavity output is unwarranted past the limit.` });
  const energy = laserEnergyDeviation(laser);
  if (!energy.inTolerance) faults.push({ code: "ENERGY_OUT_OF_TOLERANCE", tone: "red", text: `Delivered energy is ${energy.deviationPct > 0 ? "+" : ""}${energy.deviationPct}% against the set point (tolerance ±${LASER_ENERGY_TOLERANCE_PCT}%). The same nominal setting is a different treatment.` });
  if (!laser.keyOut) faults.push({ code: "KEY_LEFT_IN", tone: "amber", text: "Key left in the console. Key control is what stops an untrained user firing it." });
  if (laser.lastServiceDays > 365) faults.push({ code: "SERVICE_OVERDUE", tone: "amber", text: `${laser.lastServiceDays} days since the last service; the output check is annual.` });
  return faults;
}

/** The referral clock a screening episode is on, taking whichever of R and M is more urgent. */
export function referralFor(episode) {
  if (!episode.gradable) {
    return { days: 91, reason: "Ungradable images — refer for slit-lamp biomicroscopy.", tone: "amber" };
  }
  const r = DR_GRADES[episode.grade];
  const m = MACULOPATHY[episode.maculopathy];
  const candidates = [r?.referralDays, m?.referralDays].filter((d) => d != null);
  if (candidates.length === 0) {
    return { days: null, reason: r?.note || "Routine rescreen.", tone: "green" };
  }
  const days = Math.min(...candidates);
  return {
    days,
    reason: days === r?.referralDays ? r.note : "Maculopathy present — refer to ophthalmology, routine.",
    tone: days <= 14 ? "red" : "amber",
  };
}

/* ------------------------------------------------------------------ */
/*  Tone vocabulary                                                    */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  const v = String(value);
  if (/^(Running|Verified|In tolerance|Proven|R0|R1|M0|Optimised)$/.test(v)) return "green";
  if (/^(Idle|Ungradable|R2|M1|Not optimised)$/.test(v)) return "amber";
  if (/^(Maintenance|Held|Out of service|R3|Not calculable|Overdue)$/.test(v)) return "red";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;

/* ------------------------------------------------------------------ */
/*  Simulation                                                         */
/* ------------------------------------------------------------------ */

/**
 * The unit's own clock. Scans complete and queues drain, lasers accumulate shots and their delivered
 * energy wanders, and screening episodes age towards their referral date.
 *
 * Refs rather than state inside the loop: the interval is created once, and reading state through a
 * closure would pin it to the values captured when the effect first ran.
 */
function useUnitSimulation({ unitsRef, lasersRef, screeningRef, toast }) {
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
        unitsRef.current = unitsRef.current.map((unit) => {
          if (unit.status !== "Running") return unit;
          const completed = unit.queue > 0 ? 1 : 0;
          return {
            ...unit,
            queue: Math.max(0, unit.queue - completed),
            scansToday: unit.scansToday + completed,
            calibrationDueDays: unit.calibrationDueDays,
          };
        });

        lasersRef.current = lasersRef.current.map((laser) => {
          const fired = Math.round(Math.random() * 40);
          // Output drifts slowly and in one direction at a time, which is what an ageing cavity
          // actually does; a per-tick coin flip would average back to the set point and never trip.
          const drift = (Math.random() - 0.48) * 0.015 * laser.setEnergyMj;
          return {
            ...laser,
            shots: laser.shots + fired,
            deliveredMj: round2(Math.max(0.1, laser.deliveredMj + drift)),
          };
        });

        screeningRef.current = screeningRef.current.map((episode) => ({
          ...episode,
          waitingDays: episode.waitingDays + (Math.random() < 0.25 ? 1 : 0),
        }));
      }

      setTick((t) => t + 1);
    }, 1600);

    return () => clearInterval(interval);
  }, [unitsRef, lasersRef, screeningRef]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      unitsRef.current = IMAGING_UNITS.map((u) => ({ ...u }));
      lasersRef.current = LASERS.map((l) => ({ ...l }));
      screeningRef.current = SCREENING.map((s) => ({ ...s }));
      setTick(0);
      toast("Ophthalmology console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function OphthalmologyVisionHub() {
  const [tab, setTab] = useState("imaging");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("All");
  const [laserFilter, setLaserFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [biometryFilter, setBiometryFilter] = useState("All");

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, severity = "Low") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current.slice(-4), { id, message, severity }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const [units, setUnits] = useState(() => IMAGING_UNITS.map((u) => ({ ...u })));
  const [lasers, setLasers] = useState(() => LASERS.map((l) => ({ ...l })));
  const [screening, setScreening] = useState(() => SCREENING.map((s) => ({ ...s })));
  const [biometry, setBiometry] = useState(() => BIOMETRY.map((b) => ({ ...b })));

  const unitsRef = useRef(units);
  const lasersRef = useRef(lasers);
  const screeningRef = useRef(screening);

  useEffect(() => { unitsRef.current = units; }, [units]);
  useEffect(() => { lasersRef.current = lasers; }, [lasers]);
  useEffect(() => { screeningRef.current = screening; }, [screening]);

  const sim = useUnitSimulation({ unitsRef, lasersRef, screeningRef, toast });

  useEffect(() => {
    setUnits([...unitsRef.current]);
    setLasers([...lasersRef.current]);
    setScreening([...screeningRef.current]);
  }, [sim.tick]);

  /* ---------- derived ---------- */

  const verifications = useMemo(
    () => biometry.map((record) => ({ record, ...verifyBiometry(record) })),
    [biometry]
  );

  const stats = useMemo(() => {
    const calibrationOverdue = units.filter((u) => u.calibrationDueDays <= 0).length;
    const lasersDown = lasers.filter((l) => laserFaults(l).some((f) => f.tone === "red")).length;
    const urgentReferrals = screening.filter((s) => {
      const referral = referralFor(s);
      return referral.days != null && referral.days <= 14;
    }).length;
    const heldCases = verifications.filter((v) => v.verdict !== "Verified").length;
    return { calibrationOverdue, lasersDown, urgentReferrals, heldCases };
  }, [units, lasers, screening, verifications]);

  const filteredUnits = useMemo(() => {
    const q = query.toLowerCase();
    return units.filter((unit) => {
      const matchesQuery = !q || [unit.id, unit.name, unit.model, unit.room, unit.modality].some((f) => f.toLowerCase().includes(q));
      const matchesFilter = unitFilter === "All" || unit.status === unitFilter;
      return matchesQuery && matchesFilter;
    });
  }, [units, query, unitFilter]);

  const filteredLasers = useMemo(() => {
    const q = query.toLowerCase();
    return lasers.filter((laser) => {
      const matchesQuery = !q || [laser.id, laser.name, laser.model, laser.room].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (laserFilter === "All") return true;
      const faults = laserFaults(laser);
      if (laserFilter === "Out of service") return faults.some((f) => f.tone === "red");
      if (laserFilter === "Advisory") return faults.length > 0 && !faults.some((f) => f.tone === "red");
      return faults.length === 0;
    });
  }, [lasers, query, laserFilter]);

  const filteredScreening = useMemo(() => {
    const q = query.toLowerCase();
    return screening.filter((episode) => {
      const matchesQuery = !q || [episode.id, episode.patient, episode.grader, episode.grade].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (gradeFilter === "All") return true;
      if (gradeFilter === "Referable") {
        const referral = referralFor(episode);
        return referral.days != null;
      }
      if (gradeFilter === "AI disagreement") return episode.aiGrade !== episode.grade;
      return episode.grade === gradeFilter;
    });
  }, [screening, query, gradeFilter]);

  const filteredVerifications = useMemo(() => {
    const q = query.toLowerCase();
    return verifications.filter((entry) => {
      const { record } = entry;
      const matchesQuery = !q || [record.id, record.patient, record.lens, record.biometer].some((f) => f.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (biometryFilter === "All") return true;
      if (biometryFilter === "Verified") return entry.verdict === "Verified";
      if (biometryFilter === "Held") return entry.verdict === "Held";
      return entry.verdict === "Not calculable";
    });
  }, [verifications, query, biometryFilter]);

  /* ---------- actions ---------- */

  const toggleUnit = (id) => {
    setUnits((current) =>
      current.map((unit) =>
        unit.id === id
          ? { ...unit, status: unit.status === "Maintenance" ? "Idle" : "Maintenance", queue: unit.status === "Maintenance" ? unit.queue : unit.queue }
          : unit
      )
    );
    toast(`${id} moved in or out of maintenance`, "Medium");
  };

  const recalibrate = (id) => {
    setUnits((current) => current.map((unit) => (unit.id === id ? { ...unit, calibrationDueDays: 365 } : unit)));
    toast(`${id} calibration recorded — next due in 365 days`, "Low");
  };

  const recordEnergyCheck = (id) => {
    setLasers((current) =>
      current.map((laser) => (laser.id === id ? { ...laser, deliveredMj: laser.setEnergyMj, lastServiceDays: 0 } : laser))
    );
    toast(`${id} output check recorded — delivered energy returned to set point`, "Medium");
  };

  const escalate = (id) => {
    setScreening((current) => current.map((episode) => (episode.id === id ? { ...episode, waitingDays: 0 } : episode)));
    toast(`${id} escalated — referral clock restarted at the urgent pathway`, "High");
  };

  const exportCsv = () => {
    const table =
      tab === "imaging"
        ? [
            ["ID", "Unit", "Model", "Room", "Modality", "Status", "Scans today", "Queue", "Calibration due (d)", "Uptime %"],
            ...filteredUnits.map((u) => [u.id, u.name, u.model, u.room, u.modality, u.status, u.scansToday, u.queue, u.calibrationDueDays, u.uptimePct]),
          ]
        : tab === "lasers"
          ? [
              ["ID", "Laser", "Model", "Room", "Wavelength (nm)", "Shots", "Shot limit", "Set (mJ)", "Delivered (mJ)", "Deviation %", "Faults"],
              ...filteredLasers.map((l) => {
                const energy = laserEnergyDeviation(l);
                return [l.id, l.name, l.model, l.room, l.wavelengthNm, l.shots, l.shotLimit, l.setEnergyMj, l.deliveredMj, energy.deviationPct, laserFaults(l).map((f) => f.code).join(" ") || "none"];
              }),
            ]
          : tab === "screening"
            ? [
                ["ID", "Patient", "Eye", "Grade", "Maculopathy", "AI grade", "Gradable", "Waiting (d)", "Grader", "Referral (d)"],
                ...filteredScreening.map((s) => [s.id, s.patient, s.eye, s.grade, s.maculopathy, s.aiGrade, s.gradable, s.waitingDays, s.grader, referralFor(s).days ?? "none"]),
              ]
            : [
                ["ID", "Patient", "Eye", "Axial (mm)", "Mean K (D)", "A-constant", "Lens", "Target (D)", "Planned (D)", "Recalculated (D)", "Variance (D)", "Verdict"],
                ...filteredVerifications.map((v) => [
                  v.record.id, v.record.patient, v.record.eye, v.record.axial, v.record.keratometry, v.record.aConstant,
                  v.record.lens, v.record.targetRefraction, v.record.plannedPower,
                  v.calculated ? v.calculated.power : "—", v.variance ?? "—", v.verdict,
                ]),
              ];

    downloadCsv(`ophthalmology-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "imaging", label: "Imaging Fleet", icon: ScanLine },
    { id: "lasers", label: "Laser Suite", icon: Zap },
    { id: "screening", label: "DR Screening", icon: Eye },
    { id: "biometry", label: "IOL Biometry", icon: Calculator },
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
              <Eye size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Ophthalmology &amp; Vision Diagnostics Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Imaging fleet · laser safety · DR screening · IOL biometry — UK NSC grading, IEC 60825 laser classes
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
          <StatCard icon={Gauge} label="Calibration Overdue" value={stats.calibrationOverdue} sub={`${units.length}-unit imaging fleet`} accent={stats.calibrationOverdue > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Zap} label="Lasers Out of Service" value={stats.lasersDown} sub="interlock, shot limit or output" accent={stats.lasersDown > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Siren} label="Urgent DR Referrals" value={stats.urgentReferrals} sub="two-week pathway" accent={stats.urgentReferrals > 0 ? "text-amber-400" : "text-emerald-400"} />
          <StatCard icon={Calculator} label="Lens Powers Held" value={stats.heldCases} sub={`of ${verifications.length} cataract cases`} accent={stats.heldCases > 0 ? "text-amber-400" : "text-emerald-400"} />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search units, lasers, patients, lenses…" />
          {tab === "imaging" && <FilterChips options={["All", "Running", "Idle", "Maintenance"]} value={unitFilter} onChange={setUnitFilter} />}
          {tab === "lasers" && <FilterChips options={["All", "Out of service", "Advisory", "Clear"]} value={laserFilter} onChange={setLaserFilter} />}
          {tab === "screening" && <FilterChips options={["All", "Referable", "AI disagreement", "R3", "R2"]} value={gradeFilter} onChange={setGradeFilter} />}
          {tab === "biometry" && <FilterChips options={["All", "Verified", "Held", "Not calculable"]} value={biometryFilter} onChange={setBiometryFilter} />}
        </div>
      </header>

      <main className="px-6 py-6">
        {/* ============================= IMAGING FLEET ============================= */}
        {tab === "imaging" && (
          <section>
            {filteredUnits.length === 0 ? (
              <EmptyState icon={ScanLine} message="No imaging units match the current filters." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredUnits.map((unit) => {
                  const overdue = unit.calibrationDueDays <= 0;
                  return (
                    <article key={unit.id} className={`rounded-2xl border bg-slate-900/70 p-4 ${overdue ? "border-red-500/40" : "border-slate-800"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            onClick={() => setModal({ kind: "unit", data: unit })}
                            className="font-mono text-xs font-semibold text-emerald-300 hover:underline"
                          >
                            {unit.id}
                          </button>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{unit.name}</p>
                          <p className="truncate text-[11px] text-slate-500">{unit.model} · {unit.room}</p>
                        </div>
                        <Badge>{unit.status}</Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Scans</p>
                          <p className="text-sm font-bold text-slate-100">{unit.scansToday}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Queue</p>
                          <p className="text-sm font-bold text-slate-100">{unit.queue}</p>
                        </div>
                        <div className={`rounded-lg border p-2 ${overdue ? "border-red-500/40 bg-red-500/10" : "border-slate-800 bg-slate-950/60"}`}>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Cal.</p>
                          <p className={`text-sm font-bold ${overdue ? "text-red-300" : "text-slate-100"}`}>
                            {overdue ? `${Math.abs(unit.calibrationDueDays)}d over` : `${unit.calibrationDueDays}d`}
                          </p>
                        </div>
                      </div>

                      {overdue && (
                        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[11px] leading-relaxed text-red-200">
                          Calibration lapsed. A drifted {unit.modality.toLowerCase()} unit does not fail loudly — it reports a
                          plausible, wrong measurement and a treatment decision is made on it.
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Uptime {unit.uptimePct}%</span>
                        <div className="flex gap-2">
                          <button onClick={() => recalibrate(unit.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20">
                            Record calibration
                          </button>
                          <button onClick={() => toggleUnit(unit.id)} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                            {unit.status === "Maintenance" ? "Return to service" : "Take out"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================= LASER SUITE ============================= */}
        {tab === "lasers" && (
          <section>
            {filteredLasers.length === 0 ? (
              <EmptyState icon={Zap} message="No lasers match the current filters." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Laser</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Shots</th>
                      <th className="px-4 py-3">Energy</th>
                      <th className="px-4 py-3">Interlock</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLasers.map((laser) => {
                      const faults = laserFaults(laser);
                      const energy = laserEnergyDeviation(laser);
                      const outOfService = faults.some((f) => f.tone === "red");
                      const shotPct = Math.min(100, (laser.shots / laser.shotLimit) * 100);
                      return (
                        <tr key={laser.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <button onClick={() => setModal({ kind: "laser", data: laser })} className="font-mono text-xs font-semibold text-emerald-300 hover:underline">
                              {laser.id}
                            </button>
                            <p className="text-xs text-slate-200">{laser.name}</p>
                            <p className="text-[11px] text-slate-500">{laser.model} · {laser.wavelengthNm} nm</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{laser.room}</td>
                          <td className="px-4 py-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                              <div className={`h-full rounded-full ${shotPct >= 100 ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${shotPct}%` }} />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">{laser.shots.toLocaleString()} / {laser.shotLimit.toLocaleString()}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-xs font-semibold ${energy.inTolerance ? "text-slate-200" : "text-red-300"}`}>
                              {laser.deliveredMj} mJ
                            </p>
                            <p className="text-[11px] text-slate-500">
                              set {laser.setEnergyMj} · {energy.deviationPct > 0 ? "+" : ""}{energy.deviationPct}%
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {laser.interlock ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><Lock size={12} /> Proven</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-300"><ShieldAlert size={12} /> Open</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge>{outOfService ? "Out of service" : faults.length > 0 ? "Advisory" : "In tolerance"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => recordEnergyCheck(laser.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20">
                              Record output check
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ============================= DR SCREENING ============================= */}
        {tab === "screening" && (
          <section>
            {filteredScreening.length === 0 ? (
              <EmptyState icon={Eye} message="No screening episodes match the current filters." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredScreening.map((episode) => {
                  const referral = referralFor(episode);
                  const breached = referral.days != null && episode.waitingDays > referral.days;
                  const aiDisagrees = episode.aiGrade !== episode.grade;
                  return (
                    <article key={episode.id} className={`rounded-2xl border bg-slate-900/70 p-4 ${breached ? "border-red-500/40" : "border-slate-800"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => setModal({ kind: "screening", data: episode })} className="font-mono text-xs font-semibold text-emerald-300 hover:underline">
                            {episode.id}
                          </button>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{episode.patient}</p>
                          <p className="text-[11px] text-slate-500">{episode.eye} · diabetes {episode.diabetesYears}y · graded by {episode.grader}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge>{episode.gradable ? episode.grade : "Ungradable"}</Badge>
                          <Badge>{episode.maculopathy}</Badge>
                        </div>
                      </div>

                      <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] leading-relaxed text-slate-400">
                        {referral.reason}
                      </p>

                      {aiDisagrees && (
                        <p className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-[11px] leading-relaxed text-sky-200">
                          <Cpu size={11} className="mr-1 inline" />
                          Pre-screen returned {episode.aiGrade}, the grader recorded {episode.grade}. The grader's decision stands;
                          the disagreement is logged because a systematic direction to these is what shows the model has drifted.
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className={breached ? "font-semibold text-red-300" : "text-slate-500"}>
                          {referral.days == null
                            ? `Waiting ${episode.waitingDays}d · no referral`
                            : `Waiting ${episode.waitingDays}d of ${referral.days}d${breached ? " — breached" : ""}`}
                        </span>
                        {referral.days != null && (
                          <button onClick={() => escalate(episode.id)} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-semibold text-amber-300 hover:bg-amber-500/20">
                            Escalate
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

        {/* ============================= IOL BIOMETRY ============================= */}
        {tab === "biometry" && (
          <section>
            <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <Info size={14} className="mt-0.5 shrink-0 text-sky-400" />
                <span>
                  Every power below is recalculated from the biometry, not read back from the plan. SRK II is used because it
                  is hand-checkable at the chair — and because it is a regression, the console declines to produce a number at
                  all for an eye outside {REGRESSION_SAFE_AXIAL.min}–{REGRESSION_SAFE_AXIAL.max} mm rather than one that would be
                  read as agreement. Variance beyond ±{IOL_POWER_TOLERANCE} D holds the case.
                </span>
              </p>
            </div>

            {filteredVerifications.length === 0 ? (
              <EmptyState icon={Calculator} message="No cataract cases match the current filters." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredVerifications.map((entry) => {
                  const { record, calculated, variance, verdict, flags } = entry;
                  return (
                    <article
                      key={record.id}
                      className={`rounded-2xl border bg-slate-900/70 p-4 ${verdict === "Verified" ? "border-slate-800" : "border-amber-500/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => setModal({ kind: "biometry", data: entry })} className="font-mono text-xs font-semibold text-emerald-300 hover:underline">
                            {record.id}
                          </button>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{record.patient}</p>
                          <p className="text-[11px] text-slate-500">{record.eye} · {record.lens} · {record.biometer}</p>
                        </div>
                        <Badge>{verdict}</Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Axial</p>
                          <p className="text-sm font-bold text-slate-100">{record.axial.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Mean K</p>
                          <p className="text-sm font-bold text-slate-100">{record.keratometry.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Planned</p>
                          <p className="text-sm font-bold text-slate-100">{record.plannedPower.toFixed(2)}</p>
                        </div>
                        <div className={`rounded-lg border p-2 ${verdict === "Verified" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Recalc.</p>
                          <p className={`text-sm font-bold ${verdict === "Verified" ? "text-emerald-300" : "text-amber-300"}`}>
                            {calculated ? calculated.power.toFixed(2) : "—"}
                          </p>
                        </div>
                      </div>

                      {calculated && (
                        <p className="mt-3 text-[11px] text-slate-500">
                          A-constant {record.aConstant} banded to {calculated.adjustedA} · emmetropic {calculated.emmetropic.toFixed(2)} D ·
                          target {record.targetRefraction.toFixed(2)} D at CR {calculated.correctionFactor} ·
                          <span className={Math.abs(variance) > IOL_POWER_TOLERANCE ? " font-semibold text-amber-300" : " text-slate-400"}>
                            {" "}variance {variance > 0 ? "+" : ""}{variance.toFixed(2)} D
                          </span>
                        </p>
                      )}

                      {flags.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {flags.map((flag) => (
                            <li
                              key={flag.code}
                              className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${
                                flag.tone === "red" ? "border-red-500/30 bg-red-500/5 text-red-200" : "border-amber-500/30 bg-amber-500/5 text-amber-200"
                              }`}
                            >
                              {flag.text}
                            </li>
                          ))}
                        </ul>
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
      {modal && modal.kind === "unit" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.model}`} onClose={() => setModal(null)}>
          <Row label="Modality" value={modal.data.modality} />
          <Row label="Room" value={modal.data.room} />
          <Row label="Status" value={modal.data.status} />
          <Row label="Scans today" value={modal.data.scansToday} />
          <Row label="Queue" value={modal.data.queue} />
          <Row label="Uptime" value={`${modal.data.uptimePct}%`} />
          <Row
            label="Calibration"
            value={modal.data.calibrationDueDays <= 0 ? `${Math.abs(modal.data.calibrationDueDays)} days overdue` : `due in ${modal.data.calibrationDueDays} days`}
            accent={modal.data.calibrationDueDays <= 0 ? "text-red-300" : undefined}
          />
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
            Calibration is the whole safety case for a diagnostic imaging unit. It does not stop working when it drifts — it
            returns a retinal thickness, a field defect or an axial length that is plausible and wrong, and the treatment
            decision that follows is made with full confidence in a bad number.
          </p>
        </Modal>
      )}

      {modal && modal.kind === "laser" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.model} · ${modal.data.wavelengthNm} nm`} onClose={() => setModal(null)}>
          <Row label="Room" value={modal.data.room} />
          <Row label="Shots" value={`${modal.data.shots.toLocaleString()} of ${modal.data.shotLimit.toLocaleString()}`} />
          <Row label="Set energy" value={`${modal.data.setEnergyMj} mJ`} />
          <Row label="Delivered" value={`${modal.data.deliveredMj} mJ`} />
          <Row label="Deviation" value={`${laserEnergyDeviation(modal.data).deviationPct}%`} accent={laserEnergyDeviation(modal.data).inTolerance ? undefined : "text-red-300"} />
          <Row label="Interlock" value={modal.data.interlock ? "Proven" : "Open"} accent={modal.data.interlock ? undefined : "text-red-300"} />
          <Row label="Key control" value={modal.data.keyOut ? "Key removed" : "Key left in console"} />
          <Row label="Protective eyewear" value={`OD ${modal.data.eyewearOd} at ${modal.data.wavelengthNm} nm`} />
          <Row label="Last service" value={`${modal.data.lastServiceDays} days ago`} />
          {laserFaults(modal.data).length > 0 ? (
            <ul className="mt-3 space-y-2">
              {laserFaults(modal.data).map((fault) => (
                <li
                  key={fault.code}
                  className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${
                    fault.tone === "red" ? "border-red-500/30 bg-red-500/5 text-red-200" : "border-amber-500/30 bg-amber-500/5 text-amber-200"
                  }`}
                >
                  {fault.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-emerald-200">
              Interlock proven, shot count inside the service limit, delivered energy within ±{LASER_ENERGY_TOLERANCE_PCT}% of the
              set point and the key removed. Cleared for the list.
            </p>
          )}
        </Modal>
      )}

      {modal && modal.kind === "screening" && (
        <Modal title={modal.data.patient} subtitle={`${modal.data.id} · ${modal.data.eye}`} onClose={() => setModal(null)}>
          <Row label="Retinopathy" value={DR_GRADES[modal.data.grade]?.label || "Ungradable"} />
          <Row label="Maculopathy" value={MACULOPATHY[modal.data.maculopathy]?.label || "—"} />
          <Row label="Pre-screen" value={modal.data.aiGrade} accent={modal.data.aiGrade !== modal.data.grade ? "text-sky-300" : undefined} />
          <Row label="Grader" value={modal.data.grader} />
          <Row label="Diabetes duration" value={`${modal.data.diabetesYears} years`} />
          <Row label="Waiting" value={`${modal.data.waitingDays} days`} />
          <Row label="Referral window" value={referralFor(modal.data).days == null ? "None — routine rescreen" : `${referralFor(modal.data).days} days`} />
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
            {referralFor(modal.data).reason} The grade and the clock travel together on purpose: R3 is proliferative disease and
            the eye can lose vision inside the time a routine appointment takes to arrive, so grading it without attaching the
            two-week pathway is only a label.
          </p>
        </Modal>
      )}

      {modal && modal.kind === "biometry" && (
        <Modal
          title={modal.data.record.patient}
          subtitle={`${modal.data.record.id} · ${modal.data.record.eye} · ${modal.data.record.lens}`}
          onClose={() => setModal(null)}
        >
          <Row label="Axial length" value={`${modal.data.record.axial.toFixed(2)} mm`} />
          <Row label="Fellow eye" value={`${modal.data.record.fellowAxial.toFixed(2)} mm`} />
          <Row label="Mean keratometry" value={`${modal.data.record.keratometry.toFixed(2)} D`} />
          <Row label="A-constant" value={`${modal.data.record.aConstant}${modal.data.record.constantOptimised ? " (optimised)" : " (manufacturer)"}`} />
          <Row label="Target refraction" value={`${modal.data.record.targetRefraction.toFixed(2)} D`} />
          <Row label="Planned power" value={`${modal.data.record.plannedPower.toFixed(2)} D`} />
          <Row
            label="Recalculated"
            value={modal.data.calculated ? `${modal.data.calculated.power.toFixed(2)} D` : "not calculable"}
            accent={modal.data.verdict === "Verified" ? "text-emerald-300" : "text-amber-300"}
          />
          {modal.data.calculated && (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
              SRK II bands the A-constant by axial length before the regression, so {modal.data.record.aConstant} becomes{" "}
              {modal.data.calculated.adjustedA} for a {modal.data.record.axial.toFixed(2)} mm eye. That gives{" "}
              {modal.data.calculated.adjustedA} − 2.5 × {modal.data.record.axial.toFixed(2)} − 0.9 ×{" "}
              {modal.data.record.keratometry.toFixed(2)} = {modal.data.calculated.emmetropic.toFixed(2)} D for emmetropia,
              corrected to the {modal.data.record.targetRefraction.toFixed(2)} D target at a refractive correction factor of{" "}
              {modal.data.calculated.correctionFactor} and rounded to the quarter-dioptre step lenses are supplied in.
            </p>
          )}
          {modal.data.blocked && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-[11px] leading-relaxed text-red-200">
              No power is produced for this eye. A regression formula outside its fitted range does not fail loudly, it returns
              a confident number that is systematically wrong — and a number here would be read as agreement or disagreement
              with the plan when it is neither.
            </p>
          )}
        </Modal>
      )}

      {/* footer strip */}
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${sim.running ? "bg-emerald-400" : "bg-amber-400"}`} />
          {sim.running ? `Live simulation at ${sim.speed}× · tick #${sim.tick}` : "Simulation paused"}
        </span>
        <span className="hidden md:inline">UK NSC diabetic eye screening · IEC 60825-1 laser safety · ISO 11979 intraocular lenses</span>
        <span className="inline-flex items-center gap-1.5">
          <FileText size={12} /> {units.length} units · {lasers.length} lasers · {screening.length} episodes · {biometry.length} cases
        </span>
      </footer>
    </div>
  );
}
