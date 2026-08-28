import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Beaker, Bell, CheckCircle2, ChevronRight,
  Clock, Cross, Database, Download, Droplets, Eye, FileText, Filter, Fingerprint,
  FlaskConical, Gauge, HeartPulse, Info, Layers, PackageCheck, Pause, Play, Plus,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Stethoscope, Sun, Syringe, Thermometer, Timer, TrendingDown, TrendingUp,
  User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";
import { useKindToasts, KindToastTray } from "../../components/common/HubToasts";
import { DetailRow as Row, AlertStatCard as StatCard, MiniStat } from "../../components/common/HubCards";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const ALERT_META = {
  Critical: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Watch: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  Stable: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

const INCUBATOR_COLORS = {
  "Inc 1": "border-rose-500/40",
  "Inc 2": "border-sky-500/40",
  "Inc 3": "border-amber-500/40",
  "Inc 4": "border-emerald-500/40",
  "Inc 5": "border-violet-500/40",
  "Inc 6": "border-cyan-500/40",
  "Inc 7": "border-fuchsia-500/40",
  "Inc 8": "border-lime-500/40",
};

const INITIAL_INCUBATORS = [
  { id: "NC-01", infant: "NB-2201 — Baby Alvarez", ga: "28+2 wk", dob: "5d ago", setTemp: 36.8, actualTemp: 36.9, humidity: 62, o2: 28, hr: 148, rr: 52, spo2: 96, mode: "Servo", alarm: "Stable", weight: 1180 },
  { id: "NC-02", infant: "NB-2202 — Baby Chen", ga: "31+0 wk", dob: "3d ago", setTemp: 36.6, actualTemp: 36.3, humidity: 58, o2: 25, hr: 152, rr: 55, spo2: 94, mode: "Servo", alarm: "Watch", weight: 1420 },
  { id: "NC-03", infant: "NB-2203 — Baby Novak", ga: "26+5 wk", dob: "9d ago", setTemp: 37.0, actualTemp: 36.8, humidity: 68, o2: 35, hr: 144, rr: 48, spo2: 98, mode: "Servo", alarm: "Stable", weight: 940 },
  { id: "NC-04", infant: "NB-2204 — Baby Iwata", ga: "33+2 wk", dob: "2d ago", setTemp: 36.4, actualTemp: 36.6, humidity: 55, o2: 21, hr: 138, rr: 46, spo2: 99, mode: "Weaning", alarm: "Stable", weight: 1850 },
  { id: "NC-05", infant: "NB-2205 — Baby Mensah", ga: "29+4 wk", dob: "6d ago", setTemp: 36.9, actualTemp: 36.2, humidity: 64, o2: 30, hr: 156, rr: 58, spo2: 91, mode: "Servo", alarm: "Critical", weight: 1050 },
  { id: "NC-06", infant: "NB-2206 — Baby Larsen", ga: "35+1 wk", dob: "1d ago", setTemp: 36.2, actualTemp: 36.4, humidity: 50, o2: 21, hr: 132, rr: 42, spo2: 100, mode: "Weaning", alarm: "Stable", weight: 2210 },
  { id: "NC-07", infant: "NB-2207 — Baby Okafor", ga: "30+6 wk", dob: "4d ago", setTemp: 36.7, actualTemp: 36.5, humidity: 60, o2: 24, hr: 149, rr: 51, spo2: 97, mode: "Servo", alarm: "Stable", weight: 1290 },
  { id: "NC-08", infant: "NB-2208 — Baby Moreau", ga: "27+3 wk", dob: "11d ago", setTemp: 37.1, actualTemp: 36.9, humidity: 70, o2: 32, hr: 146, rr: 50, spo2: 95, mode: "Servo", alarm: "Watch", weight: 860 },
];

const INITIAL_FEEDING = [
  { id: "FD-301", infant: "NB-2201 — Baby Alvarez", method: "Breast milk + fortifier", volume: 18, freq: "q3h", intake: 142, target: 150, weight: 1180, gain: 14, intolerance: false, lastFeed: "40m ago" },
  { id: "FD-302", infant: "NB-2202 — Baby Chen", method: "Formula 24 cal/oz", volume: 22, freq: "q3h", intake: 158, target: 160, weight: 1420, gain: 18, intolerance: false, lastFeed: "20m ago" },
  { id: "FD-303", infant: "NB-2203 — Baby Novak", method: "TPN + minimal enteral", volume: 4, freq: "q6h", intake: 8, target: 60, weight: 940, gain: 9, intolerance: true, lastFeed: "1h ago" },
  { id: "FD-304", infant: "NB-2204 — Baby Iwata", method: "Breast milk", volume: 30, freq: "q3h", intake: 190, target: 180, weight: 1850, gain: 26, intolerance: false, lastFeed: "15m ago" },
  { id: "FD-305", infant: "NB-2205 — Baby Mensah", method: "TPN + breast milk", volume: 8, freq: "q4h", intake: 34, target: 80, weight: 1050, gain: 11, intolerance: true, lastFeed: "45m ago" },
  { id: "FD-306", infant: "NB-2206 — Baby Larsen", method: "Breast + bottle", volume: 35, freq: "q3h", intake: 210, target: 200, weight: 2210, gain: 30, intolerance: false, lastFeed: "10m ago" },
  { id: "FD-307", infant: "NB-2207 — Baby Okafor", method: "Breast milk + fortifier", volume: 20, freq: "q3h", intake: 165, target: 160, weight: 1290, gain: 16, intolerance: false, lastFeed: "30m ago" },
  { id: "FD-308", infant: "NB-2208 — Baby Moreau", method: "TPN + minimal enteral", volume: 3, freq: "q6h", intake: 6, target: 40, weight: 860, gain: 7, intolerance: true, lastFeed: "2h ago" },
];

const INITIAL_KANGAROO = [
  { id: "KC-401", infant: "NB-2204 — Baby Iwata", parent: "A. Iwata (mother)", session: "45 min", scheduled: "10:00", status: "Completed", benefit: "HR stable", skin: "Good" },
  { id: "KC-402", infant: "NB-2207 — Baby Okafor", parent: "J. Okafor (father)", session: "60 min", scheduled: "11:00", status: "In progress", benefit: "SpO₂ stable", skin: "Good" },
  { id: "KC-403", infant: "NB-2201 — Baby Alvarez", parent: "M. Alvarez (mother)", session: "60 min", scheduled: "13:30", status: "Scheduled", benefit: "—", skin: "—" },
  { id: "KC-404", infant: "NB-2206 — Baby Larsen", parent: "K. Larsen (mother)", session: "45 min", scheduled: "14:00", status: "Scheduled", benefit: "—", skin: "—" },
  { id: "KC-405", infant: "NB-2203 — Baby Novak", parent: "P. Novak (father)", session: "30 min", scheduled: "16:00", status: "Pending approval", benefit: "—", skin: "—" },
];

const INITIAL_LD = [
  { id: "LD-501", mother: "S. Reyes", ga: "38+6 wk", status: "Active labor", dilation: 6, station: "-1", complications: "None", nicuRisk: "Low", edd: "Today" },
  { id: "LD-502", mother: "T. Kim", ga: "36+2 wk", status: "Preterm labor", dilation: 4, station: "-2", complications: "PPROM", nicuRisk: "Medium", edd: "10d early" },
  { id: "LD-503", mother: "A. Dubois", ga: "31+4 wk", status: "Induction", dilation: 3, station: "-2", complications: "PET", nicuRisk: "High", edd: "6w early" },
  { id: "LD-504", mother: "N. Petrov", ga: "40+1 wk", status: "Active labor", dilation: 8, station: "0", complications: "None", nicuRisk: "Low", edd: "Today" },
  { id: "LD-505", mother: "J. Adeyemi", ga: "27+5 wk", status: "Antepartum", dilation: 1, station: "-3", complications: "PPROM + bleeding", nicuRisk: "Critical", edd: "12w early" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function alarmBadge(a) {
  const m = ALERT_META[a] || ALERT_META.Stable;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${a === "Critical" ? "bg-rose-400" : a === "Watch" ? "bg-amber-400" : "bg-emerald-400"}`} />{a}</span>;
}

function tempBand(t, set) {
  const diff = Math.abs(t - set);
  if (diff > 0.6) return { label: "Drift", cls: "text-rose-300" };
  if (diff > 0.3) return { label: "Adjusting", cls: "text-amber-300" };
  return { label: "On target", cls: "text-emerald-300" };
}

function nicuRisk(r) {
  if (r === "Critical") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (r === "High") return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  if (r === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function NeonatalNicuHub() {
  const [activeTab, setActiveTab] = useState("incubators");
  const [search, setSearch] = useState("");
  const [alarmFilter, setAlarmFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [incubators, setIncubators] = useState(INITIAL_INCUBATORS);
  const [feeding, setFeeding] = useState(INITIAL_FEEDING);
  const [kangaroo, setKangaroo] = useState(INITIAL_KANGAROO);
  const [ld, setLd] = useState(INITIAL_LD);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  const { toasts, addToast, removeToast } = useKindToasts();
  const speedRef = useRef(1);
  const pausedRef = useRef(false);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  /* ---------------- simulation tick loop ---------------- */
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      const n = Math.max(1, Math.round(speedRef.current));
      for (let s = 0; s < n; s += 1) {
        setTick((t) => t + 1);
        setIncubators((prev) =>
          prev.map((inc) => {
            const drift = +(inc.actualTemp + (Math.random() * 0.3 - 0.15)).toFixed(1);
            const spo2 = Math.max(88, Math.min(100, inc.spo2 + Math.round(Math.random() * 3 - 1.5)));
            const alarm = spo2 < 92 || Math.abs(drift - inc.setTemp) > 0.6 ? "Critical" : Math.abs(drift - inc.setTemp) > 0.3 ? "Watch" : "Stable";
            return { ...inc, actualTemp: drift, spo2, alarm };
          })
        );
      }
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  /* ---------------- periodic events ---------------- */
  useEffect(() => {
    if (tick === 0) return;
    const r = Math.random();
    if (r < 0.15) {
      setFeeding((prev) =>
        prev.map((f) => {
          const gain = +(f.gain + Math.random() * 2).toFixed(1);
          const intolerance = f.intolerance && Math.random() < 0.7;
          return { ...f, gain, intake: f.intake + Math.round(Math.random() * 6), intolerance };
        })
      );
    }
    if (r > 0.85) {
      const crit = incubators.filter((i) => i.alarm === "Critical").length;
      if (crit > 0) addToast(`${crit} incubator alarm(s) active — hypothermia/desaturation check`, "error");
    }
    if (r > 0.93) {
      setLd((prev) =>
        prev.map((m) => ({
          ...m,
          dilation: Math.min(10, m.dilation + 1),
          station: m.dilation >= 9 ? "+1" : m.station,
          status: m.dilation >= 9 ? "Pushing / delivery imminent" : m.status,
        }))
      );
      const delivering = ld.filter((m) => m.dilation >= 9).length;
      if (delivering > 0) addToast(`${delivering} delivery imminent — NICU team notified`, "warn");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  /* ---------------- derived data ---------------- */
  const stats = useMemo(() => {
    const occupied = incubators.length;
    const critical = incubators.filter((i) => i.alarm === "Critical").length;
    const watch = incubators.filter((i) => i.alarm === "Watch").length;
    const intolerant = feeding.filter((f) => f.intolerance).length;
    const avgGain = +(feeding.reduce((a, f) => a + f.gain, 0) / Math.max(1, feeding.length)).toFixed(1);
    const kangarooActive = kangaroo.filter((k) => k.status === "In progress").length;
    return { occupied, critical, watch, intolerant, avgGain, kangarooActive };
  }, [incubators, feeding, kangaroo]);

  const filteredIncubators = useMemo(() => {
    const q = search.toLowerCase();
    return incubators.filter((i) => {
      if (alarmFilter !== "All" && i.alarm !== alarmFilter) return false;
      if (q && !`${i.id} ${i.infant} ${i.ga} ${i.mode}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [incubators, search, alarmFilter]);

  const filteredFeeding = useMemo(() => {
    const q = search.toLowerCase();
    return feeding.filter((f) => {
      if (methodFilter !== "All" && f.method !== methodFilter) return false;
      if (q && !`${f.id} ${f.infant} ${f.method}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feeding, search, methodFilter]);

  const filteredKangaroo = useMemo(() => {
    const q = search.toLowerCase();
    return kangaroo.filter((k) => {
      if (statusFilter !== "All" && k.status !== statusFilter) return false;
      if (q && !`${k.id} ${k.infant} ${k.parent} ${k.status}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [kangaroo, search, statusFilter]);

  const filteredLd = useMemo(() => {
    const q = search.toLowerCase();
    return ld.filter((m) => {
      if (statusFilter !== "All" && m.nicuRisk !== statusFilter) return false;
      if (q && !`${m.id} ${m.mother} ${m.status} ${m.complications}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ld, search, statusFilter]);

  /* ---------------- actions ---------------- */
  const reset = useCallback(() => {
    setIncubators(INITIAL_INCUBATORS);
    setFeeding(INITIAL_FEEDING);
    setKangaroo(INITIAL_KANGAROO);
    setLd(INITIAL_LD);
    setTick(0);
    setSearch("");
    setAlarmFilter("All");
    setMethodFilter("All");
    setStatusFilter("All");
    addToast("Simulation reset to baseline", "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = useCallback(() => {
    const rows = activeTab === "incubators"
      ? [["Incubator", "Infant", "GA", "SetTemp", "ActualTemp", "Humidity", "O2%", "HR", "RR", "SpO2", "Mode", "Alarm", "Weight(g)"]].concat(
          filteredIncubators.map((i) => [i.id, i.infant, i.ga, i.setTemp, i.actualTemp, i.humidity, i.o2, i.hr, i.rr, i.spo2, i.mode, i.alarm, i.weight])
        )
      : activeTab === "feeding"
        ? [["Feed", "Infant", "Method", "Volume(ml)", "Freq", "Intake(ml/kg)", "Target", "Weight(g)", "Gain(g/d)", "Intolerance"]].concat(
            filteredFeeding.map((f) => [f.id, f.infant, f.method, f.volume, f.freq, f.intake, f.target, f.weight, f.gain, f.intolerance])
          )
        : [["KC", "Infant", "Parent", "Session", "Scheduled", "Status", "Benefit"]].concat(
            filteredKangaroo.map((k) => [k.id, k.infant, k.parent, k.session, k.scheduled, k.status, k.benefit])
          );
    downloadCsv(`nicu-${activeTab}.csv`, rows, "text/csv;charset=utf-8;");
    addToast("CSV exported", "success");
  }, [activeTab, filteredIncubators, filteredFeeding, filteredKangaroo, addToast]);

  const acknowledgeAlarm = (id) => {
    setIncubators((prev) => prev.map((i) => (i.id === id ? { ...i, alarm: "Watch" } : i)));
    addToast(`${id} alarm acknowledged — clinical check logged`, "info");
  };

  const markFed = (id) => {
    setFeeding((prev) => prev.map((f) => (f.id === id ? { ...f, lastFeed: "0m ago", intake: f.intake + f.volume } : f)));
    addToast(`${id} feeding recorded`, "success");
  };

  const startKangaroo = (id) => {
    setKangaroo((prev) => prev.map((k) => (k.id === id ? { ...k, status: "In progress", benefit: "Skin-to-skin started" } : k)));
    addToast(`${id} kangaroo care started`, "success");
  };

  const completeKangaroo = (id) => {
    setKangaroo((prev) => prev.map((k) => (k.id === id ? { ...k, status: "Completed", benefit: "Session completed" } : k)));
    addToast(`${id} kangaroo care completed`, "success");
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

  const filterBar = (extra) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search infants, feeds…"
          className="w-64 rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600"
        />
      </div>
      {activeTab === "incubators" && (
        <select
          value={alarmFilter}
          onChange={(e) => setAlarmFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
        >
          {["All", "Critical", "Watch", "Stable"].map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      {activeTab === "feeding" && (
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
        >
          {["All", "Breast milk", "Breast milk + fortifier", "Formula 24 cal/oz", "TPN + minimal enteral", "TPN + breast milk", "Breast + bottle"].map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      {activeTab === "kangaroo" && (
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
        >
          {["All", "Completed", "In progress", "Scheduled", "Pending approval"].map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
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

  /* ================= INCUBATOR CONSOLE ================= */
  const incubatorConsole = (
    <div className="space-y-6">
      {/* incubator cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filteredIncubators.map((inc) => {
          const tb = tempBand(inc.actualTemp, inc.setTemp);
          return (
            <div key={inc.id} className={`rounded-xl border p-5 ${inc.alarm === "Critical" ? "border-rose-500/50 bg-rose-500/5" : inc.alarm === "Watch" ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <button onClick={() => setModal({ kind: "incubator", data: inc })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{inc.id}</button>
                  <p className="mt-0.5 text-sm font-semibold text-white">{inc.infant}</p>
                  <p className="text-xs text-slate-500">GA {inc.ga} · birth {inc.dob} · {inc.weight}g</p>
                </div>
                {alarmBadge(inc.alarm)}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <MiniStat label="Temp" value={inc.actualTemp.toFixed(1)} sub={`set ${inc.setTemp.toFixed(1)}`} alert={Math.abs(inc.actualTemp - inc.setTemp) > 0.6} />
                <MiniStat label="SpO₂" value={inc.spo2} sub="%" alert={inc.spo2 < 92} />
                <MiniStat label="HR" value={inc.hr} sub="bpm" />
                <MiniStat label="RR" value={inc.rr} sub="/min" />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Droplets className="h-3.5 w-3.5 text-cyan-300" /> {inc.humidity}% RH</span>
                <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-amber-300" /> O₂ {inc.o2}%</span>
                <span className="text-slate-500">{inc.mode}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                <span className={`text-[11px] font-medium ${tb.cls}`}>{tb.label}</span>
                {inc.alarm !== "Stable" && (
                  <button onClick={() => acknowledgeAlarm(inc.id)} className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800">
                    Ack
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {filteredIncubators.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No incubators match the current filters.</div>
      )}
    </div>
  );

  /* ================= FEEDING CONSOLE ================= */
  const feedingConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Infants on feeds", value: feeding.length, icon: <Syringe className="h-4 w-4 text-emerald-300" /> },
          { label: "Feeding intolerance", value: stats.intolerant, icon: <AlertTriangle className="h-4 w-4 text-amber-300" />, alert: stats.intolerant > 0 },
          { label: "Avg daily gain", value: `${stats.avgGain} g/d`, icon: <TrendingUp className="h-4 w-4 text-sky-300" /> },
          { label: "Target: 15–30 g/d (preterm)", value: "AAP/Fenton", icon: <Gauge className="h-4 w-4 text-violet-300" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.alert ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={`mt-2 text-2xl font-bold ${s.alert ? "text-amber-300" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Feeding & Growth Tracking</h3>
            <p className="text-xs text-slate-500">Fenton growth charts · intake targets ml/kg/day · fortification per AAP guidance</p>
          </div>
          {filterBar(null)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Feed</th>
                <th className="px-5 py-3">Infant</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Volume</th>
                <th className="px-5 py-3">Intake</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Gain</th>
                <th className="px-5 py-3">Last feed</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeeding.map((f) => (
                <tr key={f.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ kind: "feeding", data: f })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{f.id}</button>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-300">{f.infant}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{f.method}</td>
                  <td className="px-5 py-3 text-slate-300">{f.volume} ml</td>
                  <td className="px-5 py-3">
                    <span className={`font-mono text-xs ${f.intake >= f.target ? "text-emerald-300" : "text-amber-300"}`}>{f.intake}</span>
                    <span className="text-[10px] text-slate-500"> ml/kg/d</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{f.target}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-300">{f.weight} g</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 font-mono text-xs ${f.gain >= 15 ? "text-emerald-300" : "text-amber-300"}`}>
                      <TrendingUp className="h-3 w-3" /> +{f.gain}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{f.lastFeed}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {f.intolerance && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">INTOL</span>}
                      <button onClick={() => markFed(f.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                        Record Feed
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFeeding.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-500">No feeding records match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ================= KANGAROO CONSOLE ================= */
  const kangarooConsole = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Sessions today", value: kangaroo.length, icon: <HeartPulse className="h-4 w-4 text-rose-300" /> },
          { label: "In progress", value: stats.kangarooActive, icon: <Users className="h-4 w-4 text-sky-300" /> },
          { label: "Completed", value: kangaroo.filter((k) => k.status === "Completed").length, icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" /> },
          { label: "Pending approval", value: kangaroo.filter((k) => k.status === "Pending approval").length, icon: <Clock className="h-4 w-4 text-amber-300" /> },
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

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Kangaroo Care Schedule</h3>
            <p className="text-xs text-slate-500">Skin-to-skin per WHO recommendations · parental bonding with vitals monitoring</p>
          </div>
          {filterBar(null)}
        </div>
        <div className="space-y-3 p-5">
          {filteredKangaroo.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <button onClick={() => setModal({ kind: "kangaroo", data: k })} className="font-mono text-xs font-semibold text-sky-300 hover:underline">{k.id}</button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">{k.infant}</p>
                <p className="text-xs text-slate-500">{k.parent} · {k.session} · scheduled {k.scheduled}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                k.status === "Completed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : k.status === "In progress" ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                : k.status === "Pending approval" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-slate-500/40 bg-slate-500/10 text-slate-300"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${k.status === "Completed" ? "bg-emerald-400" : k.status === "In progress" ? "bg-sky-400" : k.status === "Pending approval" ? "bg-amber-400" : "bg-slate-400"}`} />
                {k.status}
              </span>
              <span className="hidden text-xs text-slate-400 lg:inline">Benefit: {k.benefit}</span>
              {k.status === "Scheduled" && (
                <button onClick={() => startKangaroo(k.id)} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">
                  Start
                </button>
              )}
              {k.status === "In progress" && (
                <button onClick={() => completeKangaroo(k.id)} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/20">
                  Complete
                </button>
              )}
            </div>
          ))}
          {filteredKangaroo.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No kangaroo sessions match the current filters.</div>
          )}
        </div>
      </div>

      {/* L&D board */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Labor & Delivery Board — NICU Watch</h3>
            <p className="text-xs text-slate-500">Anticipated NICU admissions · risk-stratified delivery coordination</p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-slate-600"
          >
            {["All", "Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Mother</th>
                <th className="px-5 py-3">GA / EDD</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Cervix</th>
                <th className="px-5 py-3">Complications</th>
                <th className="px-5 py-3">NICU risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredLd.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-slate-200">{m.mother}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{m.ga} · {m.edd}</td>
                  <td className="px-5 py-3 text-xs text-slate-300">{m.status}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">D{m.dilation} · {m.station}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{m.complications}</td>
                  <td className="px-5 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${nicuRisk(m.nicuRisk)}`}>{m.nicuRisk}</span></td>
                </tr>
              ))}
              {filteredLd.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No L&D cases match the current filters.</td></tr>
              )}
            </tbody>
          </table>
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
              {kind === "incubator" ? `Incubator ${data.id}` : kind === "feeding" ? `Feeding ${data.id}` : `Kangaroo ${data.id}`}
            </h3>
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {kind === "incubator" && (
            <div className="space-y-3 text-sm">
              <Row label="Infant" value={data.infant} />
              <Row label="Gestational age" value={data.ga} />
              <Row label="Birth" value={data.dob} />
              <Row label="Set temp" value={`${data.setTemp.toFixed(1)}°C`} />
              <Row label="Actual temp" value={`${data.actualTemp.toFixed(1)}°C`} />
              <Row label="Humidity" value={`${data.humidity}% RH`} />
              <Row label="FiO₂" value={`${data.o2}%`} />
              <Row label="HR / RR" value={`${data.hr} bpm / ${data.rr} /min`} />
              <Row label="SpO₂" value={`${data.spo2}%`} />
              <Row label="Mode" value={data.mode} />
              <Row label="Weight" value={`${data.weight} g`} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.alarm === "Critical"
                  ? "Servo control drift or desaturation detected — nurse notified; skin temp probe rechecked per NICU protocol."
                  : "Incubator servo control active; humidity & oxygen titrated to maintain thermoneutral environment."}
              </p>
            </div>
          )}
          {kind === "feeding" && (
            <div className="space-y-3 text-sm">
              <Row label="Infant" value={data.infant} />
              <Row label="Method" value={data.method} />
              <Row label="Volume" value={`${data.volume} ml`} />
              <Row label="Frequency" value={data.freq} />
              <Row label="Intake" value={`${data.intake} ml/kg/d`} />
              <Row label="Target" value={`${data.target} ml/kg/d`} />
              <Row label="Weight" value={`${data.weight} g`} />
              <Row label="Daily gain" value={`+${data.gain} g/d`} />
              <Row label="Last feed" value={data.lastFeed} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                {data.intolerance
                  ? "Feeding intolerance flagged (gastric residuals / abdominal distension) — advance per slow-feed protocol with fortifier titration."
                  : "Feeding advances tolerated; fortification per AAP growth targets with Fenton chart percentiles tracked daily."}
              </p>
            </div>
          )}
          {kind === "kangaroo" && (
            <div className="space-y-3 text-sm">
              <Row label="Infant" value={data.infant} />
              <Row label="Parent" value={data.parent} />
              <Row label="Session" value={data.session} />
              <Row label="Scheduled" value={data.scheduled} />
              <Row label="Status" value={data.status} />
              <Row label="Benefit" value={data.benefit} />
              <Row label="Skin integrity" value={data.skin} />
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                Skin-to-skin care performed with infant vitals monitored continuously; per WHO KC guidance, sessions of 60+ minutes
                improve thermoregulation, breastfeeding and parent-infant bonding.
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
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5">
                <HeartPulse className="h-6 w-6 text-sky-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Maternal & Neonatal NICU</h1>
                <p className="text-sm text-slate-400">AAP NICU levels of care · Fenton growth charts · WHO kangaroo care · thermo-neutral care</p>
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
          <StatCard label="Occupied incubators" value={stats.occupied} icon={<Thermometer className="h-4 w-4 text-sky-300" />} />
          <StatCard label="Critical alarms" value={stats.critical} icon={<AlertTriangle className="h-4 w-4 text-rose-300" />} alert={stats.critical > 0} />
          <StatCard label="Watch alarms" value={stats.watch} icon={<Bell className="h-4 w-4 text-amber-300" />} />
          <StatCard label="Feeding intolerance" value={stats.intolerant} icon={<Syringe className="h-4 w-4 text-amber-300" />} alert={stats.intolerant > 0} />
          <StatCard label="Avg daily gain" value={`${stats.avgGain} g`} icon={<TrendingUp className="h-4 w-4 text-emerald-300" />} />
        </div>

        {/* tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabBtn("incubators", "Incubator Telemetry", <Thermometer className="h-4 w-4" />)}
          {tabBtn("feeding", "Feeding & Growth", <Syringe className="h-4 w-4" />)}
          {tabBtn("kangaroo", "Kangaroo Care & L&D", <HeartPulse className="h-4 w-4" />)}
        </div>

        {/* active console */}
        {activeTab === "incubators" && incubatorConsole}
        {activeTab === "feeding" && feedingConsole}
        {activeTab === "kangaroo" && kangarooConsole}

        {/* footer strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400"}`} />
            Live simulation {paused ? "paused" : `running at ${speed}×`} · tick #{tick}
          </span>
          <span className="hidden md:inline">AAP · WHO · Fenton · Vermont Oxford Network alignment</span>
          <button onClick={() => addToast("NICU census exported to Vermont Oxford Network format", "success")} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
            <Database className="h-3.5 w-3.5" /> Export census
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

