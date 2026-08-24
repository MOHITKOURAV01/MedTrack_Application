import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Battery, Bell, Boxes,
  CheckCircle2, ChevronRight, Clock, Cloud, Cpu, Download, Droplets, FileText,
  Filter, FlaskConical, Gauge, HeartPulse, Info, Layers, Lock, Package, Pause,
  Phone, Play, Plus, Power, RefreshCw, Search, Server, ShieldCheck, ShoppingCart,
  Siren, Snowflake, Syringe, Thermometer, Timer, Truck, User, Users, Warehouse,
  Wind, Wrench, X, Zap
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
import { SeverityChips } from "../../components/common/SeverityChips";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { StatusPill } from "../../components/common/StatusPill";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Pharmacy & Med-Supply Chain Hub
 *  ------------------------------------------------------------------
 *  Three consoles for pharmaceutical operations:
 *    1. Cold-Chain Sensors   - live temperature/humidity telemetry across
 *                              fridges, freezers, cold rooms and transport
 *                              shippers, with excursion tracking.
 *    2. Inventory Lifecycle  - on-hand vs par levels, lot/batch expiry,
 *                              ABC classification, stockout risk and
 *                              one-click replenishment ordering.
 *    3. Orders & Fulfillment - purchase-order pipeline from draft through
 *                              approval, placement, transit and receiving.
 *
 *  The supply chain simulates client-side: temperatures drift toward their
 *  storage ranges, excursions fire, stock depletes with demand, shipments
 *  arrive and restock shelves.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const STORAGE_META = {
  Fridge: { icon: Thermometer, tone: "text-sky-400 bg-sky-500/10 border-sky-500/30", label: "Refrigerated 2–8°C" },
  Freezer: { icon: Snowflake, tone: "text-violet-400 bg-violet-500/10 border-violet-500/30", label: "Frozen −25°C" },
  "Cold Room": { icon: Warehouse, tone: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", label: "Walk-in cold room" },
  Shipper: { icon: Truck, tone: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Transport shipper" },
};

const STATUS_META = {
  nominal: { label: "Nominal", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  warning: { label: "Warning", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  violation: { label: "Excursion", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const ORDER_STATUS_META = {
  draft: { label: "Draft", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  approved: { label: "Approved", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  placed: { label: "Placed", cls: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  "in-transit": { label: "In Transit", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  received: { label: "Received", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};

const TABS = [
  { key: "coldchain", label: "Cold-Chain Sensors", icon: Snowflake, blurb: "Live temperature & humidity telemetry with excursion tracking" },
  { key: "inventory", label: "Inventory Lifecycle", icon: Boxes, blurb: "On-hand vs par, lot expiry, ABC class & stockout risk" },
  { key: "orders", label: "Orders & Fulfillment", icon: ShoppingCart, blurb: "PO pipeline from draft through approval, transit & receiving" },
];

const COLD_STORAGE = [
  { id: "CS-FR-01", name: "Pharmacy Fridge A", type: "Fridge", location: "Main Pharmacy · Bay 1", model: "Helmer Horizon HX-111", temp: 4.2, humidity: 38, rangeMin: 2, rangeMax: 8, occupancy: 82, alarmArmed: true, battery: null, lastCalibrated: "2026-06-02", lastExcursion: null },
  { id: "CS-FR-02", name: "Vaccine Fridge B", type: "Fridge", location: "Immunization Suite", model: "Helmer Horizon HX-131", temp: 3.6, humidity: 34, rangeMin: 2, rangeMax: 8, occupancy: 71, alarmArmed: true, battery: null, lastCalibrated: "2026-05-19", lastExcursion: null },
  { id: "CS-FR-03", name: "ICU Meds Fridge", type: "Fridge", location: "ICU West · Annex", model: "Philips FridgeLine PL-40", temp: 8.9, humidity: 52, rangeMin: 2, rangeMax: 8, occupancy: 64, alarmArmed: true, battery: null, lastCalibrated: "2026-04-11", lastExcursion: "2026-07-30 03:12" },
  { id: "CS-FRZ-01", name: "Deep Freezer 1", type: "Freezer", location: "Main Pharmacy · Bay 3", model: "Thermo TSX Series", temp: -19.4, humidity: 44, rangeMin: -25, rangeMax: -15, occupancy: 58, alarmArmed: true, battery: null, lastCalibrated: "2026-06-28", lastExcursion: null },
  { id: "CS-FRZ-02", name: "Plasma Freezer 2", type: "Freezer", location: "Blood Bank Annex", model: "Thermo TSX Series", temp: -29.2, humidity: 41, rangeMin: -35, rangeMax: -25, occupancy: 77, alarmArmed: true, battery: null, lastCalibrated: "2026-05-30", lastExcursion: null },
  { id: "CS-FRZ-03", name: "Lab Freezer", type: "Freezer", location: "Research Lab 2", model: "Sanyo MDF-U3386S", temp: -22.1, humidity: 39, rangeMin: -30, rangeMax: -20, occupancy: 43, alarmArmed: false, battery: null, lastCalibrated: "2026-03-15", lastExcursion: "2026-08-02 22:47" },
  { id: "CS-CR-01", name: "Main Cold Room", type: "Cold Room", location: "Goods Receiving · North", model: "Bally Walk-in", temp: 5.1, humidity: 62, rangeMin: 2, rangeMax: 8, occupancy: 88, alarmArmed: true, battery: null, lastCalibrated: "2026-07-12", lastExcursion: null },
  { id: "CS-CR-02", name: "Pathology Cold Room", type: "Cold Room", location: "Pathology · Level 2", model: "Bally Walk-in", temp: 4.6, humidity: 58, rangeMin: 2, rangeMax: 8, occupancy: 69, alarmArmed: true, battery: null, lastCalibrated: "2026-06-20", lastExcursion: null },
  { id: "CS-SH-01", name: "Shipper — Vaccine Run 41", type: "Shipper", location: "In transit · Route 12", model: "ThermoSafe Kodiak 4", temp: 7.8, humidity: 46, rangeMin: 2, rangeMax: 8, occupancy: 100, alarmArmed: true, battery: 68, lastCalibrated: "2026-08-10", lastExcursion: null },
  { id: "CS-SH-02", name: "Shipper — Meropenem Batch", type: "Shipper", location: "Dock 3 · Awaiting check-in", model: "ThermoSafe Kodiak 6", temp: 9.4, humidity: 55, rangeMin: 2, rangeMax: 8, occupancy: 100, alarmArmed: true, battery: 41, lastCalibrated: "2026-08-09", lastExcursion: "2026-08-11 14:20" },
];

const INVENTORY = [
  { id: "ITM-1041", name: "Insulin glargine 100 U/mL", ndc: "00088-2220-33", category: "Endocrine", form: "Vial 10mL", storage: "Refrigerated", controlled: "None", unitCost: 34.8, onHand: 240, parLevel: 300, reorderPoint: 80, demandPerDay: 14, abc: "A", lots: [{ lot: "LG-2607", qty: 120, expiresInDays: 88 }, { lot: "LG-2609", qty: 120, expiresInDays: 214 }] },
  { id: "ITM-1042", name: "Meropenem 1 g powder", ndc: "00338-0727-01", category: "Anti-infective", form: "Vial 1g", storage: "Controlled Room Temp", controlled: "None", unitCost: 19.5, onHand: 36, parLevel: 120, reorderPoint: 45, demandPerDay: 9, abc: "A", lots: [{ lot: "MP-2611", qty: 36, expiresInDays: 32 }] },
  { id: "ITM-1043", name: "Morphine sulfate 10 mg/mL", ndc: "0406-0510-01", category: "Controlled · Schedule II", form: "Ampule 1mL", storage: "Controlled Room Temp", controlled: "Schedule II", unitCost: 4.1, onHand: 190, parLevel: 220, reorderPoint: 60, demandPerDay: 5, abc: "B", lots: [{ lot: "MS-2608", qty: 90, expiresInDays: 141 }, { lot: "MS-2610", qty: 100, expiresInDays: 268 }] },
  { id: "ITM-1044", name: "Oxycodone HCl 5 mg tabs", ndc: "00048-0120-05", category: "Controlled · Schedule II", form: "Tablet 100ct", storage: "Controlled Room Temp", controlled: "Schedule II", unitCost: 12.4, onHand: 52, parLevel: 150, reorderPoint: 40, demandPerDay: 6, abc: "A", lots: [{ lot: "OX-2606", qty: 52, expiresInDays: 96 }] },
  { id: "ITM-1045", name: "Albuterol HFA 90 mcg", ndc: "00173-0682-00", category: "Respiratory", form: "Inhaler 8.5g", storage: "Ambient", controlled: "None", unitCost: 9.8, onHand: 312, parLevel: 260, reorderPoint: 70, demandPerDay: 8, abc: "C", lots: [{ lot: "AB-2612", qty: 180, expiresInDays: 301 }, { lot: "AB-2609", qty: 132, expiresInDays: 172 }] },
  { id: "ITM-1046", name: "Heparin sodium 5000 U/mL", ndc: "00641-2450-45", category: "Anticoagulant", form: "Vial 10mL", storage: "Refrigerated", controlled: "None", unitCost: 7.2, onHand: 88, parLevel: 110, reorderPoint: 35, demandPerDay: 3, abc: "B", lots: [{ lot: "HP-2605", qty: 88, expiresInDays: 44 }] },
  { id: "ITM-1047", name: "Piperacillin-tazobactam 4.5 g", ndc: "00338-1080-01", category: "Anti-infective", form: "Vial 4.5g", storage: "Controlled Room Temp", controlled: "None", unitCost: 22.9, onHand: 74, parLevel: 90, reorderPoint: 30, demandPerDay: 5, abc: "A", lots: [{ lot: "PT-2611", qty: 74, expiresInDays: 118 }] },
  { id: "ITM-1048", name: "Sodium chloride 0.9% 1L", ndc: "00409-7923-09", category: "IV Fluids", form: "Bag 1L", storage: "Ambient", controlled: "None", unitCost: 1.6, onHand: 940, parLevel: 800, reorderPoint: 200, demandPerDay: 55, abc: "C", lots: [{ lot: "NS-2613", qty: 940, expiresInDays: 540 }] },
  { id: "ITM-1049", name: "Propofol 10 mg/mL", ndc: "00641-6125-01", category: "Anesthesia", form: "Vial 20mL", storage: "Controlled Room Temp", controlled: "CIII", unitCost: 6.8, onHand: 41, parLevel: 60, reorderPoint: 20, demandPerDay: 4, abc: "B", lots: [{ lot: "PR-2607", qty: 41, expiresInDays: 58 }] },
  { id: "ITM-1050", name: "Fentanyl citrate 50 mcg/mL", ndc: "00409-0864-20", category: "Controlled · Schedule II", form: "Ampule 2mL", storage: "Controlled Room Temp", controlled: "Schedule II", unitCost: 5.5, onHand: 148, parLevel: 160, reorderPoint: 50, demandPerDay: 7, abc: "A", lots: [{ lot: "FN-2608", qty: 148, expiresInDays: 133 }] },
  { id: "ITM-1051", name: "Norepinephrine 8 mg/250 mL", ndc: "00409-1144-25", category: "Cardiovascular", form: "Bag 250mL", storage: "Refrigerated", controlled: "None", unitCost: 11.3, onHand: 26, parLevel: 70, reorderPoint: 25, demandPerDay: 6, abc: "A", lots: [{ lot: "NE-2606", qty: 26, expiresInDays: 21 }] },
  { id: "ITM-1052", name: "mRNA vaccine (frozen)", ndc: "59267-1000-01", category: "Immunization", form: "Multidose vial", storage: "Frozen", controlled: "None", unitCost: 18.0, onHand: 204, parLevel: 250, reorderPoint: 60, demandPerDay: 12, abc: "B", lots: [{ lot: "VX-2614", qty: 204, expiresInDays: 405 }] },
];

const ORDERS = [
  { id: "PO-2026-2214", vendor: "McKesson", status: "approved", lines: 6, value: 48210, urgent: false, etaTicks: 2, placedTick: null, createdTick: 0, items: ["Meropenem 1 g powder", "Piperacillin-tazobactam 4.5 g", "Heparin sodium 5000 U/mL"] },
  { id: "PO-2026-2215", vendor: "Cardinal Health", status: "placed", lines: 12, value: 126900, urgent: false, etaTicks: 3, placedTick: 1, createdTick: 1, items: ["Sodium chloride 0.9% 1L", "Insulin glargine 100 U/mL", "Albuterol HFA 90 mcg"] },
  { id: "PO-2026-2216", vendor: "AmerisourceBergen", status: "in-transit", lines: 8, value: 84300, urgent: false, etaTicks: 2, placedTick: 4, createdTick: 3, items: ["Oxycodone HCl 5 mg tabs", "Fentanyl citrate 50 mcg/mL", "Propofol 10 mg/mL"] },
  { id: "PO-2026-2217", vendor: "McKesson", status: "in-transit", lines: 3, value: 12450, urgent: true, etaTicks: 3, placedTick: 2, createdTick: 2, items: ["Meropenem 1 g powder"] },
  { id: "PO-2026-2218", vendor: "Cardinal Health", status: "draft", lines: 5, value: 31780, urgent: false, etaTicks: 2, placedTick: null, createdTick: 5, items: ["Norepinephrine 8 mg/250 mL", "Morphine sulfate 10 mg/mL"] },
  { id: "PO-2026-2219", vendor: "Pfizer Direct (cold)", status: "placed", lines: 2, value: 98600, urgent: true, etaTicks: 4, placedTick: 6, createdTick: 4, items: ["mRNA vaccine (frozen)"] },
  { id: "PO-2026-2220", vendor: "AmerisourceBergen", status: "received", lines: 9, value: 61200, urgent: false, etaTicks: 0, placedTick: 8, createdTick: 0, items: ["Sodium chloride 0.9% 1L", "Albuterol HFA 90 mcg"] },
  { id: "PO-2026-2221", vendor: "McKesson", status: "draft", lines: 4, value: 18900, urgent: false, etaTicks: 2, placedTick: null, createdTick: 6, items: ["Morphine sulfate 10 mg/mL", "Oxycodone HCl 5 mg tabs"] },
];

const SEED_POINTS = 22;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 5, amp = 1.6, lo = -40, hi = 40) =>
  series(seed, n, base, amp, { lo, hi, pull: 0.1 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);

const fmtMoney = (n) => `$${n.toLocaleString("en-US")}`;


const unitType = (item) => {
  if (item.form.startsWith("Vial") || item.form.startsWith("Ampule")) return "vials";
  if (item.form.startsWith("Bag")) return "bags";
  if (item.form.startsWith("Tablet")) return "bottles";
  if (item.form.startsWith("Inhaler")) return "inhalers";
  if (item.form.startsWith("Multidose")) return "vials";
  return "units";
};

const stockRisk = (item) => {
  const coverageDays = item.demandPerDay > 0 ? item.onHand / item.demandPerDay : 999;
  const expiringSoon = item.lots.some((l) => l.expiresInDays <= 30);
  if (item.onHand < item.reorderPoint) return "critical";
  if (coverageDays < 7 || expiringSoon) return "high";
  if (coverageDays < 14) return "medium";
  return "low";
};

const storageState = (s) => {
  if (s.temp < s.rangeMin || s.temp > s.rangeMax) return "violation";
  const margin = Math.abs(s.temp - (s.rangeMin + (s.rangeMax - s.rangeMin) / 2));
  const range = s.rangeMax - s.rangeMin;
  if (margin > range * 0.8) return "warning";
  if (s.type === "Shipper" && s.battery !== null && s.battery < 50) return "warning";
  return "nominal";
};

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */











/* ------------------------------------------------------------------ *
 *  Tab 1 - Cold-Chain Sensors
 * ------------------------------------------------------------------ */

function ColdChainTab({ units, search, severity, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      const matchesSearch = !q || [u.id, u.name, u.type, u.location, u.model].some((f) => String(f).toLowerCase().includes(q));
      const st = storageState(u);
      const matchesSeverity = severity === "all" || (st === "violation" ? "critical" : st === "warning" ? "high" : "low") === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [units, search, severity]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <Snowflake size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No cold-chain assets match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or widen the severity chips.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((u) => {
        const meta = STORAGE_META[u.type] || STORAGE_META.Fridge;
        const Icon = meta.icon;
        const st = storageState(u);
        const inRange = u.temp >= u.rangeMin && u.temp <= u.rangeMax;
        const series = seededSeries(u.id.length * 5 + 1, SEED_POINTS, clamp(u.temp, -30, 30), u.type === "Freezer" ? 1.2 : 0.9);
        const tone = st === "violation" ? "rose" : st === "warning" ? "amber" : u.type === "Freezer" ? "violet" : "sky";
        return (
          <button
            key={u.id}
            onClick={() => onInspect(u)}
            className={`rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${st === "violation" ? "border-rose-500/40" : st === "warning" ? "border-amber-500/40" : "border-slate-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${meta.tone}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{u.name}</p>
                  <p className="text-[11px] text-slate-500">{u.id} · {u.location}</p>
                </div>
              </div>
              <StatusPill status={st} map={STATUS_META} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Current temp</p>
                <p className={`text-xl font-black tabular-nums ${inRange ? "text-white" : "text-rose-400"}`}>
                  {u.temp.toFixed(1)}°C
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Humidity</p>
                <p className="text-sm font-bold tabular-nums text-slate-200">{u.humidity}%</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                {u.rangeMin}°–{u.rangeMax}°C
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Temp trend · {SEED_POINTS} min</p>
              <MiniSparkline points={series} tone={tone} width={260} height={44} min={Math.min(u.rangeMin, ...series) - 1} max={Math.max(u.rangeMax, ...series) + 1} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                {u.type === "Shipper" && u.battery !== null && (
                  <span className={`flex items-center gap-1 ${u.battery < 50 ? "text-amber-400" : ""}`}><Battery size={11} /> {u.battery}%</span>
                )}
                <span className={`flex items-center gap-1 ${u.alarmArmed ? "text-emerald-400" : "text-slate-600"}`}>
                  {u.alarmArmed ? <Bell size={11} /> : <Bell size={11} className="opacity-40" />} {u.alarmArmed ? "Alarm armed" : "Alarm muted"}
                </span>
                <span className="flex items-center gap-1"><Timer size={11} /> {u.occupancy}% full</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
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
 *  Tab 2 - Inventory Lifecycle
 * ------------------------------------------------------------------ */

function InventoryTab({ items, search, onInspect, onRestock }) {
  const [riskFilter, setRiskFilter] = useState("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchesSearch = !q || [it.id, it.name, it.ndc, it.category, it.form, ...it.lots.map((l) => l.lot)].some((f) => String(f).toLowerCase().includes(q));
      const matchesRisk = riskFilter === "all" || stockRisk(it) === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [items, search, riskFilter]);

  const totals = useMemo(() => {
    const onHand = items.reduce((a, i) => a + i.onHand, 0);
    const value = items.reduce((a, i) => a + i.onHand * i.unitCost, 0);
    const expiring = items.reduce((a, i) => a + i.lots.filter((l) => l.expiresInDays <= 30).reduce((x, l) => x + l.qty, 0), 0);
    return { onHand, value, expiring };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All items" }, { key: "low", label: "Healthy" }, { key: "medium", label: "Watch" }, { key: "high", label: "At risk" }, { key: "critical", label: "Stockout risk" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRiskFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              riskFilter === key ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          {fmtNumber(totals.onHand)} units on hand · {fmtMoney(totals.value)} value · {fmtNumber(totals.expiring)} units expiring ≤ 30d
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Boxes size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No inventory items match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Try a different search term or risk band.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="divide-y divide-slate-800/70">
            {filtered.map((it) => {
              const risk = stockRisk(it);
              const sev = SEVERITY_META[risk] || SEVERITY_META.medium;
              const coverageDays = it.demandPerDay > 0 ? it.onHand / it.demandPerDay : 999;
              const parPct = (it.onHand / it.parLevel) * 100;
              const expiringSoon = it.lots.some((l) => l.expiresInDays <= 30);
              return (
                <div key={it.id} className="flex flex-col gap-3 bg-slate-900/70 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{it.name}</p>
                      {it.controlled !== "None" && (
                        <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400">
                          <Lock size={10} /> {it.controlled}
                        </span>
                      )}
                      <Badge tone={risk}>{risk === "low" ? "healthy" : risk === "medium" ? "watch" : risk === "high" ? "at risk" : "stockout risk"}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {it.ndc} · {it.category} · {it.form} · {it.storage} · ABC {it.abc}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1 text-slate-400"><Boxes size={12} /> <b className="text-white tabular-nums">{fmtNumber(it.onHand)}</b> of par {fmtNumber(it.parLevel)}</span>
                      <span className="text-slate-500">{coverageDays < 999 ? `${coverageDays.toFixed(1)}d cover @ ${it.demandPerDay}/${unitType(it)}/day` : "no demand modeled"}</span>
                      {expiringSoon && <span className="flex items-center gap-1 font-bold text-rose-400"><FlaskConical size={12} /> lot expires ≤ 30d</span>}
                    </div>
                    <div className="mt-2 max-w-sm">
                      <ProgressBar pct={parPct} tone={parPct < 50 ? "rose" : parPct < 100 ? "amber" : "emerald"} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Lots</p>
                      <div className="mt-0.5 flex gap-1">
                        {it.lots.map((l) => (
                          <span key={l.lot} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${l.expiresInDays <= 30 ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
                            {l.lot}·{l.expiresInDays}d
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestock(it.id)}
                      disabled={it.onHand >= it.parLevel}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition ${it.onHand >= it.parLevel ? "border border-slate-800 text-slate-600" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"}`}
                    >
                      <Plus size={13} /> {it.onHand >= it.parLevel ? "At par" : "Restock"}
                    </button>
                    <button onClick={() => onInspect(it)} className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 transition hover:gap-2">
                      Inspect <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - Orders & Fulfillment
 * ------------------------------------------------------------------ */

function OrdersTab({ orders, search, tick, onInspect, onPlace, onAdvance }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch = !q || [o.id, o.vendor, ...o.items].some((f) => String(f).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const inFlight = orders.filter((o) => o.status === "in-transit" || o.status === "placed").length;
  const outstanding = orders.reduce((a, o) => a + (o.status === "received" ? 0 : o.value), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All orders" }, { key: "draft", label: "Drafts" }, { key: "approved", label: "Approved" }, { key: "placed", label: "Placed" }, { key: "in-transit", label: "In transit" }, { key: "received", label: "Received" },
        ].map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                active ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-500">{inFlight} in flight · {fmtMoney(outstanding)} open value</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <ShoppingCart size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No orders match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or status chips.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="divide-y divide-slate-800/70">
            {filtered.map((o) => {
              const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.draft;
              const progress = o.status === "received" ? 100 : o.status === "in-transit" ? 70 : o.status === "placed" ? 45 : o.status === "approved" ? 25 : 8;
              return (
                <div key={o.id} className="flex flex-col gap-3 bg-slate-900/70 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-white">{o.id}</p>
                      <StatusPill status={o.status} map={ORDER_STATUS_META} />
                      {o.urgent && <Badge tone="high">Urgent</Badge>}
                      <span className="text-[11px] text-slate-500">{o.vendor}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{o.lines} lines · {o.items.slice(0, 3).join(", ")}{o.items.length > 3 ? ` +${o.items.length - 3} more` : ""}</p>
                    <div className="mt-2 max-w-sm">
                      <ProgressBar pct={progress} tone={o.status === "in-transit" ? "amber" : o.status === "received" ? "emerald" : "sky"} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-black text-white tabular-nums">{fmtMoney(o.value)}</p>
                      {o.status === "in-transit" && <p className="text-[10px] text-amber-400">arriving soon</p>}
                      {o.status === "placed" && <p className="text-[10px] text-slate-500">ETA ~{o.etaTicks} ticks</p>}
                    </div>
                    {o.status === "draft" && (
                      <button onClick={() => onPlace(o.id)} className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-[11px] font-bold text-sky-400 transition hover:bg-sky-500/20">
                        <CheckCircle2 size={13} /> Approve & place
                      </button>
                    )}
                    {o.status === "received" && (
                      <button onClick={() => onAdvance(o.id)} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20">
                        <CheckCircle2 size={13} /> Verify & close
                      </button>
                    )}
                    <button onClick={() => onInspect(o)} className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 transition hover:gap-2">
                      Inspect <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function PharmacySupplyHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("coldchain");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [units, setUnits] = useState(COLD_STORAGE);
  const [items, setItems] = useState(INVENTORY);
  const [orders, setOrders] = useState(ORDERS);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9000);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);



  /* Live supply-chain simulation loop. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      // Temperature drift toward range; excursions occasionally fire.
      setUnits((prev) =>
        prev.map((u) => {
          const midpoint = u.rangeMin + (u.rangeMax - u.rangeMin) / 2;
          const next = round1(jitter(u.temp, u.type === "Freezer" ? 0.6 : 0.45, u.rangeMin - 6, u.rangeMax + 6));
          const pulled = round1(next + (midpoint - next) * 0.12);
          return {
            ...u,
            temp: pulled,
            humidity: Math.round(jitter(u.humidity, 3, 20, 80)),
            battery: u.battery === null ? null : Math.max(0, Math.round(u.battery - 0.2)),
            lastExcursion: u.lastExcursion,
          };
        })
      );

      // Inventory depletes with demand.
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          onHand: Math.max(0, Math.round(it.onHand - it.demandPerDay * 0.35)),
        }))
      );

      // Orders advance through the pipeline.
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status === "draft" || o.status === "approved") return o;
          if (o.status === "placed") {
            return { ...o, status: "in-transit", arriveAtTick: tick + 1 + o.etaTicks };
          }
          if (o.status === "in-transit" && o.arriveAtTick !== undefined && tick >= o.arriveAtTick) {
            return { ...o, status: "received" };
          }
          return o;
        })
      );

      // Stockout alerts when an item crosses its reorder point.
      const before = itemsRef.current;
      const after = itemsRef.current.map((it) => ({ ...it, onHand: Math.max(0, Math.round(it.onHand - it.demandPerDay * 0.35)) }));
      after.forEach((it) => {
        const prev = before.find((p) => p.id === it.id);
        if (prev && prev.onHand >= it.reorderPoint && it.onHand < it.reorderPoint) {
          pushToast(`Stockout risk — ${it.name}`, `${it.id} dropped below reorder point (${it.reorderPoint} ${unitType(it)})`, "high");
        }
      });

      // Cold-chain excursion alert.
      if (Math.random() < 0.1) {
        const u = units[Math.floor(Math.random() * units.length)];
        const st = storageState(u);
        if (st === "violation") {
          pushToast(`Cold-chain excursion — ${u.name}`, `${u.id} reading ${u.temp.toFixed(1)}°C outside ${u.rangeMin}–${u.rangeMax}°C band`, "critical");
        }
      }
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, tick, units, pushToast]);

  const resetSimulation = useCallback(() => {
    setUnits(COLD_STORAGE.map((u) => ({ ...u })));
    setItems(INVENTORY.map((i) => ({ ...i, lots: i.lots.map((l) => ({ ...l })) })));
    setOrders(ORDERS.map((o) => ({ ...o })));
    setTick(20);
    setInspect(null);
    pushToast("Supply chain reset", "Cold chain, inventory and orders restored to baseline", "medium");
  }, [pushToast]);

  const handleRestock = useCallback((itemId) => {
    const item = itemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    setOrders((prev) => {
      const draft = {
        id: `PO-2026-${2200 + prev.length}`,
        vendor: "McKesson",
        status: "draft",
        lines: 1,
        value: Math.round(item.unitCost * Math.max(item.parLevel - item.onHand, 40) * 10) / 10,
        urgent: item.onHand < item.reorderPoint,
        etaTicks: 2,
        placedTick: null,
        createdTick: tick,
        items: [item.name],
      };
      return [draft, ...prev];
    });
    pushToast("Replenishment draft created", `${item.name} — draft PO raised for ${fmtMoney(item.unitCost * Math.max(item.parLevel - item.onHand, 40))}`, "medium");
  }, [tick, pushToast]);

  const handlePlace = useCallback((orderId) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "approved" } : o)));
    pushToast("Order approved", `${orderId} approved and queued for placement with vendor`, "low");
  }, [pushToast]);

  const handleAdvance = useCallback((orderId) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const restock = {};
        o.items.forEach((name) => {
          restock[name] = (restock[name] || 0) + 1;
        });
        return { ...o, status: "received" };
      })
    );
    setItems((prev) =>
      prev.map((it) => {
        const order = orders.find((o) => o.id === orderId);
        const qty = order && order.items.includes(it.name) ? Math.round(it.parLevel * 1.25) : 0;
        return qty > 0 ? { ...it, onHand: it.onHand + qty } : it;
      })
    );
    pushToast("Receiving verified", `${orderId} checked in — quality pass logged, stock updated`, "low");
  }, [orders, pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "inventory" ? items : activeTab === "orders" ? orders : units;
    const header = activeTab === "inventory"
      ? ["id", "ndc", "name", "category", "form", "controlled", "storage", "onHand", "parLevel", "reorderPoint", "unitCost", "abc"]
      : activeTab === "orders"
        ? ["id", "vendor", "status", "lines", "value", "urgent", "items"]
        : ["id", "name", "type", "location", "temp", "humidity", "rangeMin", "rangeMax", "status"];
    downloadCsv(`medtrack-pharmacy-${activeTab}-${Date.now()}.csv`, [
      header,
      ...rows.map((r) =>
        (activeTab === "inventory"
          ? [r.id, r.ndc, r.name, r.category, r.form, r.controlled, r.storage, r.onHand, r.parLevel, r.reorderPoint, r.unitCost, r.abc]
          : activeTab === "orders"
            ? [r.id, r.vendor, r.status, r.lines, r.value, r.urgent, r.items.join(" | ")]
            : [r.id, r.name, r.type, r.location, r.temp, r.humidity, r.rangeMin, r.rangeMax, storageState(r)]
        )
      ),
    ]);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, units, items, orders, pushToast]);

  const stats = useMemo(() => {
    const excursions = units.filter((u) => storageState(u) === "violation").length;
    const atRisk = items.filter((i) => stockRisk(i) === "critical" || stockRisk(i) === "high").length;
    const inFlight = orders.filter((o) => o.status === "in-transit" || o.status === "placed").length;
    const underPar = items.filter((i) => i.onHand < i.parLevel).length;
    return { excursions, atRisk, inFlight, underPar, total: items.length };
  }, [units, items, orders]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400 shadow-lg shadow-cyan-500/10">
                <Droplets size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Pharmacy &amp; Med-Supply Chain</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} livePrefix="Simulating · tick #" />
                  <span className="text-slate-600">·</span>
                  <span>Cold Chain · Inventory Lifecycle · Orders</span>
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
            <ExportButton onClick={handleExport} exporting={exporting} />
          </div>
        </div>

        {/* ---------- Stat row ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Snowflake} label="Cold-chain excursions" value={stats.excursions} sub={`of ${units.length} monitored assets`} tone="rose" />
          <StatCard icon={Boxes} label="Items below par" value={`${stats.underPar}/${stats.total}`} sub={`${stats.atRisk} at stockout risk`} tone="amber" />
          <StatCard icon={Truck} label="Orders in flight" value={stats.inFlight} sub={`across the PO pipeline`} tone="sky" />
          <StatCard icon={ShieldCheck} label="DEA Schedule II" value={items.filter((i) => i.controlled === "Schedule II").length} sub="vault-tracked & double-counted" tone="violet" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              <SeverityChips value={severity} onChange={setSeverity} meta={SEVERITY_META} />
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "coldchain" && (
              <ColdChainTab units={units} search={search} severity={severity} onInspect={setInspect} />
            )}
            {activeTab === "inventory" && (
              <InventoryTab items={items} search={search} onInspect={setInspect} onRestock={handleRestock} />
            )}
            {activeTab === "orders" && (
              <OrdersTab orders={orders} search={search} tick={tick} onInspect={setInspect} onPlace={handlePlace} onAdvance={handleAdvance} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.rangeMin !== undefined) {
            const u = inspect;
            const meta = STORAGE_META[u.type] || STORAGE_META.Fridge;
            const Icon = meta.icon;
            const st = storageState(u);
            const series = seededSeries(u.id.length * 5 + 1, SEED_POINTS, clamp(u.temp, -30, 30), u.type === "Freezer" ? 1.2 : 0.9);
            return (
              <Modal open onClose={() => setInspect(null)} title={u.name} subtitle={`${u.id} · ${u.location}`} icon={Icon} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={st} map={STATUS_META} />
                    <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{meta.label}</span>
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
                      <Boxes size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.occupancy}%</p>
                      <p className="text-[10px] text-slate-500">Occupancy</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      {u.battery !== null ? <Battery size={14} className="mx-auto text-slate-500" /> : <Bell size={14} className="mx-auto text-slate-500" />}
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{u.battery !== null ? `${u.battery}%` : u.alarmArmed ? "Armed" : "Muted"}</p>
                      <p className="text-[10px] text-slate-500">{u.battery !== null ? "Battery" : "Alarm"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Temperature band & trend</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <MiniSparkline points={series} tone={st === "violation" ? "rose" : st === "warning" ? "amber" : "sky"} width={560} height={56} min={u.rangeMin - 2} max={u.rangeMax + 2} />
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
                    <InfoRow label="Last calibration" value={u.lastCalibrated} mono />
                    <InfoRow label="Data logger" value={`${u.id}-LOG · 15-min cadence`} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
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
          if (inspect.ndc !== undefined) {
            const it = inspect;
            const risk = stockRisk(it);
            const sev = SEVERITY_META[risk] || SEVERITY_META.medium;
            const coverageDays = it.demandPerDay > 0 ? it.onHand / it.demandPerDay : 999;
            const demandSeries = seededSeries(it.id.length * 3, 12, it.demandPerDay, 3, 1, 40);
            return (
              <Modal open onClose={() => setInspect(null)} title={it.name} subtitle={`${it.id} · ${it.ndc}`} icon={Boxes} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={risk}>{risk === "low" ? "healthy" : risk === "medium" ? "watch" : risk === "high" ? "at risk" : "stockout risk"}</Badge>
                    {it.controlled !== "None" && <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400"><Lock size={11} /> {it.controlled}</span>}
                    <span className="text-[11px] text-slate-500">{it.category} · {it.form} · {it.storage} · ABC {it.abc}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Boxes size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${it.onHand < it.reorderPoint ? "text-rose-400" : "text-white"}`}>{fmtNumber(it.onHand)}</p>
                      <p className="text-[10px] text-slate-500">On hand ({unitType(it)})</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Gauge size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{coverageDays < 999 ? `${coverageDays.toFixed(1)}d` : "—"}</p>
                      <p className="text-[10px] text-slate-500">Coverage</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Activity size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{it.demandPerDay}/d</p>
                      <p className="text-[10px] text-slate-500">Demand</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Droplets size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{fmtMoney(it.unitCost)}</p>
                      <p className="text-[10px] text-slate-500">Unit cost</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Lot / batch positions</p>
                    <div className="space-y-2">
                      {it.lots.map((l) => {
                        const expiring = l.expiresInDays <= 30;
                        return (
                          <div key={l.lot} className={`flex items-center justify-between rounded-xl border p-3 ${expiring ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/60"}`}>
                            <div>
                              <p className="font-mono text-xs font-bold text-slate-200">{l.lot}</p>
                              <p className="text-[10px] text-slate-500">{l.qty} {unitType(it)} on hand</p>
                            </div>
                            <span className={`text-[11px] font-bold tabular-nums ${expiring ? "text-rose-400" : "text-slate-300"}`}>
                              {l.expiresInDays}d to expiry
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Demand history · 12d</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <MiniSparkline points={demandSeries} tone="sky" width={560} height={40} min={0} max={Math.max(...demandSeries) + 5} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Par level" value={`${fmtNumber(it.parLevel)} ${unitType(it)}`} />
                    <InfoRow label="Reorder point" value={`${fmtNumber(it.reorderPoint)} ${unitType(it)}`} />
                    <InfoRow label="Storage requirement" value={it.storage} />
                    <InfoRow label="Inventory value" value={fmtMoney(it.onHand * it.unitCost)} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button
                      onClick={() => handleRestock(it.id)}
                      disabled={it.onHand >= it.parLevel}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${it.onHand >= it.parLevel ? "border border-slate-800 text-slate-600" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"}`}
                    >
                      <Plus size={14} /> {it.onHand >= it.parLevel ? "At par" : "Raise replenishment PO"}
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Layers size={14} /> Movement history
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const o = inspect;
          const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.draft;
          const progress = o.status === "received" ? 100 : o.status === "in-transit" ? 70 : o.status === "placed" ? 45 : o.status === "approved" ? 25 : 8;
          return (
            <Modal open onClose={() => setInspect(null)} title={o.id} subtitle={`${o.vendor} · ${o.lines} lines`} icon={ShoppingCart} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={o.status} map={ORDER_STATUS_META} />
                  {o.urgent && <Badge tone="high">Urgent</Badge>}
                  <span className="text-[11px] text-slate-500">{fmtMoney(o.value)} · created {o.createdTick} ticks ago</span>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pipeline progress</p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <ProgressBar pct={progress} tone={o.status === "in-transit" ? "amber" : o.status === "received" ? "emerald" : "sky"} />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                      <span>Draft</span><span>Approved</span><span>Placed</span><span>In transit</span><span>Received</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Line items</p>
                  <div className="space-y-1.5">
                    {o.items.map((name) => (
                      <div key={name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                        <span className="text-xs text-slate-200">{name}</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500"><CheckCircle2 size={11} className="text-emerald-500" /> in receiving queue</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Vendor" value={o.vendor} />
                  <InfoRow label="Line count" value={o.lines} mono />
                  <InfoRow label="Order value" value={fmtMoney(o.value)} mono />
                  <InfoRow label="Estimated transit" value={`${o.etaTicks} ticks`} mono />
                  <InfoRow label="Urgent handling" value={o.urgent ? "Yes — expedited lane" : "Standard"} />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  {o.status === "draft" && (
                    <button onClick={() => handlePlace(o.id)} className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <CheckCircle2 size={14} /> Approve & place
                    </button>
                  )}
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <FileText size={14} /> Packing slip
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <Truck size={14} /> Track shipment
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
            Simulated cold chain & inventory · no PHI · USP 797/800 & GDP-aligned
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> DEA Schedule II items double-counted · GS1 barcode lineage tracked
          </p>
        </div>
      </div>
    </div>
  );
}
