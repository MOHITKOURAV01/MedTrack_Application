import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  ShieldAlert,
  Server,
  Filter,
  Search,
  Download,
  Terminal,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  X,
  Play,
  Pause,
  Layers,
  Database,
  Radio
} from "lucide-react";
import {
  getSiemEventLogs,
  getSiemMetrics,
  getSiemCorrelationRules,
  toggleCorrelationRule,
  exportSiemLogs
} from "../../services/SiemSecurityAnalyticsService";
import "../../pages/auth/auth.css";

/**
 * SiemSecurityAnalyticsPanel Component
 * 
 * Security Information and Event Management (SIEM) Command Center.
 * Provides real-time log ingestion telemetry, correlation rule controls,
 * event payload analysis, and automated threat signal correlation.
 */
export default function SiemSecurityAnalyticsPanel() {
  // State
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("LOGS"); // "LOGS" | "RULES"
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [notification, setNotification] = useState({ type: "", message: "" });

  // Modal State
  const [inspectEvent, setInspectEvent] = useState(null);

  // Fetch Telemetry Data
  const loadSiemData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, metricsData, rulesData] = await Promise.all([
        getSiemEventLogs(),
        getSiemMetrics(),
        getSiemCorrelationRules()
      ]);
      setLogs(logsData || []);
      setMetrics(metricsData || null);
      setRules(rulesData || []);
    } catch (err) {
      console.error("Failed loading SIEM telemetry:", err);
      setNotification({ type: "error", message: "Failed to connect to SIEM log stream." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSiemData();
  }, [loadSiemData]);

  // Live Stream Simulation Effect
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      // Simulate incoming log event pulse
      const sampleEvents = [
        {
          id: `siem_evt_${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          severity: "MEDIUM",
          category: "API_GATEWAY",
          sourceIp: "192.168.1.189",
          geoCountry: "United States",
          userAgent: "MedTrack-Web-Client/2.1",
          principal: "user_doc_99",
          eventType: "API_BURST_METRIC_PULSE",
          component: "HttpService",
          details: "Standard encrypted telemetry heartbeat received from edge application node.",
          rawPayload: JSON.stringify({ status: "HEALTHY", latencyMs: 12 }, null, 2)
        }
      ];
      setLogs((prev) => [sampleEvents[0], ...prev.slice(0, 24)]);
    }, 8000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.principal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.sourceIp.includes(searchTerm) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSev = selectedSeverity === "ALL" || log.severity === selectedSeverity;
      return matchesSearch && matchesSev;
    });
  }, [logs, searchTerm, selectedSeverity]);

  // Toggle Rule Handler
  const handleToggleRule = async (ruleId, currentStatus) => {
    setActionLoading(true);
    try {
      await toggleCorrelationRule(ruleId, !currentStatus);
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !currentStatus } : r))
      );
      setNotification({
        type: "success",
        message: `Correlation rule ${ruleId} ${!currentStatus ? "enabled" : "disabled"}.`
      });
    } catch (err) {
      setNotification({ type: "error", message: "Failed updating correlation rule." });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Logs Handler
  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `MedTrack_SIEM_Logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    setNotification({ type: "success", message: "SIEM event log stream exported successfully." });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* 1. Header Banner & Real-time SIEM Telemetry */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center gap-1.5 font-mono">
                <Radio size={12} className="animate-pulse" /> LIVE SIEM STREAM
              </span>
              <span className="px-3 py-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <Database size={12} /> RETENTION 90 DAYS
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              SIEM & Security Event Analytics Console
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Centralized security log ingestion engine with real-time correlation rules, automated anomaly triggers, and forensic payload analysis.
            </p>
          </div>

          {/* EPS Metrics Widget */}
          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl w-full lg:w-auto text-xs space-y-2">
            <div className="flex items-center justify-between gap-6 font-mono">
              <span className="text-slate-400 font-sans font-bold uppercase text-[10px]">Ingestion Engine</span>
              <span className="text-sky-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                {metrics?.eventsPerMinute ?? "--"} EPM
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700/80 font-mono text-[11px]">
              <div>Today: <strong className="text-white">{((metrics?.totalEventsProcessedToday || 1245890) / 1000000).toFixed(2)}M Evts</strong></div>
              <div>Ingress: <strong className="text-purple-300">{metrics?.logIngestionGbPerDay || 48.5} GB/day</strong></div>
              <div>Rules Active: <strong className="text-emerald-400">{metrics?.activeCorrelationRules || 48} Rules</strong></div>
              <div>Latency: <strong className="text-amber-300">{metrics?.avgCorrelationLatencyMs || 4.2} ms</strong></div>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {notification.message && (
          <div
            className={`mt-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              notification.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
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

      {/* 2. Navigation Tabs & Stream Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("LOGS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "LOGS"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <FileText size={15} /> Real-time Log Stream ({filteredLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("RULES")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "RULES"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Sliders size={15} /> Correlation Rules ({rules.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              isLiveStreaming
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {isLiveStreaming ? <Pause size={13} /> : <Play size={13} />}
            {isLiveStreaming ? "Live Polling Active" : "Polling Paused"}
          </button>

          <button
            type="button"
            onClick={handleExportLogs}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Download size={14} /> Export Stream
          </button>
        </div>
      </div>

      {/* 3. LOG STREAM TAB */}
      {activeTab === "LOGS" && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search event type, IP, user, component..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Severity:</span>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition ${
                    selectedSeverity === sev
                      ? "bg-sky-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Log Stream Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Event Identifier</th>
                    <th className="p-4">Component</th>
                    <th className="p-4">Source IP & Geo</th>
                    <th className="p-4">Principal User</th>
                    <th className="p-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500 font-sans">
                        No SIEM security events matching active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                              log.severity === "CRITICAL"
                                ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                                : log.severity === "HIGH"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : log.severity === "MEDIUM"
                                ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white font-sans">
                          <div>{log.eventType}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{log.id}</div>
                        </td>
                        <td className="p-4 text-purple-300">{log.component}</td>
                        <td className="p-4">
                          <div className="text-sky-400 font-bold">{log.sourceIp}</div>
                          <div className="text-[10px] text-slate-500 font-sans">{log.geoCountry}</div>
                        </td>
                        <td className="p-4 text-slate-200">{log.principal}</td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectEvent(log)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-sans font-bold transition"
                          >
                            Payload
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

      {/* 4. CORRELATION RULES TAB */}
      {activeTab === "RULES" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">SIEM Correlation & Threat Automation Rules</h3>
              <p className="text-xs text-slate-400">Automated event evaluation pipeline triggers</p>
            </div>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{rule.name}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 rounded text-sky-300">
                      {rule.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        rule.severity === "CRITICAL" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Condition: <strong className="text-slate-200">{rule.condition}</strong>
                  </div>
                  <div className="text-xs text-purple-400 font-mono">
                    Action: <strong>{rule.action}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono text-slate-400">
                    Triggers: <strong className="text-white">{rule.triggerCount}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    disabled={actionLoading}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      rule.enabled
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}
                  >
                    {rule.enabled ? "ACTIVE" : "DISABLED"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. INSPECT PAYLOAD MODAL */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="text-sky-400" size={20} />
                <h3 className="text-base font-bold text-white">{inspectEvent.eventType}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-300 leading-relaxed">
                {inspectEvent.details}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                <div>Event ID: <strong className="text-sky-400">{inspectEvent.id}</strong></div>
                <div>Principal: <strong className="text-white">{inspectEvent.principal}</strong></div>
                <div>Source IP: <strong className="text-purple-300">{inspectEvent.sourceIp}</strong></div>
                <div>Component: <strong className="text-emerald-400">{inspectEvent.component}</strong></div>
                <div>Category: <strong className="text-slate-200">{inspectEvent.category}</strong></div>
                <div>Geo Country: <strong className="text-slate-200">{inspectEvent.geoCountry}</strong></div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Raw JSON Payload:</label>
                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                  {inspectEvent.rawPayload}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInspectEvent(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
