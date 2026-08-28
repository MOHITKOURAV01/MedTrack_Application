import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Beaker, Bell, Boxes, CalendarClock,
  CheckCircle2, ChevronRight, Clock, Cross, Database, Download, Droplets, Eye,
  FileText, Filter, Fingerprint, FlaskConical, Gauge, HeartPulse, Info, Layers,
  PackageCheck, Pause, Play, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck,
  Siren, Syringe, Timer, TrendingDown, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

const TYPE_META = {
  "O-": { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", role: "Universal Donor", rarity: "Critical" },
  "O+": { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", role: "Most Common", rarity: "Common" },
  "A-": { color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30", role: "Rare Negative", rarity: "Rare" },
  "A+": { color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30", role: "Common", rarity: "Common" },
  "B-": { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", role: "Rare Negative", rarity: "Rare" },
  "B+": { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", role: "Common", rarity: "Common" },
  "AB-": { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", role: "Rare Negative", rarity: "Rare" },
  "AB+": { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", role: "Universal Recipient", rarity: "Critical" },
};

const INITIAL_UNITS = [
  { id: "BB-8841", type: "O-", comp: "RBC", collect: "14d ago", expiryDays: 7, storage: "Fridge 2°–6°C", rack: "F-A3", status: "Available", donor: "D-2210", screened: true, mtp: false },
  { id: "BB-8842", type: "O-", comp: "RBC", collect: "11d ago", expiryDays: 10, storage: "Fridge 2°–6°C", rack: "F-A3", status: "Available", donor: "D-2211", screened: true, mtp: false },
  { id: "BB-8843", type: "O-", comp: "PLT", collect: "1d ago", expiryDays: 4, storage: "Platelet Agitator", rack: "PL-1", status: "Available", donor: "D-2212", screened: true, mtp: true },
  { id: "BB-8844", type: "O+", comp: "RBC", collect: "20d ago", expiryDays: 1, storage: "Fridge 2°–6°C", rack: "F-B1", status: "Available", donor: "D-2213", screened: true, mtp: false },
  { id: "BB-8845", type: "A-", comp: "RBC", collect: "9d ago", expiryDays: 12, storage: "Fridge 2°–6°C", rack: "F-C2", status: "Available", donor: "D-2214", screened: true, mtp: false },
  { id: "BB-8846", type: "A+", comp: "FFP", collect: "60d ago", expiryDays: 305, storage: "Freezer -30°C", rack: "FR-1", status: "Available", donor: "D-2215", screened: true, mtp: false },
  { id: "BB-8847", type: "B-", comp: "RBC", collect: "16d ago", expiryDays: 5, storage: "Fridge 2°–6°C", rack: "F-D1", status: "Crossmatched", donor: "D-2216", screened: true, mtp: false },
  { id: "BB-8848", type: "AB+", comp: "PLT", collect: "2d ago", expiryDays: 3, storage: "Platelet Agitator", rack: "PL-2", status: "Available", donor: "D-2217", screened: true, mtp: false },
  { id: "BB-8849", type: "O+", comp: "CRYO", collect: "30d ago", expiryDays: 335, storage: "Freezer -30°C", rack: "FR-2", status: "Quarantined", donor: "D-2218", screened: false, mtp: false },
  { id: "BB-8850", type: "AB+", comp: "RBC", collect: "19d ago", expiryDays: 2, storage: "Fridge 2°–6°C", rack: "F-E1", status: "Issued", donor: "D-2219", screened: true, mtp: true },
  { id: "BB-8851", type: "O-", comp: "PLT", collect: "0d ago", expiryDays: 5, storage: "Platelet Agitator", rack: "PL-3", status: "Available", donor: "D-2220", screened: true, mtp: false },
  { id: "BB-8852", type: "A-", comp: "FFP", collect: "40d ago", expiryDays: 325, storage: "Freezer -30°C", rack: "FR-3", status: "Available", donor: "D-2221", screened: true, mtp: false },
];

const INITIAL_DONORS = [
  { id: "D-2210", name: "A. Rahim", type: "O-", lastDonation: "12d ago", status: "Eligible", hemoglobin: 14.2, units: 18, badge: "Regular" },
  { id: "D-2211", name: "M. Chen", type: "O-", lastDonation: "9d ago", status: "Eligible", hemoglobin: 13.8, units: 12, badge: "Regular" },
  { id: "D-2212", name: "P. Novak", type: "O-", lastDonation: "2d ago", status: "Cooling", hemoglobin: 14.9, units: 7, badge: "New" },
  { id: "D-2213", name: "S. Iwata", type: "O+", lastDonation: "18d ago", status: "Eligible", hemoglobin: 15.1, units: 24, badge: "Platinum" },
  { id: "D-2214", name: "R. Mensah", type: "A-", lastDonation: "7d ago", status: "Eligible", hemoglobin: 13.2, units: 9, badge: "Regular" },
  { id: "D-2215", name: "K. Larsen", type: "A+", lastDonation: "55d ago", status: "Deferred", hemoglobin: 12.1, units: 3, badge: "Watch" },
  { id: "D-2216", name: "J. Okafor", type: "B-", lastDonation: "14d ago", status: "Eligible", hemoglobin: 14.6, units: 11, badge: "Regular" },
  { id: "D-2217", name: "L. Moreau", type: "AB+", lastDonation: "1d ago", status: "Cooling", hemoglobin: 13.5, units: 5, badge: "New" },
];

const INITIAL_ORDERS = [
  { id: "XM-441", patient: "PT-2291 — R. Vance", ward: "ICU-3", type: "O-", aboRh: "A+", product: "RBC ×2", antibody: "Anti-K", phase: "Crossmatch", status: "Pending", urgency: "STAT", mtp: false, ordered: "12m ago" },
  { id: "XM-442", patient: "PT-2288 — H. Bose", ward: "OR-2", type: "O+", aboRh: "O+", product: "RBC ×4", antibody: "None", phase: "Type & Screen", status: "Pending", urgency: "Urgent", mtp: false, ordered: "34m ago" },
  { id: "XM-443", patient: "PT-2301 — T. Nwosu", ward: "ED Resus", type: "AB+", aboRh: "AB+", product: "RBC ×6", antibody: "None", phase: "Crossmatch", status: "Pending", urgency: "STAT", mtp: true, ordered: "6m ago" },
  { id: "XM-444", patient: "PT-2274 — M. Silva", ward: "Hema Ward", type: "B-", aboRh: "B+", product: "PLT ×1", antibody: "Anti-Jk(a)", phase: "Antiglobulin", status: "Pending", urgency: "Urgent", mtp: false, ordered: "52m ago" },
  { id: "XM-445", patient: "PT-2296 — F. Duarte", ward: "ICU-1", type: "O-", aboRh: "A-", product: "RBC ×3", antibody: "None", phase: "Crossmatch", status: "Pending", urgency: "Routine", mtp: false, ordered: "2h ago" },
  { id: "XM-446", patient: "PT-2283 — G. Park", ward: "Cath Lab", type: "A+", aboRh: "A+", product: "RBC ×2", antibody: "None", phase: "Type & Screen", status: "Issued", urgency: "Urgent", mtp: false, ordered: "3h ago" },
  { id: "XM-447", patient: "PT-2304 — I. Khan", ward: "L&D", type: "O-", aboRh: "O-", product: "RBC ×2", antibody: "None", phase: "Crossmatch", status: "Pending", urgency: "STAT", mtp: true, ordered: "9m ago" },
  { id: "XM-448", patient: "PT-2279 — C. Rossi", ward: "ICU-2", type: "AB-", aboRh: "B-", product: "RBC ×2", antibody: "Anti-c", phase: "Antiglobulin", status: "Pending", urgency: "Routine", mtp: false, ordered: "4h ago" },
  { id: "XM-449", patient: "PT-2307 — Y. Tanaka", ward: "OR-5", type: "O+", aboRh: "O+", product: "PLT ×1", antibody: "None", phase: "Crossmatch", status: "Pending", urgency: "Urgent", mtp: false, ordered: "40m ago" },
  { id: "XM-450", patient: "PT-2293 — N. Ali", ward: "Hema Ward", type: "A-", aboRh: "A+", product: "RBC ×1", antibody: "Anti-E", phase: "Crossmatch", status: "Pending", urgency: "Routine", mtp: false, ordered: "1h ago" },
];

const INITIAL_REACTIONS = [
  { id: "TR-91", patient: "PT-2288 — H. Bose", type: "Febrile non-haemolytic", severity: "Mild", phase: "Investigating", onset: "18m ago", tempRise: 0.9, labAction: "Bilirubin pending", htc: false },
  { id: "TR-92", patient: "PT-2296 — F. Duarte", type: "Allergic (urticaria)", severity: "Mild", phase: "Closed", onset: "2h ago", tempRise: 0.2, labAction: "Antihistamine given", htc: false },
  { id: "TR-93", patient: "PT-2301 — T. Nwosu", type: "TACO", severity: "Moderate", phase: "Monitoring", onset: "42m ago", tempRise: 0.3, labAction: "Diuretic + O₂", htc: false },
  { id: "TR-94", patient: "PT-2291 — R. Vance", type: "Acute haemolytic", severity: "Critical", phase: "Investigating", onset: "12m ago", tempRise: 1.4, labAction: "Immediate stop + DAT", htc: true },
  { id: "TR-95", patient: "PT-2283 — G. Park", type: "Delayed serologic", severity: "Moderate", phase: "Investigating", onset: "3h ago", tempRise: 0.4, labAction: "Antibody ID panel", htc: false },
  { id: "TR-96", patient: "PT-2304 — I. Khan", type: "TRALI", severity: "Critical", phase: "Monitoring", onset: "26m ago", tempRise: 1.1, labAction: "Respiratory support", htc: true },
];

const COMP_META = {
  RBC: { label: "Red Cells", icon: "rbc", shelf: "35 days", temp: "2–6°C" },
  PLT: { label: "Platelets", icon: "plt", shelf: "5 days", temp: "20–24°C" },
  FFP: { label: "Fresh Frozen Plasma", icon: "ffp", shelf: "365 days", temp: "≤ -18°C" },
  CRYO: { label: "Cryoprecipitate", icon: "cryo", shelf: "365 days", temp: "≤ -18°C" },
};

const STATUS_BADGE = {
  Available: { cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  Crossmatched: { cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
  Quarantined: { cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  Issued: { cls: "bg-violet-500/10 text-violet-300 border-violet-500/30", dot: "bg-violet-400" },
  Expired: { cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", dot: "bg-rose-400" },
};

const URGENCY_BADGE = {
  STAT: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  Urgent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Routine: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function expiryBand(days) {
  if (days <= 1) return { label: "Critical", cls: "text-rose-300 bg-rose-500/10 border-rose-500/40" };
  if (days <= 5) return { label: "Short", cls: "text-amber-300 bg-amber-500/10 border-amber-500/40" };
  return { label: "Stable", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/40" };
}

function sevBadge(sev) {
  if (sev === "Critical") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (sev === "Moderate") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

function phaseColor(phase) {
  if (phase === "Crossmatch" || phase === "Antiglobulin") return "text-sky-300";
  if (phase === "Type & Screen") return "text-slate-300";
  return "text-emerald-300";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function BloodBankHub() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [compFilter, setCompFilter] = useState("All");
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [donors, setDonors] = useState(INITIAL_DONORS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [reactions, setReactions] = useState(INITIAL_REACTIONS);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  const { toasts, addToast, removeToast } = useKindToasts();
  const [mtpActive, setMtpActive] = useState(false);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const tickRef = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { tickRef.current = tick; }, [tick]);

  /* ---------------- simulation tick loop ---------------- */
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      const n = Math.max(1, Math.round(speedRef.current));
      for (let s = 0; s < n; s += 1) {
        setTick((t) => t + 1);
        setUnits((prev) =>
          prev.map((u) => {
            if (u.status === "Expired") return u;
            const expiryDays = u.expiryDays - 0.08;
            if (expiryDays <= 0) return { ...u, expiryDays: 0, status: "Expired" };
            return { ...u, expiryDays };
          })
        );
      }
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  /* ---------------- periodic events (per tick) ---------------- */
  useEffect(() => {
    if (tick === 0) return;
    const r = Math.random();
    if (r < 0.16) {
      const t = BLOOD_TYPES[Math.floor(Math.random() * BLOOD_TYPES.length)];
      const comp = ["RBC", "PLT", "FFP", "CRYO"][Math.floor(Math.random() * 4)];
      const shelf = comp === "RBC" ? 35 : comp === "PLT" ? 5 : 365;
      setUnits((prev) => [
        ...prev,
        {
          id: `BB-${8853 + Math.floor(Math.random() * 900)}`,
          type: t, comp, collect: "0d ago",
          expiryDays: Math.max(1, Math.round(shelf * (0.4 + Math.random() * 0.55))),
          storage: comp === "PLT" ? "Platelet Agitator" : comp === "FFP" || comp === "CRYO" ? "Freezer -30°C" : "Fridge 2°–6°C",
          rack: `IN-${Math.floor(Math.random() * 8)}`,
          status: "Available", donor: `D-${2222 + Math.floor(Math.random() * 40)}`,
          screened: true, mtp: false,
        },
      ]);
      addToast(`New ${comp} unit (${t}) received from blood drive`, "success");
    }
    if (r > 0.78) {
      const t = BLOOD_TYPES[Math.floor(Math.random() * BLOOD_TYPES.length)];
      setUnits((prev) => {
        const candidates = prev.filter((u) => u.type === t && u.status === "Available" && u.comp === "RBC");
        if (candidates.length === 0) {
          addToast(`RBC demand spike — ${t} stock critically low`, "warn");
          return prev;
        }
        const victim = candidates[0];
        return prev.map((u) => (u.id === victim.id ? { ...u, status: "Issued" } : u));
      });
    }
    if (r > 0.9) {
      const sev = ["Mild", "Mild", "Moderate", "Critical"][Math.floor(Math.random() * 4)];
      setReactions((prev) => [
        {
          id: `TR-${97 + Math.floor(Math.random() * 90)}`,
          patient: `PT-${2300 + Math.floor(Math.random() * 60)} — Deferred Patient`,
          type: sev === "Critical" ? "TRALI" : sev === "Moderate" ? "TACO" : "Febrile non-haemolytic",
          severity: sev, phase: "Investigating", onset: "0m ago",
          tempRise: +(0.2 + Math.random() * 1.3).toFixed(1),
          labAction: sev === "Critical" ? "Immediate stop + DAT" : "Bilirubin pending",
          htc: sev === "Critical",
        },
        ...prev,
      ]);
      addToast(`New transfusion reaction reported (${sev})`, sev === "Critical" ? "error" : "warn");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  /* ---------------- derived data ---------------- */
  const stats = useMemo(() => {
    const available = units.filter((u) => u.status === "Available");
    const criticalExpiry = units.filter((u) => u.status === "Available" && u.expiryDays <= 2);
    const oNeg = available.filter((u) => u.type === "O-").length;
    const pendingOrders = orders.filter((o) => o.status === "Pending").length;
    const activeReactions = reactions.filter((r) => r.phase !== "Closed").length;
    return {
      total: available.length,
      criticalExpiry: criticalExpiry.length,
      oNeg,
      pendingOrders,
      activeReactions,
      mtp: mtpActive,
    };
  }, [units, orders, reactions, mtpActive]);

  const filteredUnits = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((u) => {
      if (typeFilter !== "All" && u.type !== typeFilter) return false;
      if (statusFilter !== "All" && u.status !== statusFilter) return false;
      if (compFilter !== "All" && u.comp !== compFilter) return false;
      if (q && !`${u.id} ${u.comp} ${u.type} ${u.rack} ${u.donor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [units, search, typeFilter, statusFilter, compFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (typeFilter !== "All" && o.type !== typeFilter) return false;
      if (statusFilter !== "All" && o.status !== statusFilter) return false;
      if (q && !`${o.id} ${o.patient} ${o.ward} ${o.product} ${o.phase} ${o.urgency}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, search, typeFilter, statusFilter]);

  const filteredReactions = useMemo(() => {
    const q = search.toLowerCase();
    return reactions.filter((r) => {
      if (statusFilter !== "All") {
        if (statusFilter === "Active" && r.phase === "Closed") return false;
        if (statusFilter === "Closed" && r.phase !== "Closed") return false;
      }
      if (q && !`${r.id} ${r.patient} ${r.type} ${r.severity}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reactions, search, statusFilter]);

  /* ---------------- actions ---------------- */
  const reset = useCallback(() => {
    setUnits(INITIAL_UNITS);
    setDonors(INITIAL_DONORS);
    setOrders(INITIAL_ORDERS);
    setReactions(INITIAL_REACTIONS);
    setMtpActive(false);
    setTick(0);
    setSearch("");
    setTypeFilter("All");
    setStatusFilter("All");
    setCompFilter("All");
    addToast("Simulation reset to baseline", "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "inventory"
      ? [["Unit", "Type", "Component", "Storage", "Rack", "Status", "ExpiryDays", "Donor"]].concat(
          filteredUnits.map((u) => [u.id, u.type, u.comp, u.storage, u.rack, u.status, u.expiryDays.toFixed(1), u.donor])
        )
      : activeTab === "crossmatch"
        ? [["Order", "Patient", "Ward", "Required", "PatientABO", "Product", "Phase", "Status", "Urgency"]].concat(
            filteredOrders.map((o) => [o.id, o.patient, o.ward, o.type, o.aboRh, o.product, o.phase, o.status, o.urgency])
          )
        : [["Reaction", "Patient", "Type", "Severity", "Phase", "Onset", "TempRise"]].concat(
            filteredReactions.map((r) => [r.id, r.patient, r.type, r.severity, r.phase, r.onset, r.tempRise])
          );
    downloadCsv(`blood-bank-${activeTab}.csv`, rows, "text/csv;charset=utf-8;");
    addToast("CSV exported", "success");
  }, [activeTab, filteredUnits, filteredOrders, filteredReactions, addToast]);

  const issueUnit = (id) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Issued" } : u)));
    addToast(`Unit ${id} issued for transfusion`, "success");
  };

  const releaseUnit = (id) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Available" } : u)));
    addToast(`Unit ${id} released back to inventory`, "info");
  };

  const advanceOrder = (id) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.phase === "Type & Screen") return { ...o, phase: "Crossmatch" };
        if (o.phase === "Crossmatch") return { ...o, phase: "Antiglobulin" };
        return { ...o, phase: "Antiglobulin", status: "Issued" };
      })
    );
    addToast(`Crossmatch advanced — ${id}`, "info");
  };

  const activateMtp = () => {
    setMtpActive((v) => {
      const next = !v;
      if (next) {
        setOrders((prev) => [
          ...prev,
          { id: "MTP-1", patient: "PT-2301 — T. Nwosu", ward: "ED Resus", type: "AB+", aboRh: "AB+", product: "RBC ×6 / FFP ×4 / PLT ×1", antibody: "None", phase: "Crossmatch", status: "Pending", urgency: "STAT", mtp: true, ordered: "0m ago" },
        ]);
      }
      addToast(next ? "MTP activated — emergency release standing" : "MTP deactivated", next ? "error" : "info");
      return next;
    });
  };

  const closeReaction = (id) => {
    setReactions((prev) => prev.map((r) => (r.id === id ? { ...r, phase: "Closed" } : r)));
    addToast(`Reaction ${id} closed — hemovigilance logged`, "success");
  };

  const verifyBedside = (id) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Verified" } : o)));
    addToast(`${id} — two-person bedside verification complete (ISBT 128)`, "success");
  };

  /* ---------------- render helpers ---------------- */
  const tabBtn = (key, label, icon) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        activeTab === key
          ? "bg-slate-800 text-white shadow-lg shadow-slate-950/40 border border-slate-700"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const typeChip = (t) => {
    const m = TYPE_META[t] || TYPE_META["O+"];
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border ${m.bg} ${m.border} px-2 py-0.5 text-xs font-bold ${m.color}`}>
        <Droplets className="h-3 w-3" />
        {t}
      </span>
    );
  };

  const statusBadge = (s) => {
    const b = STATUS_BADGE[s] || STATUS_BADGE.Available;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${b.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
        {s}
      </span>
    );
  };

  const filterBar = (extra) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records…"
          className="w-64 rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
      >
        <option>All</option>
        {BLOOD_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
      >
        {activeTab === "reactions" ? (
          <>
            <option>All</option>
            <option>Active</option>
            <option>Closed</option>
          </>
        ) : (
          ["All", "Available", "Crossmatched", "Quarantined", "Issued", "Expired"].map((s) => <option key={s}>{s}</option>)
        )}
      </select>
      {extra}
    </div>
  );

  const speedBtn = (v, label) => (
    <button
      onClick={() => setSpeed(v)}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
        speed === v ? "border-slate-600 bg-slate-700 text-white" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  /* ================= INVENTORY CONSOLE ================= */
  const inventoryConsole = (
    <div className="space-y-6">
      {/* storage snapshot strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Fridge 2–6°C", units: units.filter((u) => u.storage === "Fridge 2°–6°C" && u.status !== "Expired").length, icon: <Database className="h-4 w-4 text-sky-300" /> },
          { label: "Platelet Agitator", units: units.filter((u) => u.storage === "Platelet Agitator" && u.status !== "Expired").length, icon: <Zap className="h-4 w-4 text-amber-300" /> },
          { label: "Freezer ≤ -18°C", units: units.filter((u) => u.storage === "Freezer -30°C" && u.status !== "Expired").length, icon: <SnowflakeIcon className="h-4 w-4 text-cyan-300" /> },
          { label: "Quarantined hold", units: units.filter((u) => u.status === "Quarantined").length, icon: <ShieldAlert className="h-4 w-4 text-amber-300" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{s.units}</p>
          </div>
        ))}
      </div>

      {/* blood type availability */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">ABO/Rh Inventory Availability</h3>
            <p className="text-xs text-slate-500">On-shelf units per blood type — O− and AB− flagged for rare-stock policy</p>
          </div>
          <Droplets className="h-5 w-5 text-rose-300" />
        </div>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {BLOOD_TYPES.map((t) => {
            const m = TYPE_META[t];
            const count = units.filter((u) => u.type === t && u.status === "Available").length;
            const low = count <= 2;
            return (
              <div key={t} className={`rounded-lg border p-3 text-center ${m.bg} ${m.border}`}>
                <p className={`text-lg font-bold ${m.color}`}>{count}</p>
                <p className={`text-xs font-bold ${m.color}`}>{t}</p>
                {low && <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-rose-300"><AlertTriangle className="h-3 w-3" /> Low</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Adequate (≥3 units)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Low stock (&lt;3 units)</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> AABB 31st ed. inventory guidance</span>
        </div>
      </div>

      {/* units table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Component Inventory</h3>
            <p className="text-xs text-slate-500">{filteredUnits.length} units · ISBT 128 labelled · storage & expiry tracked</p>
          </div>
          {filterBar(
            <select
              value={compFilter}
              onChange={(e) => setCompFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
            >
              <option>All</option>
              {Object.keys(COMP_META).map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Component</th>
                <th className="px-5 py-3">Storage</th>
                <th className="px-5 py-3">Expiry</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => {
                const band = expiryBand(Math.ceil(u.expiryDays));
                return (
                  <tr key={u.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <button onClick={() => setModal({ kind: "unit", data: u })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">
                        {u.id}
                      </button>
                    </td>
                    <td className="px-5 py-3">{typeChip(u.type)}</td>
                    <td className="px-5 py-3 text-slate-300">{u.comp}<span className="ml-1 text-xs text-slate-500">{COMP_META[u.comp]?.label}</span></td>
                    <td className="px-5 py-3 text-xs text-slate-400">{u.storage}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${band.cls}`}>{u.expiryDays.toFixed(0)}d</span>
                      <span className="ml-2 text-xs text-slate-500">{band.label}</span>
                    </td>
                    <td className="px-5 py-3">{statusBadge(u.status)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {u.status === "Quarantined" && (
                          <button onClick={() => releaseUnit(u.id)} className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800">
                            Release
                          </button>
                        )}
                        {(u.status === "Available" || u.status === "Crossmatched") && (
                          <button onClick={() => issueUnit(u.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                            Issue
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUnits.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">No units match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* donor pipeline */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Donor Pipeline & Eligibility</h3>
            <p className="text-xs text-slate-500">FDA 21 CFR 630 screening · Hb ≥ 12.5 g/dL · 56-day deferral window</p>
          </div>
          <Users className="h-5 w-5 text-rose-300" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {donors.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{d.name}</span>
                {typeChip(d.type)}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{d.id} · {d.units} lifetime units</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`inline-flex items-center gap-1 ${d.status === "Eligible" ? "text-emerald-300" : d.status === "Cooling" ? "text-sky-300" : "text-amber-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${d.status === "Eligible" ? "bg-emerald-400" : d.status === "Cooling" ? "bg-sky-400" : "bg-amber-400"}`} />
                  {d.status}
                </span>
                <span className="text-slate-500">Hb {d.hemoglobin} g/dL</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Last: {d.lastDonation}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{d.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ================= CROSSMATCH CONSOLE ================= */
  const crossmatchConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Pending orders", value: stats.pendingOrders, icon: <Clock className="h-4 w-4 text-sky-300" /> },
          { label: "STAT lanes", value: orders.filter((o) => o.urgency === "STAT" && o.status === "Pending").length, icon: <Siren className="h-4 w-4 text-rose-300" /> },
          { label: "Antibody workups", value: orders.filter((o) => o.antibody !== "None").length, icon: <FlaskConical className="h-4 w-4 text-amber-300" /> },
          { label: "MTP status", value: mtpActive ? "ACTIVE" : "Standby", icon: <Zap className={`h-4 w-4 ${mtpActive ? "text-rose-300" : "text-slate-500"}`} /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${mtpActive && s.label === "MTP status" ? "border-rose-500/50 bg-rose-500/10" : "border-slate-800 bg-slate-900"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={`mt-2 text-2xl font-bold ${s.label === "MTP status" && mtpActive ? "text-rose-300" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Compatibility Queue</h3>
          <p className="text-xs text-slate-500">ABO/Rh + antiglobulin crossmatch · AABB 7.2 · electronic issue for no-antibody cases</p>
        </div>
        <div className="flex items-center gap-3">
          {filterBar(null)}
          <button
            onClick={activateMtp}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              mtpActive ? "border-rose-500/60 bg-rose-500/15 text-rose-300" : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            {mtpActive ? "MTP Active — Disarm" : "Activate MTP"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Patient / Ward</th>
                <th className="px-5 py-3">Required</th>
                <th className="px-5 py-3">Patient ABO/Rh</th>
                <th className="px-5 py-3">Antibody</th>
                <th className="px-5 py-3">Phase</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ kind: "order", data: o })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">
                      {o.id}
                    </button>
                    {o.mtp && <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">MTP</span>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-200">{o.patient}</p>
                    <p className="text-xs text-slate-500">{o.ward} · {o.ordered}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-slate-300">{o.product}</span>
                    <span className="ml-2 align-middle">{typeChip(o.type)}</span>
                  </td>
                  <td className="px-5 py-3">{typeChip(o.aboRh)}</td>
                  <td className="px-5 py-3">
                    {o.antibody === "None"
                      ? <span className="text-xs text-slate-500">None</span>
                      : <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">{o.antibody}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${phaseColor(o.phase)}`}>
                      <Activity className="h-3.5 w-3.5" />
                      {o.phase}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${URGENCY_BADGE[o.urgency]}`}>{o.urgency}</span>
                    <span className="ml-2 text-xs text-slate-400">{o.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {o.status === "Pending" && (
                        <>
                          <button onClick={() => advanceOrder(o.id)} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/20">
                            Advance
                          </button>
                          <button onClick={() => verifyBedside(o.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                            Verify
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No crossmatch orders match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">Compatibility Rules Engine</h3>
        </div>
        <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            O− RBC issued to any recipient in emergency; O− supply reserved when ABO unknown.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            AB+ plasma is the universal plasma donor; AB+ platelets reserve for neonates.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Historical antibody record auto-blocks electronic issue — manual antiglobulin crossmatch required.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            MTP releases uncrossmatched O− / AB+ in 3:1:1 ratio while crossmatch catches up.
          </div>
        </div>
      </div>
    </div>
  );

  /* ================= REACTIONS CONSOLE ================= */
  const reactionsConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active investigations", value: stats.activeReactions, icon: <Activity className="h-4 w-4 text-rose-300" /> },
          { label: "Critical (hemolytic/TRALI)", value: reactions.filter((r) => r.severity === "Critical" && r.phase !== "Closed").length, icon: <AlertTriangle className="h-4 w-4 text-rose-300" /> },
          { label: "Severity mix — Critical", value: `${Math.round((reactions.filter((r) => r.severity === "Critical").length / Math.max(1, reactions.length)) * 100)}%`, icon: <Gauge className="h-4 w-4 text-amber-300" /> },
          { label: "SHOT reports filed", value: reactions.filter((r) => r.phase === "Closed").length, icon: <FileText className="h-4 w-4 text-emerald-300" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Hemovigilance & Reaction Triage</h3>
            <p className="text-xs text-slate-500">Bedside two-person check · immediate stop on suspected reaction · SHOT / ISBT 128 reporting</p>
          </div>
          {filterBar(null)}
        </div>
        <div className="space-y-3">
          {filteredReactions.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <button onClick={() => setModal({ kind: "reaction", data: r })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">
                {r.id}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">{r.patient}</p>
                <p className="text-xs text-slate-500">{r.type} · onset {r.onset} · ΔT +{r.tempRise}°C</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sevBadge(r.severity)}`}>{r.severity}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.phase === "Closed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : r.phase === "Monitoring" ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${r.phase === "Closed" ? "bg-emerald-400" : r.phase === "Monitoring" ? "bg-sky-400" : "bg-amber-400"}`} />
                {r.phase}
              </span>
              <span className="hidden text-xs text-slate-400 lg:inline">{r.labAction}</span>
              {r.htc && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">HTC REVIEW</span>}
              {r.phase !== "Closed" && (
                <button onClick={() => closeReaction(r.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                  Close & Log
                </button>
              )}
            </div>
          ))}
          {filteredReactions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No reaction cases match the current filters.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-rose-300" />
          <h3 className="text-sm font-semibold text-white">Bedside Verification Protocol</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: "01", title: "Identity Check", body: "Two clinicians confirm patient name, DOB, and hospital ID band against the issued unit label before transfusion starts." },
            { step: "02", title: "Vitals Baseline", body: "Pre-transfusion HR, BP, temperature and SpO₂ recorded; observations repeated at 15 minutes, 1 hour, and end of unit." },
            { step: "03", title: "Stop Criteria", body: "Fever ≥1°C rise, rigors, hypotension, respiratory distress, or flank pain — stop immediately and return unit with paperwork." },
          ].map((s) => (
            <div key={s.step} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-bold text-rose-300">{s.step}</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ================= MODAL ================= */
  const renderModal = () => {
    if (!modal) return null;
    const { kind, data } = modal;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setModal(null)}>
        <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {kind === "unit" ? `Unit ${data.id} — ${data.comp}` : kind === "order" ? `Order ${data.id}` : `Reaction ${data.id}`}
            </h3>
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {kind === "unit" && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">{typeChip(data.type)}<span className="text-xs text-slate-400">{TYPE_META[data.type]?.role} · {TYPE_META[data.type]?.rarity}</span></div>
              <Row label="Component" value={`${data.comp} — ${COMP_META[data.comp]?.label}`} />
              <Row label="Storage" value={`${data.storage} · rack ${data.rack}`} />
              <Row label="Collected" value={data.collect} />
              <Row label="Expiry" value={`${data.expiryDays.toFixed(1)} days remaining (${COMP_META[data.comp]?.shelf} shelf-life)`} />
              <Row label="Donor" value={`${data.donor} · screened ${data.screened ? "yes" : "PENDING — quarantined"}`} />
              <Row label="Status" value={data.status} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                ISBT 128 barcode verified · AABB 31st ed. storage compliance ·{" "}
                {data.mtp ? "Eligible for MTP emergency release." : "Standard release workflow. Traceability ledger updated on issue."}
              </p>
            </div>
          )}
          {kind === "order" && (
            <div className="space-y-3 text-sm">
              <Row label="Patient" value={data.patient} />
              <Row label="Ward" value={data.ward} />
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-xs text-slate-400">Required type</span>
                {typeChip(data.type)}
              </div>
              <Row label="Patient ABO/Rh" value={data.aboRh} />
              <Row label="Product" value={data.product} />
              <Row label="Antibody" value={data.antibody} />
              <Row label="Phase" value={data.phase} />
              <Row label="Urgency" value={data.urgency} />
              <Row label="Ordered" value={data.ordered} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.antibody === "None"
                  ? "No historical antibodies on file — electronic issue pathway eligible after ABO/Rh confirmation."
                  : `${data.antibody} detected — manual antiglobulin crossmatch required; incompatible units flagged.`}
              </p>
            </div>
          )}
          {kind === "reaction" && (
            <div className="space-y-3 text-sm">
              <Row label="Patient" value={data.patient} />
              <Row label="Type" value={data.type} />
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-xs text-slate-400">Severity</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sevBadge(data.severity)}`}>{data.severity}</span>
              </div>
              <Row label="Phase" value={data.phase} />
              <Row label="Onset" value={data.onset} />
              <Row label="Temp rise" value={`+${data.tempRise}°C`} />
              <Row label="Lab action" value={data.labAction} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.htc
                  ? "Escalated to Hospital Transfusion Committee — hemovigilance review mandatory within 24h; SHOT report filed."
                  : "Routine hemovigilance follow-up; unit returned with paperwork for serologic investigation."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <Droplets className="h-6 w-6 text-rose-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Blood Bank & Transfusion Medicine</h1>
                <p className="text-sm text-slate-400">AABB 31st ed. · FDA 21 CFR 606 · ISBT 128 · hemovigilance & MTP orchestration</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                paused ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
              {[[1, "1×"], [2, "2×"], [4, "4×"]].map(([v, label]) => speedBtn(v, label))}
            </div>
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {/* stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Available units" value={stats.total} icon={<Boxes className="h-4 w-4 text-emerald-300" />} />
          <StatCard label="O− (universal donor)" value={stats.oNeg} icon={<Award className="h-4 w-4 text-rose-300" />} />
          <StatCard label="Expiring ≤ 2 days" value={stats.criticalExpiry} icon={<Timer className="h-4 w-4 text-amber-300" />} alert={stats.criticalExpiry > 2} />
          <StatCard label="Pending crossmatches" value={stats.pendingOrders} icon={<FlaskConical className="h-4 w-4 text-sky-300" />} />
          <StatCard label="Active reactions" value={stats.activeReactions} icon={<HeartPulse className="h-4 w-4 text-rose-300" />} alert={stats.activeReactions > 0} />
        </div>

        {/* tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabBtn("inventory", "Donor & Inventory", <Boxes className="h-4 w-4" />)}
          {tabBtn("crossmatch", "Crossmatch & Compatibility", <FlaskConical className="h-4 w-4" />)}
          {tabBtn("reactions", "Transfusion Safety", <HeartPulse className="h-4 w-4" />)}
        </div>

        {/* active console */}
        {activeTab === "inventory" && inventoryConsole}
        {activeTab === "crossmatch" && crossmatchConsole}
        {activeTab === "reactions" && reactionsConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">AABB · CAP · FDA cGMP · ISBT 128 compliance dashboard</span>
          <button onClick={() => addToast("Traceability ledger exported to audit archive", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
            <FileText className="h-3.5 w-3.5" /> Export audit archive
          </button>
        </div>
      </div>

      {/* modal */}
      {renderModal()}

      {/* toasts */}
      <KindToastTray toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */


function SnowflakeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="m20 16-4-4 4-4" />
      <path d="m4 8 4 4-4 4" />
      <path d="m16 4-4 4-4-4" />
      <path d="m8 20 4-4 4 4" />
    </svg>
  );
}
