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

const PROVENANCE = [
  { id: "art-101", name: "Discharge Summary — P. Sharma", type: "C-CDA Document", site: "PACS-CDS", created: "2h ago", chain: 4, status: "Valid", manifest: "c2pa://medtrack/9f3c…7a21", actor: "Dr. Lena Fischer", signer: "HSM-PQ-01", sig: "ML-DSA-5", tamper: false, version: "1.3.0" },
  { id: "art-102", name: "CT Abdomen Study 88421", type: "DICOM Series", site: "PACS-RAD", created: "5h ago", chain: 6, status: "Valid", manifest: "c2pa://medtrack/b1e2…c0d3", actor: "Dr. Amir Hassan", signer: "HSM-PQ-02", sig: "ML-DSA-5", tamper: false, version: "1.3.0" },
  { id: "art-103", name: "Lab Result Panel — CBC", type: "HL7 FHIR Bundle", site: "LIMS-GW", created: "8h ago", chain: 3, status: "Valid", manifest: "c2pa://medtrack/d4f5…90aa", actor: "LIMS Integrator", signer: "HSM-PQ-03", sig: "Kyber-1024", tamper: false, version: "1.2.9" },
  { id: "art-104", name: "Medication Order — Metformin", type: "ePrescription", site: "RX-WORKFLOW", created: "11h ago", chain: 2, status: "Suspicious", manifest: "c2pa://medtrack/77a9…1b2c", actor: "Dr. Priya Sharma", signer: "SOFTWARE-01", sig: "RSA-4096", tamper: true, version: "1.1.2" },
  { id: "art-105", name: "Oncology Consent Form", type: "Signed PDF", site: "DOC-SIGN", created: "1d ago", chain: 5, status: "Valid", manifest: "c2pa://medtrack/e8c1…3d4e", actor: "Dr. Lena Fischer", signer: "HSM-PQ-01", sig: "ML-DSA-5", tamper: false, version: "1.3.0" },
  { id: "art-106", name: "MRI Brain Study 99210", type: "DICOM Series", site: "PACS-RAD", created: "1d ago", chain: 7, status: "Valid", manifest: "c2pa://medtrack/5f0a…6b7c", actor: "Dr. Amir Hassan", signer: "HSM-PQ-02", sig: "ML-DSA-5", tamper: false, version: "1.3.0" },
  { id: "art-107", name: "ICU Vitals Export — Bed 4", type: "HL7 FHIR Bundle", site: "TELEMETRY", created: "2d ago", chain: 3, status: "Valid", manifest: "c2pa://medtrack/2c8d…9e0f", actor: "Telemetry Ingest", signer: "HSM-PQ-03", sig: "Kyber-1024", tamper: false, version: "1.2.9" },
  { id: "art-108", name: "Billing Claim 7712-04", type: "X12 EDI 837", site: "BILLING", created: "2d ago", chain: 2, status: "Suspicious", manifest: "c2pa://medtrack/a3b4…5c6d", actor: "Raj Mehta", signer: "SOFTWARE-02", sig: "RSA-4096", tamper: true, version: "1.0.8" },
  { id: "art-109", name: "Pathology Slide Scan S-2201", type: "DICOM WSI", site: "PATH-GW", created: "3d ago", chain: 8, status: "Valid", manifest: "c2pa://medtrack/6e7f…8g9h", actor: "LIMS Integrator", signer: "HSM-PQ-04", sig: "ML-DSA-5", tamper: false, version: "1.3.0" },
  { id: "art-110", name: "Research Cohort Manifest v2", type: "CSV Dataset", site: "RESEARCH", created: "3d ago", chain: 4, status: "Valid", manifest: "c2pa://medtrack/9d0e…1f2a", actor: "Research Admin", signer: "HSM-PQ-05", sig: "Dilithium-3", tamper: false, version: "1.2.4" },
];

const AUDIT_EVENTS = [
  { id: "evt-5001", actor: "Dr. Priya Sharma", action: "VIEW", resource: "EHR Record — Patient #4471", ip: "10.24.8.12", risk: "Normal", ts: "2m ago", retention: "6y 364d", session: "s-88421", detail: "Chart opened from workstation STAFF-LT-217. Policy: minimum necessary, role-based access satisfied." },
  { id: "evt-5002", actor: "LIMS Integrator", action: "EXPORT", resource: "Lab Results Batch — 1,204 rows", ip: "172.16.9.4", risk: "Flagged", ts: "7m ago", retention: "6y 364d", session: "s-api-77", detail: "Bulk export of a lab results batch via service account. Volume exceeds the 500-row daily threshold; queued for privacy review." },
  { id: "evt-5003", actor: "Raj Mehta", action: "PRINT", resource: "Insurance Card — Patient #1120", ip: "10.24.12.31", risk: "Normal", ts: "15m ago", retention: "6y 364d", session: "s-55190", detail: "Printed insurance card during benefits verification. Printer: FIN-RICOH-3, logged per HIPAA 164.312(e)." },
  { id: "evt-5004", actor: "Dr. Lena Fischer", action: "SHARE", resource: "Oncology Note — Patient #8830", ip: "10.24.7.44", risk: "Normal", ts: "26m ago", retention: "6y 364d", session: "s-33012", detail: "Secure referral share to St. Mary's Oncology via DIRECT protocol, encrypted payload, audit receipt captured." },
  { id: "evt-5005", actor: "Night Shift Backup", action: "DOWNLOAD", resource: "Full Patient Directory Export", ip: "198.51.100.66", risk: "Critical", ts: "41m ago", retention: "6y 364d", session: "s-11044", detail: "Unusual full-directory export outside business hours from a legacy workstation. Breach-response workflow triggered, session terminated." },
  { id: "evt-5006", actor: "Anesthesia Telemetry", action: "WRITE", resource: "Vitals Stream — OR Suite 2", ip: "10.24.50.21", risk: "Normal", ts: "1h ago", retention: "6y 364d", session: "s-iot-12", detail: "Continuous device write to the ICU vitals stream. Device attestation OK, firmware v4.2 current." },
  { id: "evt-5007", actor: "Temp Staff - Karen W.", action: "MODIFY", resource: "Appointment — Patient #6655", ip: "10.24.3.9", risk: "Flagged", ts: "1h ago", retention: "6y 364d", session: "s-77213", detail: "Appointment rescheduled three times within 20 minutes from a kiosk session. Anomaly score 0.72, flagged for review." },
  { id: "evt-5008", actor: "Dr. Amir Hassan", action: "VIEW", resource: "Radiology Study — Patient #4471", ip: "10.24.6.88", risk: "Normal", ts: "2h ago", retention: "6y 364d", session: "s-99102", detail: "Study opened in PACS viewer. Access pattern consistent with the on-call radiology shift." },
  { id: "evt-5009", actor: "Vendor - MedSupply Portal", action: "API_READ", resource: "Supply Contract Metadata", ip: "203.0.113.22", risk: "Normal", ts: "2h ago", retention: "6y 364d", session: "s-api-14", detail: "Partner API read of contract metadata, scoped OAuth token, no PHI in payload." },
  { id: "evt-5010", actor: "Nurse Daniel Okafor", action: "CREATE", resource: "Nursing Note — Patient #4471", ip: "10.24.8.77", risk: "Normal", ts: "3h ago", retention: "6y 364d", session: "s-55210", detail: "Nursing note created during shift handover. Auto-signed with clinical timestamp." },
];

const EVIDENCE = [
  { id: "ev-301", name: "HIPAA Security Rule Gap Assessment", framework: "HIPAA", scope: "All systems", status: "In Review", reviewer: "Compliance Officer", expires: "45d", coverage: 96, last: "3d ago" },
  { id: "ev-302", name: "SOC 2 Type II — Controls 2026", framework: "SOC 2", scope: "AICPA TSC", status: "Compliant", reviewer: "External CPA", expires: "112d", coverage: 100, last: "12d ago" },
  { id: "ev-303", name: "C2PA Manifest Schema Alignment", framework: "C2PA", scope: "Artifact pipeline", status: "Compliant", reviewer: "Provenance Lead", expires: "88d", coverage: 98, last: "5d ago" },
  { id: "ev-304", name: "ISO 27001:2022 Surveillance", framework: "ISO 27001", scope: "Annex A controls", status: "In Review", reviewer: "ISMS Lead", expires: "22d", coverage: 93, last: "1d ago" },
  { id: "ev-305", name: "NIST CSF 2.0 Maturity Scorecard", framework: "NIST CSF", scope: "Govern · Identify", status: "Compliant", reviewer: "Security Architect", expires: "134d", coverage: 97, last: "8d ago" },
  { id: "ev-306", name: "GDPR DPIAs — Pending Backlog", framework: "GDPR", scope: "Processing ops", status: "At Risk", reviewer: "DPO", expires: "9d", coverage: 71, last: "2d ago" },
  { id: "ev-307", name: "21 CFR Part 11 — eSignature", framework: "FDA", scope: "EHR signature", status: "Compliant", reviewer: "QA Lead", expires: "200d", coverage: 99, last: "20d ago" },
  { id: "ev-308", name: "HITRUST CSF Certification", framework: "HITRUST", scope: "Full enterprise", status: "In Review", reviewer: "Compliance Officer", expires: "61d", coverage: 90, last: "4d ago" },
];

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Critical", "Suspicious", "At Risk", "Flagged"].includes(v)) return "red";
  if (["In Review", "Medium"].includes(v)) return "amber";
  if (["Valid", "Compliant", "Normal"].includes(v)) return "green";
  return "slate";
};



const Badge = ({ children, tone }) => <ToneBadge toneOf={toneOf} tone={tone}>{children}</ToneBadge>;

const Meter = ({ value, color = "bg-emerald-400" }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-800">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);




/* ------------------------------------------------------------------ */
/*  Live simulation hook                                               */
/* ------------------------------------------------------------------ */

function useSimulation({ artifactRef, eventRef, evidenceRef, toast }) {
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

    // Evidence expiry creep
    evidenceRef.current = evidenceRef.current.map((e) => {
      const daysLeft = Math.max(0, parseFloat(e.expires) - 0.04);
      let status = e.status;
      if (daysLeft < 15 && e.status !== "At Risk") status = "At Risk";
      if (daysLeft < 45 && e.status === "Compliant") status = "In Review";
      return { ...e, expires: daysLeft.toFixed(0), status };
    });

    // Occasionally a new audit event arrives
    if (Math.random() < 0.12 * speedRef.current) {
      const actors = ["Dr. Priya Sharma", "Nurse Daniel Okafor", "Raj Mehta", "Dr. Amir Hassan", "Temp Staff - Karen W."];
      const actions = ["VIEW", "CREATE", "MODIFY", "SHARE", "PRINT"];
      const ne = {
        id: `evt-${6000 + Math.floor(Math.random() * 900)}`,
        actor: actors[Math.floor(Math.random() * actors.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        resource: "EHR Record — Patient #" + (Math.floor(Math.random() * 9000) + 1000),
        ip: "10.24." + (Math.floor(Math.random() * 60) + 1) + "." + (Math.floor(Math.random() * 250) + 1),
        risk: Math.random() < 0.08 ? "Flagged" : "Normal",
        ts: "just now", retention: "6y 364d",
        session: "s-" + (Math.floor(Math.random() * 90000) + 10000),
        detail: "Generated by the live audit-stream simulator.",
      };
      eventRef.current = [ne, ...eventRef.current].slice(0, 40);
      toast(`${ne.actor} · ${ne.action}`, ne.risk);
    }

    // Occasionally a provenance check completes
    if (Math.random() < 0.05 * speedRef.current) {
      const a = artifactRef.current[Math.floor(Math.random() * artifactRef.current.length)];
      toast(`C2PA manifest revalidated · ${a.name}`, "Low");
    }
  }, [artifactRef, eventRef, evidenceRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      artifactRef.current = PROVENANCE.map((a) => ({ ...a }));
      eventRef.current = AUDIT_EVENTS.map((e) => ({ ...e }));
      evidenceRef.current = EVIDENCE.map((e) => ({ ...e }));
      setTick(0);
      toast("Ledger reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function RegulatoryAuditHub() {
  const [tab, setTab] = useState("provenance");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [frameworkFilter, setFrameworkFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [artifacts, setArtifacts] = useState(() => PROVENANCE.map((a) => ({ ...a })));
  const [events, setEvents] = useState(() => AUDIT_EVENTS.map((e) => ({ ...e })));
  const [evidence, setEvidence] = useState(() => EVIDENCE.map((e) => ({ ...e })));

  const artifactRef = useRef(artifacts);
  const eventRef = useRef(events);
  const evidenceRef = useRef(evidence);

  useEffect(() => { artifactRef.current = artifacts; }, [artifacts]);
  useEffect(() => { eventRef.current = events; }, [events]);
  useEffect(() => { evidenceRef.current = evidence; }, [evidence]);

  const sim = useSimulation({ artifactRef, eventRef, evidenceRef, toast });

  useEffect(() => {
    setArtifacts([...artifactRef.current]);
    setEvents([...eventRef.current]);
    setEvidence([...evidenceRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const suspicious = artifacts.filter((a) => a.status === "Suspicious").length;
    const flagged = events.filter((e) => e.risk !== "Normal").length;
    const expiring = evidence.filter((e) => e.status !== "Compliant" || parseFloat(e.expires) < 30).length;
    const valid = artifacts.filter((a) => a.status === "Valid").length;
    return { suspicious, flagged, expiring, valid };
  }, [artifacts, events, evidence]);

  /* ---------- filters ---------- */
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((a) => {
      const q = query.toLowerCase();
      const matchQ = !q || [a.name, a.type, a.site, a.actor, a.manifest].some((s) => s.toLowerCase().includes(q));
      const matchS = statusFilter === "All" || a.status === statusFilter;
      return matchQ && matchS;
    });
  }, [artifacts, query, statusFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const q = query.toLowerCase();
      const matchQ = !q || [e.actor, e.action, e.resource, e.ip, e.session].some((s) => s.toLowerCase().includes(q));
      const matchR = riskFilter === "All" || e.risk === riskFilter;
      return matchQ && matchR;
    });
  }, [events, query, riskFilter]);

  const filteredEvidence = useMemo(() => {
    return evidence.filter((e) => {
      const q = query.toLowerCase();
      const matchQ = !q || [e.name, e.framework, e.scope, e.reviewer].some((s) => s.toLowerCase().includes(q));
      const matchF = frameworkFilter === "All" || e.framework === frameworkFilter;
      return matchQ && matchF;
    });
  }, [evidence, query, frameworkFilter]);

  /* ---------- actions ---------- */
  const requalify = (id) => {
    setArtifacts((as) => as.map((a) => (a.id === id ? { ...a, status: "Valid", signer: "HSM-PQ-01", sig: "ML-DSA-5", version: "1.3.0" } : a)));
    toast("Artifact re-signed under post-quantum policy", "Low");
  };

  const holdForReview = (id) => {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, risk: "Flagged" } : e)));
    toast("Event placed under privacy hold", "Low");
  };

  const requestRenewal = (id) => {
    setEvidence((es) => es.map((e) => (e.id === id ? { ...e, status: "In Review", expires: "30" } : e)));
    toast("Evidence renewal requested", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "provenance"
        ? [["ID", "Artifact", "Type", "Site", "Chain", "Status", "Signer", "Signature"], ...filteredArtifacts.map((a) => [a.id, a.name, a.type, a.site, a.chain, a.status, a.signer, a.sig])]
        : tab === "audit"
        ? [["ID", "Actor", "Action", "Resource", "IP", "Risk", "Time", "Retention"], ...filteredEvents.map((e) => [e.id, e.actor, e.action, e.resource, e.ip, e.risk, e.ts, e.retention])]
        : [["ID", "Evidence", "Framework", "Status", "Reviewer", "Expires (d)", "Coverage"], ...filteredEvidence.map((e) => [e.id, e.name, e.framework, e.status, e.reviewer, e.expires, e.coverage])];
    downloadCsv(`regulatory-audit-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "provenance", label: "C2PA Provenance Ledger", icon: Fingerprint },
    { id: "audit", label: "HIPAA Audit Log", icon: FileText },
    { id: "evidence", label: "Evidence & Attestation", icon: ShieldCheck },
  ];

  const riskOrder = { Critical: 0, Flagged: 1, Normal: 2 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <ToastTray toasts={toasts} critical={["Critical", "Flagged"]} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<Scale size={24} className="text-emerald-400" />}
            title="Regulatory Audit &amp; Provenance Ledger Hub"
            subtitle="C2PA provenance · HIPAA audit trails · Evidence &amp; attestation — immutable, queryable, export-ready"
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
          <StatCard icon={Fingerprint} label="Artifacts Provenanced" value={stats.valid} sub={`${artifacts.length} total in ledger`} accent="text-emerald-400" />
          <StatCard icon={Siren} label="Suspicious Manifests" value={stats.suspicious} sub="C2PA chain integrity alerts" accent={stats.suspicious > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={Eye} label="Flagged Audit Events" value={stats.flagged} sub="HIPAA 164.308(a)(1)(ii)(D)" accent={stats.flagged > 0 ? "text-amber-400" : "text-emerald-400"} />
          <StatCard icon={Timer} label="Evidence Expiring Soon" value={stats.expiring} sub="≤ 30 days or under review" accent="text-sky-400" />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search artifacts, events, evidence…" />
          {tab === "provenance" && (
            <FilterChips options={["All", "Valid", "Suspicious"]} value={statusFilter} onChange={setStatusFilter} />
          )}
          {tab === "audit" && (
            <FilterChips options={["All", "Normal", "Flagged", "Critical"]} value={riskFilter} onChange={setRiskFilter} />
          )}
          {tab === "evidence" && (
            <FilterChips options={["All", "HIPAA", "SOC 2", "ISO 27001", "C2PA", "GDPR", "HITRUST"]} value={frameworkFilter} onChange={setFrameworkFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= C2PA PROVENANCE TAB ================= */}
        {tab === "provenance" && (
          <div className="space-y-6">
            {/* provenance posture strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Fingerprint size={14} className="text-emerald-400" /> ML-DSA signed</div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{artifacts.filter((a) => a.sig.startsWith("ML-DSA") || a.sig.startsWith("Dilithium")).length}</p>
                <p className="text-[10px] text-slate-500">post-quantum signatures</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Layers size={14} className="text-sky-400" /> Avg chain depth</div>
                <p className="mt-1 text-2xl font-bold text-sky-400">{(artifacts.reduce((a, x) => a + x.chain, 0) / Math.max(1, artifacts.length)).toFixed(1)}</p>
                <p className="text-[10px] text-slate-500">assertions per manifest</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Cpu size={14} className="text-purple-400" /> HSM-backed</div>
                <p className="mt-1 text-2xl font-bold text-purple-400">{artifacts.filter((a) => a.signer.startsWith("HSM")).length}</p>
                <p className="text-[10px] text-slate-500">hardware key custody</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle size={14} className="text-red-400" /> Legacy RSA</div>
                <p className="mt-1 text-2xl font-bold text-red-400">{artifacts.filter((a) => a.sig === "RSA-4096").length}</p>
                <p className="text-[10px] text-slate-500">sunset-policy flagged</p>
              </div>
            </section>

            {/* artifact table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Fingerprint size={16} className="text-emerald-400" />}
                title="Provenance Ledger"
                badge={`${filteredArtifacts.length} artifacts`}
                right="C2PA 2.1 manifests · W3C credentials binding"
              />
              {filteredArtifacts.length === 0 ? (
                <EmptyState icon={Scale} message="No artifacts match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Artifact</th>
                        <th className="px-4 py-3">Chain</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Signed By</th>
                        <th className="px-4 py-3">Signature</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArtifacts.map((a) => (
                        <tr key={a.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="flex items-center gap-3 text-left" onClick={() => setModal({ kind: "artifact", data: a })}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.status === "Suspicious" ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                                {a.type.startsWith("DICOM") ? <Database size={14} /> : a.type.startsWith("Signed") ? <FileText size={14} /> : a.type.startsWith("C-CDA") ? <FileText size={14} /> : a.type.startsWith("X12") ? <Award size={14} /> : <Activity size={14} />}
                              </div>
                              <div>
                                <p className="font-medium text-slate-200">{a.name}</p>
                                <p className="text-[10px] text-slate-500">{a.type} · {a.site}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300">{a.chain}</span>
                              <div className="flex gap-0.5">
                                {Array.from({ length: Math.min(a.chain, 6) }).map((_, i) => (
                                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${a.status === "Suspicious" && i >= 2 ? "bg-red-400" : "bg-emerald-400"}`} />
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><Badge>{a.status}</Badge></td>
                          <td className="px-4 py-3">
                            <p className="text-slate-300">{a.signer}</p>
                            <p className="text-[10px] text-slate-500">{a.actor}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${a.sig === "RSA-4096" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-slate-700 bg-slate-800/60 text-slate-400"}`}>{a.sig}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{a.created}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {a.status === "Suspicious" && (
                                <button
                                  onClick={() => requalify(a.id)}
                                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                >
                                  Re-sign
                                </button>
                              )}
                              <button
                                onClick={() => setModal({ kind: "artifact", data: a })}
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

        {/* ================= HIPAA AUDIT TAB ================= */}
        {tab === "audit" && (
          <div className="space-y-6">
            {/* audit stream */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<FileText size={16} className="text-amber-400" />}
                title="Access &amp; Activity Audit Stream"
                badge={`${filteredEvents.length} events`}
                right="HIPAA 164.312(b) · immutable, WORM-storage backed"
              />
              {filteredEvents.length === 0 ? (
                <EmptyState icon={Scale} message="No events match the current filters." />
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {[...filteredEvents]
                    .sort((a, b) => (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9))
                    .map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          e.risk === "Critical" ? "bg-red-500/15 text-red-400" : e.risk === "Flagged" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {e.action === "VIEW" ? <Eye size={15} /> : e.action === "EXPORT" || e.action === "DOWNLOAD" ? <Download size={15} /> : e.action === "SHARE" ? <Globe size={15} /> : e.action === "PRINT" ? <FileText size={15} /> : e.action === "CREATE" ? <Plus size={15} /> : <EditMini />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button className="flex items-center gap-2 text-left" onClick={() => setModal({ kind: "event", data: e })}>
                            <p className="truncate text-xs font-medium text-slate-200">{e.actor} · {e.action}</p>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">{e.id}</span>
                          </button>
                          <p className="mt-0.5 text-[10px] text-slate-500">{e.resource} · {e.ip} · {e.ts}</p>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <Badge>{e.risk}</Badge>
                          <span className="text-[10px] text-slate-500">retention {e.retention}</span>
                        </div>
                        <div className="flex gap-1.5">
                          {e.risk === "Normal" && (
                            <button
                              onClick={() => holdForReview(e.id)}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20"
                            >
                              Hold
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ kind: "event", data: e })}
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

            {/* access pattern strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Network size={16} className="text-sky-400" />} title="Action Mix — Last 24h" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {["VIEW", "CREATE", "MODIFY", "EXPORT", "SHARE", "PRINT"].map((act) => {
                  const count = events.filter((e) => e.action === act || (act === "EXPORT" && e.action === "DOWNLOAD")).length;
                  const pct = Math.max(6, Math.min(100, count * 20));
                  return (
                    <div key={act} className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                      <p className="text-lg font-bold text-slate-100">{count}</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">{act}</p>
                      <div className="mt-1.5 h-1 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${count > 1 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ================= EVIDENCE TAB ================= */}
        {tab === "evidence" && (
          <div className="space-y-6">
            {/* evidence cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredEvidence.map((e) => {
                const expiring = parseFloat(e.expires) < 30;
                return (
                  <button
                    key={e.id}
                    onClick={() => setModal({ kind: "evidence", data: e })}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-emerald-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className={e.status === "Compliant" ? "text-emerald-400" : e.status === "At Risk" ? "text-red-400" : "text-amber-400"} />
                        <span className="text-[11px] font-bold tracking-wide text-slate-300">{e.framework}</span>
                      </div>
                      <Badge>{e.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-200">{e.name}</p>
                    <p className="text-[10px] text-slate-500">{e.scope} · reviewed by {e.reviewer}</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Coverage</span>
                        <span>{e.coverage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${e.coverage >= 95 ? "bg-emerald-400" : e.coverage >= 85 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${e.coverage}%` }} />
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="text-slate-500">expires in</span>
                        <span className={expiring ? "font-semibold text-red-400" : "text-slate-400"}>{e.expires}d</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredEvidence.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                  <EmptyState icon={Scale} message="No evidence items match the current filters." />
                </div>
              )}
            </section>

            {/* readiness summary */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Gauge size={16} className="text-emerald-400" />} title="Enterprise Audit Readiness" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Compliant", value: evidence.filter((e) => e.status === "Compliant").length, color: "text-emerald-400", pct: Math.round((evidence.filter((e) => e.status === "Compliant").length / evidence.length) * 100) },
                  { label: "In Review", value: evidence.filter((e) => e.status === "In Review").length, color: "text-amber-400", pct: Math.round((evidence.filter((e) => e.status === "In Review").length / evidence.length) * 100) },
                  { label: "At Risk", value: evidence.filter((e) => e.status === "At Risk").length, color: "text-red-400", pct: Math.round((evidence.filter((e) => e.status === "At Risk").length / evidence.length) * 100) },
                  { label: "Avg Coverage", value: `${Math.round(evidence.reduce((a, e) => a + e.coverage, 0) / Math.max(1, evidence.length))}%`, color: "text-sky-400", pct: Math.round(evidence.reduce((a, e) => a + e.coverage, 0) / Math.max(1, evidence.length)) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${s.color.includes("emerald") ? "bg-emerald-400" : s.color.includes("amber") ? "bg-amber-400" : s.color.includes("red") ? "bg-red-400" : "bg-sky-400"}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "artifact" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.type}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.sig}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">manifest v{modal.data.version}</span>
          </div>
          <Row label="Provenance Chain" value={`${modal.data.chain} assertions`} />
          <Row label="Manifest URI" value={modal.data.manifest} accent="text-emerald-400" />
          <Row label="Acting Principal" value={modal.data.actor} />
          <Row label="Signing Key" value={modal.data.signer} />
          <Row label="Site of Origin" value={modal.data.site} />
          <Row label="Created" value={modal.data.created} />
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-300"><Fingerprint size={12} /> C2PA binding</p>
            The manifest asserts the artifact's origin, hardware-bound signing identity and a hash-chained edit history. Consumers verify against the enterprise trust anchor before the artifact is rendered or exported. Legacy RSA-signed items are flagged for the sunset policy window.
          </div>
          {modal.data.status === "Suspicious" && (
            <button
              onClick={() => { requalify(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Re-sign under post-quantum policy
            </button>
          )}
        </Modal>
      )}

      {modal?.kind === "event" && (
        <Modal title={`${modal.data.actor} — ${modal.data.action}`} subtitle={`${modal.data.id} · ${modal.data.session}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.risk}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">{modal.data.action}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">retention {modal.data.retention}</span>
          </div>
          <Row label="Resource" value={modal.data.resource} />
          <Row label="Source IP" value={modal.data.ip} />
          <Row label="Session" value={modal.data.session} />
          <Row label="Timestamp" value={modal.data.ts} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">{modal.data.detail}</p>
          <div className="flex gap-2 pt-1">
            {modal.data.risk === "Normal" && (
              <button
                onClick={() => { holdForReview(modal.data.id); setModal(null); }}
                className="flex-1 rounded-lg bg-amber-500/15 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
              >
                Hold for Review
              </button>
            )}
            <button onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              Close
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "evidence" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.framework}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">coverage {modal.data.coverage}%</span>
          </div>
          <Row label="Scope" value={modal.data.scope} />
          <Row label="Reviewer" value={modal.data.reviewer} />
          <Row label="Last Assessed" value={modal.data.last} />
          <Row label="Expires In" value={`${modal.data.expires} days`} accent={parseFloat(modal.data.expires) < 30 ? "text-red-400" : "text-slate-200"} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Controls evidence is bound to the attestation ledger with hash anchors; any control change re-runs the mapped assessment and pushes an update to the evidence set consumed by external auditors.
          </p>
          {modal.data.status !== "Compliant" && (
            <button
              onClick={() => { requestRenewal(modal.data.id); setModal(null); }}
              className="w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Request Evidence Renewal
            </button>
          )}
        </Modal>
      )}

      <Footer>
        Regulatory Audit &amp; Provenance Ledger Hub — C2PA 2.1, HIPAA 164.312(b), 21 CFR Part 11, SOC 2, ISO 27001 · immutable simulation environment
      </Footer>
    </div>
  );
}

/* tiny inline edit icon so the icon list stays minimal */
const EditMini = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
