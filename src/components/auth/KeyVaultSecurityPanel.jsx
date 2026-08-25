import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  Sliders,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Server,
  FileCode,
  Shield,
  Activity,
  Layers,
  Sparkles,
  X
} from "lucide-react";
import {
  getKeyVaultSecrets,
  getHsmHealthTelemetry,
  rotateSecret,
  createSecret,
  revokeSecret
} from "../../services/KeyVaultSecurityService";
import "../../pages/auth/auth.css";

/**
 * KeyVaultSecurityPanel Component
 * 
 * Hardware Security Module (HSM) & Cryptographic Secret Key Vault Management Center.
 * Features:
 * 1. FIPS 140-3 Hardware Security Module (HSM) Telemetry Monitor
 * 2. Symmetric & Asymmetric Key Lifecycle Management (AES-256, RSA-4096, ECDSA)
 * 3. Automated Key Rotation Engine with Hardware Entropy Seed
 * 4. TLS/X.509 Certificate Expiration Tracking
 * 5. Cryptographic Secret Creation Studio & Inspection Modal
 * 6. Audit Trail Export for Key Management Ledger
 */
export default function KeyVaultSecurityPanel() {
  // State
  const [secrets, setSecrets] = useState([]);
  const [hsmStatus, setHsmStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState({ type: "", message: "" });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inspectSecret, setInspectSecret] = useState(null);
  const [showSecretValue, setShowSecretValue] = useState(false);

  // Form State for Secret Creation
  const [newSecName, setNewSecName] = useState("");
  const [newSecCategory, setNewSecCategory] = useState("SYMMETRIC_KEY");
  const [newSecAlgorithm, setNewSecAlgorithm] = useState("AES-256-GCM");
  const [newSecDesc, setNewSecDesc] = useState("");
  const [newSecAutoRotate, setNewSecAutoRotate] = useState(true);

  // Load Key Vault Telemetry
  const loadVaultData = useCallback(async () => {
    setLoading(true);
    try {
      const [secData, hsmData] = await Promise.all([
        getKeyVaultSecrets(),
        getHsmHealthTelemetry()
      ]);
      setSecrets(secData || []);
      setHsmStatus(hsmData || null);
    } catch (err) {
      console.error("Failed loading Key Vault data:", err);
      setNotification({ type: "error", message: "Failed to load Key Vault secrets." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Metrics
  const metrics = useMemo(() => {
    const total = secrets.length;
    const active = secrets.filter((s) => s.status === "ACTIVE").length;
    const needsRotation = secrets.filter((s) => s.status === "NEEDS_ROTATION").length;
    const totalAccess = secrets.reduce((acc, curr) => acc + (curr.accessCount || 0), 0);
    return { total, active, needsRotation, totalAccess };
  }, [secrets]);

  // Filtered Secrets
  const filteredSecrets = useMemo(() => {
    return secrets.filter((sec) => {
      const matchesSearch =
        sec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sec.algorithm.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sec.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = selectedCategory === "ALL" || sec.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [secrets, searchTerm, selectedCategory]);

  // Rotate Key Handler
  const handleRotateKey = async (secretId) => {
    setActionLoading(true);
    try {
      const res = await rotateSecret(secretId);

      // A rotation that never reached the HSM produced no new key material. Advancing the
      // displayed version anyway made an unrotated key read as rotated in the audit column,
      // which is the one thing this panel exists to get right.
      if (res && res.success === false) {
        setNotification({
          type: "error",
          message: res.message || `Key ${secretId} was NOT rotated - the HSM was unreachable.`
        });
        return;
      }

      setSecrets((prev) =>
        prev.map((s) =>
          s.id === secretId
            ? {
                ...s,
                status: "ACTIVE",
                version: res.newKeyVersion || res.newVersion || `v${parseFloat(s.version.slice(1)) + 0.1}`,
                lastRotated: new Date().toISOString().split("T")[0]
              }
            : s
        )
      );
      setNotification({
        type: "success",
        message: res.message || `Key ${secretId} rotated successfully!`
      });
      if (inspectSecret && inspectSecret.id === secretId) {
        setInspectSecret((prev) => ({
          ...prev,
          status: "ACTIVE",
          lastRotated: new Date().toISOString().split("T")[0]
        }));
      }
    } catch (err) {
      setNotification({ type: "error", message: "Failed to rotate cryptographic key." });
    } finally {
      setActionLoading(false);
    }
  };

  // Create Secret Handler
  const handleCreateSecret = async (e) => {
    e.preventDefault();
    if (!newSecName.trim()) return;

    setActionLoading(true);
    try {
      const created = await createSecret({
        name: newSecName.trim().toUpperCase(),
        category: newSecCategory,
        algorithm: newSecAlgorithm,
        description: newSecDesc.trim(),
        autoRotate: newSecAutoRotate
      });

      setSecrets((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewSecName("");
      setNewSecDesc("");
      setNotification({
        type: "success",
        message: `Secret "${created.name}" provisioned successfully in Key Vault!`
      });
    } catch (err) {
      setNotification({ type: "error", message: "Failed to provision secret." });
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Secret Handler
  const handleRevokeSecret = async (secretId) => {
    if (!window.confirm(`Revoke and zeroize key "${secretId}"? This action cannot be undone.`)) return;

    setActionLoading(true);
    try {
      const res = await revokeSecret(secretId);

      // Dropping the row on a revocation that did not reach the HSM is the worst available
      // outcome: the secret is still live and it is no longer on screen to revoke again.
      if (res && res.success === false) {
        setNotification({
          type: "error",
          message: res.message || `Secret ${secretId} was NOT revoked - the HSM was unreachable. It remains active.`
        });
        return;
      }

      setSecrets((prev) => prev.filter((s) => s.id !== secretId));
      setNotification({ type: "success", message: `Secret ${secretId} zeroized and revoked.` });
      if (inspectSecret && inspectSecret.id === secretId) {
        setInspectSecret(null);
      }
    } catch (err) {
      setNotification({ type: "error", message: "Failed to revoke secret." });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Ledger
  const handleExportLedger = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(secrets, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `MedTrack_KeyVault_Ledger_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* 1. Header Banner & Diagnostics */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center gap-1.5">
                <Lock size={12} /> HSM Cryptographic Security
              </span>
              <span className="px-3 py-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <ShieldCheck size={12} /> FIPS 140-3 LEVEL 3
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Cryptographic Key Vault & HSM Secret Manager
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Manage enterprise asymmetric signing keypairs, AES-256 envelope encryption keys, TLS wildcard certificates, and automated hardware rotation policies.
            </p>
          </div>

          {/* HSM Cluster Widget */}
          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl w-full lg:w-auto text-xs space-y-2">
            <div className="flex items-center justify-between gap-4 font-mono">
              <span className="text-slate-400 font-sans font-bold uppercase text-[10px]">HSM Cluster Status</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {hsmStatus?.clusterStatus || "HEALTHY"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700/80 font-mono text-[11px]">
              <div>Nodes: <strong className="text-white">{hsmStatus?.activeNodes || 4}/4 Active</strong></div>
              <div>Throughput: <strong className="text-sky-400">{(hsmStatus?.cryptoOperationsPerSec || 12450).toLocaleString()} ops/s</strong></div>
              <div>Temp: <strong className="text-slate-300">{hsmStatus?.hardwareTempCelsius || 38.4}°C</strong></div>
              <div>Memory: <strong className="text-purple-300">{hsmStatus?.memoryUtilizationPercent || 42.1}%</strong></div>
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

      {/* 2. Metrics Bar & Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Secrets Registered</div>
          <div className="text-2xl font-black text-white">{metrics.total} Keys</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-[10px] font-bold text-emerald-400 uppercase">Active FIPS Keys</div>
          <div className="text-2xl font-black text-emerald-400">{metrics.active} Keys</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-[10px] font-bold text-amber-400 uppercase">Pending Rotation</div>
          <div className="text-2xl font-black text-amber-400">{metrics.needsRotation} Keys</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-[10px] font-bold text-purple-400 uppercase">Crypto Encrypt Operations</div>
          <div className="text-2xl font-black text-purple-400">{(metrics.totalAccess).toLocaleString()}</div>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search keys or algorithms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {["ALL", "ASYMMETRIC_KEY", "SYMMETRIC_KEY", "TLS_CERTIFICATE", "SECRET_KEY", "API_TOKEN"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
          >
            <Plus size={14} /> Provision Secret
          </button>
          <button
            type="button"
            onClick={handleExportLedger}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Download size={14} /> Export Audit
          </button>
        </div>
      </div>

      {/* 4. Secrets Grid Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-4">Key Identifier</th>
                <th className="p-4">Category</th>
                <th className="p-4">Algorithm & Spec</th>
                <th className="p-4">Version</th>
                <th className="p-4">Last Rotated</th>
                <th className="p-4">Auto-Rotate</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredSecrets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                    No cryptographic secrets found matching query filter.
                  </td>
                </tr>
              ) : (
                filteredSecrets.map((sec) => (
                  <tr key={sec.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-white font-sans flex items-center gap-2">
                      <KeyRound size={16} className="text-purple-400" />
                      <div>
                        <div>{sec.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{sec.id}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded text-purple-300">
                        {sec.category}
                      </span>
                    </td>
                    <td className="p-4 text-sky-400 font-bold">{sec.algorithm}</td>
                    <td className="p-4 text-slate-200">{sec.version}</td>
                    <td className="p-4 text-slate-400">{sec.lastRotated}</td>
                    <td className="p-4">
                      <span className={sec.autoRotate ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        {sec.autoRotate ? "ENABLED" : "OFF"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                          sec.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse"
                        }`}
                      >
                        {sec.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleRotateKey(sec.id)}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded-lg text-[11px] font-sans font-bold transition"
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectSecret(sec)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-sans font-bold transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. CREATE SECRET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-purple-400" /> Provision Cryptographic Secret
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSecret} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Secret Identifier Name:</label>
                <input
                  type="text"
                  placeholder="e.g. AUTH_REDIS_AES_KEY"
                  value={newSecName}
                  onChange={(e) => setNewSecName(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Category:</label>
                  <select
                    value={newSecCategory}
                    onChange={(e) => setNewSecCategory(e.target.value)}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="SYMMETRIC_KEY">Symmetric Key</option>
                    <option value="ASYMMETRIC_KEY">Asymmetric Key Pair</option>
                    <option value="TLS_CERTIFICATE">TLS Certificate</option>
                    <option value="SECRET_KEY">Secret Key</option>
                    <option value="API_TOKEN">API Token</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Algorithm Spec:</label>
                  <select
                    value={newSecAlgorithm}
                    onChange={(e) => setNewSecAlgorithm(e.target.value)}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="AES-256-GCM">AES-256-GCM</option>
                    <option value="RSA-4096 / SHA-512">RSA-4096 / SHA-512</option>
                    <option value="ECDSA P-384 / X.509">ECDSA P-384 / X.509</option>
                    <option value="HMAC-SHA256">HMAC-SHA256</option>
                    <option value="HMAC-SHA512">HMAC-SHA512</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description:</label>
                <textarea
                  rows={2}
                  placeholder="Purpose and key access policy..."
                  value={newSecDesc}
                  onChange={(e) => setNewSecDesc(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSecAutoRotate}
                  onChange={(e) => setNewSecAutoRotate(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <span className="text-slate-200 font-bold">Enable 90-Day Hardware Auto-Rotation</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition"
                >
                  Provision Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. INSPECT SECRET MODAL */}
      {inspectSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="text-purple-400" size={20} />
                <h3 className="text-base font-bold text-white">{inspectSecret.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSecret(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-300 leading-relaxed">
                {inspectSecret.description}
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono">
                <div>ID: <strong className="text-purple-400">{inspectSecret.id}</strong></div>
                <div>Category: <strong className="text-white">{inspectSecret.category}</strong></div>
                <div>Spec: <strong className="text-sky-400">{inspectSecret.algorithm}</strong></div>
                <div>Version: <strong className="text-emerald-400">{inspectSecret.version}</strong></div>
                <div>Last Rotated: <strong className="text-slate-200">{inspectSecret.lastRotated}</strong></div>
                <div>Next Rotation: <strong className="text-slate-200">{inspectSecret.nextRotation}</strong></div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-purple-300 space-y-1">
                <div className="text-slate-500 uppercase text-[10px] font-sans font-bold flex items-center justify-between">
                  <span>Cryptographic Key Fingerprint</span>
                  <button
                    type="button"
                    onClick={() => setShowSecretValue(!showSecretValue)}
                    className="text-purple-400 hover:underline flex items-center gap-1 font-sans"
                  >
                    {showSecretValue ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showSecretValue ? "Hide Fingerprint" : "View Fingerprint"}
                  </button>
                </div>
                {showSecretValue ? (
                  <div className="break-all font-mono text-emerald-400">
                    SHA256:8f4a99b1c77d99e055f412b378a966c144e233d822f077a499c555e611b2
                  </div>
                ) : (
                  <div className="text-slate-600">••••••••••••••••••••••••••••••••••••••••••••••••••••••••</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleRotateKey(inspectSecret.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Rotate Key Now
                </button>

                <button
                  type="button"
                  onClick={() => handleRevokeSecret(inspectSecret.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold rounded-xl text-xs transition"
                >
                  Revoke Secret
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
