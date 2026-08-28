import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Calendar, CheckCircle2,
  ChevronRight, Clock, Cpu, Database, Download, Eye, FileText, Filter, Fingerprint,
  Gauge, Globe, HardDrive, Info, KeyRound, Layers, Lock, Network, Pause, Play,
  Plus, Radar, RefreshCw, Scale, Search, Server, ShieldAlert, ShieldCheck, Siren,
  Timer, TrendingDown, TrendingUp, User, Users, Wifi, WifiOff, Zap,
} from "lucide-react";
import { ExportCsvButton } from "../../components/common/ExportButton";
import { downloadCsv } from "../../utils/csv";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import ToastTray, { useToastTray } from "../../components/common/ToastTray";
import { PageHeader, Footer } from "../../components/common/PageHeader";
import { SectionHeader, PanelHeader } from "../../components/common/SectionHeader";
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { CompactSearch } from "../../components/common/SearchBox";
import { FilterChips } from "../../components/common/FilterChips";
import { Row } from "../../components/common/InfoRow";
import { EmptyState } from "../../components/common/EmptyState";
import { ToneBadge } from "../../components/common/ToneBadge";
import { TabsBar } from "../../components/common/TabsBar";
import { SimpleModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const ROBOTS = [
  { id: "rob-01", name: "DaVinci X — Unit 3", model: "Multi-arm console", room: "OR-1", status: "In Surgery", uptime: 4120, battery: 87, sterile: true, last: "12m ago", firmware: "v5.2.1", surgeon: "Dr. A. Verma", cases: 1284, alerts: 0 },
  { id: "rob-02", name: "DaVinci Xi — Unit 7", model: "Multi-arm console", room: "OR-4", status: "In Surgery", uptime: 3890, battery: 91, sterile: true, last: "3m ago", firmware: "v5.2.1", surgeon: "Dr. M. Chen", cases: 2102, alerts: 1 },
  { id: "rob-03", name: "Versius — Unit 12", model: "Modular arms", room: "OR-2", status: "Ready", uptime: 640, battery: 100, sterile: true, last: "1h ago", firmware: "v3.9.0", surgeon: "—", cases: 947, alerts: 0 },
  { id: "rob-04", name: "Hugo RAS — Unit 19", model: "Modular arms", room: "OR-5", status: "In Surgery", uptime: 4710, battery: 79, sterile: true, last: "6m ago", firmware: "v4.1.2", surgeon: "Dr. R. Patel", cases: 1661, alerts: 0 },
  { id: "rob-05", name: "Senhance — Unit 22", model: "Haptic feedback", room: "OR-7", status: "Maintenance", uptime: 210, battery: 63, sterile: false, last: "4h ago", firmware: "v2.8.4", surgeon: "—", cases: 388, alerts: 2 },
  { id: "rob-06", name: "DaVinci SP — Unit 25", model: "Single-port", room: "OR-3", status: "Ready", uptime: 890, battery: 96, sterile: true, last: "30m ago", firmware: "v5.1.0", surgeon: "—", cases: 574, alerts: 0 },
  { id: "rob-07", name: "Versius — Unit 31", model: "Modular arms", room: "OR-6", status: "In Surgery", uptime: 5120, battery: 74, sterile: true, last: "8m ago", firmware: "v3.9.0", surgeon: "Dr. L. Fischer", cases: 1190, alerts: 1 },
  { id: "rob-08", name: "Hugo RAS — Unit 40", model: "Modular arms", room: "OR-8", status: "Offline", uptime: 0, battery: 12, sterile: false, last: "26h ago", firmware: "v4.1.2", surgeon: "—", cases: 803, alerts: 1 },
];

const OR_SCHEDULE = [
  { id: "or-101", room: "OR-1", procedure: "Robotic Prostatectomy", surgeon: "Dr. A. Verma", specialty: "Urology", start: "08:00", dur: 210, status: "In Progress", progress: 62, priority: "Elective", staff: 5 },
  { id: "or-102", room: "OR-2", procedure: "Laparoscopic Cholecystectomy", surgeon: "Dr. S. Nair", specialty: "General", start: "09:30", dur: 90, status: "In Progress", progress: 45, priority: "Elective", staff: 4 },
  { id: "or-103", room: "OR-3", procedure: "Robotic Hysterectomy", surgeon: "Dr. M. Chen", specialty: "GYN", start: "10:15", dur: 180, status: "Scheduled", progress: 0, priority: "Elective", staff: 5 },
  { id: "or-104", room: "OR-4", procedure: "Robotic Nephrectomy", surgeon: "Dr. M. Chen", specialty: "Urology", start: "11:45", dur: 240, status: "Scheduled", progress: 0, priority: "Elective", staff: 5 },
  { id: "or-105", room: "OR-5", procedure: "Emergency Appendectomy", surgeon: "Dr. R. Patel", specialty: "General", start: "09:05", dur: 75, status: "In Progress", progress: 80, priority: "Urgent", staff: 4 },
  { id: "or-106", room: "OR-6", procedure: "Robotic Mitral Valve Repair", surgeon: "Dr. L. Fischer", specialty: "Cardiac", start: "07:30", dur: 300, status: "In Progress", progress: 34, priority: "Elective", staff: 7 },
  { id: "or-107", room: "OR-7", procedure: "Colorectal Resection", surgeon: "Dr. K. Brooks", specialty: "Colorectal", start: "13:00", dur: 200, status: "Scheduled", progress: 0, priority: "Elective", staff: 5 },
  { id: "or-108", room: "OR-8", procedure: "Trauma Laparotomy", surgeon: "On-call Trauma", specialty: "Trauma", start: "08:40", dur: 120, status: "In Progress", progress: 55, priority: "Emergent", staff: 6 },
];

const PROCEDURES = [
  { id: "prc-01", robot: "DaVinci X — Unit 3", room: "OR-1", proc: "Robotic Prostatectomy", surgeon: "Dr. A. Verma", elapsed: 88, elapsedMax: 210, phase: "Console — dissection", arms: 4, inst: 7, heart: 74, bp: "128/82", spo2: 98, tool: "Maryland forceps", toolCount: 41, flags: 0, notes: "Dissection progressing on schedule; blood loss minimal." },
  { id: "prc-02", robot: "DaVinci Xi — Unit 7", room: "OR-4", proc: "Robotic Nephrectomy", surgeon: "Dr. M. Chen", elapsed: 62, elapsedMax: 240, phase: "Port placement", arms: 4, inst: 6, heart: 68, bp: "122/78", spo2: 99, tool: "Monopolar scissors", toolCount: 29, flags: 0, notes: "Ports placed; docking in progress." },
  { id: "prc-03", robot: "Hugo RAS — Unit 19", room: "OR-5", proc: "Emergency Appendectomy", surgeon: "Dr. R. Patel", elapsed: 52, elapsedMax: 75, phase: "Closure", arms: 3, inst: 5, heart: 91, bp: "118/70", spo2: 97, tool: "Needle driver", toolCount: 18, flags: 1, notes: "Appendectomy complete; closure underway. BP slightly labile — anesthesiology notified." },
  { id: "prc-04", robot: "Versius — Unit 31", room: "OR-6", proc: "Robotic Mitral Valve Repair", surgeon: "Dr. L. Fischer", elapsed: 148, elapsedMax: 300, phase: "Cardiopulmonary bypass", arms: 4, inst: 8, heart: 0, bp: "—", spo2: 99, tool: "Valve sizers", toolCount: 53, flags: 0, notes: "On bypass; valve annuloplasty ring sizing underway." },
];

const INSTRUMENTS = [
  { id: "inst-01", name: "Maryland bipolar forceps", lot: "L-88213", robot: "Unit 3", uses: 7, limit: 10, status: "In Use", sterilized: "2h ago" },
  { id: "inst-02", name: "Monopolar curved scissors", lot: "L-77104", robot: "Unit 7", uses: 6, limit: 10, status: "In Use", sterilized: "1h ago" },
  { id: "inst-03", name: "Needle driver large", lot: "L-66027", robot: "Unit 19", uses: 8, limit: 10, status: "In Use", sterilized: "3h ago" },
  { id: "inst-04", name: "Prograsp forceps", lot: "L-55190", robot: "Unit 31", uses: 9, limit: 10, status: "In Use", sterilized: "4h ago" },
  { id: "inst-05", name: "Vessel sealer ext", lot: "L-44361", robot: "Unit 3", uses: 4, limit: 10, status: "Sterile Ready", sterilized: "40m ago" },
  { id: "inst-06", name: "Fenestrated bipolar", lot: "L-33845", robot: "Unit 7", uses: 3, limit: 10, status: "Sterile Ready", sterilized: "25m ago" },
  { id: "inst-07", name: "Large needle driver", lot: "L-22018", robot: "Unit 25", uses: 10, limit: 10, status: "Expired — Re-sterilize", sterilized: "1d ago" },
  { id: "inst-08", name: "Hot shears monopolar", lot: "L-11907", robot: "Unit 12", uses: 2, limit: 10, status: "In Sterilizer", sterilized: "12m ago" },
];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Offline", "Maintenance", "Emergent", "Expired — Re-sterilize"].includes(v)) return "red";
  if (["Ready", "Scheduled", "Sterile Ready", "In Sterilizer"].includes(v)) return "green";
  if (["In Surgery", "In Progress", "Urgent"].includes(v)) return "sky";
  return "slate";
};



const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;

const Meter = ({ value, color = "bg-emerald-400" }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-800">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);




const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Live simulation hook                                               */
/* ------------------------------------------------------------------ */

function useSimulation({ robotRef, orRef, procRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    setTick((tk) => tk + 1);

    // Procedure progress + vitals creep
    procRef.current = procRef.current.map((p) => {
      const elapsed = p.elapsed + 0.8;
      const phase = elapsed > p.elapsedMax * 0.9 ? "Closing / hand-off" : elapsed > p.elapsedMax * 0.6 ? "Console — dissection" : p.phase;
      return {
        ...p,
        elapsed,
        phase,
        heart: p.heart > 0 ? Math.max(60, Math.min(110, Math.round(p.heart + (Math.random() * 4 - 2)))) : 0,
        spo2: Math.max(95, Math.min(100, Math.round(p.spo2 + (Math.random() * 1 - 0.5)))),
        toolCount: p.toolCount + (Math.random() < 0.3 ? 1 : 0),
      };
    });

    // OR progress creep
    orRef.current = orRef.current.map((o) => {
      if (o.status !== "In Progress") return o;
      const progress = Math.min(100, o.progress + 0.6 + Math.random());
      const status = progress >= 100 ? "Completed" : "In Progress";
      if (progress >= 100) toast(`${o.procedure} completed in ${o.room}`, "Low");
      return { ...o, progress, status };
    });

    // Robot heartbeat
    robotRef.current = robotRef.current.map((r) => {
      if (r.status === "Offline") return r;
      const uptime = r.status === "In Surgery" ? r.uptime + 0.5 : r.uptime;
      const battery = r.status === "In Surgery" ? Math.max(30, Math.round(r.battery - 0.1)) : r.battery;
      const alerts = Math.max(0, r.alerts + (Math.random() < 0.02 ? 1 : 0));
      return { ...r, uptime: Math.round(uptime), battery, alerts };
    });
  }, [robotRef, orRef, procRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      robotRef.current = ROBOTS.map((r) => ({ ...r }));
      orRef.current = OR_SCHEDULE.map((o) => ({ ...o }));
      procRef.current = PROCEDURES.map((p) => ({ ...p }));
      setTick(0);
      toast("OR orchestration reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SurgicalRoboticsHub() {
  const [tab, setTab] = useState("fleet");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [instFilter, setInstFilter] = useState("All");

  const { toasts, toast, removeToast } = useToastTray();

  const [robots, setRobots] = useState(() => ROBOTS.map((r) => ({ ...r })));
  const [orList, setOrList] = useState(() => OR_SCHEDULE.map((o) => ({ ...o })));
  const [procedures, setProcedures] = useState(() => PROCEDURES.map((p) => ({ ...p })));
  const [instruments, setInstruments] = useState(() => INSTRUMENTS.map((i) => ({ ...i })));

  const robotRef = useRef(robots);
  const orRef = useRef(orList);
  const procRef = useRef(procedures);

  useEffect(() => { robotRef.current = robots; }, [robots]);
  useEffect(() => { orRef.current = orList; }, [orList]);
  useEffect(() => { procRef.current = procedures; }, [procedures]);

  const sim = useSimulation({ robotRef, orRef, procRef, toast });

  useEffect(() => {
    setRobots([...robotRef.current]);
    setOrList([...orRef.current]);
    setProcedures([...procRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const inSurgery = robots.filter((r) => r.status === "In Surgery").length;
    const inProgress = orList.filter((o) => o.status === "In Progress").length;
    const flags = procedures.reduce((a, p) => a + p.flags, 0);
    const expiring = instruments.filter((i) => i.uses >= i.limit || i.status === "Expired — Re-sterilize").length;
    return { inSurgery, inProgress, flags, expiring };
  }, [robots, orList, procedures, instruments]);

  /* ---------- filters ---------- */
  const filteredRobots = useMemo(() => {
    return robots.filter((r) => {
      const q = query.toLowerCase();
      const matchQ = !q || [r.name, r.model, r.room, r.surgeon, r.firmware].some((s) => s.toLowerCase().includes(q));
      const matchS = statusFilter === "All" || r.status === statusFilter;
      return matchQ && matchS;
    });
  }, [robots, query, statusFilter]);

  const filteredOr = useMemo(() => {
    return orList.filter((o) => {
      const q = query.toLowerCase();
      const matchQ = !q || [o.room, o.procedure, o.surgeon, o.specialty].some((s) => s.toLowerCase().includes(q));
      const matchP = priorityFilter === "All" || o.priority === priorityFilter;
      return matchQ && matchP;
    });
  }, [orList, query, priorityFilter]);

  const filteredInstruments = useMemo(() => {
    return instruments.filter((i) => {
      const q = query.toLowerCase();
      const matchQ = !q || [i.name, i.lot, i.robot].some((s) => s.toLowerCase().includes(q));
      const matchS = instFilter === "All" || i.status === instFilter;
      return matchQ && matchS;
    });
  }, [instruments, query, instFilter]);

  /* ---------- actions ---------- */
  const cycleRobot = (id) => {
    setRobots((rs) => rs.map((r) => (r.id === id ? { ...r, status: r.status === "Offline" ? "Ready" : "Offline", alerts: 0 } : r)));
    toast("Robot status cycled", "Low");
  };

  const markComplete = (id) => {
    setOrList((os) => os.map((o) => (o.id === id ? { ...o, status: "Completed", progress: 100 } : o)));
    toast("Procedure marked complete", "Low");
  };

  const resterilize = (id) => {
    setInstruments((is) => is.map((i) => (i.id === id ? { ...i, status: "In Sterilizer", uses: 0 } : i)));
    toast("Instrument sent for sterilization", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "fleet"
        ? [["ID", "Robot", "Model", "Room", "Status", "Uptime (min)", "Battery %", "Firmware", "Surgeon"], ...filteredRobots.map((r) => [r.id, r.name, r.model, r.room, r.status, r.uptime, r.battery, r.firmware, r.surgeon])]
        : tab === "schedule"
        ? [["ID", "Room", "Procedure", "Surgeon", "Start", "Duration (min)", "Status", "Progress %", "Priority"], ...filteredOr.map((o) => [o.id, o.room, o.procedure, o.surgeon, o.start, o.dur, o.status, Math.round(o.progress), o.priority])]
        : [["ID", "Instrument", "Lot", "Robot", "Uses", "Limit", "Status", "Sterilized"], ...filteredInstruments.map((i) => [i.id, i.name, i.lot, i.robot, i.uses, i.limit, i.status, i.sterilized])];
    downloadCsv(`surgical-robotics-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "fleet", label: "Robot Fleet", icon: Bot },
    { id: "schedule", label: "OR Schedule & Utilization", icon: Calendar },
    { id: "telemetry", label: "Live Procedure Telemetry", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <ToastTray toasts={toasts} onDismiss={removeToast} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<Bot size={24} className="text-emerald-400" />}
            title="Surgical Robotics &amp; OR Orchestration Hub"
            subtitle="Robot fleet · OR scheduling &amp; utilization · live procedure telemetry — AAMI/IEC 80601-2-77 aligned"
          />
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
          <StatCard icon={Bot} label="Robots In Surgery" value={stats.inSurgery} sub={`${robots.length} unit fleet`} accent="text-sky-400" />
          <StatCard icon={Calendar} label="Active OR Procedures" value={stats.inProgress} sub="live rooms on schedule" accent="text-emerald-400" />
          <StatCard icon={AlertTriangle} label="Telemetry Flags" value={stats.flags} sub="procedure anomalies" accent={stats.flags > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Timer} label="Instruments Needing Care" value={stats.expiring} sub="limit reached / re-sterilize" accent={stats.expiring > 0 ? "text-amber-400" : "text-emerald-400"} />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search robots, ORs, instruments…" />
          {tab === "fleet" && (
            <FilterChips options={["All", "In Surgery", "Ready", "Maintenance", "Offline"]} value={statusFilter} onChange={setStatusFilter} />
          )}
          {tab === "schedule" && (
            <FilterChips options={["All", "Elective", "Urgent", "Emergent"]} value={priorityFilter} onChange={setPriorityFilter} />
          )}
          {tab === "telemetry" && (
            <FilterChips options={["All", "In Use", "Sterile Ready", "In Sterilizer", "Expired — Re-sterilize"]} value={instFilter} onChange={setInstFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= ROBOT FLEET TAB ================= */}
        {tab === "fleet" && (
          <div className="space-y-6">
            {/* fleet cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRobots.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setModal({ kind: "robot", data: r })}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu size={15} className={r.status === "In Surgery" ? "text-sky-400" : r.status === "Offline" ? "text-red-400" : "text-emerald-400"} />
                      <span className="text-[11px] font-bold tracking-wide text-slate-300">{r.id}</span>
                    </div>
                    <Badge>{r.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-200">{r.name}</p>
                  <p className="text-[10px] text-slate-500">{r.model} · {r.room}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Battery</span>
                      <span>{r.battery}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${r.battery > 70 ? "bg-emerald-400" : r.battery > 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${r.battery}%` }} />
                    </div>
                    <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                      <span>{r.cases.toLocaleString()} lifetime cases</span>
                      <span className={r.alerts > 0 ? "font-semibold text-red-400" : ""}>{r.alerts} alerts</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredRobots.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                  <EmptyState icon={Bot} message="No robots match the current filters." />
                </div>
              )}
            </section>

            {/* firmware strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Layers size={16} className="text-purple-400" />} title="Fleet Firmware &amp; Service Posture" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {["v5.2.1", "v4.1.2", "v3.9.0", "v2.8.4"].map((fw) => {
                  const count = robots.filter((r) => r.firmware === fw).length;
                  return (
                    <div key={fw} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <p className="font-mono text-sm font-bold text-slate-100">{fw}</p>
                      <p className="text-[10px] text-slate-500">{count} unit{count === 1 ? "" : "s"} · {count > 0 && fw === "v2.8.4" ? "service due" : "current"}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ================= OR SCHEDULE TAB ================= */}
        {tab === "schedule" && (
          <div className="space-y-6">
            {/* utilization strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "ORs Occupied", value: orList.filter((o) => o.status === "In Progress").length, color: "text-sky-400" },
                { label: "Scheduled Today", value: orList.filter((o) => o.status === "Scheduled").length, color: "text-emerald-400" },
                { label: "Completed", value: orList.filter((o) => o.status === "Completed").length, color: "text-purple-400" },
                { label: "Avg Progress", value: `${Math.round(orList.reduce((a, o) => a + o.progress, 0) / Math.max(1, orList.length))}%`, color: "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                </div>
              ))}
            </section>

            {/* OR board */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Calendar size={16} className="text-emerald-400" />}
                title="Operating Room Board"
                badge={`${filteredOr.length} rooms`}
                right="live progress · priority-coded"
              />
              {filteredOr.length === 0 ? (
                <EmptyState icon={Bot} message="No OR cases match the current filters." />
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filteredOr.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        o.priority === "Emergent" ? "bg-red-500/15 text-red-400" : o.priority === "Urgent" ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-400"
                      }`}>
                        {o.priority === "Emergent" ? <Siren size={15} /> : o.priority === "Urgent" ? <Zap size={15} /> : <Calendar size={15} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button className="flex items-center gap-2 text-left" onClick={() => setModal({ kind: "or", data: o })}>
                          <p className="truncate text-xs font-medium text-slate-200">{o.procedure}</p>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">{o.room}</span>
                        </button>
                        <p className="mt-0.5 text-[10px] text-slate-500">{o.surgeon} · {o.specialty} · starts {o.start} · {o.dur} min</p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <Badge>{o.status}</Badge>
                        <Badge>{o.priority}</Badge>
                        <div className="ml-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-300">{Math.round(o.progress)}%</span>
                          <Meter value={o.progress} color={o.progress >= 100 ? "bg-emerald-400" : o.priority === "Emergent" ? "bg-red-400" : "bg-sky-400"} />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {o.status === "In Progress" && (
                          <button
                            onClick={() => markComplete(o.id)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ kind: "or", data: o })}
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= LIVE TELEMETRY TAB ================= */}
        {tab === "telemetry" && (
          <div className="space-y-6">
            {/* live procedure feed */}
            <section className="grid gap-3 xl:grid-cols-2">
              {procedures.map((p) => {
                const pct = Math.min(100, Math.round((p.elapsed / p.elapsedMax) * 100));
                const minutes = Math.floor(p.elapsed);
                const hrs = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return (
                  <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                          <Activity size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{p.proc}</p>
                          <p className="text-[10px] text-slate-500">{p.robot} · {p.room} · {p.surgeon}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{p.phase}</Badge>
                        {p.flags > 0 && <Badge tone="red">{p.flags} flag{p.flags > 1 ? "s" : ""}</Badge>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-[10px] text-slate-500">elapsed {hrs > 0 ? `${hrs}h ` : ""}{mins}m / {p.elapsedMax}m</span>
                      <div className="h-1.5 flex-1 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${pct >= 90 ? "bg-amber-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                        <p className="text-[9px] uppercase text-slate-500">HR</p>
                        <p className={`text-sm font-bold ${p.heart === 0 ? "text-slate-500" : "text-slate-200"}`}>{p.heart === 0 ? "—" : p.heart}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                        <p className="text-[9px] uppercase text-slate-500">BP</p>
                        <p className="text-sm font-bold text-slate-200">{p.bp}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                        <p className="text-[9px] uppercase text-slate-500">SpO₂</p>
                        <p className="text-sm font-bold text-emerald-400">{p.spo2}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                        <p className="text-[9px] uppercase text-slate-500">Tools</p>
                        <p className="text-sm font-bold text-slate-200">{p.toolCount}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[10px] text-slate-500">
                        {p.arms} arms · {p.inst} instruments · active tool: <span className="text-slate-300">{p.tool}</span>
                      </p>
                      <button
                        onClick={() => setModal({ kind: "proc", data: p })}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        Inspect
                      </button>
                    </div>
                    {p.notes && (
                      <p className={`mt-2 rounded-lg border p-2.5 text-[10px] leading-relaxed ${p.flags > 0 ? "border-amber-500/30 bg-amber-500/5 text-amber-200/80" : "border-slate-800 bg-slate-950 text-slate-500"}`}>
                        {p.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>

            {/* instrument lifecycle */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<HardDrive size={16} className="text-amber-400" />}
                title="Instrument Lifecycle &amp; Sterility"
                badge={`${filteredInstruments.length} instruments`}
                right="10-use limit · AAMI ST79 sterilization tracking"
              />
              {filteredInstruments.length === 0 ? (
                <EmptyState icon={Bot} message="No instruments match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Instrument</th>
                        <th className="px-4 py-3">Lot</th>
                        <th className="px-4 py-3">Assigned Robot</th>
                        <th className="px-4 py-3">Uses</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Last Sterilized</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstruments.map((i) => {
                        const nearLimit = i.uses >= i.limit;
                        return (
                          <tr key={i.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <p className={`font-medium ${nearLimit ? "text-red-300" : "text-slate-200"}`}>{i.name}</p>
                              <p className="text-[10px] text-slate-500">{i.id}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">{i.lot}</td>
                            <td className="px-4 py-3 text-slate-400">{i.robot}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-bold ${nearLimit ? "text-red-400" : "text-slate-300"}`}>{i.uses}/{i.limit}</span>
                                <Meter value={(i.uses / i.limit) * 100} color={nearLimit ? "bg-red-400" : i.uses >= i.limit * 0.7 ? "bg-amber-400" : "bg-emerald-400"} />
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge>{i.status}</Badge></td>
                            <td className="px-4 py-3 text-slate-400">{i.sterilized}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {i.status !== "In Sterilizer" && (
                                  <button
                                    onClick={() => resterilize(i.id)}
                                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20"
                                  >
                                    Re-sterilize
                                  </button>
                                )}
                                <button
                                  onClick={() => setModal({ kind: "inst", data: i })}
                                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                                >
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "robot" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.model}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">fw {modal.data.firmware}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.cases.toLocaleString()} cases</span>
          </div>
          <Row label="Location" value={modal.data.room} />
          <Row label="Uptime (session)" value={`${modal.data.uptime} minutes`} />
          <Row label="Battery" value={`${modal.data.battery}%`} accent={modal.data.battery > 70 ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Sterile Wrap" value={modal.data.sterile ? "Validated" : "Not sealed"} />
          <Row label="Attending Surgeon" value={modal.data.surgeon} />
          <Row label="Last Heartbeat" value={modal.data.last} />
          <Row label="Active Alerts" value={String(modal.data.alerts)} accent={modal.data.alerts > 0 ? "text-red-400" : "text-slate-200"} />
          <button
            onClick={() => { cycleRobot(modal.data.id); setModal(null); }}
            className="w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            {modal.data.status === "Offline" ? "Bring Online" : "Take Offline"}
          </button>
        </Modal>
      )}

      {modal?.kind === "or" && (
        <Modal title={modal.data.procedure} subtitle={`${modal.data.room} · ${modal.data.specialty}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <Badge>{modal.data.priority}</Badge>
          </div>
          <Row label="Surgeon" value={modal.data.surgeon} />
          <Row label="Scheduled Start" value={modal.data.start} />
          <Row label="Allocated Duration" value={`${modal.data.dur} minutes`} />
          <Row label="Progress" value={`${Math.round(modal.data.progress)}%`} />
          <Row label="Care Team" value={`${modal.data.staff} personnel`} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            OR orchestration binds the room block, robotic unit, instrument tray set, anesthesia and circulating staff. Priority Emergent/Urgent cases can preempt elective starts with a 15-minute room turnaround SLA.
          </p>
          {modal.data.status === "In Progress" && (
            <button
              onClick={() => { markComplete(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Mark Complete
            </button>
          )}
        </Modal>
      )}

      {modal?.kind === "proc" && (
        <Modal title={modal.data.proc} subtitle={`${modal.data.room} · ${modal.data.surgeon}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.phase}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.robot}</span>
          </div>
          <Row label="Elapsed" value={`${Math.floor(modal.data.elapsed / 60)}h ${Math.floor(modal.data.elapsed % 60)}m / ${modal.data.elapsedMax}m`} />
          <Row label="Heart Rate" value={modal.data.heart === 0 ? "On bypass" : String(modal.data.heart)} />
          <Row label="Blood Pressure" value={modal.data.bp} />
          <Row label="SpO₂" value={`${modal.data.spo2}%`} />
          <Row label="Active Tool" value={modal.data.tool} />
          <Row label="Tool Swaps" value={String(modal.data.toolCount)} />
          <Row label="Robotic Arms" value={String(modal.data.arms)} />
          {modal.data.notes && (
            <p className={`rounded-lg border p-3 text-[11px] leading-relaxed ${modal.data.flags > 0 ? "border-amber-500/30 bg-amber-500/5 text-amber-200/80" : "border-slate-800 bg-slate-950 text-slate-400"}`}>
              {modal.data.notes}
            </p>
          )}
        </Modal>
      )}

      {modal?.kind === "inst" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · lot ${modal.data.lot}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">limit {modal.data.limit} uses</span>
          </div>
          <Row label="Assigned Robot" value={modal.data.robot} />
          <Row label="Uses" value={`${modal.data.uses} / ${modal.data.limit}`} accent={modal.data.uses >= modal.data.limit ? "text-red-400" : "text-slate-200"} />
          <Row label="Last Sterilized" value={modal.data.sterilized} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Each instrument carries a validated sterilization cycle record and a hard 10-use limit. Exceeding the limit flags the item for quarantine; reprocessing follows AAMI ST79 parameters with a chemical + biological indicator.
          </p>
          {modal.data.status !== "In Sterilizer" && (
            <button
              onClick={() => { resterilize(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-amber-500/15 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            >
              Send for Sterilization
            </button>
          )}
        </Modal>
      )}

      <Footer>
        Surgical Robotics &amp; OR Orchestration Hub — IEC 80601-2-77, AAMI ST79, ISO 13485 · simulation environment · not connected to live devices
      </Footer>
    </div>
  );
}
