import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Calendar, CheckCircle2,
  ChevronRight, Clock, Cpu, Database, Download, Eye, FileText, Filter, Fingerprint,
  Gauge, Globe, HardDrive, Info, KeyRound, Layers, Lock, Network, Pause, Play,
  Plus, Radar, RefreshCw, Scale, Search, Server, ShieldAlert, ShieldCheck, Siren,
  Timer, TrendingDown, TrendingUp, User, Users, Wifi, WifiOff, Zap,
} from "lucide-react";
import { ExportCsvButton } from "../../components/common/ExportButton";
// Shared primitives this console renders. The extraction into src/components/common removed the
// page-local definitions; these imports replace them. Without them each name is a free variable and
// the first render throws, which is what the console did before this line existed.
import ToastTray, { useToastTray } from "../../components/common/ToastTray";
import { PageHeader, Footer } from "../../components/common/PageHeader";
import { SectionHeader, PanelHeader } from "../../components/common/SectionHeader";
import { downloadCsv } from "../../utils/csv";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { CompactStatCard as StatCard } from "../../components/common/StatCard";
import { CompactSearch } from "../../components/common/SearchBox";
import { FilterChips } from "../../components/common/FilterChips";
import { Row } from "../../components/common/InfoRow";
import { EmptyState } from "../../components/common/EmptyState";
import { ToneBadge } from "../../components/common/ToneBadge";
import { TabsBar } from "../../components/common/TabsBar";
import { SimpleModal as Modal } from "../../components/common/Modal";
import { Sparkline } from "../../components/common/Sparkline";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const ADVERSE_EVENTS = [
  { id: "ae-9001", patient: "P-4471", drug: "Metformin 500mg", reaction: "Severe hypoglycemia", sev: "Serious", status: "Investigating", outcome: "Hospitalized", reporter: "Dr. Priya Sharma", ts: "12m ago", region: "EMEA", score: 92, caseId: "EMEA2026-00441", detail: "Patient presented with blood glucose 32 mg/dL two hours after the second dose. Treated with IV dextrose; being observed overnight. Reporting obligation: expedited (15-day) to EMA." },
  { id: "ae-9002", patient: "P-8830", drug: "Trastuzumab infusion", reaction: "Infusion-related reaction", sev: "Serious", status: "Investigating", outcome: "Recovered", reporter: "Dr. Lena Fischer", ts: "38m ago", region: "NA", score: 88, caseId: "NA2026-03112", detail: "Grade 3 chills and hypotension during cycle 2 infusion; halted, treated with diphenhydramine, restarted at reduced rate. Causality assessment in progress." },
  { id: "ae-9003", patient: "P-1120", drug: "Warfarin 5mg", reaction: "INR elevation 4.8", sev: "Serious", status: "Open", outcome: "Recovered", reporter: "Raj Mehta", ts: "1h ago", region: "APAC", score: 76, caseId: "APAC2026-00887", detail: "Routine INR check returned 4.8 (target 2–3). Dose held; no bleeding events. Follow-up in 48h. Considered reportable per RMP criteria." },
  { id: "ae-9004", patient: "P-6655", drug: "Amoxicillin 875mg", reaction: "Skin rash", sev: "Non-serious", status: "Open", outcome: "Recovered", reporter: "Temp Staff - Karen W.", ts: "2h ago", region: "EMEA", score: 44, caseId: "EMEA2026-00442", detail: "Mild maculopapular rash on day 6 of a 10-day course. Antihistamine prescribed; photos uploaded to the case file." },
  { id: "ae-9005", patient: "P-2210", drug: "Atorvastatin 40mg", reaction: "Myalgia", sev: "Non-serious", status: "Closed", outcome: "Recovered", reporter: "Dr. Amir Hassan", ts: "4h ago", region: "NA", score: 35, caseId: "NA2026-03113", detail: "Muscle aches reported at 6 weeks; CK normal. Restarted at 20mg; no recurrence at last contact." },
  { id: "ae-9006", patient: "P-7721", drug: "Insulin glargine", reaction: "Device malfunction — dose not delivered", sev: "Serious", status: "Investigating", outcome: "Recovered", reporter: "Nurse Daniel Okafor", ts: "5h ago", region: "EMEA", score: 84, caseId: "EMEA2026-00443", detail: "Pen injector failed to deliver the scheduled basal dose; patient self-corrected with manual injection. Device lot pulled for investigation; CAPA opened." },
  { id: "ae-9007", patient: "P-3389", drug: "Sertraline 100mg", reaction: "Serotonin syndrome symptoms", sev: "Serious", status: "Open", outcome: "Hospitalized", reporter: "Dr. Lena Fischer", ts: "7h ago", region: "NA", score: 90, caseId: "NA2026-03114", detail: "Confusion, tremor, hyperreflexia after dose increase while also taking tramadol. Cyproheptadine administered; psychiatry consulted." },
  { id: "ae-9008", patient: "P-9902", drug: "Placebo (Trial ARM-B)", reaction: "Headache", sev: "Non-serious", status: "Closed", outcome: "Recovered", reporter: "Trial Coordinator", ts: "9h ago", region: "APAC", score: 18, caseId: "APAC2026-00888", detail: "Transient headache, no treatment needed. Blinded arm; unblinding not requested." },
  { id: "ae-9009", patient: "P-5567", drug: "Sacubitril/valsartan", reaction: "Hypotension", sev: "Serious", status: "Investigating", outcome: "Recovered", reporter: "Dr. Priya Sharma", ts: "11h ago", region: "EMEA", score: 72, caseId: "EMEA2026-00444", detail: "Symptomatic hypotension (85/50) after first dose; held dose, IV fluids. Home monitoring plan issued." },
  { id: "ae-9010", patient: "P-4410", drug: "Rituximab", reaction: "Hepatotoxicity (ALT 6x ULN)", sev: "Serious", status: "Open", outcome: "Hospitalized", reporter: "Dr. Amir Hassan", ts: "14h ago", region: "NA", score: 94, caseId: "NA2026-03115", detail: "ALT 288 U/L at week 8 monitoring. Treatment interrupted; hepatology consult; causality 'probably related'." },
];

const SIGNALS = [
  { id: "sig-701", drug: "Trastuzumab", event: "Infusion reactions", dispro: 3.2, cases: 14, chi: "p < 0.001", tier: "Tier 1", status: "Monitoring", trend: [12, 14, 13, 16, 15, 18, 22], last: "2h ago" },
  { id: "sig-702", drug: "Metformin", event: "Severe hypoglycemia in elderly", dispro: 2.7, cases: 9, chi: "p < 0.01", tier: "Tier 1", status: "Monitoring", trend: [8, 9, 11, 10, 12, 14, 16], last: "1h ago" },
  { id: "sig-703", drug: "Sacubitril/valsartan", event: "First-dose hypotension", dispro: 2.1, cases: 6, chi: "p < 0.05", tier: "Tier 2", status: "Reviewing", trend: [5, 5, 6, 7, 6, 8, 9], last: "3h ago" },
  { id: "sig-704", drug: "Sertraline", event: "Serotonergic overlap", dispro: 1.8, cases: 5, chi: "p = 0.07", tier: "Tier 2", status: "Reviewing", trend: [4, 4, 5, 4, 5, 6, 7], last: "5h ago" },
  { id: "sig-705", drug: "Rituximab", event: "Hepatotoxicity", dispro: 2.4, cases: 7, chi: "p < 0.01", tier: "Tier 1", status: "Escalated", trend: [5, 6, 7, 7, 9, 10, 12], last: "4h ago" },
  { id: "sig-706", drug: "Insulin glargine", event: "Device delivery failures", dispro: 1.6, cases: 4, chi: "p = 0.09", tier: "Tier 3", status: "Monitoring", trend: [3, 3, 4, 3, 4, 4, 5], last: "6h ago" },
];

const SUBMISSIONS = [
  { id: "sub-501", type: "Expedited 15-day (E2B)", agency: "EMA", drug: "Metformin", case: "EMEA2026-00441", due: "14d 6h", status: "In Progress", owner: "PV Ops", docs: 3 },
  { id: "sub-502", type: "Expedited 15-day (CIOMS I)", agency: "FDA", drug: "Trastuzumab", case: "NA2026-03112", due: "12d 2h", status: "Drafting", owner: "PV Ops", docs: 2 },
  { id: "sub-503", type: "PSUR — Quarterly", agency: "EMA", drug: "Sacubitril/valsartan", case: "EMEA2026-00444", due: "21d 0h", status: "Review", owner: "Medical Writer", docs: 12 },
  { id: "sub-504", type: "DSUR — Annual", agency: "All", drug: "Trial Portfolio", case: "TRIAL-DSUR", due: "38d 12h", status: "Scheduled", owner: "PV Lead", docs: 8 },
  { id: "sub-505", type: "Expedited 7-day (fatal/life-threatening)", agency: "EMA", drug: "Rituximab", case: "NA2026-03115", due: "6d 4h", status: "In Progress", owner: "PV Ops", docs: 5 },
  { id: "sub-506", type: "Signal Evaluation Report", agency: "PRAC", drug: "Rituximab", case: "SIG-705", due: "29d 0h", status: "Review", owner: "PV Physician", docs: 6 },
];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Serious", "Tier 1", "Escalated", "Critical"].includes(v)) return "red";
  if (["Investigating", "Tier 2", "In Progress", "Drafting", "Review", "Reviewing"].includes(v)) return "amber";
  if (["Non-serious", "Closed", "Scheduled", "Monitoring"].includes(v)) return "green";
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

function useSimulation({ eventRef, signalRef, submissionRef, toast }) {
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

    // Submission countdown creep
    submissionRef.current = submissionRef.current.map((s) => {
      const m = s.due.match(/(\d+)d (\d+)h/);
      let total = m ? parseInt(m[1], 10) * 24 + parseInt(m[2], 10) : 24 * 30;
      total = Math.max(0, total - 0.5);
      const dd = Math.floor(total / 24);
      const hh = Math.round(total % 24);
      let status = s.status;
      if (total < 24 * 7 && s.status === "Scheduled") status = "In Progress";
      if (total < 24 * 3 && s.status !== "In Progress") status = "In Progress";
      return { ...s, due: `${dd}d ${hh}h`, status };
    });

    // Occasionally a new AE arrives
    if (Math.random() < 0.08 * speedRef.current) {
      const drugs = ["Atorvastatin 20mg", "Amlodipine 5mg", "Levothyroxine 75mcg", "Pantoprazole 40mg"];
      const reactions = ["Nausea", "Dizziness", "Headache", "Fatigue", "Pruritus"];
      const ne = {
        id: `ae-${9100 + Math.floor(Math.random() * 800)}`,
        patient: "P-" + (Math.floor(Math.random() * 9000) + 1000),
        drug: drugs[Math.floor(Math.random() * drugs.length)],
        reaction: reactions[Math.floor(Math.random() * reactions.length)],
        sev: Math.random() < 0.2 ? "Serious" : "Non-serious",
        status: "Open", outcome: "Under observation",
        reporter: "Spontaneous Report", ts: "just now",
        region: ["EMEA", "NA", "APAC"][Math.floor(Math.random() * 3)],
        score: Math.round(15 + Math.random() * 60),
        caseId: "NEW-" + Math.floor(Math.random() * 90000),
        detail: "Generated by the live adverse-event simulator.",
      };
      eventRef.current = [ne, ...eventRef.current].slice(0, 40);
      toast(`New AE case · ${ne.reaction} (${ne.sev})`, ne.sev === "Serious" ? "High" : "Low");
    }
  }, [eventRef, signalRef, submissionRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      eventRef.current = ADVERSE_EVENTS.map((a) => ({ ...a }));
      signalRef.current = SIGNALS.map((s) => ({ ...s }));
      submissionRef.current = SUBMISSIONS.map((s) => ({ ...s }));
      setTick(0);
      toast("Pharmacovigilance console reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PharmacovigilanceHub() {
  const [tab, setTab] = useState("cases");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [events, setEvents] = useState(() => ADVERSE_EVENTS.map((a) => ({ ...a })));
  const [signals, setSignals] = useState(() => SIGNALS.map((s) => ({ ...s })));
  const [submissions, setSubmissions] = useState(() => SUBMISSIONS.map((s) => ({ ...s })));

  const eventRef = useRef(events);
  const signalRef = useRef(signals);
  const submissionRef = useRef(submissions);

  useEffect(() => { eventRef.current = events; }, [events]);
  useEffect(() => { signalRef.current = signals; }, [signals]);
  useEffect(() => { submissionRef.current = submissions; }, [submissions]);

  const sim = useSimulation({ eventRef, signalRef, submissionRef, toast });

  useEffect(() => {
    setEvents([...eventRef.current]);
    setSignals([...signalRef.current]);
    setSubmissions([...submissionRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const serious = events.filter((e) => e.sev === "Serious" && e.status !== "Closed").length;
    const tier1 = signals.filter((s) => s.tier === "Tier 1").length;
    const dueSoon = submissions.filter((s) => parseInt(s.due, 10) < 7).length;
    const open = events.filter((e) => e.status !== "Closed").length;
    return { serious, tier1, dueSoon, open };
  }, [events, signals, submissions]);

  /* ---------- filters ---------- */
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const q = query.toLowerCase();
      const matchQ = !q || [e.patient, e.drug, e.reaction, e.reporter, e.caseId].some((s) => s.toLowerCase().includes(q));
      const matchS = sevFilter === "All" || e.sev === sevFilter;
      return matchQ && matchS;
    });
  }, [events, query, sevFilter]);

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      const q = query.toLowerCase();
      const matchQ = !q || [s.drug, s.event].some((x) => x.toLowerCase().includes(q));
      const matchT = tierFilter === "All" || s.tier === tierFilter;
      return matchQ && matchT;
    });
  }, [signals, query, tierFilter]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const q = query.toLowerCase();
      const matchQ = !q || [s.type, s.agency, s.drug, s.case, s.owner].some((x) => x.toLowerCase().includes(q));
      const matchSt = statusFilter === "All" || s.status === statusFilter;
      return matchQ && matchSt;
    });
  }, [submissions, query, statusFilter]);

  /* ---------- actions ---------- */
  const escalate = (id) => {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status: "Investigating", sev: "Serious" } : e)));
    toast("Case escalated to serious — expedited clock started", "High");
  };

  const closeCase = (id) => {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, status: "Closed" } : e)));
    toast("Case closed and archived to the safety database", "Low");
  };

  const markSignal = (id) => {
    setSignals((ss) => ss.map((s) => (s.id === id ? { ...s, status: s.status === "Escalated" ? "Monitoring" : "Escalated" } : s)));
    toast("Signal status toggled for PRAC review", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "cases"
        ? [["ID", "Patient", "Drug", "Reaction", "Severity", "Status", "Outcome", "Region", "Score"], ...filteredEvents.map((e) => [e.id, e.patient, e.drug, e.reaction, e.sev, e.status, e.outcome, e.region, e.score])]
        : tab === "signals"
        ? [["ID", "Drug", "Event", "DPR", "Cases", "Chi-sq", "Tier", "Status"], ...filteredSignals.map((s) => [s.id, s.drug, s.event, s.dispro, s.cases, s.chi, s.tier, s.status])]
        : [["ID", "Type", "Agency", "Drug", "Case", "Due", "Status", "Owner"], ...filteredSubmissions.map((s) => [s.id, s.type, s.agency, s.drug, s.case, s.due, s.status, s.owner])];
    downloadCsv(`pharmacovigilance-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "cases", label: "Adverse Event Triage", icon: Siren },
    { id: "signals", label: "Signal Detection", icon: Radar },
    { id: "submissions", label: "SAE Reporting & Deadlines", icon: FileText },
  ];

  const sevOrder = { Serious: 0, "Non-serious": 1 };
  const tierOrder = { "Tier 1": 0, "Tier 2": 1, "Tier 3": 2 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <ToastTray toasts={toasts} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<ShieldCheck size={24} className="text-emerald-400" />}
            title="Pharmacovigilance &amp; Drug Safety Hub"
            subtitle="Adverse-event triage · signal detection · SAE reporting — GVP Module VI / FDA 21 CFR 314.80 aligned"
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
          <StatCard icon={Siren} label="Open Serious Cases" value={stats.serious} sub={`${stats.open} total open`} accent={stats.serious > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Radar} label="Tier 1 Signals" value={stats.tier1} sub="statistical disproportionality" accent="text-amber-400" />
          <StatCard icon={FileText} label="Submissions Due &lt; 7d" value={stats.dueSoon} sub="expedited + scheduled" accent="text-sky-400" />
          <StatCard icon={Activity} label="Cases This Week" value={events.filter((e) => e.ts.includes("h ago") || e.ts === "just now").length} sub="reported to safety DB" accent="text-emerald-400" />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search cases, signals, submissions…" />
          {tab === "cases" && (
            <FilterChips options={["All", "Serious", "Non-serious"]} value={sevFilter} onChange={setSevFilter} />
          )}
          {tab === "signals" && (
            <FilterChips options={["All", "Tier 1", "Tier 2", "Tier 3"]} value={tierFilter} onChange={setTierFilter} />
          )}
          {tab === "submissions" && (
            <FilterChips options={["All", "In Progress", "Drafting", "Review", "Scheduled"]} value={statusFilter} onChange={setStatusFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= ADVERSE EVENT CASES TAB ================= */}
        {tab === "cases" && (
          <div className="space-y-6">
            {/* region strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {["EMEA", "NA", "APAC", "LATAM"].map((region) => {
                const count = events.filter((e) => e.region === region).length;
                return (
                  <div key={region} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <Globe size={13} className="text-sky-400" /> {region}
                      </span>
                      <span className="text-lg font-bold text-slate-100">{count}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{count > 0 ? `${Math.round((count / Math.max(1, events.length)) * 100)}% of intake` : "no intake this window"}</p>
                  </div>
                );
              })}
            </section>

            {/* case table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Siren size={16} className="text-red-400" />}
                title="Adverse Event Case Queue"
                badge={`${filteredEvents.length} cases`}
                right="ICSR triage · E2B(R3) formatted"
              />
              {filteredEvents.length === 0 ? (
                <EmptyState icon={ShieldCheck} message="No cases match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Case</th>
                        <th className="px-4 py-3">Drug</th>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Outcome</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Reported</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((e) => (
                        <tr key={e.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="flex items-center gap-3 text-left" onClick={() => setModal({ kind: "case", data: e })}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${e.sev === "Serious" ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                                {e.sev === "Serious" ? <AlertTriangle size={14} /> : <Info size={14} />}
                              </div>
                              <div>
                                <p className="font-medium text-slate-200">{e.reaction}</p>
                                <p className="text-[10px] text-slate-500">{e.patient} · {e.caseId} · {e.region}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{e.drug}</td>
                          <td className="px-4 py-3"><Badge>{e.sev}</Badge></td>
                          <td className="px-4 py-3"><Badge>{e.status}</Badge></td>
                          <td className="px-4 py-3 text-slate-400">{e.outcome}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${e.score >= 80 ? "text-red-400" : e.score >= 60 ? "text-amber-400" : "text-slate-400"}`}>{e.score}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{e.ts}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {e.status !== "Closed" && (
                                <>
                                  <button
                                    onClick={() => escalate(e.id)}
                                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
                                  >
                                    Escalate
                                  </button>
                                  <button
                                    onClick={() => closeCase(e.id)}
                                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    Close
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setModal({ kind: "case", data: e })}
                                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                              >
                                Inspect
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= SIGNAL DETECTION TAB ================= */}
        {tab === "signals" && (
          <div className="space-y-6">
            {/* method strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Radar size={14} className="text-emerald-400" /> ROR ≥ 2.0</div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{signals.filter((s) => s.dispro >= 2.0).length}</p>
                <p className="text-[10px] text-slate-500">reporting odds ratio</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Layers size={14} className="text-sky-400" /> Statistically significant</div>
                <p className="mt-1 text-2xl font-bold text-sky-400">{signals.filter((s) => !s.chi.includes("0.0") || s.chi.includes("0.05") || s.chi.includes("0.01") || s.chi.includes("0.001")).length}</p>
                <p className="text-[10px] text-slate-500">p &lt; 0.05 after correction</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Zap size={14} className="text-amber-400" /> Escalated</div>
                <p className="mt-1 text-2xl font-bold text-amber-400">{signals.filter((s) => s.status === "Escalated").length}</p>
                <p className="text-[10px] text-slate-500">awaiting PRAC review</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Activity size={14} className="text-purple-400" /> Rising trends</div>
                <p className="mt-1 text-2xl font-bold text-purple-400">{signals.filter((s) => s.trend[s.trend.length - 1] > s.trend[0] * 1.3).length}</p>
                <p className="text-[10px] text-slate-500">≥ 30% increase vs baseline</p>
              </div>
            </section>

            {/* signal table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Radar size={16} className="text-amber-400" />}
                title="Disproportionality Signals"
                badge={`${filteredSignals.length} signals`}
                right="EudraVigilance-style ROR · EBGM overlay"
              />
              {filteredSignals.length === 0 ? (
                <EmptyState icon={ShieldCheck} message="No signals match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Drug–Event Pair</th>
                        <th className="px-4 py-3">ROR</th>
                        <th className="px-4 py-3">Cases</th>
                        <th className="px-4 py-3">Chi-sq</th>
                        <th className="px-4 py-3">Tier</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Trend</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredSignals]
                        .sort((a, b) => (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="text-left" onClick={() => setModal({ kind: "signal", data: s })}>
                                <p className="font-medium text-slate-200">{s.drug}</p>
                                <p className="text-[10px] text-slate-500">{s.event}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-bold ${s.dispro >= 2.0 ? "text-red-400" : "text-amber-400"}`}>{s.dispro.toFixed(1)}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{s.cases}</td>
                            <td className="px-4 py-3 text-slate-400">{s.chi}</td>
                            <td className="px-4 py-3"><Badge>{s.tier}</Badge></td>
                            <td className="px-4 py-3"><Badge>{s.status}</Badge></td>
                            <td className="px-4 py-3">
                              <Sparkline points={s.trend} color={s.dispro >= 2.0 ? "#f87171" : "#fbbf24"} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => markSignal(s.id)}
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${s.status === "Escalated" ? "border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"}`}
                                >
                                  {s.status === "Escalated" ? "Unescalate" : "Escalate"}
                                </button>
                                <button
                                  onClick={() => setModal({ kind: "signal", data: s })}
                                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                                >
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= SUBMISSIONS TAB ================= */}
        {tab === "submissions" && (
          <div className="space-y-6">
            {/* deadline strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Timer size={16} className="text-sky-400" />} title="Regulatory Submission Pipeline" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSubmissions
                  .sort((a, b) => parseInt(a.due, 10) - parseInt(b.due, 10))
                  .map((s) => {
                    const days = parseInt(s.due, 10);
                    const urgent = days < 7;
                    return (
                      <div key={s.id} className={`rounded-lg border p-3 ${urgent ? "border-red-500/40 bg-red-500/5" : "border-slate-800 bg-slate-950"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">{s.type}</span>
                          <Badge>{s.status}</Badge>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">{s.agency} · {s.drug} · {s.case}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-sm font-bold ${urgent ? "text-red-400" : "text-slate-200"}`}>{s.due}</span>
                          <button
                            onClick={() => setModal({ kind: "submission", data: s })}
                            className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {filteredSubmissions.length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EmptyState icon={ShieldCheck} message="No submissions match the current filters." />
                  </div>
                )}
              </div>
            </section>

            {/* obligation table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<FileText size={16} className="text-sky-400" />}
                title="Submission Obligations"
                badge={`${filteredSubmissions.length} tracked`}
                right="GVP VI · 21 CFR 314.80(c)"
              />
              {filteredSubmissions.length === 0 ? (
                <EmptyState icon={ShieldCheck} message="No submissions match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Type</th>
                        <th className="px-4 py-3">Agency</th>
                        <th className="px-4 py-3">Drug / Case</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3 text-right">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((s) => {
                        const days = parseInt(s.due, 10);
                        const urgent = days < 7;
                        return (
                          <tr key={s.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="text-left" onClick={() => setModal({ kind: "submission", data: s })}>
                                <p className={`font-medium ${urgent ? "text-red-300" : "text-slate-200"}`}>{s.type}</p>
                                <p className="text-[10px] text-slate-500">{s.id}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{s.agency}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{s.drug} · {s.case}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${urgent ? "text-red-400" : "text-slate-300"}`}>{s.due}</span>
                              {urgent && <span className="ml-1.5 text-[9px] uppercase text-red-400">urgent</span>}
                            </td>
                            <td className="px-4 py-3"><Badge>{s.status}</Badge></td>
                            <td className="px-4 py-3 text-slate-400">{s.owner}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{s.docs}</td>
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
      {modal?.kind === "case" && (
        <Modal title={modal.data.reaction} subtitle={`${modal.data.id} · ${modal.data.caseId}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.sev}</Badge>
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">score {modal.data.score}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.region}</span>
          </div>
          <Row label="Patient" value={modal.data.patient} />
          <Row label="Suspect Drug" value={modal.data.drug} />
          <Row label="Outcome" value={modal.data.outcome} />
          <Row label="Reported By" value={modal.data.reporter} />
          <Row label="Reported" value={modal.data.ts} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">{modal.data.detail}</p>
          <div className="flex gap-2 pt-1">
            {modal.data.status !== "Closed" && (
              <>
                <button
                  onClick={() => { escalate(modal.data.id); setModal(null); }}
                  className="flex-1 rounded-lg bg-red-500/15 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                >
                  Escalate
                </button>
                <button
                  onClick={() => { closeCase(modal.data.id); setModal(null); }}
                  className="flex-1 rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                >
                  Close Case
                </button>
              </>
            )}
            <button onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              Close
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "signal" && (
        <Modal title={`${modal.data.drug} — ${modal.data.event}`} subtitle={`${modal.data.id} · ${modal.data.status}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.tier}</Badge>
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.cases} cases</span>
          </div>
          <Row label="Reporting Odds Ratio" value={modal.data.dispro.toFixed(2)} accent={modal.data.dispro >= 2 ? "text-red-400" : "text-amber-400"} />
          <Row label="Chi-square / Fisher" value={modal.data.chi} />
          <Row label="Last Evaluated" value={modal.data.last} />
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-300"><Activity size={12} /> Rolling case trend</p>
            <Sparkline points={modal.data.trend} color={modal.data.dispro >= 2 ? "#f87171" : "#fbbf24"} w={200} h={40} />
          </div>
          <button
            onClick={() => { markSignal(modal.data.id); setModal(null); }}
            className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            {modal.data.status === "Escalated" ? "Unescalate from PRAC queue" : "Escalate for PRAC review"}
          </button>
        </Modal>
      )}

      {modal?.kind === "submission" && (
        <Modal title={modal.data.type} subtitle={`${modal.data.id} · ${modal.data.agency}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.docs} documents</span>
          </div>
          <Row label="Suspect Drug" value={modal.data.drug} />
          <Row label="Linked Case" value={modal.data.case} />
          <Row label="Due" value={modal.data.due} accent={parseInt(modal.data.due, 10) < 7 ? "text-red-400" : "text-slate-200"} />
          <Row label="Assigned Owner" value={modal.data.owner} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Submission package is compiled from the E2B(R3) ICSR, the CIOMS narrative, the RMP cross-reference and the source medical records, then transmitted via the agency gateway with an acknowledgment receipt stored in the audit ledger.
          </p>
          <button onClick={() => setModal(null)} className="w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            Close
          </button>
        </Modal>
      )}

      <Footer>
        Pharmacovigilance &amp; Drug Safety Hub — GVP Module VI, FDA 21 CFR 314.80, E2B(R3) · simulation environment · not for actual regulatory submission
      </Footer>
    </div>
  );
}
