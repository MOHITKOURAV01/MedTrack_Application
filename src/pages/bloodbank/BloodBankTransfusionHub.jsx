import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BadgeCheck, Bell, CheckCircle2, Clock, Download, Droplet,
  Droplets, FileText, FlaskConical, Hourglass, Info, Layers, Microscope, Pause, Play,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, Snowflake, Syringe, Thermometer,
  Timer, TrendingDown, TrendingUp, UserCheck, Users, X,
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
 *  Blood Bank & Transfusion Medicine Command Hub
 *
 *  Four consoles over one shared inventory of blood components:
 *
 *    1. Component Inventory  - ISBT 128 labelled units, storage state, FIFO age
 *    2. Crossmatch Lab       - type & screen, antibody screen, electronic issue
 *    3. Haemovigilance       - transfusion reaction workup and reporting
 *    4. Donor & Apheresis    - collection sessions, deferrals, yield
 *
 *  Standards the data model follows: ISBT 128 (ICCBBA) for unit identification and
 *  product coding, AABB Standards for Blood Banks and Transfusion Services (34th ed.)
 *  for storage, crossmatch and haemovigilance requirements, FDA 21 CFR 606/610 for
 *  component labelling and expiry, and EU Directive 2002/98/EC Article 14 for the
 *  vein-to-vein traceability the audit trail models.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Reference data                                                     */
/* ------------------------------------------------------------------ */

/**
 * Shelf life in hours per component, from AABB Standards / 21 CFR 610.53.
 *
 * Platelets are the constraint that drives most of this console: five days at room
 * temperature with agitation, and no way to freeze the shortfall away. Red cells in
 * AS-3 additive keep for 42 days; plasma frozen within 8 hours keeps for a year but
 * only 24 hours once thawed, which is why thawed plasma is tracked as its own product.
 */
const SHELF_LIFE_HOURS = {
  "RBC (AS-3)": 42 * 24,
  "RBC (CPDA-1)": 35 * 24,
  "Apheresis Platelets": 5 * 24,
  "Pooled Platelets": 5 * 24,
  "Thawed Plasma": 24,
  "Fresh Frozen Plasma": 365 * 24,
  Cryoprecipitate: 365 * 24,
};

/** Storage envelope per component. Excursions outside it quarantine the unit. */
const STORAGE_ENVELOPE = {
  "RBC (AS-3)": { min: 1, max: 6, label: "1-6 °C refrigerated" },
  "RBC (CPDA-1)": { min: 1, max: 6, label: "1-6 °C refrigerated" },
  "Apheresis Platelets": { min: 20, max: 24, label: "20-24 °C, continuous agitation" },
  "Pooled Platelets": { min: 20, max: 24, label: "20-24 °C, continuous agitation" },
  "Thawed Plasma": { min: 1, max: 6, label: "1-6 °C, 24 h from thaw" },
  "Fresh Frozen Plasma": { min: -30, max: -18, label: "≤ -18 °C frozen" },
  Cryoprecipitate: { min: -30, max: -18, label: "≤ -18 °C frozen" },
};

const ABO_GROUPS = ["O", "A", "B", "AB"];

/**
 * ABO donor groups a recipient may receive, by component class.
 *
 * Red cells carry donor antigen, so the donor's ABO antigens must be absent from the
 * recipient's plasma: O is the universal red cell donor. Plasma carries donor
 * antibody, so the direction inverts: AB is the universal plasma donor. Getting this
 * backwards is the single most consequential error in a transfusion service, so the
 * two directions are written out in full rather than derived from one table.
 */
const RBC_COMPATIBILITY = {
  O: ["O"],
  A: ["A", "O"],
  B: ["B", "O"],
  AB: ["AB", "A", "B", "O"],
};

const PLASMA_COMPATIBILITY = {
  O: ["O", "A", "B", "AB"],
  A: ["A", "AB"],
  B: ["B", "AB"],
  AB: ["AB"],
};

/**
 * RhD: a D-negative recipient of child-bearing potential must not receive D-positive
 * red cells, because anti-D alloimmunisation causes haemolytic disease of the
 * foetus and newborn in a later pregnancy. D-positive recipients may receive either.
 */
function rhCompatible(recipientRh, donorRh) {
  return recipientRh === "+" || donorRh === "-";
}

function isCompatible(recipient, unit) {
  const table = unit.class === "Plasma" ? PLASMA_COMPATIBILITY : RBC_COMPATIBILITY;
  const aboOk = (table[recipient.abo] || []).includes(unit.abo);
  const rhOk = unit.class === "Plasma" || rhCompatible(recipient.rh, unit.rh);
  return aboOk && rhOk;
}

const COMPONENT_CLASS = {
  "RBC (AS-3)": "Red Cells",
  "RBC (CPDA-1)": "Red Cells",
  "Apheresis Platelets": "Platelets",
  "Pooled Platelets": "Platelets",
  "Thawed Plasma": "Plasma",
  "Fresh Frozen Plasma": "Plasma",
  Cryoprecipitate: "Cryo",
};

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const UNITS = [
  { din: "W1234 24 900001", product: "E0382", component: "RBC (AS-3)", abo: "O", rh: "-", ageHours: 612, temp: 4.1, state: "Available", fridge: "BB-R1", phenotype: "R1R1, K-", cmv: "Negative", irradiated: false, volume: 312 },
  { din: "W1234 24 900002", product: "E0382", component: "RBC (AS-3)", abo: "O", rh: "-", ageHours: 948, temp: 4.3, state: "Available", fridge: "BB-R1", phenotype: "R2R2, K-", cmv: "Negative", irradiated: true, volume: 305 },
  { din: "W1234 24 900003", product: "E0382", component: "RBC (AS-3)", abo: "O", rh: "+", ageHours: 240, temp: 3.9, state: "Available", fridge: "BB-R1", phenotype: "R1r, K+", cmv: "Untested", irradiated: false, volume: 318 },
  { din: "W1234 24 900004", product: "E0382", component: "RBC (AS-3)", abo: "A", rh: "+", ageHours: 96, temp: 4.0, state: "Available", fridge: "BB-R2", phenotype: "R1R1, K-", cmv: "Untested", irradiated: false, volume: 322 },
  { din: "W1234 24 900005", product: "E0382", component: "RBC (AS-3)", abo: "A", rh: "+", ageHours: 864, temp: 4.4, state: "Crossmatched", fridge: "BB-R2", phenotype: "R1r, K-", cmv: "Negative", irradiated: false, volume: 298 },
  { din: "W1234 24 900006", product: "E0336", component: "RBC (CPDA-1)", abo: "A", rh: "-", ageHours: 720, temp: 4.2, state: "Available", fridge: "BB-R2", phenotype: "rr, K-", cmv: "Negative", irradiated: false, volume: 289 },
  { din: "W1234 24 900007", product: "E0382", component: "RBC (AS-3)", abo: "B", rh: "+", ageHours: 168, temp: 4.0, state: "Available", fridge: "BB-R1", phenotype: "R1R2, K-", cmv: "Untested", irradiated: false, volume: 315 },
  { din: "W1234 24 900008", product: "E0382", component: "RBC (AS-3)", abo: "B", rh: "-", ageHours: 984, temp: 4.5, state: "Available", fridge: "BB-R3", phenotype: "rr, K-", cmv: "Negative", irradiated: true, volume: 301 },
  { din: "W1234 24 900009", product: "E0382", component: "RBC (AS-3)", abo: "AB", rh: "+", ageHours: 456, temp: 4.1, state: "Available", fridge: "BB-R3", phenotype: "R1R1, K+", cmv: "Untested", irradiated: false, volume: 310 },
  { din: "W1234 24 900010", product: "E0382", component: "RBC (AS-3)", abo: "O", rh: "-", ageHours: 1000, temp: 4.2, state: "Available", fridge: "BB-R1", phenotype: "rr, K-", cmv: "Negative", irradiated: false, volume: 295 },
  { din: "W1234 24 910001", product: "E3011", component: "Apheresis Platelets", abo: "A", rh: "+", ageHours: 62, temp: 22.3, state: "Available", fridge: "BB-P1", phenotype: "HLA-unmatched", cmv: "Negative", irradiated: true, volume: 248 },
  { din: "W1234 24 910002", product: "E3011", component: "Apheresis Platelets", abo: "O", rh: "+", ageHours: 96, temp: 22.1, state: "Available", fridge: "BB-P1", phenotype: "HLA-A2 matched", cmv: "Negative", irradiated: true, volume: 252 },
  { din: "W1234 24 910003", product: "E3011", component: "Apheresis Platelets", abo: "AB", rh: "+", ageHours: 108, temp: 24.6, state: "Quarantine", fridge: "BB-P1", phenotype: "HLA-unmatched", cmv: "Untested", irradiated: false, volume: 244 },
  { din: "W1234 24 910004", product: "E3021", component: "Pooled Platelets", abo: "O", rh: "-", ageHours: 40, temp: 22.0, state: "Available", fridge: "BB-P2", phenotype: "5-donor pool", cmv: "Untested", irradiated: false, volume: 288 },
  { din: "W1234 24 920001", product: "E0701", component: "Fresh Frozen Plasma", abo: "AB", rh: "+", ageHours: 2200, temp: -26.4, state: "Available", fridge: "BB-F1", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 265 },
  { din: "W1234 24 920002", product: "E0701", component: "Fresh Frozen Plasma", abo: "A", rh: "+", ageHours: 5100, temp: -25.8, state: "Available", fridge: "BB-F1", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 271 },
  { din: "W1234 24 920003", product: "E0754", component: "Thawed Plasma", abo: "AB", rh: "-", ageHours: 17, temp: 4.6, state: "Available", fridge: "BB-R3", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 258 },
  { din: "W1234 24 920004", product: "E0754", component: "Thawed Plasma", abo: "O", rh: "+", ageHours: 22, temp: 4.8, state: "Available", fridge: "BB-R3", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 262 },
  { din: "W1234 24 930001", product: "E1521", component: "Cryoprecipitate", abo: "A", rh: "+", ageHours: 3400, temp: -27.1, state: "Available", fridge: "BB-F2", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 42 },
  { din: "W1234 24 930002", product: "E1521", component: "Cryoprecipitate", abo: "O", rh: "+", ageHours: 1800, temp: -26.9, state: "Available", fridge: "BB-F2", phenotype: "n/a", cmv: "n/a", irradiated: false, volume: 45 },
];

const REQUESTS = [
  { id: "XM-4401", patient: "P-7781", name: "Recipient 7781", abo: "O", rh: "-", ward: "Theatre 3", indication: "Ruptured AAA — MTP active", units: 6, component: "Red Cells", urgency: "Emergency", stage: "Electronic issue", antibody: "None detected", lastScreen: "22 min ago", assigned: [] },
  { id: "XM-4402", patient: "P-3390", name: "Recipient 3390", abo: "A", rh: "+", ward: "Haematology", indication: "AML induction, plt 8", units: 1, component: "Platelets", urgency: "Urgent", stage: "Type & screen", antibody: "Anti-K", lastScreen: "1 h ago", assigned: [] },
  { id: "XM-4403", patient: "P-5512", name: "Recipient 5512", abo: "B", rh: "+", ward: "Renal", indication: "Chronic anaemia, Hb 6.8", units: 2, component: "Red Cells", urgency: "Routine", stage: "Serologic crossmatch", antibody: "Anti-Jka", lastScreen: "3 h ago", assigned: [] },
  { id: "XM-4404", patient: "P-9007", name: "Recipient 9007", abo: "AB", rh: "+", ward: "ICU 2", indication: "Liver failure, INR 3.4", units: 4, component: "Plasma", urgency: "Urgent", stage: "Type & screen", antibody: "None detected", lastScreen: "35 min ago", assigned: [] },
  { id: "XM-4405", patient: "P-2244", name: "Recipient 2244", abo: "O", rh: "+", ward: "Maternity", indication: "Post-partum haemorrhage", units: 3, component: "Red Cells", urgency: "Emergency", stage: "Immediate spin", antibody: "None detected", lastScreen: "8 min ago", assigned: [] },
  { id: "XM-4406", patient: "P-6130", name: "Recipient 6130", abo: "A", rh: "-", ward: "Oncology", indication: "Elective colectomy, group & save", units: 2, component: "Red Cells", urgency: "Routine", stage: "Type & screen", antibody: "None detected", lastScreen: "5 h ago", assigned: [] },
  { id: "XM-4407", patient: "P-8845", name: "Recipient 8845", abo: "B", rh: "-", ward: "Paediatrics", indication: "Sickle exchange, phenotype matched", units: 3, component: "Red Cells", urgency: "Urgent", stage: "Serologic crossmatch", antibody: "Anti-C, Anti-E", lastScreen: "50 min ago", assigned: [] },
];

const REACTIONS = [
  { id: "HV-2201", din: "W1234 24 900005", patient: "P-3390", type: "Febrile non-haemolytic", severity: "Grade 1", onset: "18 min into transfusion", imputability: "Probable", status: "Under workup", reported: "ISBT/IHN form drafted", action: "Transfusion stopped, antipyretic given" },
  { id: "HV-2202", din: "W1234 24 910003", patient: "P-5512", type: "Suspected bacterial contamination", severity: "Grade 3", onset: "9 min into transfusion", imputability: "Possible", status: "Escalated", reported: "Notified to haemovigilance lead", action: "Unit and set cultured, empiric antibiotics" },
  { id: "HV-2203", din: "W1234 24 900009", patient: "P-9007", type: "TACO (circulatory overload)", severity: "Grade 2", onset: "3 h post-transfusion", imputability: "Definite", status: "Closed", reported: "Submitted to national scheme", action: "Diuresis, rate protocol amended" },
  { id: "HV-2204", din: "W1234 24 920002", patient: "P-2244", type: "Allergic / urticarial", severity: "Grade 1", onset: "12 min into transfusion", imputability: "Probable", status: "Closed", reported: "Local record only", action: "Antihistamine, transfusion completed" },
  { id: "HV-2205", din: "W1234 24 900002", patient: "P-8845", type: "Suspected TRALI", severity: "Grade 3", onset: "90 min post-transfusion", imputability: "Possible", status: "Under workup", reported: "Donor HLA lookback requested", action: "Respiratory support, donor deferred pending result" },
];

const SESSIONS = [
  { id: "DS-77", site: "Main campus atrium", type: "Whole blood drive", booked: 64, attended: 51, deferred: 7, collected: 44, yieldPct: 86, staff: 6, status: "In progress" },
  { id: "DS-78", site: "Apheresis suite bay 1", type: "Platelet apheresis", booked: 12, attended: 11, deferred: 1, collected: 10, yieldPct: 91, staff: 3, status: "In progress" },
  { id: "DS-79", site: "Riverside mobile unit", type: "Whole blood drive", booked: 48, attended: 39, deferred: 9, collected: 30, yieldPct: 77, staff: 5, status: "Closing" },
  { id: "DS-80", site: "Apheresis suite bay 2", type: "Plasma apheresis", booked: 9, attended: 9, deferred: 0, collected: 9, yieldPct: 100, staff: 2, status: "Complete" },
  { id: "DS-81", site: "University satellite", type: "Whole blood drive", booked: 72, attended: 0, deferred: 0, collected: 0, yieldPct: 0, staff: 6, status: "Scheduled" },
];

const DEFERRAL_REASONS = [
  { reason: "Low haemoglobin", count: 9, trend: "up" },
  { reason: "Recent travel (malaria risk)", count: 4, trend: "flat" },
  { reason: "Interval since last donation", count: 3, trend: "down" },
  { reason: "Blood pressure out of range", count: 1, trend: "flat" },
];

/* ------------------------------------------------------------------ */
/*  Domain calculations                                                */
/* ------------------------------------------------------------------ */

/** Hours left before the unit expires, from component shelf life and current age. */
function hoursRemaining(unit) {
  return Math.max(0, (SHELF_LIFE_HOURS[unit.component] || 0) - unit.ageHours);
}

/**
 * Outdate risk band.
 *
 * Expressed as a fraction of shelf life rather than absolute hours, because six hours
 * left on a platelet (5 % of its life) is an emergency while six hours left on a red
 * cell is a rounding error. Anything under a tenth of its life is "critical", which is
 * the band the FIFO issue recommendation optimises against.
 */
function outdateBand(unit) {
  const total = SHELF_LIFE_HOURS[unit.component] || 1;
  const fraction = hoursRemaining(unit) / total;
  if (fraction <= 0) return "Expired";
  if (fraction < 0.1) return "Critical";
  if (fraction < 0.25) return "Watch";
  return "Stable";
}

/** Whether the storage temperature sits inside the component's envelope. */
function temperatureExcursion(unit) {
  const envelope = STORAGE_ENVELOPE[unit.component];
  if (!envelope) return false;
  return unit.temp < envelope.min || unit.temp > envelope.max;
}

/**
 * Massive transfusion protocol readiness.
 *
 * The 1:1:1 balanced resuscitation ratio (PROPPR trial, JAMA 2015) means an MTP pack
 * needs equal numbers of red cell, plasma and platelet units. Readiness is therefore
 * governed by the scarcest of the three, not by the total unit count — a fridge full
 * of red cells with no platelets cannot run a single round.
 */
function mtpReadiness(units) {
  const issuable = units.filter((unit) => unit.state === "Available" && outdateBand(unit) !== "Expired");
  const redCells = issuable.filter((unit) => COMPONENT_CLASS[unit.component] === "Red Cells").length;
  const plasma = issuable.filter((unit) => COMPONENT_CLASS[unit.component] === "Plasma").length;
  const platelets = issuable.filter((unit) => COMPONENT_CLASS[unit.component] === "Platelets").length;
  const rounds = Math.min(redCells, plasma, platelets);
  const limiting = rounds === platelets ? "Platelets" : rounds === plasma ? "Plasma" : "Red Cells";
  return { redCells, plasma, platelets, rounds, limiting };
}

/**
 * Days of cover for a group, against observed issue rate.
 *
 * O-negative is the group this number exists for: it is the only red cell any
 * recipient can receive, so it is drawn down first in every emergency and is
 * chronically the group closest to running out.
 */
function daysOfCover(units, abo, rh, dailyIssueRate) {
  const onHand = units.filter(
    (unit) =>
      unit.abo === abo &&
      unit.rh === rh &&
      unit.state === "Available" &&
      COMPONENT_CLASS[unit.component] === "Red Cells" &&
      outdateBand(unit) !== "Expired"
  ).length;
  return dailyIssueRate > 0 ? Number((onHand / dailyIssueRate).toFixed(1)) : onHand;
}

/**
 * Units this request may legally receive, best first.
 *
 * Ordered oldest-compatible-first so the unit closest to outdating is issued before a
 * fresh one — the standard FIFO discipline that keeps the outdate rate down. Units
 * under temperature excursion or already assigned are excluded outright rather than
 * ranked last, because they are not issuable at any priority.
 */
function selectUnitsFor(request, units) {
  return units
    .filter((unit) => unit.state === "Available")
    .filter((unit) => !temperatureExcursion(unit))
    .filter((unit) => outdateBand(unit) !== "Expired")
    .filter((unit) => COMPONENT_CLASS[unit.component] === request.component)
    .filter((unit) =>
      isCompatible({ abo: request.abo, rh: request.rh }, { abo: unit.abo, rh: unit.rh, class: COMPONENT_CLASS[unit.component] })
    )
    .sort((a, b) => hoursRemaining(a) - hoursRemaining(b));
}

const formatHours = (hours) => {
  if (hours >= 48) return `${Math.floor(hours / 24)} d`;
  if (hours >= 1) return `${Math.round(hours)} h`;
  return `${Math.round(hours * 60)} min`;
};

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (value) => {
  if (["Expired", "Emergency", "Grade 3", "Escalated", "Quarantine"].includes(value)) return "red";
  if (["Critical", "Urgent", "Grade 2", "Under workup", "Closing"].includes(value)) return "amber";
  if (["Stable", "Available", "Complete", "Closed", "Grade 1"].includes(value)) return "green";
  if (["Watch", "Routine", "Scheduled", "In progress", "Crossmatched"].includes(value)) return "sky";
  return "slate";
};

const Badge = ({ children, tone }) => <ToneBadge tone={tone} toneOf={toneOf}>{children}</ToneBadge>;



/* ------------------------------------------------------------------ */
/*  Live simulation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ages the inventory and walks crossmatch requests through their workflow.
 *
 * The refs matter: the interval closes over its callback once, so writing to state
 * directly from the loop would pin every tick to the first render's snapshot. The loop
 * mutates refs and bumps a tick counter, and the page copies the refs back into state
 * from a single effect keyed on that counter.
 */
function useSimulation({ unitsRef, requestsRef, sessionsRef, toast }) {
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

    unitsRef.current = unitsRef.current.map((unit) => {
      const envelope = STORAGE_ENVELOPE[unit.component];
      const drift = (Math.random() - 0.48) * (envelope.max - envelope.min) * 0.18;
      const temp = Number((unit.temp + drift).toFixed(1));
      const aged = { ...unit, ageHours: unit.ageHours + 2, temp };

      // A unit that leaves its storage envelope is quarantined on the spot: AABB
      // requires it be evaluated before it can go back into issuable stock.
      if (aged.state === "Available" && temperatureExcursion(aged)) {
        toast(`${aged.din} quarantined — ${temp} °C outside ${envelope.label}`, "High");
        return { ...aged, state: "Quarantine" };
      }
      if (aged.state === "Available" && outdateBand(aged) === "Expired") {
        toast(`${aged.din} outdated (${aged.component})`, "Medium");
        return { ...aged, state: "Outdated" };
      }
      return aged;
    });

    requestsRef.current = requestsRef.current.map((request) => {
      if (request.stage === "Issued" || Math.random() > 0.22) return request;
      const order = ["Type & screen", "Immediate spin", "Serologic crossmatch", "Electronic issue", "Issued"];
      const next = order[Math.min(order.length - 1, order.indexOf(request.stage) + 1)];
      if (next !== request.stage) {
        toast(`${request.id} advanced to ${next}`, request.urgency === "Emergency" ? "Medium" : "Low");
      }
      return { ...request, stage: next };
    });

    sessionsRef.current = sessionsRef.current.map((session) => {
      if (session.status !== "In progress") return session;
      const attended = Math.min(session.booked, session.attended + (Math.random() < 0.5 ? 1 : 0));
      const collected = Math.min(attended - session.deferred, session.collected + (Math.random() < 0.4 ? 1 : 0));
      const yieldPct = attended > 0 ? Math.round((collected / attended) * 100) : 0;
      return { ...session, attended, collected, yieldPct };
    });
  }, [unitsRef, requestsRef, sessionsRef, toast]);

  useEffect(() => {
    const interval = setInterval(loop, Math.round(2400 / speedRef.current));
    return () => clearInterval(interval);
  }, [loop]);

  return {
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    reset: () => {
      unitsRef.current = UNITS.map((unit) => ({ ...unit }));
      requestsRef.current = REQUESTS.map((request) => ({ ...request, assigned: [] }));
      sessionsRef.current = SESSIONS.map((session) => ({ ...session }));
      setTick(0);
      toast("Transfusion console reset to baseline inventory", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BloodBankTransfusionHub() {
  const [tab, setTab] = useState("inventory");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [componentFilter, setComponentFilter] = useState("All");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  const { toasts, toast, removeToast } = useSeverityToasts();

  const [units, setUnits] = useState(() => UNITS.map((unit) => ({ ...unit })));
  const [requests, setRequests] = useState(() => REQUESTS.map((request) => ({ ...request, assigned: [] })));
  const [reactions, setReactions] = useState(() => REACTIONS.map((reaction) => ({ ...reaction })));
  const [sessions, setSessions] = useState(() => SESSIONS.map((session) => ({ ...session })));

  const unitsRef = useRef(units);
  const requestsRef = useRef(requests);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const simulation = useSimulation({ unitsRef, requestsRef, sessionsRef, toast });

  useEffect(() => {
    setUnits([...unitsRef.current]);
    setRequests([...requestsRef.current]);
    setSessions([...sessionsRef.current]);
  }, [simulation.tick]);

  /* ---------- derived ---------- */

  const stats = useMemo(() => {
    const issuable = units.filter((unit) => unit.state === "Available");
    const critical = issuable.filter((unit) => outdateBand(unit) === "Critical").length;
    const quarantined = units.filter((unit) => unit.state === "Quarantine").length;
    const openReactions = reactions.filter((reaction) => reaction.status !== "Closed").length;
    return { issuable: issuable.length, critical, quarantined, openReactions };
  }, [units, reactions]);

  const mtp = useMemo(() => mtpReadiness(units), [units]);

  const groupCover = useMemo(
    () =>
      [
        { abo: "O", rh: "-", rate: 4.5 },
        { abo: "O", rh: "+", rate: 6.0 },
        { abo: "A", rh: "+", rate: 5.0 },
        { abo: "B", rh: "+", rate: 2.5 },
        { abo: "AB", rh: "+", rate: 1.0 },
      ].map((group) => ({
        ...group,
        cover: daysOfCover(units, group.abo, group.rh, group.rate),
      })),
    [units]
  );

  const filteredUnits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return units
      .filter((unit) => {
        const matchesQuery =
          !needle ||
          [unit.din, unit.component, unit.fridge, unit.phenotype, `${unit.abo}${unit.rh}`].some((field) =>
            field.toLowerCase().includes(needle)
          );
        const matchesComponent =
          componentFilter === "All" || COMPONENT_CLASS[unit.component] === componentFilter;
        return matchesQuery && matchesComponent;
      })
      .sort((a, b) => hoursRemaining(a) - hoursRemaining(b));
  }, [units, query, componentFilter]);

  const filteredRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesQuery =
        !needle ||
        [request.id, request.patient, request.ward, request.indication, request.antibody].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesUrgency = urgencyFilter === "All" || request.urgency === urgencyFilter;
      return matchesQuery && matchesUrgency;
    });
  }, [requests, query, urgencyFilter]);

  const filteredReactions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reactions.filter((reaction) => {
      const matchesQuery =
        !needle ||
        [reaction.id, reaction.din, reaction.patient, reaction.type, reaction.imputability].some((field) =>
          field.toLowerCase().includes(needle)
        );
      const matchesSeverity = severityFilter === "All" || reaction.severity === severityFilter;
      return matchesQuery && matchesSeverity;
    });
  }, [reactions, query, severityFilter]);

  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter(
      (session) =>
        !needle || [session.id, session.site, session.type, session.status].some((field) => field.toLowerCase().includes(needle))
    );
  }, [sessions, query]);

  /* ---------- actions ---------- */

  const assignUnits = (request) => {
    const candidates = selectUnitsFor(request, units).slice(0, request.units);
    if (candidates.length === 0) {
      toast(`No compatible ${request.component.toLowerCase()} in stock for ${request.abo}${request.rh}`, "High");
      return;
    }
    const chosen = candidates.map((unit) => unit.din);
    setUnits((current) => current.map((unit) => (chosen.includes(unit.din) ? { ...unit, state: "Crossmatched" } : unit)));
    setRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, assigned: chosen } : item))
    );
    if (candidates.length < request.units) {
      toast(`${request.id}: only ${candidates.length} of ${request.units} units could be reserved`, "Medium");
    } else {
      toast(`${request.id}: ${chosen.length} compatible units reserved, oldest first`, "Low");
    }
  };

  const releaseUnits = (request) => {
    setUnits((current) =>
      current.map((unit) => (request.assigned.includes(unit.din) ? { ...unit, state: "Available" } : unit))
    );
    setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, assigned: [] } : item)));
    toast(`${request.id}: reservation released back to available stock`, "Low");
  };

  const releaseQuarantine = (din) => {
    setUnits((current) => current.map((unit) => (unit.din === din ? { ...unit, state: "Available" } : unit)));
    toast(`${din} returned to issuable stock after evaluation`, "Low");
  };

  const closeReaction = (id) => {
    setReactions((current) =>
      current.map((reaction) => (reaction.id === id ? { ...reaction, status: "Closed" } : reaction))
    );
    toast(`${id} closed and submitted to the national haemovigilance scheme`, "Low");
  };

  const exportCsv = () => {
    const table =
      tab === "inventory"
        ? [
            ["DIN", "Product", "Component", "Group", "Age (h)", "Remaining", "Temp", "State", "Location"],
            ...filteredUnits.map((unit) => [
              unit.din,
              unit.product,
              unit.component,
              `${unit.abo}${unit.rh}`,
              unit.ageHours,
              formatHours(hoursRemaining(unit)),
              unit.temp,
              unit.state,
              unit.fridge,
            ]),
          ]
        : tab === "crossmatch"
        ? [
            ["Request", "Patient", "Group", "Ward", "Component", "Units", "Urgency", "Stage", "Antibody", "Reserved"],
            ...filteredRequests.map((request) => [
              request.id,
              request.patient,
              `${request.abo}${request.rh}`,
              request.ward,
              request.component,
              request.units,
              request.urgency,
              request.stage,
              request.antibody,
              request.assigned.length,
            ]),
          ]
        : tab === "haemovigilance"
        ? [
            ["Case", "DIN", "Patient", "Reaction", "Severity", "Imputability", "Status"],
            ...filteredReactions.map((reaction) => [
              reaction.id,
              reaction.din,
              reaction.patient,
              reaction.type,
              reaction.severity,
              reaction.imputability,
              reaction.status,
            ]),
          ]
        : [
            ["Session", "Site", "Type", "Booked", "Attended", "Deferred", "Collected", "Yield %", "Status"],
            ...filteredSessions.map((session) => [
              session.id,
              session.site,
              session.type,
              session.booked,
              session.attended,
              session.deferred,
              session.collected,
              session.yieldPct,
              session.status,
            ]),
          ];

    downloadCsv(`blood-bank-${tab}.csv`, table);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "inventory", label: "Component Inventory", icon: Droplets },
    { id: "crossmatch", label: "Crossmatch Lab", icon: Microscope },
    { id: "haemovigilance", label: "Haemovigilance", icon: ShieldAlert },
    { id: "donors", label: "Donor & Apheresis", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <SeverityToastTray toasts={toasts} onDismiss={removeToast} />

      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-400">
              <Droplet size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Blood Bank &amp; Transfusion Medicine Command Hub</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Component inventory · crossmatch · haemovigilance · donor sessions — ISBT 128 / AABB 34th ed. aligned
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
                    simulation.speed === factor ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:bg-slate-800"
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
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Droplets}
            label="Issuable units"
            value={stats.issuable}
            sub={`${units.length} units under management`}
            accent="text-emerald-400"
          />
          <StatCard
            icon={Hourglass}
            label="Near outdate"
            value={stats.critical}
            sub="under 10% of shelf life left"
            accent={stats.critical > 0 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={Snowflake}
            label="Quarantined"
            value={stats.quarantined}
            sub="storage excursion, pending review"
            accent={stats.quarantined > 0 ? "text-red-400" : "text-emerald-400"}
          />
          <StatCard
            icon={ShieldAlert}
            label="Open reaction cases"
            value={stats.openReactions}
            sub="haemovigilance workup"
            accent={stats.openReactions > 0 ? "text-red-400" : "text-emerald-400"}
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
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
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
              placeholder="Search DIN, group, ward, reaction…"
              aria-label="Search the transfusion service"
              className="w-72 rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-rose-500/50 focus:outline-none"
            />
          </div>
          {tab === "inventory" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Red Cells", "Platelets", "Plasma", "Cryo"].map((option) => (
                <button
                  key={option}
                  onClick={() => setComponentFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    componentFilter === option
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {tab === "crossmatch" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Emergency", "Urgent", "Routine"].map((option) => (
                <button
                  key={option}
                  onClick={() => setUrgencyFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    urgencyFilter === option
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {tab === "haemovigilance" && (
            <div className="flex flex-wrap gap-1.5">
              {["All", "Grade 1", "Grade 2", "Grade 3"].map((option) => (
                <button
                  key={option}
                  onClick={() => setSeverityFilter(option)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                    severityFilter === option
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
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
        {tab === "inventory" && (
          <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <Layers size={15} className="text-rose-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Days of cover by red cell group</h2>
                </div>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                  On-hand issuable units divided by the observed daily issue rate. O-negative is the group this
                  figure exists for: it is the only red cell any recipient can receive, so it is drawn down first in
                  every emergency release and is chronically the group closest to running out.
                </p>
                <div className="space-y-3">
                  {groupCover.map((group) => {
                    const short = group.cover < 2;
                    return (
                      <div key={`${group.abo}${group.rh}`} className="flex items-center gap-4">
                        <span className="w-12 text-sm font-bold text-slate-100">
                          {group.abo}
                          {group.rh}
                        </span>
                        <Meter
                          value={(group.cover / 5) * 100}
                          color={short ? "bg-red-400" : group.cover < 3 ? "bg-amber-400" : "bg-emerald-400"}
                        />
                        <span className={`text-xs font-medium ${short ? "text-red-400" : "text-slate-300"}`}>
                          {group.cover} days
                        </span>
                        <span className="text-[11px] text-slate-500">{group.rate}/day issue rate</span>
                        {short && <Badge tone="red">Below 2-day floor</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Siren size={15} className="text-rose-400" />
                  <h2 className="text-sm font-semibold text-slate-200">MTP readiness</h2>
                </div>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                  Balanced 1:1:1 resuscitation needs equal red cell, plasma and platelet units, so readiness is
                  governed by the scarcest of the three — not the total unit count.
                </p>
                <div className="space-y-2">
                  <Row label="Red cell units" value={mtp.redCells} />
                  <Row label="Plasma units" value={mtp.plasma} />
                  <Row label="Platelet units" value={mtp.platelets} />
                  <Row
                    label="Complete 1:1:1 rounds"
                    value={mtp.rounds}
                    accent={mtp.rounds < 2 ? "text-red-400" : "text-emerald-400"}
                  />
                  <Row label="Limiting component" value={mtp.limiting} accent="text-amber-400" />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Donation ID (ISBT 128)</th>
                    <th className="px-4 py-3 font-medium">Component</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 font-medium">Shelf life left</th>
                    <th className="px-4 py-3 font-medium">Storage</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
                  {filteredUnits.map((unit) => {
                    const band = outdateBand(unit);
                    const excursion = temperatureExcursion(unit);
                    return (
                      <tr key={unit.din} className="hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-300">{unit.din}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-200">{unit.component}</div>
                          <div className="text-[11px] text-slate-500">
                            {unit.product} · {unit.volume} mL{unit.irradiated ? " · irradiated" : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-100">
                          {unit.abo}
                          {unit.rh}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge tone={band === "Expired" ? "red" : band === "Critical" ? "amber" : band === "Watch" ? "sky" : "green"}>
                              {band}
                            </Badge>
                            <span className="text-slate-400">{formatHours(hoursRemaining(unit))}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 ${excursion ? "text-red-400" : "text-slate-300"}`}>
                            <Thermometer size={13} />
                            {unit.temp} °C
                          </div>
                          <div className="text-[11px] text-slate-500">{unit.fridge}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge>{unit.state}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setModal({ kind: "unit", unit })}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUnits.length === 0 && <EmptyState message="No units match the current search and filter." icon={Droplet} />}
            </section>
          </div>
        )}

        {tab === "crossmatch" && (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const candidates = selectUnitsFor(request, units);
              const shortfall = Math.max(0, request.units - candidates.length - request.assigned.length);
              return (
                <div key={request.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{request.id}</h3>
                        <Badge>{request.urgency}</Badge>
                        <Badge tone="sky">{request.stage}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {request.patient} · {request.abo}
                        {request.rh} · {request.ward} — {request.indication}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Antibody screen: <span className={request.antibody === "None detected" ? "text-emerald-400" : "text-amber-400"}>{request.antibody}</span>
                        {" · "}last screen {request.lastScreen}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {request.assigned.length > 0 ? (
                        <button
                          onClick={() => releaseUnits(request)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                        >
                          Release {request.assigned.length}
                        </button>
                      ) : (
                        <button
                          onClick={() => assignUnits(request)}
                          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
                        >
                          Reserve {request.units} units
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ kind: "request", request, candidates })}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
                      >
                        Compatibility
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-500">Requested</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">
                        {request.units} × {request.component}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-500">Compatible in stock</div>
                      <div className="mt-1 text-sm font-semibold text-slate-100">{candidates.length}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-500">Reserved</div>
                      <div className={`mt-1 text-sm font-semibold ${shortfall > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {request.assigned.length}
                        {shortfall > 0 ? ` · ${shortfall} short` : ""}
                      </div>
                    </div>
                  </div>

                  {request.assigned.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {request.assigned.map((din) => (
                        <span key={din} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-400">
                          {din}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredRequests.length === 0 && <EmptyState message="No crossmatch requests match the current filter." icon={Droplet} />}
          </div>
        )}

        {tab === "haemovigilance" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Info size={15} className="text-rose-400" />
                <h2 className="text-sm font-semibold text-slate-200">Imputability grading</h2>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Every suspected reaction is graded for severity (1-4) and for imputability — the strength of the causal
                link between the component and the event, from &ldquo;excluded&rdquo; through &ldquo;possible&rdquo; and
                &ldquo;probable&rdquo; to &ldquo;definite&rdquo;. Only cases graded possible or above are reportable to
                the national scheme, which is why the two axes are tracked separately rather than collapsed into one
                severity score.
              </p>
            </div>

            {filteredReactions.map((reaction) => (
              <div key={reaction.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{reaction.id}</h3>
                      <Badge>{reaction.severity}</Badge>
                      <Badge>{reaction.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{reaction.type}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Unit <span className="font-mono">{reaction.din}</span> · {reaction.patient} · onset {reaction.onset}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {reaction.status !== "Closed" && (
                      <button
                        onClick={() => closeReaction(reaction.id)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Close &amp; report
                      </button>
                    )}
                    <button
                      onClick={() => setModal({ kind: "reaction", reaction })}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
                    >
                      Case file
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
                  <div>
                    Imputability: <span className="text-slate-200">{reaction.imputability}</span>
                  </div>
                  <div>
                    Reporting: <span className="text-slate-200">{reaction.reported}</span>
                  </div>
                  <div>
                    Action: <span className="text-slate-200">{reaction.action}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredReactions.length === 0 && <EmptyState message="No reaction cases match the current filter." icon={Droplet} />}
          </div>
        )}

        {tab === "donors" && (
          <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                {filteredSessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-100">{session.site}</h3>
                          <Badge>{session.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {session.id} · {session.type} · {session.staff} collection staff
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Meter value={session.yieldPct} color={session.yieldPct < 80 ? "bg-amber-400" : "bg-emerald-400"} />
                        <span className="text-xs font-medium text-slate-300">{session.yieldPct}% yield</span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Booked", value: session.booked, icon: Clock },
                        { label: "Attended", value: session.attended, icon: UserCheck },
                        { label: "Deferred", value: session.deferred, icon: AlertTriangle },
                        { label: "Collected", value: session.collected, icon: Syringe },
                      ].map((cell) => {
                        const Icon = cell.icon;
                        return (
                          <div key={cell.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              {cell.label}
                              <Icon size={13} />
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-100">{cell.value}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredSessions.length === 0 && <EmptyState message="No collection sessions match the search." icon={Droplet} />}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical size={15} className="text-rose-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Deferral reasons today</h2>
                </div>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
                  Deferrals are the difference between a booked donor and a collected unit, and low haemoglobin is
                  consistently the largest single cause. A drive that books 64 and defers 7 has already lost more than
                  a tenth of its yield before a needle goes in.
                </p>
                <div className="space-y-3">
                  {DEFERRAL_REASONS.map((entry) => (
                    <div key={entry.reason} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-300">{entry.reason}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100">{entry.count}</span>
                        {entry.trend === "up" ? (
                          <TrendingUp size={13} className="text-red-400" />
                        ) : entry.trend === "down" ? (
                          <TrendingDown size={13} className="text-emerald-400" />
                        ) : (
                          <Activity size={13} className="text-slate-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {modal?.kind === "unit" && (
        <Modal
          title={modal.unit.din}
          subtitle={`${modal.unit.component} · ${modal.unit.abo}${modal.unit.rh}`}
          onClose={() => setModal(null)}
        >
          <Row label="ISBT 128 product code" value={modal.unit.product} />
          <Row label="Component class" value={COMPONENT_CLASS[modal.unit.component]} />
          <Row label="Volume" value={`${modal.unit.volume} mL`} />
          <Row label="Phenotype" value={modal.unit.phenotype} />
          <Row label="CMV status" value={modal.unit.cmv} />
          <Row label="Irradiated" value={modal.unit.irradiated ? "Yes" : "No"} />
          <Row label="Storage envelope" value={STORAGE_ENVELOPE[modal.unit.component].label} />
          <Row
            label="Current temperature"
            value={`${modal.unit.temp} °C`}
            accent={temperatureExcursion(modal.unit) ? "text-red-400" : "text-emerald-400"}
          />
          <Row label="Age" value={formatHours(modal.unit.ageHours)} />
          <Row label="Shelf life remaining" value={formatHours(hoursRemaining(modal.unit))} />
          <Row label="Outdate band" value={outdateBand(modal.unit)} />
          <Row label="State" value={modal.unit.state} />
          <div className="pt-2 text-[11px] leading-relaxed text-slate-500">
            Compatible recipients:{" "}
            {ABO_GROUPS.filter((group) =>
              isCompatible(
                { abo: group, rh: "+" },
                { abo: modal.unit.abo, rh: modal.unit.rh, class: COMPONENT_CLASS[modal.unit.component] }
              )
            )
              .map((group) => group)
              .join(", ") || "none"}
          </div>
          {modal.unit.state === "Quarantine" && (
            <button
              onClick={() => {
                releaseQuarantine(modal.unit.din);
                setModal(null);
              }}
              className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              Return to issuable stock after evaluation
            </button>
          )}
        </Modal>
      )}

      {modal?.kind === "request" && (
        <Modal
          title={`${modal.request.id} compatibility`}
          subtitle={`${modal.request.patient} · ${modal.request.abo}${modal.request.rh} · ${modal.request.component}`}
          onClose={() => setModal(null)}
        >
          <p className="text-[11px] leading-relaxed text-slate-500">
            {modal.request.component === "Plasma"
              ? "Plasma carries donor antibody, so compatibility runs the opposite way to red cells: AB is the universal plasma donor."
              : "Red cells carry donor antigen, so the donor's ABO antigens must be absent from the recipient's plasma. O-negative is the universal red cell donor."}
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-2 text-[11px] font-medium text-slate-400">Acceptable donor groups</div>
            <div className="flex flex-wrap gap-1.5">
              {(modal.request.component === "Plasma" ? PLASMA_COMPATIBILITY : RBC_COMPATIBILITY)[modal.request.abo].map(
                (group) => (
                  <Badge key={group} tone="green">
                    {group}
                    {modal.request.component === "Plasma" ? "" : modal.request.rh === "+" ? " ±" : " −"}
                  </Badge>
                )
              )}
            </div>
          </div>
          <Row label="Units requested" value={modal.request.units} />
          <Row label="Compatible in stock" value={modal.candidates.length} />
          <Row label="Antibody screen" value={modal.request.antibody} />
          <Row label="Workflow stage" value={modal.request.stage} />
          <div className="pt-1 text-[11px] font-medium text-slate-400">Issue order (oldest compatible first)</div>
          {modal.candidates.length === 0 ? (
            <p className="text-xs text-amber-400">No compatible, in-date, in-envelope units are available.</p>
          ) : (
            <div className="space-y-1.5">
              {modal.candidates.slice(0, 8).map((unit) => (
                <div key={unit.din} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <span className="font-mono text-[11px] text-slate-300">{unit.din}</span>
                  <span className="text-[11px] text-slate-500">
                    {unit.abo}
                    {unit.rh} · {formatHours(hoursRemaining(unit))} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {modal?.kind === "reaction" && (
        <Modal title={modal.reaction.id} subtitle={modal.reaction.type} onClose={() => setModal(null)}>
          <Row label="Implicated unit" value={modal.reaction.din} />
          <Row label="Recipient" value={modal.reaction.patient} />
          <Row label="Severity" value={modal.reaction.severity} />
          <Row label="Imputability" value={modal.reaction.imputability} />
          <Row label="Onset" value={modal.reaction.onset} />
          <Row label="Immediate action" value={modal.reaction.action} />
          <Row label="Reporting" value={modal.reaction.reported} />
          <Row label="Status" value={modal.reaction.status} />
          <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>
              Vein-to-vein traceability: the donation, the component, the recipient and this case are linked by the
              donation identification number, so a lookback from either end reaches the other for the 30 years the EU
              blood directive requires.
            </span>
          </div>
        </Modal>
      )}

      <footer className="border-t border-slate-800 px-6 py-4 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} /> ISBT 128 unit identification
          </span>
          <span className="flex items-center gap-1.5">
            <FileText size={12} /> AABB Standards, 34th edition
          </span>
          <span className="flex items-center gap-1.5">
            <Timer size={12} /> 21 CFR 610.53 dating periods
          </span>
          <span className="flex items-center gap-1.5">
            <Bell size={12} /> EU Directive 2002/98/EC traceability
          </span>
        </div>
      </footer>
    </div>
  );
}
