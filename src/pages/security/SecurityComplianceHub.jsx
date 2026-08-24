import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Calendar, CheckCircle2,
  ChevronRight, Clock, Cpu, Database, Download, Eye, FileText, Filter, Fingerprint,
  Gauge, Globe, HardDrive, Info, KeyRound, Layers, Lock, Network, Pause, Play,
  Plus, Radar, RefreshCw, Scale, Search, Server, ShieldAlert, ShieldCheck, Siren,
  Timer, TrendingDown, TrendingUp, User, Users, Wifi, WifiOff, X, Zap,
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

const IDENTITIES = [
  { id: "usr-001", name: "Dr. Priya Sharma", role: "Cardiologist", dept: "Cardiology", device: "STAFF-LT-217", os: "Win11 Secured", trust: 92, posture: "Healthy", mfa: "Passkey + TOTP", sessions: 3, risk: "Low", lastSeen: "12s ago", ip: "10.24.8.12" },
  { id: "usr-002", name: "Nurse Daniel Okafor", role: "ICU Nurse", dept: "ICU", device: "STAFF-LT-094", os: "Win11 Secured", trust: 88, posture: "Healthy", mfa: "Passkey + TOTP", sessions: 2, risk: "Low", lastSeen: "41s ago", ip: "10.24.8.77" },
  { id: "usr-003", name: "Labs Integrator", role: "Service Account", dept: "Pathology", device: "SVC-LIMS-01", os: "Linux Hardened", trust: 61, posture: "Degraded", mfa: "Cert-based", sessions: 1, risk: "Medium", lastSeen: "3m ago", ip: "172.16.9.4" },
  { id: "usr-004", name: "Raj Mehta", role: "Billing Analyst", dept: "Finance", device: "STAFF-LT-311", os: "Win11 Secured", trust: 74, posture: "Healthy", mfa: "Passkey", sessions: 4, risk: "Low", lastSeen: "26s ago", ip: "10.24.12.31" },
  { id: "usr-005", name: "Vendor - MedSupply Portal", role: "Vendor API", dept: "Supply Chain", device: "API-GW-14", os: "TLS mTLS", trust: 43, posture: "At Risk", mfa: "mTLS + OAuth", sessions: 2, risk: "High", lastSeen: "8m ago", ip: "203.0.113.22" },
  { id: "usr-006", name: "Dr. Lena Fischer", role: "Oncologist", dept: "Oncology", device: "STAFF-LT-058", os: "Win11 Secured", trust: 90, posture: "Healthy", mfa: "Passkey + TOTP", sessions: 2, risk: "Low", lastSeen: "18s ago", ip: "10.24.7.44" },
  { id: "usr-007", name: "Temp Staff - Karen W.", role: "Front Desk", dept: "Reception", device: "KIOSK-02", os: "Thin Client", trust: 52, posture: "Degraded", mfa: "TOTP only", sessions: 1, risk: "Medium", lastSeen: "2m ago", ip: "10.24.3.9" },
  { id: "usr-008", name: "Anesthesia Telemetry", role: "IoT Device", dept: "OR", device: "OR-TLM-07", os: "Firmware v4.2", trust: 57, posture: "Degraded", mfa: "N/A", sessions: 1, risk: "Medium", lastSeen: "55s ago", ip: "10.24.50.21" },
  { id: "usr-009", name: "Dr. Amir Hassan", role: "Radiologist", dept: "Radiology", device: "STAFF-LT-143", os: "Win11 Secured", trust: 85, posture: "Healthy", mfa: "Passkey", sessions: 3, risk: "Low", lastSeen: "1m ago", ip: "10.24.6.88" },
  { id: "usr-010", name: "Night Shift - Backup Crew", role: "On-call Admin", dept: "IT Ops", device: "STAFF-LT-402", os: "Win11 Legacy", trust: 39, posture: "At Risk", mfa: "SMS + TOTP", sessions: 2, risk: "High", lastSeen: "4m ago", ip: "198.51.100.66" },
];

const KEYS = [
  { id: "key-101", name: "EHR Master Key", algo: "Kyber-1024 + AES-256", status: "Active", age: 14, rotation: 30, enclave: "ENC-EHR-01", version: 7, usage: 128400, lastRotated: "14 days ago" },
  { id: "key-102", name: "Pharma Supply Signing", algo: "Dilithium-5", status: "Active", age: 9, rotation: 30, enclave: "ENC-SUP-02", version: 4, usage: 40211, lastRotated: "9 days ago" },
  { id: "key-103", name: "Telemetry Ingest Key", algo: "Kyber-768", status: "Active", age: 26, rotation: 30, enclave: "ENC-IOT-03", version: 12, usage: 912030, lastRotated: "26 days ago" },
  { id: "key-104", name: "Billing Token Master", algo: "AES-256 (Hybrid)", status: "Rotating", age: 29, rotation: 30, enclave: "ENC-FIN-01", version: 21, usage: 55210, lastRotated: "29 days ago" },
  { id: "key-105", name: "Research Cohort Key", algo: "Dilithium-3 + AES-256", status: "Active", age: 3, rotation: 30, enclave: "ENC-RES-04", version: 2, usage: 9877, lastRotated: "3 days ago" },
  { id: "key-106", name: "Legacy RSA Backup", algo: "RSA-4096 (Deprecated)", status: "Retired", age: 214, rotation: 30, enclave: "ENC-LEGACY", version: 1, usage: 0, lastRotated: "214 days ago" },
  { id: "key-107", name: "External Partner Bridge", algo: "Kyber-768 + TLS 1.3", status: "Active", age: 17, rotation: 30, enclave: "ENC-PRT-05", version: 9, usage: 33108, lastRotated: "17 days ago" },
  { id: "key-108", name: "Audit Ledger Anchor", algo: "Dilithium-5", status: "Active", age: 5, rotation: 30, enclave: "ENC-AUD-06", version: 3, usage: 76012, lastRotated: "5 days ago" },
];

const ENCLAVES = [
  { id: "ENC-EHR-01", name: "EHR Confidential Compute", cpu: "AMD SEV-SNP", att: "Healthy", pods: 12, mem: 84, threats: 0 },
  { id: "ENC-SUP-02", name: "Supply Chain Vault", cpu: "Intel TDX", att: "Healthy", pods: 6, mem: 61, threats: 0 },
  { id: "ENC-IOT-03", name: "IoT Ingest Enclave", cpu: "AMD SEV-ES", att: "Healthy", pods: 9, mem: 77, threats: 1 },
  { id: "ENC-FIN-01", name: "Billing & Payments", cpu: "Intel TDX", att: "Healthy", pods: 5, mem: 58, threats: 0 },
  { id: "ENC-RES-04", name: "Genomics Research", cpu: "AMD SEV-SNP", att: "Degraded", pods: 8, mem: 91, threats: 2 },
  { id: "ENC-PRT-05", name: "Partner Integration", cpu: "Intel TDX", att: "Healthy", pods: 4, mem: 49, threats: 0 },
  { id: "ENC-AUD-06", name: "Audit Ledger", cpu: "AMD SEV-SNP", att: "Healthy", pods: 7, mem: 66, threats: 0 },
];

const DETECTIONS = [
  { id: "det-9001", title: "Anomalous lateral movement", src: "SIEM Correlation", sev: "Critical", status: "Investigating", asset: "STAFF-LT-402", time: "2m ago", owner: "SOC Lead", mitre: "TA0008", score: 96, detail: "Multiple internal SMB handshakes from a workstation outside business hours, chaining toward the finance segment." },
  { id: "det-9002", title: "Impossible travel login", src: "Identity Analytics", sev: "High", status: "Investigating", asset: "usr-005", time: "5m ago", owner: "IAM Team", mitre: "TA0001", score: 88, detail: "Successful login from Frankfurt followed by a second login from Singapore within 11 minutes; MFA was satisfied via push approval." },
  { id: "det-9003", title: "Key rotation overdue", src: "KMS Guard", sev: "High", status: "Open", asset: "key-104", time: "9m ago", owner: "Crypto Ops", mitre: "TA0005", score: 81, detail: "Hybrid AES master has exceeded the 30-day rotation policy window and is now outside compliance bounds." },
  { id: "det-9004", title: "USB mass storage policy bypass", src: "EDR Agent", sev: "Medium", status: "Open", asset: "KIOSK-02", time: "14m ago", owner: "Endpoint Team", mitre: "TA0010", score: 63, detail: "A removable storage device was mounted on a front-desk kiosk; write access was blocked but audit flags were raised." },
  { id: "det-9005", title: "Exposure: RDP port open", src: "CTEM Scanner", sev: "Medium", status: "Open", asset: "10.24.50.21", time: "21m ago", owner: "CTEM Team", mitre: "TA0009", score: 58, detail: "Attack-surface scan found RDP exposed on an OR telemetry gateway; blast-radius scoring places it in the medium band." },
  { id: "det-9006", title: "Phishing beacon callback", src: "DNS Analytics", sev: "Low", status: "Open", asset: "STAFF-LT-311", time: "33m ago", owner: "SOC Lead", mitre: "TA0011", score: 44, detail: "A single DNS query matched a known phishing infrastructure sinkhole; the endpoint was isolated and rescanned." },
  { id: "det-9007", title: "Privilege escalation attempt", src: "SIEM Correlation", sev: "High", status: "Investigating", asset: "SVC-LIMS-01", time: "41m ago", owner: "SOC Lead", mitre: "TA0004", score: 84, detail: "A service account attempted to invoke admin PowerShell cmdlets outside its runbook; UAC blocked the elevation." },
  { id: "det-9008", title: "Enclave attestation drift", src: "Enclave Monitor", sev: "Medium", status: "Open", asset: "ENC-RES-04", time: "52m ago", owner: "Crypto Ops", mitre: "TA0003", score: 66, detail: "PCR measurement mismatch detected during scheduled attestation; workload pods were re-pinned to a known-good baseline." },
];

const POLICIES = [
  { id: "pol-01", name: "Zero-Trust Conditional Access", control: "Identity", status: "Enforced", score: 96, updated: "2d ago" },
  { id: "pol-02", name: "Post-Quantum Key Rotation (30d)", control: "Crypto", status: "Enforced", score: 88, updated: "1d ago" },
  { id: "pol-03", name: "Enclave Attestation Cadence", control: "Compute", status: "Enforced", score: 92, updated: "4d ago" },
  { id: "pol-04", name: "HIPAA Audit Log Retention", control: "Compliance", status: "Enforced", score: 100, updated: "5d ago" },
  { id: "pol-05", name: "MFA Everywhere (Except Break-Glass)", control: "Identity", status: "Enforced", score: 94, updated: "3d ago" },
  { id: "pol-06", name: "CTEM Continuous Exposure Scan", control: "Threat", status: "Enforced", score: 79, updated: "1d ago" },
];

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

const toneOf = (v) => {
  if (["Critical", "High", "At Risk", "Retired"].includes(v)) return "red";
  if (["Medium", "Degraded", "Rotating", "Open"].includes(v)) return "amber";
  if (["Low", "Healthy", "Active", "Investigating", "Enforced"].includes(v)) return "green";
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

function useSimulation({ identityRef, keyRef, detectionRef, toast }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const runningRef = useRef(true);
  const speedRef = useRef(1);
  const timerRef = useRef(null);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const t = (id) => identityRef.current.find((x) => x.id === id);
    // Trust-score drift for identities
    setTick((tk) => tk + 1);
    identityRef.current = identityRef.current.map((u) => {
      let trust = u.trust + (Math.random() * 4 - 2);
      const now = Date.now();
      const last = u._last || now;
      const secs = Math.max(5, Math.round((now - last) / 1000));
      u._last = now;
      u.lastSeen = secs > 60 ? `${Math.round(secs / 60)}m ago` : `${secs}s ago`;
      // occasional anomaly event
      if (Math.random() < 0.015) trust -= 7 + Math.random() * 8;
      if (Math.random() < 0.02) trust += 3;
      trust = Math.round(Math.min(99, Math.max(8, trust)));
      const posture = trust >= 70 ? "Healthy" : trust >= 50 ? "Degraded" : "At Risk";
      const risk = trust >= 70 ? "Low" : trust >= 50 ? "Medium" : "High";
      return { ...u, trust, posture, risk };
    });
    // Key age creep
    keyRef.current = keyRef.current.map((k) => {
      const age = k.age + 0.06;
      let status = k.status;
      if (k.status === "Active" && age >= k.rotation) status = "Rotating";
      if (status === "Rotating" && age > k.rotation + 1) status = "Active";
      return { ...k, age: Math.min(k.rotation + 2, age), status, lastRotated: status === "Rotating" ? "just now" : k.lastRotated };
    });
    // Detection arrival
    if (Math.random() < 0.1 * speedRef.current) {
      const titles = [
        ["Repeated failed auth attempts", "SIEM Correlation", "Medium"],
        ["New device join without MFA", "Identity Analytics", "High"],
        ["Certificate near expiry", "KMS Guard", "Low"],
        ["Suspicious outbound transfer", "DNS Analytics", "Medium"],
      ];
      const pick = titles[Math.floor(Math.random() * titles.length)];
      const nd = {
        id: `det-${9000 + Math.floor(Math.random() * 900)}`,
        title: pick[0], src: pick[1], sev: pick[2], status: "Open",
        asset: `host-${Math.floor(Math.random() * 90) + 10}`,
        time: "just now", owner: "SOC Lead", mitre: "TA0002",
        score: Math.round(40 + Math.random() * 55),
        detail: "Auto-generated by the live detection simulator.",
      };
      detectionRef.current = [nd, ...detectionRef.current].slice(0, 30);
      toast(`${pick[0]} · ${pick[2]}`, pick[2]);
    }
    void t;
  }, [identityRef, keyRef, detectionRef, toast]);

  useEffect(() => {
    const iv = setInterval(() => loop(), Math.round(2000 / speedRef.current));
    timerRef.current = iv;
    return () => clearInterval(iv);
  }, [loop]);

  return {
    running, setRunning, speed, setSpeed, tick,
    reset: () => {
      identityRef.current = IDENTITIES.map((u) => ({ ...u }));
      keyRef.current = KEYS.map((k) => ({ ...k }));
      detectionRef.current = DETECTIONS.map((d) => ({ ...d }));
      setTick(0);
      toast("Simulation reset to baseline", "Low");
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SecurityComplianceHub() {
  const [tab, setTab] = useState("zero-trust");
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [postureFilter, setPostureFilter] = useState("All");
  const [keyStatusFilter, setKeyStatusFilter] = useState("All");

  const { toasts, toast } = useToastTray();

  const [identities, setIdentities] = useState(() => IDENTITIES.map((u) => ({ ...u })));
  const [keys, setKeys] = useState(() => KEYS.map((k) => ({ ...k })));
  const [detections, setDetections] = useState(() => DETECTIONS.map((d) => ({ ...d })));
  const [policies] = useState(() => POLICIES.map((p) => ({ ...p })));

  const identityRef = useRef(identities);
  const keyRef = useRef(keys);
  const detectionRef = useRef(detections);

  useEffect(() => { identityRef.current = identities; }, [identities]);
  useEffect(() => { keyRef.current = keys; }, [keys]);
  useEffect(() => { detectionRef.current = detections; }, [detections]);

  const sim = useSimulation({ identityRef, keyRef, detectionRef, toast });

  useEffect(() => {
    setIdentities([...identityRef.current]);
    setKeys([...keyRef.current]);
    setDetections([...detectionRef.current]);
  }, [sim.tick]);

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const atRisk = identities.filter((u) => u.risk === "High").length;
    const avgTrust = Math.round(identities.reduce((a, u) => a + u.trust, 0) / Math.max(1, identities.length));
    const rotating = keys.filter((k) => k.status === "Rotating" || k.age >= k.rotation * 0.9).length;
    const activeThreats = detections.filter((d) => ["Critical", "High"].includes(d.sev) && d.status !== "Resolved").length;
    return { atRisk, avgTrust, rotating, activeThreats };
  }, [identities, keys, detections]);

  /* ---------- filters ---------- */
  const filteredIdentities = useMemo(() => {
    return identities.filter((u) => {
      const q = query.toLowerCase();
      const matchQ = !q || [u.name, u.role, u.dept, u.device, u.ip].some((s) => s.toLowerCase().includes(q));
      const matchP = postureFilter === "All" || u.posture === postureFilter;
      return matchQ && matchP;
    });
  }, [identities, query, postureFilter]);

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const q = query.toLowerCase();
      const matchQ = !q || [k.name, k.algo, k.enclave].some((s) => s.toLowerCase().includes(q));
      const matchS = keyStatusFilter === "All" || k.status === keyStatusFilter;
      return matchQ && matchS;
    });
  }, [keys, query, keyStatusFilter]);

  const filteredDetections = useMemo(() => {
    return detections.filter((d) => {
      const q = query.toLowerCase();
      const matchQ = !q || [d.title, d.src, d.asset, d.owner, d.mitre].some((s) => s.toLowerCase().includes(q));
      const matchS = sevFilter === "All" || d.sev === sevFilter;
      return matchQ && matchS;
    });
  }, [detections, query, sevFilter]);

  /* ---------- actions ---------- */
  const resolveDetection = (id) => {
    setDetections((ds) => ds.map((d) => (d.id === id ? { ...d, status: "Resolved" } : d)));
    toast("Detection resolved and added to audit trail", "Low");
  };

  const rotateKey = (id) => {
    setKeys((ks) =>
      ks.map((k) => (k.id === id ? { ...k, status: "Rotating", age: 0, version: k.version + 1, lastRotated: "just now" } : k))
    );
    toast("Post-quantum key rotation initiated", "Low");
  };

  const challengeIdentity = (id) => {
    setIdentities((us) =>
      us.map((u) => (u.id === id ? { ...u, trust: Math.max(20, u.trust - 15), posture: u.trust - 15 >= 70 ? "Healthy" : u.trust - 15 >= 50 ? "Degraded" : "At Risk", risk: "Medium" } : u))
    );
    toast("Re-auth challenge issued to endpoint", "Low");
  };

  const exportCsv = () => {
    const rows =
      tab === "zero-trust"
        ? [["ID", "Name", "Role", "Department", "Device", "Trust %", "Posture", "MFA", "Risk"], ...filteredIdentities.map((u) => [u.id, u.name, u.role, u.dept, u.device, u.trust, u.posture, u.mfa, u.risk])]
        : tab === "kms"
        ? [["ID", "Key", "Algorithm", "Status", "Age (d)", "Rotation (d)", "Enclave", "Version"], ...filteredKeys.map((k) => [k.id, k.name, k.algo, k.status, k.age.toFixed(1), k.rotation, k.enclave, k.version])]
        : [["ID", "Title", "Source", "Severity", "Status", "Asset", "Time", "Score"], ...filteredDetections.map((d) => [d.id, d.title, d.src, d.sev, d.status, d.asset, d.time, d.score])];
    downloadCsv(`security-compliance-${tab}-${Date.now()}.csv`, rows);
    toast("CSV export downloaded", "Low");
  };

  const tabs = [
    { id: "zero-trust", label: "Zero-Trust Access", icon: Fingerprint },
    { id: "kms", label: "Quantum KMS & Enclaves", icon: KeyRound },
    { id: "ctem", label: "CTEM & SIEM Overwatch", icon: Radar },
  ];

  const sevOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* toast stack */}
      <ToastTray toasts={toasts} />

      {/* header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            icon={<ShieldCheck size={24} className="text-emerald-400" />}
            title="Enterprise Security &amp; Compliance Hub"
            subtitle="Zero-trust posture · Post-quantum KMS · Confidential enclaves · CTEM &amp; SIEM — NIST SP 800-207 / FIPS 203 aligned"
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
          <StatCard icon={Fingerprint} label="Avg Trust Score" value={`${stats.avgTrust}%`} sub={`${stats.atRisk} high-risk identities`} accent="text-emerald-400" />
          <StatCard icon={ShieldAlert} label="Active High Threats" value={stats.activeThreats} sub="CTEM + SIEM correlation" accent={stats.activeThreats > 0 ? "text-red-400" : "text-emerald-400"} />
          <StatCard icon={KeyRound} label="Keys Due for Rotation" value={stats.rotating} sub="FIPS 203 hybrid policy" accent="text-amber-400" />
          <StatCard icon={Server} label="Enclave Attestation" value={`${ENCLAVES.filter((e) => e.att === "Healthy").length}/${ENCLAVES.length}`} sub="TEE measurements valid" accent="text-sky-400" />
        </div>

        <TabsBar tabs={tabs} active={tab} onChange={setTab} />

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CompactSearch value={query} onChange={setQuery} placeholder="Search identities, keys, detections…" />
          {tab === "zero-trust" && (
            <FilterChips options={["All", "Healthy", "Degraded", "At Risk"]} value={postureFilter} onChange={setPostureFilter} />
          )}
          {tab === "kms" && (
            <FilterChips options={["All", "Active", "Rotating", "Retired"]} value={keyStatusFilter} onChange={setKeyStatusFilter} />
          )}
          {tab === "ctem" && (
            <FilterChips options={["All", "Critical", "High", "Medium", "Low"]} value={sevFilter} onChange={setSevFilter} />
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {sim.tick} ticks · <span className={sim.running ? "text-emerald-400" : "text-amber-400"}>{sim.running ? "LIVE" : "PAUSED"}</span>
          </span>
        </div>
      </header>

      <main className="space-y-6 p-6">
        {/* ================= ZERO-TRUST TAB ================= */}
        {tab === "zero-trust" && (
          <div className="space-y-6">
            {/* policy strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {policies.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-1.5 ${p.score >= 90 ? "bg-emerald-500/10 text-emerald-400" : p.score >= 80 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                      {p.score >= 90 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.control} · updated {p.updated}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-100">{p.score}%</p>
                    <Badge>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </section>

            {/* identity table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Fingerprint size={16} className="text-emerald-400" />}
                title="Identity &amp; Device Trust Inventory"
                badge={`${filteredIdentities.length} subjects`}
                right="Continuous verification · NIST SP 800-207"
              />
              {filteredIdentities.length === 0 ? (
                <EmptyState icon={Radar} message="No identities match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-4 py-3">Device</th>
                        <th className="px-4 py-3">Trust</th>
                        <th className="px-4 py-3">Posture</th>
                        <th className="px-4 py-3">MFA</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Last Seen</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIdentities.map((u) => (
                        <tr key={u.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            <button className="flex items-center gap-3 text-left" onClick={() => setModal({ kind: "identity", data: u })}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${u.risk === "High" ? "bg-red-500/15 text-red-400" : u.risk === "Medium" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                                {u.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <p className="font-medium text-slate-200">{u.name}</p>
                                <p className="text-[10px] text-slate-500">{u.role} · {u.dept}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-300">{u.device}</p>
                            <p className="text-[10px] text-slate-500">{u.os}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${u.trust >= 70 ? "text-emerald-400" : u.trust >= 50 ? "text-amber-400" : "text-red-400"}`}>{u.trust}%</span>
                              <Meter value={u.trust} color={u.trust >= 70 ? "bg-emerald-400" : u.trust >= 50 ? "bg-amber-400" : "bg-red-400"} />
                            </div>
                          </td>
                          <td className="px-4 py-3"><Badge>{u.posture}</Badge></td>
                          <td className="px-4 py-3 text-slate-400">{u.mfa}</td>
                          <td className="px-4 py-3"><Badge>{u.risk}</Badge></td>
                          <td className="px-4 py-3 text-slate-400">{u.lastSeen}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => challengeIdentity(u.id)}
                                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                              >
                                Challenge
                              </button>
                              <button
                                onClick={() => setModal({ kind: "identity", data: u })}
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

        {/* ================= KMS TAB ================= */}
        {tab === "kms" && (
          <div className="space-y-6">
            {/* enclave grid */}
            <section>
              <PanelHeader
                icon={<Server size={16} className="text-sky-400" />}
                title="Confidential Computing Enclaves"
                badge="Hardware TEE attestation"
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ENCLAVES.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setModal({ kind: "enclave", data: e })}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-sky-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu size={15} className="text-sky-400" />
                        <span className="text-[11px] font-bold tracking-wide text-slate-300">{e.id}</span>
                      </div>
                      <Badge>{e.att}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-200">{e.name}</p>
                    <p className="text-[10px] text-slate-500">{e.cpu}</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Memory</span>
                        <span>{e.mem}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${e.mem > 85 ? "bg-red-400" : "bg-sky-400"}`} style={{ width: `${e.mem}%` }} />
                      </div>
                      <div className="flex justify-between pt-1 text-[10px] text-slate-500">
                        <span>{e.pods} pods</span>
                        <span>{e.threats} threat flags</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* key table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<KeyRound size={16} className="text-amber-400" />}
                title="Post-Quantum Key Inventory"
                badge={`${filteredKeys.length} keys`}
                right="NIST FIPS 203 (ML-KEM) · FIPS 204 (ML-DSA) hybrid"
              />
              {filteredKeys.length === 0 ? (
                <EmptyState icon={Radar} message="No keys match the current filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Key</th>
                        <th className="px-4 py-3">Algorithm</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Rotation Age</th>
                        <th className="px-4 py-3">Version</th>
                        <th className="px-4 py-3">Usage</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKeys.map((k) => {
                        const pct = Math.min(100, Math.round((k.age / k.rotation) * 100));
                        const due = k.age >= k.rotation;
                        return (
                          <tr key={k.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                            <td className="px-5 py-3">
                              <button className="text-left" onClick={() => setModal({ kind: "key", data: k })}>
                                <p className="font-medium text-slate-200">{k.name}</p>
                                <p className="text-[10px] text-slate-500">{k.id} · {k.enclave}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{k.algo}</td>
                            <td className="px-4 py-3"><Badge>{k.status}</Badge></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-medium ${due ? "text-red-400" : "text-slate-300"}`}>
                                  {k.age.toFixed(1)}d / {k.rotation}d
                                </span>
                                <div className="h-1.5 w-16 rounded-full bg-slate-800">
                                  <div className={`h-full rounded-full ${due ? "bg-red-400" : pct > 75 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">v{k.version}</td>
                            <td className="px-4 py-3 text-slate-400">{k.usage.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => rotateKey(k.id)}
                                  disabled={k.status === "Retired"}
                                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Rotate
                                </button>
                                <button
                                  onClick={() => setModal({ kind: "key", data: k })}
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

        {/* ================= CTEM / SIEM TAB ================= */}
        {tab === "ctem" && (
          <div className="space-y-6">
            {/* threat posture mini grid */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Siren size={14} className="text-red-400" /> Critical detections</div>
                <p className="mt-1 text-2xl font-bold text-red-400">{detections.filter((d) => d.sev === "Critical").length}</p>
                <p className="text-[10px] text-slate-500">immediate SOC action</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle size={14} className="text-amber-400" /> High severity</div>
                <p className="mt-1 text-2xl font-bold text-amber-400">{detections.filter((d) => d.sev === "High").length}</p>
                <p className="text-[10px] text-slate-500">prioritized queue</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Radar size={14} className="text-sky-400" /> Exposure score</div>
                <p className="mt-1 text-2xl font-bold text-sky-400">
                  {Math.max(0, 100 - detections.reduce((a, d) => a + (d.sev === "Critical" ? 6 : d.sev === "High" ? 4 : d.sev === "Medium" ? 2 : 1), 0))}
                </p>
                <p className="text-[10px] text-slate-500">CTEM blast-radius model</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Bot size={14} className="text-emerald-400" /> Auto-remediation</div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{detections.filter((d) => d.status === "Resolved").length}</p>
                <p className="text-[10px] text-slate-500">closed via runbook</p>
              </div>
            </section>

            {/* detection queue */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
              <SectionHeader
                icon={<Radar size={16} className="text-red-400" />}
                title="Detection &amp; Exposure Queue"
                badge={`${filteredDetections.length} detections`}
                right="MITRE ATT&amp;CK mapped · kill-chain scoring"
              />
              {filteredDetections.length === 0 ? (
                <EmptyState icon={Radar} message="No detections match the current filters." />
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {[...filteredDetections]
                    .sort((a, b) => (sevOrder[a.sev] ?? 9) - (sevOrder[b.sev] ?? 9))
                    .map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          d.sev === "Critical" ? "bg-red-500/15 text-red-400" : d.sev === "High" ? "bg-amber-500/15 text-amber-400" : d.sev === "Medium" ? "bg-sky-500/15 text-sky-400" : "bg-slate-500/15 text-slate-400"
                        }`}>
                          {d.sev === "Critical" ? <Siren size={16} /> : d.sev === "High" ? <ShieldAlert size={16} /> : d.sev === "Medium" ? <AlertTriangle size={16} /> : <Info size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button className="flex items-center gap-2 text-left" onClick={() => setModal({ kind: "detection", data: d })}>
                            <p className="truncate text-xs font-medium text-slate-200">{d.title}</p>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">{d.mitre}</span>
                          </button>
                          <p className="mt-0.5 text-[10px] text-slate-500">{d.src} · {d.asset} · {d.time} · owned by {d.owner}</p>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <Badge>{d.sev}</Badge>
                          <Badge>{d.status}</Badge>
                          <div className="ml-1 flex items-center gap-1.5">
                            <span className={`text-[11px] font-bold ${d.score >= 80 ? "text-red-400" : d.score >= 60 ? "text-amber-400" : "text-slate-400"}`}>{d.score}</span>
                            <Meter value={d.score} color={d.score >= 80 ? "bg-red-400" : d.score >= 60 ? "bg-amber-400" : "bg-slate-500"} />
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {d.status !== "Resolved" && (
                            <button
                              onClick={() => resolveDetection(d.id)}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ kind: "detection", data: d })}
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

            {/* kill chain strip */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <PanelHeader icon={<Network size={16} className="text-purple-400" />} title="Active Kill-Chain Coverage" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                {["Recon", "Delivery", "Exploit", "Priv Esc", "Lateral", "Exfil", "C2", "Impact", "Persistence"].map((stage, i) => {
                  const hits = detections.filter((d) => d.mitre && ["TA0001", "TA0011", "TA0004", "TA0008", "TA0010", "TA0009", "TA0011", "TA0040", "TA0003"].indexOf(d.mitre) === i).length;
                  return (
                    <div key={stage} className={`rounded-lg border p-2.5 text-center ${hits > 0 ? "border-red-500/40 bg-red-500/5" : "border-slate-800 bg-slate-900"}`}>
                      <p className={`text-lg font-bold ${hits > 0 ? "text-red-400" : "text-slate-600"}`}>{hits}</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">{stage}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal?.kind === "identity" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.role} · ${modal.data.dept}`} onClose={() => setModal(null)}>
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <Fingerprint size={18} className="text-emerald-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Continuous trust score</span>
                <span className={`text-lg font-bold ${modal.data.trust >= 70 ? "text-emerald-400" : modal.data.trust >= 50 ? "text-amber-400" : "text-red-400"}`}>{modal.data.trust}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${modal.data.trust >= 70 ? "bg-emerald-400" : modal.data.trust >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${modal.data.trust}%` }} />
              </div>
            </div>
          </div>
          <Row label="Subject ID" value={modal.data.id} />
          <Row label="Device" value={`${modal.data.device} · ${modal.data.os}`} />
          <Row label="IP Address" value={modal.data.ip} />
          <Row label="MFA Method" value={modal.data.mfa} />
          <Row label="Active Sessions" value={String(modal.data.sessions)} />
          <Row label="Posture" value={modal.data.posture} accent={modal.data.posture === "Healthy" ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Risk Band" value={modal.data.risk} accent={modal.data.risk === "High" ? "text-red-400" : "text-amber-400"} />
          <Row label="Last Seen" value={modal.data.lastSeen} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Policy: access is granted per-session based on real-time device posture, location, and behavior analytics. A trust score below 50 triggers step-up authentication and conditional access restrictions per NIST SP 800-207.
          </p>
        </Modal>
      )}

      {modal?.kind === "key" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.enclave}`} onClose={() => setModal(null)}>
          <Row label="Algorithm" value={modal.data.algo} />
          <Row label="Status" value={modal.data.status} accent={modal.data.status === "Active" ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Rotation Age" value={`${modal.data.age.toFixed(1)} days of ${modal.data.rotation} day policy`} />
          <Row label="Version" value={`v${modal.data.version}`} />
          <Row label="Operations" value={modal.data.usage.toLocaleString()} />
          <Row label="Last Rotated" value={modal.data.lastRotated} />
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-300"><KeyRound size={12} /> Crypto policy</p>
            FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) hybrid schemes are enforced for all new material. RSA-2048 and ECC-256 remain only in "Retired" state for read-only legacy decryption until the sunset window closes.
          </div>
        </Modal>
      )}

      {modal?.kind === "enclave" && (
        <Modal title={modal.data.name} subtitle={`${modal.data.id} · ${modal.data.cpu}`} onClose={() => setModal(null)}>
          <Row label="Attestation" value={modal.data.att} accent={modal.data.att === "Healthy" ? "text-emerald-400" : "text-amber-400"} />
          <Row label="Running Pods" value={String(modal.data.pods)} />
          <Row label="Memory Pressure" value={`${modal.data.mem}%`} />
          <Row label="Threat Flags" value={String(modal.data.threats)} />
          <Row label="Baseline PCR" value="0x9f3c…7a21 (known-good)" />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Confidential workloads run inside hardware TEEs with remote attestation at boot and on a 6-hour cadence. Any PCR drift auto-quarantines the enclave and re-pins pods to the last trusted baseline.
          </p>
        </Modal>
      )}

      {modal?.kind === "detection" && (
        <Modal title={modal.data.title} subtitle={`${modal.data.id} · ${modal.data.src}`} onClose={() => setModal(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{modal.data.sev}</Badge>
            <Badge>{modal.data.status}</Badge>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">MITRE {modal.data.mitre}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">Score {modal.data.score}</span>
          </div>
          <Row label="Affected Asset" value={modal.data.asset} />
          <Row label="Reported" value={modal.data.time} />
          <Row label="Assigned To" value={modal.data.owner} />
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">{modal.data.detail}</p>
          <div className="flex gap-2 pt-1">
            {modal.data.status !== "Resolved" && (
              <button
                onClick={() => { resolveDetection(modal.data.id); setModal(null); }}
                className="flex-1 rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                Resolve &amp; Log
              </button>
            )}
            <button onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              Close
            </button>
          </div>
        </Modal>
      )}

      <Footer>
        Enterprise Security &amp; Compliance Hub — simulation environment · Zero-trust, post-quantum crypto, confidential compute, CTEM &amp; SIEM telemetry (NIST SP 800-207, FIPS 203/204, HIPAA Security Rule)
      </Footer>
    </div>
  );
}
