import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Archive, ArrowRight, Battery, Bell, Boxes,
  CheckCircle2, ChevronRight, Clock, Cloud, Cpu, Database, Download,
  Droplets, FileText, Fingerprint, FlaskConical, Gauge, Hash, Info, Layers,
  Lock, Package, Pause, Play, Plus, QrCode, Radio, RefreshCw, ScanLine,
  Search, Server, ShieldAlert, ShieldCheck, Snowflake, Syringe, Thermometer,
  Timer, Truck, Users, Warehouse, Wind, Wrench, X, Zap
} from "lucide-react";
import { clamp, round1, fmtNumber, seededSeries as series } from "../../utils/series";
import PlaybackControls from "../../components/common/PlaybackControls";
import { ExportButton } from "../../components/common/ExportButton";
import LiveStatus from "../../components/common/LiveStatus";
import ToastStack, { useToasts } from "../../components/common/ToastStack";
import { downloadCsv } from "../../utils/csv";
import { ProgressBar } from "../../components/common/ProgressBar";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { StatusPill } from "../../components/common/StatusPill";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Pharmaceutical Cold-Chain & Med-Supply Chain Command Station
 *  ------------------------------------------------------------------
 *  Five consoles for the cold-chain command function:
 *    1. Cryo Telemetry      - ultra-low (-80C) freezer fleet with live
 *                             temperature telemetry, CO2 backup and
 *                             excursion tracking.
 *    2. RFID Serialization  - SGTIN-96 tag inventory with read integrity,
 *                             tamper flags and re-read actions.
 *    3. DSCSA 2023 Track & Trace - serialized product tracing with ePCIS
 *                             event streams, verification and suspect-
 *                             product alerts.
 *    4. Schedule II Vault   - DEA Schedule II narcotic vault with dual
 *                             custody, dispense audit log and cycle counts.
 *    5. Arrhenius Kinetics  - thermal excursion impact modelling using the
 *                             Arrhenius equation to quantify shelf-life loss.
 *
 *  The command station simulates client-side: cryo temperatures drift,
 *  RFID reads intermittently drop, shipments progress through ePCIS
 *  events, the vault logs dispensations and excursions accumulate
 *  kinetic impact until disposition review.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const CRYO_STATUS = {
  nominal: { label: "Nominal", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  warning: { label: "Warning", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  violation: { label: "Excursion", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const RFID_STATUS = {
  read: { label: "Read", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  missed: { label: "Missed Read", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  tampered: { label: "Tamper Alert", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const DSCSA_STATUS = {
  commissioned: { label: "Commissioned", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  shipped: { label: "Shipped", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  "in-transit": { label: "In Transit", cls: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  received: { label: "Received", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  verified: { label: "Verified", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  suspect: { label: "Suspect", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const VAULT_STATUS = {
  balanced: { label: "Balanced", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  discrepancy: { label: "Discrepancy", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const IMPACT_META = {
  low: { label: "Low Impact", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  moderate: { label: "Moderate", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  high: { label: "High", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  critical: { label: "Critical", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const TABS = [
  { key: "cryo", label: "Cryo Telemetry", icon: Snowflake, blurb: "Ultra-low −80°C freezer fleet · live telemetry & excursions" },
  { key: "rfid", label: "RFID Serialization", icon: Radio, blurb: "SGTIN tag inventory · read integrity & tamper alerts" },
  { key: "dscsa", label: "DSCSA Track & Trace", icon: ScanLine, blurb: "Serialized product tracing · ePCIS events & verification" },
  { key: "vault", label: "Narcotic Vault Audit", icon: Lock, blurb: "DEA Schedule II vault · dual custody & dispense audit" },
  { key: "arrhenius", label: "Arrhenius Kinetics", icon: FlaskConical, blurb: "Excursion impact modelling · shelf-life loss estimation" },
];

const CRYO_FREEZERS = [
  { id: "CRYO-01", name: "Cryo Vault A · mRNA Bank", model: "Thermo TSX -86°C", location: "Vaccine Vault · Level B1", temp: -81.2, rangeMin: -85, rangeMax: -70, humidity: 31, occupancy: 84, co2: 78, battery: 92, alarmArmed: true, lastCalibrated: "2026-07-28", lastExcursion: null, portable: false },
  { id: "CRYO-02", name: "Cryo Vault B · Cell Therapy", model: "Stirling SU780XLE", location: "Cell Lab · Level B1", temp: -79.6, rangeMin: -85, rangeMax: -70, humidity: 29, occupancy: 71, co2: 64, battery: 88, alarmArmed: true, lastCalibrated: "2026-06-19", lastExcursion: null, portable: false },
  { id: "CRYO-03", name: "Cryo Vault C · Plasma Bank", model: "Haier DW-86L626", location: "Blood Bank · Level B2", temp: -83.4, rangeMin: -85, rangeMax: -70, humidity: 26, occupancy: 92, co2: 51, battery: 97, alarmArmed: true, lastCalibrated: "2026-07-05", lastExcursion: null, portable: false },
  { id: "CRYO-04", name: "Cryo Vault D · Gene Therapy", model: "Thermo Forma 88700", location: "Gene Therapy Suite", temp: -77.8, rangeMin: -82, rangeMax: -76, humidity: 33, occupancy: 63, co2: 82, battery: 74, alarmArmed: true, lastCalibrated: "2026-05-22", lastExcursion: "2026-08-02 01:47", portable: false },
  { id: "CRYO-05", name: "Cryo Vault E · Biobank", model: "Panasonic MDF-U76VA", location: "Biobank · Level B3", temp: -84.6, rangeMin: -85, rangeMax: -70, humidity: 24, occupancy: 58, co2: 46, battery: 81, alarmArmed: true, lastCalibrated: "2026-07-11", lastExcursion: null, portable: false },
  { id: "CRYO-06", name: "Cryo Vault F · Research", model: "Thermo TSX -80", location: "Research Lab 1", temp: -76.2, rangeMin: -80, rangeMax: -75, humidity: 36, occupancy: 49, co2: 71, battery: 66, alarmArmed: false, lastCalibrated: "2026-03-30", lastExcursion: "2026-07-29 18:22", portable: false },
  { id: "CRYO-07", name: "Dry Shipper · CAR-T Run 12", model: "Stirling SHC-4B", location: "In transit · FedEx Health", temp: -72.4, rangeMin: -75, rangeMax: -65, humidity: 19, occupancy: 100, co2: 22, battery: 54, alarmArmed: true, lastCalibrated: "2026-08-10", lastExcursion: "2026-08-11 09:40", portable: true },
  { id: "CRYO-08", name: "Dry Shipper · Vaccine Run 44", model: "ThermoSafe Kodiak XL", location: "Dock 2 · Awaiting dispatch", temp: -74.6, rangeMin: -75, rangeMax: -65, humidity: 21, occupancy: 100, co2: 18, battery: 33, alarmArmed: true, lastCalibrated: "2026-08-09", lastExcursion: null, portable: true },
];

const RFID_ITEMS = [
  { id: "303436B315C08B0C", product: "Fentanyl citrate 50 mcg/mL", serial: "FN-2026-11847", lot: "FN-2608", zone: "Vault · Drawer A1", lastRead: 1, strength: -48.2, status: "read", tampered: false, expiresInDays: 133 },
  { id: "303436B315C09F31", product: "Oxycodone HCl 5 mg tabs", serial: "OX-2026-20411", lot: "OX-2606", zone: "Vault · Drawer A2", lastRead: 2, strength: -52.7, status: "read", tampered: false, expiresInDays: 96 },
  { id: "303436B315C0A15E", product: "Morphine sulfate 10 mg/mL", serial: "MS-2026-33008", lot: "MS-2608", zone: "Vault · Drawer A3", lastRead: 5, strength: -61.4, status: "missed", tampered: false, expiresInDays: 141 },
  { id: "303436B315C0B2AC", product: "Hydromorphone HCl 2 mg", serial: "HM-2026-45122", lot: "HM-2607", zone: "Vault · Drawer A4", lastRead: 0, strength: -44.9, status: "read", tampered: false, expiresInDays: 187 },
  { id: "303436B315C0C4D1", product: "Sufentanil citrate 50 mcg/mL", serial: "SF-2026-51207", lot: "SF-2605", zone: "Vault · Drawer B1", lastRead: 3, strength: -55.1, status: "read", tampered: true, expiresInDays: 62 },
  { id: "303436B315C0D7E8", product: "Remifentanil HCl 2 mg", serial: "RM-2026-60114", lot: "RM-2608", zone: "Vault · Drawer B2", lastRead: 1, strength: -47.8, status: "read", tampered: false, expiresInDays: 155 },
  { id: "303436B315C0E9F5", product: "Adderall XR 20 mg caps", serial: "AD-2026-72419", lot: "AD-2609", zone: "Vault · Drawer C1", lastRead: 7, strength: -68.3, status: "missed", tampered: false, expiresInDays: 210 },
  { id: "303436B315C0F0A6", product: "Methylphenidate LA 40 mg", serial: "MP-2026-83210", lot: "MP-2607", zone: "Vault · Drawer C2", lastRead: 0, strength: -43.6, status: "read", tampered: false, expiresInDays: 174 },
  { id: "303436B315C101B7", product: "Meperidine HCl 50 mg/mL", serial: "DP-2026-94055", lot: "DP-2606", zone: "Vault · Drawer D1", lastRead: 4, strength: -58.9, status: "read", tampered: false, expiresInDays: 88 },
  { id: "303436B315C112C8", product: "Dilaudid 2 mg/mL", serial: "DL-2026-10012", lot: "DL-2609", zone: "Vault · Drawer D2", lastRead: 12, strength: -71.5, status: "missed", tampered: false, expiresInDays: 119 },
];

const SHIPMENTS = [
  { id: "SH-2026-8814", product: "Fentanyl citrate 2 mL amps", lot: "FN-2612", qty: 480, status: "in-transit", partner: "AmerisourceBergen", lastEvent: "SHIPMENT_ACCEPTANCE", arriveTick: 6, suspect: false },
  { id: "SH-2026-8815", product: "Oxycodone HCl 5 mg tabs", lot: "OX-2610", qty: 1200, status: "verified", partner: "Cardinal Health", lastEvent: "OBJECT_EVENT_RECEIVE", arriveTick: null, suspect: false },
  { id: "SH-2026-8816", product: "Hydromorphone 2 mg amps", lot: "HM-2609", qty: 300, status: "received", partner: "McKesson", lastEvent: "OBJECT_EVENT_RECEIVE", arriveTick: null, suspect: false },
  { id: "SH-2026-8817", product: "Sufentanil 50 mcg/mL", lot: "SF-2607", qty: 240, status: "in-transit", partner: "Cardinal Health", lastEvent: "SHIPMENT_DISPATCH", arriveTick: 9, suspect: false },
  { id: "SH-2026-8818", product: "Remifentanil 2 mg vials", lot: "RM-2610", qty: 200, status: "commissioned", partner: "Pfizer Direct", lastEvent: "OBJECT_EVENT_AGGREGATION", arriveTick: null, suspect: false },
  { id: "SH-2026-8819", product: "Adderall XR 20 mg caps", lot: "AD-2611", qty: 900, status: "suspect", partner: "AmerisourceBergen", lastEvent: "OBJECT_EVENT_RECEIVE", arriveTick: null, suspect: true },
  { id: "SH-2026-8820", product: "Methylphenidate LA 40 mg", lot: "MP-2612", qty: 600, status: "shipped", partner: "McKesson", lastEvent: "OBJECT_EVENT_SHIP", arriveTick: 4, suspect: false },
  { id: "SH-2026-8821", product: "Meperidine 50 mg/mL", lot: "DP-2608", qty: 360, status: "verified", partner: "Cardinal Health", lastEvent: "OBJECT_EVENT_VERIFY", arriveTick: null, suspect: false },
];

const EPICS_EVENTS = [
  { id: "EV-9041", tick: 0, type: "OBJECT_EVENT_AGGREGATION", shipment: "SH-2026-8818", location: "Pfizer · Chesterfield", partner: "Pfizer Direct" },
  { id: "EV-9042", tick: 2, type: "OBJECT_EVENT_SHIP", shipment: "SH-2026-8820", location: "McKesson DC · Columbus", partner: "McKesson" },
  { id: "EV-9043", tick: 4, type: "SHIPMENT_DISPATCH", shipment: "SH-2026-8817", location: "Cardinal DC · Allentown", partner: "Cardinal Health" },
  { id: "EV-9044", tick: 5, type: "TRANSACTION_STATEMENT", shipment: "SH-2026-8815", location: "Cardinal DC · Allentown", partner: "Cardinal Health" },
  { id: "EV-9045", tick: 6, type: "OBJECT_EVENT_RECEIVE", shipment: "SH-2026-8815", location: "MedTrack Receiving · Dock 1", partner: "Cardinal Health" },
  { id: "EV-9046", tick: 7, type: "OBJECT_EVENT_VERIFY", shipment: "SH-2026-8815", location: "MedTrack Pharmacy", partner: "MedTrack" },
  { id: "EV-9047", tick: 8, type: "OBJECT_EVENT_RECEIVE", shipment: "SH-2026-8816", location: "MedTrack Receiving · Dock 2", partner: "McKesson" },
  { id: "EV-9048", tick: 9, type: "OBJECT_EVENT_RECEIVE", shipment: "SH-2026-8819", location: "MedTrack Receiving · Dock 1", partner: "AmerisourceBergen" },
  { id: "EV-9049", tick: 10, type: "TRANSACTION_HISTORY", shipment: "SH-2026-8814", location: "ABDC · Dallas", partner: "AmerisourceBergen" },
  { id: "EV-9050", tick: 11, type: "SHIPMENT_DISPATCH", shipment: "SH-2026-8814", location: "ABDC · Dallas", partner: "AmerisourceBergen" },
  { id: "EV-9051", tick: 12, type: "OBJECT_EVENT_AGGREGATION", shipment: "SH-2026-8821", location: "Cardinal DC · Allentown", partner: "Cardinal Health" },
  { id: "EV-9052", tick: 13, type: "OBJECT_EVENT_VERIFY", shipment: "SH-2026-8821", location: "MedTrack Pharmacy", partner: "MedTrack" },
];

const VAULT_ITEMS = [
  { id: "SII-001", name: "Fentanyl citrate 50 mcg/mL", schedule: "CII", drawer: "A1", expected: 148, onHand: 146, lastCount: 5, discrepancy: 2, custody: "Dual" },
  { id: "SII-002", name: "Oxycodone HCl 5 mg tabs", schedule: "CII", drawer: "A2", expected: 520, onHand: 518, lastCount: 2, discrepancy: 2, custody: "Dual" },
  { id: "SII-003", name: "Morphine sulfate 10 mg/mL", schedule: "CII", drawer: "A3", expected: 190, onHand: 190, lastCount: 1, discrepancy: 0, custody: "Dual" },
  { id: "SII-004", name: "Hydromorphone HCl 2 mg", schedule: "CII", drawer: "A4", expected: 240, onHand: 238, lastCount: 9, discrepancy: 2, custody: "Dual" },
  { id: "SII-005", name: "Sufentanil citrate 50 mcg/mL", schedule: "CII", drawer: "B1", expected: 80, onHand: 76, lastCount: 3, discrepancy: 4, custody: "Dual" },
  { id: "SII-006", name: "Remifentanil HCl 2 mg", schedule: "CII", drawer: "B2", expected: 60, onHand: 60, lastCount: 0, discrepancy: 0, custody: "Dual" },
  { id: "SII-007", name: "Adderall XR 20 mg caps", schedule: "CII", drawer: "C1", expected: 300, onHand: 300, lastCount: 4, discrepancy: 0, custody: "Dual" },
  { id: "SII-008", name: "Methylphenidate LA 40 mg", schedule: "CII", drawer: "C2", expected: 200, onHand: 200, lastCount: 2, discrepancy: 0, custody: "Dual" },
  { id: "SII-009", name: "Meperidine HCl 50 mg/mL", schedule: "CII", drawer: "D1", expected: 120, onHand: 119, lastCount: 6, discrepancy: 1, custody: "Dual" },
  { id: "SII-010", name: "Dilaudid 2 mg/mL", schedule: "CII", drawer: "D2", expected: 90, onHand: 90, lastCount: 1, discrepancy: 0, custody: "Dual" },
];

const AUDIT_EVENTS = [
  { id: "AU-3301", tick: 0, type: "DISPENSE", item: "SII-001", qty: 2, user: "R. Alvarez (PharmD)", witness: "K. Meyer (RN)" },
  { id: "AU-3302", tick: 2, type: "DISPENSE", item: "SII-005", qty: 1, user: "R. Alvarez (PharmD)", witness: "T. Brooks (PharmD)" },
  { id: "AU-3303", tick: 4, type: "CYCLE_COUNT", item: "SII-002", qty: 518, user: "J. Patel (PharmD)", witness: "M. Chen (PharmD)" },
  { id: "AU-3304", tick: 6, type: "RESTOCK", item: "SII-007", qty: 60, user: "S. Nguyen (PharmD)", witness: "K. Meyer (RN)" },
  { id: "AU-3305", tick: 8, type: "DISPENSE", item: "SII-009", qty: 1, user: "R. Alvarez (PharmD)", witness: "T. Brooks (PharmD)" },
  { id: "AU-3306", tick: 10, type: "CYCLE_COUNT", item: "SII-001", qty: 146, user: "J. Patel (PharmD)", witness: "M. Chen (PharmD)" },
  { id: "AU-3307", tick: 12, type: "DISPENSE", item: "SII-004", qty: 2, user: "S. Nguyen (PharmD)", witness: "K. Meyer (RN)" },
  { id: "AU-3308", tick: 14, type: "DISPENSE", item: "SII-005", qty: 1, user: "R. Alvarez (PharmD)", witness: "T. Brooks (PharmD)" },
  { id: "AU-3309", tick: 16, type: "RESTOCK", item: "SII-003", qty: 40, user: "J. Patel (PharmD)", witness: "M. Chen (PharmD)" },
  { id: "AU-3310", tick: 18, type: "DISPENSE", item: "SII-010", qty: 1, user: "S. Nguyen (PharmD)", witness: "K. Meyer (RN)" },
];

const EXCURSIONS = [
  { id: "EX-7711", unit: "CRYO-04", product: "Gene therapy vector lot GT-114", startTick: 4, elapsed: 22, maxTemp: -71.8, threshold: -76, ea: 118, shelfLifeDays: 730, status: "active", disposition: null },
  { id: "EX-7712", unit: "CRYO-07", product: "CAR-T product lot CT-09", startTick: 7, elapsed: 14, maxTemp: -63.5, threshold: -65, ea: 102, shelfLifeDays: 540, status: "active", disposition: null },
  { id: "EX-7713", unit: "CRYO-06", product: "Research serum pool RP-22", startTick: 10, elapsed: 45, maxTemp: -69.4, threshold: -75, ea: 88, shelfLifeDays: 1095, status: "active", disposition: null },
  { id: "EX-7714", unit: "CRYO-01", product: "mRNA vaccine lot VX-2614", startTick: 12, elapsed: 9, maxTemp: -66.2, threshold: -70, ea: 95, shelfLifeDays: 730, status: "resolved", disposition: "Released after review" },
  { id: "EX-7715", unit: "CRYO-03", product: "Plasma pool PL-31", startTick: 15, elapsed: 31, maxTemp: -72.6, threshold: -70, ea: 84, shelfLifeDays: 1095, status: "resolved", disposition: "Repurposed — non-therapeutic" },
  { id: "EX-7716", unit: "CRYO-08", product: "Vaccine run lot VX-2615", startTick: 17, elapsed: 6, maxTemp: -68.9, threshold: -65, ea: 96, shelfLifeDays: 730, status: "active", disposition: null },
  { id: "EX-7717", unit: "CRYO-02", product: "Cell therapy lot CT-11", startTick: 19, elapsed: 38, maxTemp: -74.1, threshold: -70, ea: 110, shelfLifeDays: 540, status: "resolved", disposition: "Quarantined — QA review" },
  { id: "EX-7718", unit: "CRYO-05", product: "Biobank specimen pool BB-07", startTick: 20, elapsed: 12, maxTemp: -73.9, threshold: -70, ea: 80, shelfLifeDays: 1460, status: "active", disposition: null },
];

const SEED_POINTS = 22;
const NARCOTIC_AUDITORS = ["R. Alvarez (PharmD)", "J. Patel (PharmD)", "S. Nguyen (PharmD)"];
const NARCOTIC_WITNESSES = ["K. Meyer (RN)", "T. Brooks (PharmD)", "M. Chen (PharmD)"];

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 5, amp = 1.6, lo = -40, hi = 40) =>
  series(seed, n, base, amp, { lo, hi, pull: 0.1 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);



const cryoState = (u) => {
  if (u.temp < u.rangeMin || u.temp > u.rangeMax) return "violation";
  if (u.battery !== null && u.battery < 35) return "warning";
  if (u.portable && u.co2 < 30) return "warning";
  return "nominal";
};

const rfidState = (t) => (t.tampered ? "tampered" : t.status === "read" ? "read" : "missed");

/* Arrhenius kinetic model: rate ratio vs nominal -80C storage, then
 * convert elapsed excursion time into equivalent exposure and shelf-life loss. */
const R_GAS = 8.314;
const toKelvin = (c) => c + 273.15;

const arrheniusImpact = (e) => {
  const tRef = toKelvin(-80);
  const tExc = toKelvin(Math.min(Math.max(e.maxTemp, -79), -10));
  const rateRatio = Math.exp((e.ea * 1000 / R_GAS) * (1 / tRef - 1 / tExc));
  const equivMinutes = e.elapsed * rateRatio;
  const shelfLifeMinutes = e.shelfLifeDays * 24 * 60;
  const lossPct = clamp((equivMinutes / shelfLifeMinutes) * 100, 0, 99);
  const impact = lossPct < 1 ? "low" : lossPct < 5 ? "moderate" : lossPct < 15 ? "high" : "critical";
  return { rateRatio, equivMinutes, lossPct, impact };
};

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */










function FilterChips({ value, onChange, options, allLabel = "All" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => {
        const active = value === o.key;
        const meta = o.meta || SEVERITY_META.medium;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active ? `${meta.bg} ${meta.border} ${meta.text}` : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {o.key === "all" ? allLabel : o.label}
          </button>
        );
      })}
    </div>
  );
}

const Modal = (props) => <InspectionModal {...props} accent="text-cyan-400" />;

/* ------------------------------------------------------------------ *
 *  Tab 1 - Cryo Telemetry
 * ------------------------------------------------------------------ */

function CryoTab({ units, search, filter, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      const matchesSearch = !q || [u.id, u.name, u.model, u.location].some((f) => String(f).toLowerCase().includes(q));
      const st = cryoState(u);
      const matchesFilter = filter === "all" || st === filter;
      return matchesSearch && matchesFilter;
    });
  }, [units, search, filter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <Snowflake size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No cryo assets match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or widen the state chips.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((u) => {
        const st = cryoState(u);
        const inBand = u.temp >= u.rangeMin && u.temp <= u.rangeMax;
        const series = seededSeries(u.id.length * 7 + 1, SEED_POINTS, clamp(u.temp, -90, -60), 1.1, -92, -58);
        const tone = st === "violation" ? "rose" : st === "warning" ? "amber" : "cyan";
        return (
          <button
            key={u.id}
            onClick={() => onInspect(u)}
            className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${st === "violation" ? "border-rose-500/40" : st === "warning" ? "border-amber-500/40" : "border-slate-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${u.portable ? "text-violet-400 bg-violet-500/10 border-violet-500/30" : "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"}`}>
                  {u.portable ? <Package size={16} /> : <Snowflake size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{u.name}</p>
                  <p className="text-[11px] text-slate-500">{u.id} · {u.location}</p>
                </div>
              </div>
              <StatusPill status={st} map={CRYO_STATUS} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Current temp</p>
                <p className={`text-xl font-black tabular-nums ${inBand ? "text-white" : "text-rose-400"}`}>
                  {u.temp.toFixed(1)}°C
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">CO₂ backup</p>
                <p className={`text-sm font-bold tabular-nums ${u.co2 < 30 ? "text-amber-400" : "text-slate-200"}`}>{u.co2}%</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                {u.rangeMin}°–{u.rangeMax}°C
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Temp trend · {SEED_POINTS} min</p>
              <MiniSparkline points={series} tone={tone} width={260} height={44} min={Math.min(u.rangeMin, ...series) - 2} max={Math.max(u.rangeMax, ...series) + 2} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span className={`flex items-center gap-1 ${u.battery < 35 ? "text-amber-400" : ""}`}><Battery size={11} /> {u.battery}%</span>
                <span className={`flex items-center gap-1 ${u.alarmArmed ? "text-emerald-400" : "text-slate-600"}`}>
                  {u.alarmArmed ? <Bell size={11} /> : <Bell size={11} className="opacity-40" />} {u.alarmArmed ? "Alarm armed" : "Alarm muted"}
                </span>
                <span className="flex items-center gap-1"><Boxes size={11} /> {u.occupancy}% full</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                Inspect <ChevronRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 2 - RFID Serialization
 * ------------------------------------------------------------------ */

function RfidTab({ tags, search, filter, onInspect, onReread }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tags.filter((t) => {
      const matchesSearch = !q || [t.id, t.product, t.serial, t.lot, t.zone].some((f) => String(f).toLowerCase().includes(q));
      const matchesFilter = filter === "all" || rfidState(t) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [tags, search, filter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <Radio size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No RFID tags match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or widen the state chips.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((t) => {
        const st = rfidState(t);
        return (
          <button
            key={t.id}
            onClick={() => onInspect(t)}
            className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${st === "tampered" ? "border-rose-500/40" : st === "missed" ? "border-amber-500/40" : "border-slate-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-400">
                  <Fingerprint size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t.product}</p>
                  <p className="font-mono text-[10px] text-slate-500">{t.serial}</p>
                </div>
              </div>
              <StatusPill status={st} map={RFID_STATUS} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">EPC (SGTIN-96)</p>
                <p className="font-mono text-xs font-bold text-slate-200">{t.id}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Read strength</p>
                <p className={`text-sm font-bold tabular-nums ${t.strength < -60 ? "text-amber-400" : "text-slate-200"}`}>{t.strength.toFixed(1)} dBm</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Timer size={11} /> read {t.lastRead} ticks ago</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {t.expiresInDays}d to expiry</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                {st === "missed" ? "Re-read" : "Inspect"} <ChevronRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - DSCSA Track & Trace
 * ------------------------------------------------------------------ */

function DscsaTab({ shipments, events, search, filter, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      const matchesSearch = !q || [s.id, s.product, s.lot, s.partner].some((f) => String(f).toLowerCase().includes(q));
      const matchesFilter = filter === "all" || s.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [shipments, search, filter]);

  const recent = useMemo(() => [...events].sort((a, b) => b.tick - a.tick).slice(0, 6), [events]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
            <ScanLine size={32} className="mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No serialized shipments match the current filters</p>
            <p className="mt-1 text-xs text-slate-600">Clear the search or widen the state chips.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((s) => {
              const meta = DSCSA_STATUS[s.status] || DSCSA_STATUS.commissioned;
              const epcisCount = events.filter((e) => e.shipment === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => onInspect(s)}
                  className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${s.suspect ? "border-rose-500/40" : "border-slate-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{s.product}</p>
                      <p className="font-mono text-[10px] text-slate-500">{s.id} · lot {s.lot}</p>
                    </div>
                    <StatusPill status={s.status} map={DSCSA_STATUS} />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Serialized units</p>
                      <p className="text-lg font-black tabular-nums text-white">{fmtNumber(s.qty)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">ePCIS events</p>
                      <p className="text-lg font-black tabular-nums text-slate-200">{epcisCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                      {meta.label}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Truck size={11} /> {s.partner} · {s.lastEvent}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                      Trace <ChevronRight size={13} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Database size={13} /> ePCIS event stream
        </p>
        <div className="mt-3 space-y-2">
          {recent.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.type.includes("RECEIVE") ? "bg-emerald-500" : e.type.includes("VERIFY") ? "bg-sky-500" : e.type.includes("SUSPECT") ? "bg-rose-500" : "bg-slate-500"}`} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-200">{e.type}</p>
                <p className="truncate font-mono text-[9px] text-slate-500">{e.shipment} · {e.location}</p>
              </div>
              <span className="ml-auto shrink-0 font-mono text-[9px] text-slate-600">T-{e.tick}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-snug text-slate-600">DSCSA 2023 · serialized product tracing via GS1 EPCIS 2.0 event model</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 4 - Schedule II Narcotic Vault Audit
 * ------------------------------------------------------------------ */

function VaultTab({ items, events, search, filter, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchesSearch = !q || [it.id, it.name, it.drawer].some((f) => String(f).toLowerCase().includes(q));
      const d = it.expected - it.onHand;
      const matchesFilter = filter === "all" || (d === 0 ? "balanced" : "discrepancy") === filter;
      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const recent = useMemo(() => [...events].sort((a, b) => b.tick - a.tick).slice(0, 6), [events]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
            <Lock size={32} className="mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No vault items match the current filters</p>
            <p className="mt-1 text-xs text-slate-600">Clear the search or widen the state chips.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((it) => {
              const d = it.expected - it.onHand;
              const st = d === 0 ? "balanced" : "discrepancy";
              return (
                <button
                  key={it.id}
                  onClick={() => onInspect(it)}
                  className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${st === "discrepancy" ? "border-rose-500/40" : "border-slate-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-violet-400">
                        <Syringe size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{it.name}</p>
                        <p className="text-[11px] text-slate-500">{it.id} · Drawer {it.drawer}</p>
                      </div>
                    </div>
                    <StatusPill status={st} map={VAULT_STATUS} />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Expected</p>
                      <p className="text-lg font-black tabular-nums text-white">{fmtNumber(it.expected)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">On hand</p>
                      <p className={`text-lg font-black tabular-nums ${d === 0 ? "text-slate-200" : "text-rose-400"}`}>{fmtNumber(it.onHand)}</p>
                    </div>
                    <div className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${d === 0 ? "border-slate-700 bg-slate-800 text-slate-300" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                      {d === 0 ? "Balanced" : `${d} short`}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Users size={11} /> {it.custody} custody · counted {it.lastCount} ticks ago
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                      Audit <ChevronRight size={13} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Archive size={13} /> Audit trail
        </p>
        <div className="mt-3 space-y-2">
          {recent.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.type === "DISPENSE" ? "bg-rose-500" : e.type === "CYCLE_COUNT" ? "bg-sky-500" : "bg-emerald-500"}`} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-200">{e.type} · {e.item}</p>
                <p className="truncate text-[9px] text-slate-500">{e.user} + {e.witness}</p>
              </div>
              <span className="ml-auto shrink-0 font-mono text-[9px] text-slate-600">T-{e.tick}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-snug text-slate-600">DEA Schedule II · dual-custody dispense log with pharmacist + witness sign-off</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 5 - Arrhenius Thermal Excursion Kinetics
 * ------------------------------------------------------------------ */

function ArrheniusTab({ excursions, search, filter, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return excursions.filter((e) => {
      const matchesSearch = !q || [e.id, e.unit, e.product].some((f) => String(f).toLowerCase().includes(q));
      const impact = arrheniusImpact(e).impact;
      const matchesFilter = filter === "all" || impact === filter;
      return matchesSearch && matchesFilter;
    });
  }, [excursions, search, filter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <FlaskConical size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No excursion events match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or widen the impact chips.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((e) => {
        const model = arrheniusImpact(e);
        const series = seededSeries(e.id.length * 3 + 1, SEED_POINTS, clamp(e.maxTemp, -85, -55), 2.2, -90, -45);
        const tone = model.impact === "critical" ? "rose" : model.impact === "high" ? "amber" : model.impact === "moderate" ? "sky" : "emerald";
        return (
          <button
            key={e.id}
            onClick={() => onInspect(e)}
            className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${model.impact === "critical" ? "border-rose-500/40" : model.impact === "high" ? "border-amber-500/40" : "border-slate-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${e.status === "active" ? "text-amber-400 bg-amber-500/10 border-amber-500/30" : "text-slate-400 bg-slate-500/10 border-slate-500/30"}`}>
                  <Thermometer size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{e.product}</p>
                  <p className="text-[11px] text-slate-500">{e.id} · {e.unit} · {e.status === "active" ? "in progress" : "resolved"}</p>
                </div>
              </div>
              <StatusPill status={model.impact} map={IMPACT_META} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Peak temp</p>
                <p className={`text-xl font-black tabular-nums ${model.impact === "critical" || model.impact === "high" ? "text-rose-400" : "text-white"}`}>
                  {e.maxTemp.toFixed(1)}°C
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Elapsed</p>
                <p className="text-lg font-black tabular-nums text-slate-200">{e.elapsed} min</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                Ea {e.ea} kJ/mol
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Excursion profile</p>
              <MiniSparkline points={series} tone={tone} width={260} height={44} min={-90} max={-40} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <FlaskConical size={11} /> shelf-life loss {model.lossPct.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                Kinetics <ChevronRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function ColdChainCommandHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("cryo");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [units, setUnits] = useState(CRYO_FREEZERS);
  const [tags, setTags] = useState(RFID_ITEMS);
  const [shipments, setShipments] = useState(SHIPMENTS);
  const [events, setEvents] = useState(EPICS_EVENTS);
  const [vaultItems, setVaultItems] = useState(VAULT_ITEMS);
  const [audit, setAudit] = useState(AUDIT_EVENTS);
  const [excursions, setExcursions] = useState(EXCURSIONS);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9500);
  const eventRef = useRef(9060);
  const auditRef = useRef(3311);
  const excursionRef = useRef(7719);
  const itemsRef = useRef({ units, tags, shipments, vaultItems, excursions });
  useEffect(() => {
    itemsRef.current = { units, tags, shipments, vaultItems, excursions };
  }, [units, tags, shipments, vaultItems, excursions]);



  /* Live command-station simulation loop. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      // Cryo telemetry: temperatures drift; battery and CO2 deplete.
      setUnits((prev) =>
        prev.map((u) => {
          const midpoint = u.rangeMin + (u.rangeMax - u.rangeMin) / 2;
          const next = round1(jitter(u.temp, 0.5, u.rangeMin - 8, u.rangeMax + 8));
          const pulled = round1(next + (midpoint - next) * 0.1);
          return {
            ...u,
            temp: pulled,
            humidity: Math.round(jitter(u.humidity, 2, 15, 60)),
            co2: Math.max(0, Math.round(u.co2 - 0.15)),
            battery: Math.max(0, Math.round(u.battery - 0.25)),
          };
        })
      );

      // RFID reads: strength jitters, occasionally a tag is missed.
      setTags((prev) =>
        prev.map((t) => ({
          ...t,
          strength: round1(jitter(t.strength, 2.5, -80, -40)),
          lastRead: t.status === "read" ? t.lastRead + 1 : t.lastRead,
        }))
      );

      // DSCSA shipments progress through ePCIS events.
      setShipments((prev) =>
        prev.map((s) => {
          if (s.status === "shipped") return { ...s, status: "in-transit", lastEvent: "SHIPMENT_DISPATCH" };
          if (s.status === "in-transit" && s.arriveTick !== undefined && tick >= s.arriveTick) {
            return { ...s, status: "received", lastEvent: "OBJECT_EVENT_RECEIVE", arriveTick: null };
          }
          return s;
        })
      );

      // Vault: occasional dispense draws down on-hand stock.
      setVaultItems((prev) =>
        prev.map((it) => (Math.random() < 0.04 ? { ...it, onHand: Math.max(0, it.onHand - 1) } : it))
      );

      // Excursions accumulate elapsed time for kinetic modelling.
      setExcursions((prev) =>
        prev.map((e) => (e.status === "active" ? { ...e, elapsed: e.elapsed + 1 } : e))
      );

      // --- Random alert events -------------------------------------
      const ref = itemsRef.current;

      // Cryo excursion alert.
      if (Math.random() < 0.07 && ref.units.length > 0) {
        const u = ref.units[Math.floor(Math.random() * ref.units.length)];
        const st = cryoState(u);
        if (st === "violation") {
          pushToast(`Cryo excursion — ${u.name}`, `${u.id} reading ${u.temp.toFixed(1)}°C outside ${u.rangeMin}–${u.rangeMax}°C band`, "critical");
        } else if (u.battery < 25 && u.alarmArmed) {
          pushToast(`Backup power low — ${u.name}`, `${u.id} backup battery at ${u.battery}% · CO2 reserve ${u.co2}%`, "high");
        }
      }

      // RFID tamper / persistent miss alert.
      if (Math.random() < 0.06 && ref.tags.length > 0) {
        const t = ref.tags[Math.floor(Math.random() * ref.tags.length)];
        if (t.tampered) {
          pushToast(`RFID tamper — ${t.product}`, `${t.serial} tag integrity check failed · quarantine drawer ${t.zone}`, "critical");
        } else if (rfidState(t) === "missed") {
          pushToast(`Tag out of read range — ${t.product}`, `${t.serial} missed ${t.lastRead} consecutive reads`, "high");
        }
      }

      // DSCSA suspect product alert.
      if (Math.random() < 0.05 && ref.shipments.length > 0) {
        const s = ref.shipments[Math.floor(Math.random() * ref.shipments.length)];
        if (s.suspect) {
          pushToast(`Suspect product — ${s.id}`, `${s.product} (lot ${s.lot}) flagged · verification hold active`, "critical");
        }
      }

      // Vault discrepancy alert.
      if (Math.random() < 0.05 && ref.vaultItems.length > 0) {
        const it = ref.vaultItems[Math.floor(Math.random() * ref.vaultItems.length)];
        const d = it.expected - it.onHand;
        if (d > 0) {
          pushToast(`Vault discrepancy — ${it.name}`, `${it.id} expected ${it.expected}, found ${it.onHand} · ${d} unaccounted`, "high");
        }
      }

      // New kinetic excursion event.
      if (Math.random() < 0.06 && ref.units.length > 0) {
        const u = ref.units[Math.floor(Math.random() * ref.units.length)];
        const maxTemp = round1(jitter(u.rangeMax + 4, 3, u.rangeMax + 1, -40));
        const ex = {
          id: `EX-${excursionRef.current++}`,
          unit: u.id,
          product: `${u.name} stored lot`,
          startTick: tick + 1,
          elapsed: 1,
          maxTemp,
          threshold: u.rangeMax,
          ea: 80 + Math.round(Math.random() * 40),
          shelfLifeDays: 730,
          status: "active",
          disposition: null,
        };
        setExcursions((prev) => [ex, ...prev].slice(0, 14));
        pushToast(`Thermal excursion — ${u.name}`, `${ex.id} peaked at ${maxTemp.toFixed(1)}°C · kinetic impact modelling started`, "medium");
      }
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, tick, units, tags, shipments, vaultItems, excursions, pushToast]);

  const resetSimulation = useCallback(() => {
    setUnits(CRYO_FREEZERS.map((u) => ({ ...u })));
    setTags(RFID_ITEMS.map((t) => ({ ...t })));
    setShipments(SHIPMENTS.map((s) => ({ ...s })));
    setEvents(EPICS_EVENTS.map((e) => ({ ...e })));
    setVaultItems(VAULT_ITEMS.map((v) => ({ ...v })));
    setAudit(AUDIT_EVENTS.map((a) => ({ ...a })));
    setExcursions(EXCURSIONS.map((e) => ({ ...e })));
    setTick(20);
    setInspect(null);
    pushToast("Command station reset", "Cryo, RFID, DSCSA, vault and kinetics restored to baseline", "medium");
  }, [pushToast]);

  const handleReread = useCallback((tagId) => {
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, status: "read", lastRead: 0, tampered: false, strength: round1(-42 - Math.random() * 12) } : t))
    );
    pushToast("Tag re-read requested", `${tagId} interrogated at 4 W EIRP · response captured`, "low");
  }, [pushToast]);

  const handleVerify = useCallback((shipmentId) => {
    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, status: "verified", suspect: false, lastEvent: "OBJECT_EVENT_VERIFY" } : s))
    );
    setEvents((prev) => [
      ...prev,
      { id: `EV-${eventRef.current++}`, tick, type: "OBJECT_EVENT_VERIFY", shipment: shipmentId, location: "MedTrack Pharmacy", partner: "MedTrack" },
    ]);
    pushToast("Serial verification complete", `${shipmentId} matched against manufacturer transaction data`, "low");
  }, [tick, pushToast]);

  const handleSuspect = useCallback((shipmentId) => {
    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, status: "suspect", suspect: true, lastEvent: "SUSPECT_PRODUCT_HOLD" } : s))
    );
    setEvents((prev) => [
      ...prev,
      { id: `EV-${eventRef.current++}`, tick, type: "SUSPECT_PRODUCT_HOLD", shipment: shipmentId, location: "MedTrack Pharmacy", partner: "MedTrack" },
    ]);
    pushToast("Suspect product hold", `${shipmentId} quarantined pending DSCSA verification`, "critical");
  }, [tick, pushToast]);

  const handleCycleCount = useCallback((itemId) => {
    setVaultItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, onHand: it.expected, discrepancy: 0, lastCount: 0 } : it))
    );
    setAudit((prev) => [
      { id: `AU-${auditRef.current++}`, tick, type: "CYCLE_COUNT", item: itemId, qty: 0, user: NARCOTIC_AUDITORS[0], witness: NARCOTIC_WITNESSES[0] },
      ...prev,
    ]);
    pushToast("Cycle count posted", `${itemId} recount balanced · dual-custody sign-off recorded`, "low");
  }, [tick, pushToast]);

  const handleDisposition = useCallback((excursionId) => {
    setExcursions((prev) =>
      prev.map((e) => (e.id === excursionId ? { ...e, status: "resolved", disposition: "QA disposition review" } : e))
    );
    pushToast("Disposition review requested", `${excursionId} routed to QA · kinetic report attached`, "medium");
  }, [pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "rfid" ? tags : activeTab === "dscsa" ? shipments : activeTab === "vault" ? vaultItems : activeTab === "arrhenius" ? excursions : units;
    const header = activeTab === "rfid"
      ? ["epc", "product", "serial", "lot", "zone", "status", "strength", "lastRead", "tampered"]
      : activeTab === "dscsa"
        ? ["id", "product", "lot", "qty", "status", "partner", "lastEvent", "suspect"]
        : activeTab === "vault"
          ? ["id", "name", "schedule", "drawer", "expected", "onHand", "discrepancy", "custody"]
          : activeTab === "arrhenius"
            ? ["id", "unit", "product", "startTick", "elapsed", "maxTemp", "ea", "lossPct", "impact"]
            : ["id", "name", "model", "location", "temp", "rangeMin", "rangeMax", "humidity", "co2", "battery", "status"];
    downloadCsv(`medtrack-cold-chain-${activeTab}-${Date.now()}.csv`, [
      header,
      ...rows.map((r) =>
        (activeTab === "rfid"
          ? [r.id, r.product, r.serial, r.lot, r.zone, rfidState(r), r.strength.toFixed(1), r.lastRead, r.tampered]
          : activeTab === "dscsa"
            ? [r.id, r.product, r.lot, r.qty, r.status, r.partner, r.lastEvent, r.suspect]
            : activeTab === "vault"
              ? [r.id, r.name, r.schedule, r.drawer, r.expected, r.onHand, r.expected - r.onHand, r.custody]
              : activeTab === "arrhenius"
                ? [r.id, r.unit, r.product, r.startTick, r.elapsed, r.maxTemp, r.ea, arrheniusImpact(r).lossPct.toFixed(1), arrheniusImpact(r).impact]
                : [r.id, r.name, r.model, r.location, r.temp, r.rangeMin, r.rangeMax, r.humidity, r.co2, r.battery, cryoState(r)]
        )
      ),
    ]);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, units, tags, shipments, vaultItems, excursions, pushToast]);

  const stats = useMemo(() => {
    const excursionsActive = units.filter((u) => cryoState(u) === "violation").length;
    const tagsOut = tags.filter((t) => rfidState(t) !== "read").length;
    const suspect = shipments.filter((s) => s.suspect).length;
    const discrepancies = vaultItems.filter((it) => it.expected - it.onHand !== 0).length;
    const kinetic = excursions.filter((e) => arrheniusImpact(e).impact === "high" || arrheniusImpact(e).impact === "critical").length;
    return { excursionsActive, tagsOut, suspect, discrepancies, kinetic };
  }, [units, tags, shipments, vaultItems, excursions]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  const FILTER_OPTIONS = {
    cryo: [
      { key: "all", label: "All states" },
      { key: "nominal", label: "Nominal", meta: SEVERITY_META.low },
      { key: "warning", label: "Warning", meta: SEVERITY_META.high },
      { key: "violation", label: "Excursion", meta: SEVERITY_META.critical },
    ],
    rfid: [
      { key: "all", label: "All tags" },
      { key: "read", label: "Read", meta: SEVERITY_META.low },
      { key: "missed", label: "Missed", meta: SEVERITY_META.high },
      { key: "tampered", label: "Tampered", meta: SEVERITY_META.critical },
    ],
    dscsa: [
      { key: "all", label: "All shipments" },
      { key: "verified", label: "Verified", meta: SEVERITY_META.low },
      { key: "received", label: "Received", meta: SEVERITY_META.low },
      { key: "in-transit", label: "In transit", meta: SEVERITY_META.medium },
      { key: "suspect", label: "Suspect", meta: SEVERITY_META.critical },
    ],
    vault: [
      { key: "all", label: "All items" },
      { key: "balanced", label: "Balanced", meta: SEVERITY_META.low },
      { key: "discrepancy", label: "Discrepancy", meta: SEVERITY_META.critical },
    ],
    arrhenius: [
      { key: "all", label: "All impacts" },
      { key: "low", label: "Low", meta: SEVERITY_META.low },
      { key: "moderate", label: "Moderate", meta: SEVERITY_META.medium },
      { key: "high", label: "High", meta: SEVERITY_META.high },
      { key: "critical", label: "Critical", meta: SEVERITY_META.critical },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400 shadow-lg shadow-cyan-500/10">
                <Snowflake size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Pharmaceutical Cold-Chain &amp; Med-Supply Chain</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} livePrefix="Simulating · tick #" />
                  <span className="text-slate-600">·</span>
                  <span>Cryo Telemetry · RFID · DSCSA 2023 · Vault · Kinetics</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlaybackControls
              playing={playing}
              onToggle={() => setPlaying((p) => !p)}
              speed={speed}
              onSpeedChange={setSpeed}
              onReset={resetSimulation}
            />
            <ExportButton onClick={handleExport} exporting={exporting} accent="cyan" />
          </div>
        </div>

        {/* ---------- Stat row ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Snowflake} label="Cryo excursions" value={stats.excursionsActive} sub={`of ${units.length} monitored units`} tone="rose" />
          <StatCard icon={Radio} label="Tags out of range" value={stats.tagsOut} sub={`of ${tags.length} serialized tags`} tone="amber" />
          <StatCard icon={ShieldAlert} label="Suspect products" value={stats.suspect} sub={`of ${shipments.length} traced shipments`} tone="rose" />
          <StatCard icon={FlaskConical} label="High-impact excursions" value={stats.kinetic} sub="kinetic shelf-life impact" tone="violet" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="cyan" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} accent="cyan" />
              <FilterChips
                value={filter}
                onChange={setFilter}
                options={FILTER_OPTIONS[activeTab] || FILTER_OPTIONS.cryo}
                allLabel="All"
              />
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "cryo" && <CryoTab units={units} search={search} filter={filter} onInspect={setInspect} />}
            {activeTab === "rfid" && <RfidTab tags={tags} search={search} filter={filter} onInspect={setInspect} onReread={handleReread} />}
            {activeTab === "dscsa" && <DscsaTab shipments={shipments} events={events} search={search} filter={filter} onInspect={setInspect} />}
            {activeTab === "vault" && <VaultTab items={vaultItems} events={audit} search={search} filter={filter} onInspect={setInspect} />}
            {activeTab === "arrhenius" && <ArrheniusTab excursions={excursions} search={search} filter={filter} onInspect={setInspect} />}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modals ---------- */}
      {inspect && (
        (() => {
          if (inspect.rangeMin !== undefined) {
            const u = inspect;
            const st = cryoState(u);
            const series = seededSeries(u.id.length * 7 + 1, SEED_POINTS, clamp(u.temp, -90, -60), 1.1, -92, -58);
            return (
              <Modal open onClose={() => setInspect(null)} title={u.name} subtitle={`${u.id} · ${u.location}`} icon={Snowflake} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={st} map={CRYO_STATUS} />
                    <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{u.portable ? "Portable dry shipper" : "Ultra-low −80°C freezer"}</span>
                    {u.lastExcursion && <span className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400"><AlertTriangle size={11} /> Last excursion {u.lastExcursion}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Thermometer size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${u.temp < u.rangeMin || u.temp > u.rangeMax ? "text-rose-400" : "text-white"}`}>{u.temp.toFixed(1)}°C</p>
                      <p className="text-[10px] text-slate-500">Temp</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Cloud size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.humidity}%</p>
                      <p className="text-[10px] text-slate-500">Humidity</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Wind size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${u.co2 < 30 ? "text-amber-400" : "text-white"}`}>{u.co2}%</p>
                      <p className="text-[10px] text-slate-500">CO₂ reserve</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Battery size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${u.battery < 35 ? "text-amber-400" : "text-white"}`}>{u.battery}%</p>
                      <p className="text-[10px] text-slate-500">Backup battery</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Temperature band & trend</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <MiniSparkline points={series} tone={st === "violation" ? "rose" : st === "warning" ? "amber" : "cyan"} width={560} height={56} min={u.rangeMin - 4} max={u.rangeMax + 4} />
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>min {u.rangeMin}°C</span>
                        <span className="text-slate-600">storage band</span>
                        <span>max {u.rangeMax}°C</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Model" value={u.model} />
                    <InfoRow label="Location" value={u.location} />
                    <InfoRow label="Occupancy" value={`${u.occupancy}% of capacity`} />
                    <InfoRow label="Last calibration" value={u.lastCalibrated} mono />
                    <InfoRow label="Data logger" value={`${u.id}-LOG · 5-min cadence`} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20">
                      <Bell size={14} /> {u.alarmArmed ? "Alarm armed" : "Arm alarm"}
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Excursion log
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.product !== undefined && inspect.zone !== undefined) {
            const t = inspect;
            const st = rfidState(t);
            return (
              <Modal open onClose={() => setInspect(null)} title={t.product} subtitle={`${t.serial} · ${t.lot}`} icon={Radio} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={st} map={RFID_STATUS} />
                    {t.tampered && <span className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400"><AlertTriangle size={11} /> Tamper flag set</span>}
                    <span className="text-[11px] text-slate-500">{t.expiresInDays}d to expiry</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Fingerprint size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black font-mono text-white">{t.id.slice(0, 12)}</p>
                      <p className="text-[10px] text-slate-500">EPC prefix</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Gauge size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${t.strength < -60 ? "text-amber-400" : "text-white"}`}>{t.strength.toFixed(1)}</p>
                      <p className="text-[10px] text-slate-500">dBm</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Timer size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{t.lastRead}</p>
                      <p className="text-[10px] text-slate-500">Ticks since read</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Zap size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black text-white">4 W</p>
                      <p className="text-[10px] text-slate-500">Interrogation</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="SGTIN-96 serial" value={t.serial} mono />
                    <InfoRow label="Lot / batch" value={t.lot} mono />
                    <InfoRow label="Storage zone" value={t.zone} />
                    <InfoRow label="Last successful read" value={t.lastRead === 0 ? "current tick" : `${t.lastRead} ticks ago`} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button onClick={() => handleReread(t.id)} className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20">
                      <Radio size={14} /> Re-read tag
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Layers size={14} /> Read history
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.qty !== undefined) {
            const s = inspect;
            const meta = DSCSA_STATUS[s.status] || DSCSA_STATUS.commissioned;
            const sEvents = events.filter((e) => e.shipment === s.id);
            const progress = s.status === "verified" ? 100 : s.status === "received" ? 82 : s.status === "in-transit" ? 55 : s.status === "shipped" ? 30 : 12;
            return (
              <Modal open onClose={() => setInspect(null)} title={s.product} subtitle={`${s.id} · lot ${s.lot}`} icon={ScanLine} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={s.status} map={DSCSA_STATUS} />
                    {s.suspect && <Badge tone="critical">Suspect product hold</Badge>}
                    <span className="text-[11px] text-slate-500">{fmtNumber(s.qty)} serialized units · {s.partner}</span>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tracing pipeline</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <ProgressBar pct={progress} tone={s.suspect ? "rose" : s.status === "verified" ? "emerald" : "sky"} />
                      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                        <span>Commissioned</span><span>Shipped</span><span>In transit</span><span>Received</span><span>Verified</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">ePCIS event chain ({sEvents.length})</p>
                    <div className="space-y-1.5">
                      {sEvents.slice(-6).reverse().map((e) => (
                        <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                          <span className="text-[11px] font-semibold text-slate-200">{e.type}</span>
                          <span className="font-mono text-[10px] text-slate-500">{e.location}</span>
                          <span className="font-mono text-[10px] text-slate-600">T-{e.tick}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Trading partner" value={s.partner} />
                    <InfoRow label="Last event" value={s.lastEvent} mono />
                    <InfoRow label="Serialized units" value={fmtNumber(s.qty)} mono />
                    <InfoRow label="Verification status" value={s.status === "verified" ? "Passed — matched manufacturer data" : s.suspect ? "Hold — suspect product" : "Pending"} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    {s.status !== "verified" && !s.suspect && (
                      <button onClick={() => handleVerify(s.id)} className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20">
                        <CheckCircle2 size={14} /> Verify serial
                      </button>
                    )}
                    {!s.suspect && (
                      <button onClick={() => handleSuspect(s.id)} className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20">
                        <ShieldAlert size={14} /> Flag suspect
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Transaction history
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.drawer !== undefined) {
            const it = inspect;
            const d = it.expected - it.onHand;
            const itEvents = audit.filter((e) => e.item === it.id);
            return (
              <Modal open onClose={() => setInspect(null)} title={it.name} subtitle={`${it.id} · Drawer ${it.drawer}`} icon={Lock} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={d === 0 ? "balanced" : "discrepancy"} map={VAULT_STATUS} />
                    <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400"><Lock size={11} /> DEA Schedule {it.schedule}</span>
                    <span className="text-[11px] text-slate-500">{it.custody} custody</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Boxes size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{fmtNumber(it.expected)}</p>
                      <p className="text-[10px] text-slate-500">Expected</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Archive size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${d === 0 ? "text-white" : "text-rose-400"}`}>{fmtNumber(it.onHand)}</p>
                      <p className="text-[10px] text-slate-500">On hand</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Hash size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${d === 0 ? "text-emerald-400" : "text-rose-400"}`}>{d === 0 ? "0" : `−${d}`}</p>
                      <p className="text-[10px] text-slate-500">Variance</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Timer size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{it.lastCount}</p>
                      <p className="text-[10px] text-slate-500">Ticks since count</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent audit entries</p>
                    <div className="space-y-1.5">
                      {itEvents.slice(-5).reverse().map((e) => (
                        <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                          <span className="text-[11px] font-semibold text-slate-200">{e.type}</span>
                          <span className="truncate text-[10px] text-slate-500">{e.user} + {e.witness}</span>
                          <span className="font-mono text-[10px] text-slate-600">T-{e.tick}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button onClick={() => handleCycleCount(it.id)} className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20">
                      <CheckCircle2 size={14} /> Start cycle count
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Users size={14} /> Custody chain
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const e = inspect;
          const model = arrheniusImpact(e);
          const series = seededSeries(e.id.length * 3 + 1, SEED_POINTS, clamp(e.maxTemp, -85, -55), 2.2, -90, -45);
          return (
            <Modal open onClose={() => setInspect(null)} title={e.product} subtitle={`${e.id} · ${e.unit}`} icon={FlaskConical} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={model.impact} map={IMPACT_META} />
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${e.status === "active" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
                    {e.status === "active" ? "In progress" : "Resolved"}
                  </span>
                  {e.disposition && <span className="text-[11px] text-slate-500">{e.disposition}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Thermometer size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{e.maxTemp.toFixed(1)}°C</p>
                    <p className="text-[10px] text-slate-500">Peak temp</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Timer size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{e.elapsed} min</p>
                    <p className="text-[10px] text-slate-500">Duration</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <Zap size={14} className="mx-auto text-slate-500" />
                    <p className="mt-1 text-lg font-black tabular-nums text-white">{model.rateRatio.toFixed(0)}×</p>
                    <p className="text-[10px] text-slate-500">Rate ratio</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                    <FlaskConical size={14} className="mx-auto text-slate-500" />
                    <p className={`mt-1 text-lg font-black tabular-nums ${model.impact === "critical" || model.impact === "high" ? "text-rose-400" : "text-white"}`}>{model.lossPct.toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-500">Shelf-life loss</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Excursion profile</p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <MiniSparkline points={series} tone={model.impact === "critical" ? "rose" : model.impact === "high" ? "amber" : model.impact === "moderate" ? "sky" : "emerald"} width={560} height={56} min={-90} max={-40} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Activation energy (Ea)" value={`${e.ea} kJ/mol`} mono />
                  <InfoRow label="Nominal storage" value="-80°C (193.15 K)" mono />
                  <InfoRow label="Equivalent exposure" value={`${model.equivMinutes < 1000 ? `${Math.round(model.equivMinutes)} min` : `${(model.equivMinutes / 60).toFixed(1)} hr`} at −80°C`} />
                  <InfoRow label="Label shelf life" value={`${e.shelfLifeDays} days`} mono />
                  <InfoRow label="Threshold exceeded" value={`${e.threshold}°C`} mono />
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                  Arrhenius model: k ∝ exp(−Ea/RT). The rate ratio of the excursion temperature relative to −80°C storage is {model.rateRatio.toFixed(0)}×, converting {e.elapsed} minutes of excursion into {model.equivMinutes < 1000 ? `${Math.round(model.equivMinutes)} minutes` : `${(model.equivMinutes / 60).toFixed(1)} hours`} of equivalent −80°C exposure — a {model.lossPct.toFixed(1)}% draw against remaining shelf life.
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button onClick={() => handleDisposition(e.id)} disabled={e.status === "resolved"} className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-50">
                    <ShieldCheck size={14} /> {e.status === "resolved" ? "Disposition posted" : "Request disposition review"}
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <FileText size={14} /> Kinetic report
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()
      )}

      {/* ---------- Footer strip ---------- */}
      <div className="border-t border-slate-800/60 bg-slate-950 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-[11px] text-slate-600 sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5">
            <Snowflake size={12} className="text-cyan-500" />
            Simulated cold chain &amp; med-supply operations · no PHI · 21 CFR 11-aligned audit trails
          </p>
          <p className="flex items-center gap-1.5">
            <ScanLine size={12} /> DSCSA 2023 serialized tracing · DEA Schedule II double-counted
          </p>
        </div>
      </div>
    </div>
  );
}
