import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  Radio,
  Play,
  Lock,
  Globe,
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Sliders,
  Cpu,
  Server,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Crosshair,
  UserX,
  X
} from "lucide-react";
import {
  getActiveThreatEvents,
  getSoarPlaybooks,
  triggerPlaybookExecution,
  togglePlaybookStatus,
  simulateThreatIncident,
  updateThreatStatus
} from "../../services/ThreatDetectionService";
import "../../pages/auth/auth.css";

/**
 * ThreatDetectionSoarPanel Component
 * 
 * Enterprise Security Operations Center (SOC) & Automated Incident Response Console.
 * Key Features:
 * 1. Live Threat Telemetry Radar & Anomaly Severity Matrix
 * 2. Automated SOAR Playbook Execution & Policy Toggles
 * 3. Real-Time Attack Simulation Studio & Vector Injector
 * 4. Incident Remediation Console & Session Quarantine Controls
 * 5. SIEM Incident Export & Audit Trail Reporting
 */
export default function ThreatDetectionSoarPanel() {
  // Primary State
  const [threatEvents, setThreatEvents] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("feed"); // 'feed', 'playbooks', 'simulator', 'metrics'
  
  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Notification Banner State
  const [notification, setNotification] = useState({ type: "", message: "" });

  // Modal / Detail Inspector State
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [executingPlaybookId, setExecutingPlaybookId] = useState(null);

  // Threat Simulator Form State
  const [simThreatType, setSimThreatType] = useState("BRUTE_FORCE_ATTACK");
  const [simIp, setSimIp] = useState("185.220.101.99");
  const [simResource, setSimResource] = useState("/api/auth/authority/bump");

  // Load Initial SOC Telemetry
  const loadSocTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsData, playbooksData] = await Promise.all([
        getActiveThreatEvents(),
        getSoarPlaybooks()
      ]);
      setThreatEvents(eventsData || []);
      setPlaybooks(playbooksData || []);
    } catch (err) {
      console.error("Failed to load SOC threat telemetry:", err);
      setNotification({ type: "error", message: "Failed to sync live SOC threat telemetry." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSocTelemetry();
  }, [loadSocTelemetry]);

  // Calculated Metrics
  const metrics = useMemo(() => {
    const total = threatEvents.length;
    const criticalCount = threatEvents.filter((e) => e.severity === "CRITICAL").length;
    const activeCount = threatEvents.filter((e) => e.status === "ACTIVE").length;
    const avgRisk = total > 0 ? Math.round(threatEvents.reduce((acc, curr) => acc + (curr.riskScore || 50), 0) / total) : 0;
    return { total, criticalCount, activeCount, avgRisk };
  }, [threatEvents]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return threatEvents.filter((evt) => {
      const matchesSearch =
        (evt.threatType && evt.threatType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (evt.sourceIp && evt.sourceIp.includes(searchTerm)) ||
        (evt.targetResource && evt.targetResource.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (evt.details && evt.details.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesSeverity = selectedSeverity === "ALL" || evt.severity === selectedSeverity;
      const matchesStatus = selectedStatus === "ALL" || evt.status === selectedStatus;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [threatEvents, searchTerm, selectedSeverity, selectedStatus]);

  // Playbook Execution Handler
  const handleRunPlaybook = async (playbookId, eventId) => {
    setExecutingPlaybookId(playbookId);
    setActionLoading(true);
    try {
      const res = await triggerPlaybookExecution(playbookId, eventId);
      setNotification({
        type: "success",
        message: res.message || `SOAR Playbook ${playbookId} executed successfully!`
      });

      // Update local event status to CONTAINED
      if (eventId) {
        setThreatEvents((prev) =>
          prev.map((evt) => (evt.id === eventId ? { ...evt, status: "CONTAINED", riskScore: Math.max(10, evt.riskScore - 40) } : evt))
        );
      }
    } catch (err) {
      setNotification({ type: "error", message: "Playbook execution failed." });
    } finally {
      setActionLoading(false);
      setExecutingPlaybookId(null);
    }
  };

  // Playbook Toggle Handler
  const handleTogglePlaybook = async (playbookId, currentStatus) => {
    const nextStatus = currentStatus === "ENABLED";
    try {
      const res = await togglePlaybookStatus(playbookId, !nextStatus);
      setPlaybooks((prev) =>
        prev.map((pb) =>
          pb.id === playbookId
            ? { ...pb, status: nextStatus ? "DISABLED" : "ENABLED", enabled: !nextStatus }
            : pb
        )
      );
      setNotification({
        type: res && res.offline ? "warning" : "success",
        message: res && res.offline
          ? `Playbook ${playbookId} shown as ${nextStatus ? "DISABLED" : "ENABLED"} locally - the automation server did not confirm it. The playbook may still be armed.`
          : `Playbook ${playbookId} is now ${nextStatus ? "DISABLED" : "ENABLED"}.`
      });
    } catch (err) {
      setNotification({ type: "error", message: "Failed to toggle playbook status." });
    }
  };

  // Simulate Threat Handler
  const handleSimulateAttack = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const newEvt = await simulateThreatIncident(simThreatType, simIp, simResource);
      setThreatEvents((prev) => [newEvt, ...prev]);
      setNotification({
        type: "success",
        message: `Synthetic incident injected: ${newEvt.threatType} (IP: ${newEvt.sourceIp})`
      });
      setActiveTab("feed");
    } catch (err) {
      setNotification({ type: "error", message: "Simulation injection failed." });
    } finally {
      setActionLoading(false);
    }
  };

  // Update Event Status Handler
  const handleStatusChange = async (eventId, newStatus) => {
    try {
      const res = await updateThreatStatus(eventId, newStatus);
      setThreatEvents((prev) =>
        prev.map((evt) => (evt.id === eventId ? { ...evt, status: newStatus } : evt))
      );
      setNotification({
        type: res && res.offline ? "warning" : "success",
        message: res && res.offline
          ? `Event ${eventId} shown as ${newStatus} locally - the SOC server did not confirm it. Other analysts still see the previous status.`
          : `Event ${eventId} updated to ${newStatus}.`
      });
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      setNotification({ type: "error", message: "Failed to update threat event status." });
    }
  };

  // Export Telemetry to JSON
  const handleExportTelemetry = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(threatEvents, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `MedTrack_SOC_Threat_Telemetry_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  // Helper Severity Badge Color
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      case "HIGH":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "LOW":
        return "bg-sky-500/20 text-sky-400 border-sky-500/40";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/40";
    }
  };

  // Helper Status Badge Color
  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "INVESTIGATING":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "CONTAINED":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "RESOLVED":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* 1. Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1.5">
                <Radio size={14} className="animate-pulse text-red-400" /> Live Threat Engine
              </span>
              <span className="px-3 py-1 text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center gap-1">
                <Zap size={12} /> SOAR Automated Response
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Threat Detection & SOAR Command Center
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Real-time Security Operations Center (SOC) dashboard for continuous anomaly detection, impossible travel inspection, automated SOAR playbook enforcement, and threat containment.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl w-full lg:w-auto text-center">
            <div className="p-2">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Incidents</div>
              <div className="text-xl font-black text-white mt-1">{metrics.total}</div>
            </div>
            <div className="p-2 border-l border-slate-700">
              <div className="text-[10px] uppercase font-bold text-red-400">Critical Threat</div>
              <div className="text-xl font-black text-red-400 mt-1">{metrics.criticalCount}</div>
            </div>
            <div className="p-2 border-l border-slate-700">
              <div className="text-[10px] uppercase font-bold text-amber-400">Active Alerts</div>
              <div className="text-xl font-black text-amber-400 mt-1">{metrics.activeCount}</div>
            </div>
            <div className="p-2 border-l border-slate-700">
              <div className="text-[10px] uppercase font-bold text-sky-400">Avg Risk Score</div>
              <div className="text-xl font-black text-sky-400 mt-1">{metrics.avgRisk}/100</div>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {notification.message && (
          <div
            className={`mt-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              notification.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : notification.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "error" || notification.type === "warning"
                ? <AlertTriangle size={18} />
                : <CheckCircle2 size={18} />}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification({ type: "", message: "" })}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 2. Controls & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: "feed", label: `Live Threat Feed (${threatEvents.length})`, icon: Activity },
            { id: "playbooks", label: `SOAR Playbooks (${playbooks.length})`, icon: Zap },
            { id: "simulator", label: "Attack Simulator Studio", icon: Crosshair },
            { id: "metrics", label: "Threat Telemetry Analytics", icon: Cpu }
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                    : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <IconComp size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSocTelemetry}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync Telemetry
          </button>
          <button
            type="button"
            onClick={handleExportTelemetry}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <Download size={14} /> Export SIEM
          </button>
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: LIVE THREAT FEED */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search IP, threat vector, or resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Severity</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">All Incident Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="CONTAINED">CONTAINED</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>
          </div>

          {/* Events Stream Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Threat Vector</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Source IP</th>
                    <th className="p-4">Target Resource</th>
                    <th className="p-4">Risk Score</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">SOAR Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                        No active threat events match the search filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 text-slate-400 text-[11px]">
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "Just now"}
                        </td>
                        <td className="p-4 font-bold text-white font-sans">
                          {evt.threatType}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${getSeverityBadge(
                              evt.severity
                            )}`}
                          >
                            {evt.severity}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-sky-400">
                          {evt.sourceIp} <span className="text-slate-500 text-[10px]">({evt.country || "US"})</span>
                        </td>
                        <td className="p-4 text-slate-300">{evt.targetResource}</td>
                        <td className="p-4 font-bold">
                          <span className={evt.riskScore > 80 ? "text-red-400" : "text-amber-400"}>
                            {evt.riskScore}/100
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getStatusBadge(evt.status)}`}>
                            {evt.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(evt)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-sans font-bold border border-slate-700 transition"
                          >
                            Inspect & Mitigate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOAR PLAYBOOKS */}
      {activeTab === "playbooks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {playbooks.map((pb) => (
            <div
              key={pb.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">{pb.name}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">Trigger: {pb.triggerEvent}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                      pb.status === "ENABLED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {pb.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{pb.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono pt-2 border-t border-slate-800">
                  <span>Actions: <strong className="text-white">{pb.actionsCount} Steps</strong></span>
                  <span>•</span>
                  <span>Auto-Execute: <strong className="text-sky-400">{pb.autoExecute ? "YES" : "MANUAL"}</strong></span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleTogglePlaybook(pb.id, pb.status)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition ${
                    pb.status === "ENABLED"
                      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  }`}
                >
                  {pb.status === "ENABLED" ? "Disable Playbook" : "Enable Playbook"}
                </button>

                <button
                  type="button"
                  onClick={() => handleRunPlaybook(pb.id, null)}
                  disabled={actionLoading && executingPlaybookId === pb.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  <Play size={12} /> Trigger Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: ATTACK SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Crosshair size={20} className="text-red-400" /> Synthetic Threat Vector Injection Studio
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simulate intrusion attack vectors against MedTrack endpoints to test real-time SOAR automated playbooks and containment rules.
            </p>
          </div>

          <form onSubmit={handleSimulateAttack} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Threat Vector Category:</label>
                <select
                  value={simThreatType}
                  onChange={(e) => setSimThreatType(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                >
                  <option value="BRUTE_FORCE_ATTACK">BRUTE_FORCE_ATTACK (Critical)</option>
                  <option value="IMPOSSIBLE_TRAVEL">IMPOSSIBLE_TRAVEL (High)</option>
                  <option value="TOKEN_HIJACK_ATTEMPT">TOKEN_HIJACK_ATTEMPT (Critical)</option>
                  <option value="API_ANOMALY_RATE_LIMIT">API_ANOMALY_RATE_LIMIT (Medium)</option>
                  <option value="MALICIOUS_USER_AGENT">MALICIOUS_USER_AGENT (Low)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Simulated Origin IP:</label>
                <input
                  type="text"
                  value={simIp}
                  onChange={(e) => setSimIp(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                  placeholder="e.g. 185.220.101.99"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Target API Endpoint:</label>
                <input
                  type="text"
                  value={simResource}
                  onChange={(e) => setSimResource(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                  placeholder="/api/auth/authority/bump"
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-red-300 space-y-2">
              <div className="text-slate-500 uppercase text-[10px] font-bold">Simulated Telemetry Payload</div>
              <pre>
                {JSON.stringify(
                  {
                    threatType: simThreatType,
                    sourceIp: simIp,
                    targetResource: simResource,
                    timestamp: new Date().toISOString(),
                    autoMitigate: true
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              <Play size={14} /> Inject Threat Incident & Trigger SOAR Pipeline
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: TELEMETRY ANALYTICS */}
      {activeTab === "metrics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu size={18} className="text-sky-400" /> Incident Severity Distribution
            </h4>
            <div className="space-y-3 pt-2">
              {[
                { label: "Critical Threat Events", count: threatEvents.filter(e => e.severity === "CRITICAL").length, color: "bg-red-500" },
                { label: "High Severity Anomaly", count: threatEvents.filter(e => e.severity === "HIGH").length, color: "bg-rose-500" },
                { label: "Medium Anomaly Burst", count: threatEvents.filter(e => e.severity === "MEDIUM").length, color: "bg-amber-500" },
                { label: "Low Threat Telemetry", count: threatEvents.filter(e => e.severity === "LOW").length, color: "bg-sky-500" }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{item.label}</span>
                    <span className="font-mono font-bold">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${item.color} h-full transition-all duration-500`}
                      style={{ width: `${metrics.total > 0 ? (item.count / metrics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Server size={18} className="text-emerald-400" /> SOAR Automation Containment Metrics
            </h4>
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/50 space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span>Automated Mitigation Rate</span>
                <span className="font-bold text-emerald-400">96.4%</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span>Average Containment Time</span>
                <span className="font-bold text-sky-400">1.2 Seconds</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Active Honeypot Traps</span>
                <span className="font-bold text-purple-400">12 Endpoints</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. INCIDENT INSPECTOR MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-red-400" size={20} />
                <h3 className="text-base font-bold text-white">Incident Remediation Inspector</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <span className="font-bold text-white">{selectedEvent.threatType}</span>
                <span className={`px-2.5 py-0.5 font-bold rounded ${getSeverityBadge(selectedEvent.severity)}`}>
                  {selectedEvent.severity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono">
                <div>Origin IP: <strong className="text-sky-400">{selectedEvent.sourceIp}</strong></div>
                <div>Risk Score: <strong className="text-red-400">{selectedEvent.riskScore}/100</strong></div>
                <div>Resource: <strong className="text-slate-200">{selectedEvent.targetResource}</strong></div>
                <div>Status: <strong className="text-amber-400">{selectedEvent.status}</strong></div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Details & Vector Diagnostic</div>
                {selectedEvent.details}
              </div>

              <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/30 text-red-300 leading-relaxed">
                <div className="text-[10px] text-red-400 uppercase font-bold mb-1">Recommended SOAR Action</div>
                {selectedEvent.remediation}
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedEvent.id, "CONTAINED")}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Mark Contained
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedEvent.id, "RESOLVED")}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  onClick={() => handleRunPlaybook("pb_01", selectedEvent.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1"
                >
                  <Zap size={12} /> Run Playbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
