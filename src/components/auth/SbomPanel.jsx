import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Sliders,
  Terminal,
  Cpu,
  Lock,
  Search,
  PlusCircle,
  FileText,
  Download,
  Code,
  Layers,
  Sparkles,
  Eye,
  X,
  FileCode,
  ShieldAlert,
  Server
} from "lucide-react";
import {
  getAllArtifacts,
  registerArtifact,
  getAllComponents,
  ingestComponent,
  generateAttestation,
  getCycloneDxManifest
} from "../../services/SbomService";
import "../../pages/auth/auth.css";

/**
 * SbomPanel Component
 * 
 * 360-Degree Software Bill of Materials (SBOM) & Supply Chain Security Console.
 * Features:
 * 1. CycloneDX 1.5 & SPDX 2.3 Dependency Manifest Engine
 * 2. NVD CVE Supply Chain Vulnerability & Prohibited License Scanner
 * 3. SLSA Level 3 Build Provenance & SHA-256 Attestation Ledger
 * 4. Interactive JSON Manifest Inspector Modal
 */
export default function SbomPanel() {
  // State
  const [artifacts, setArtifacts] = useState([]);
  const [components, setComponents] = useState([]);
  const [attestation, setAttestation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("ARTIFACTS"); // "ARTIFACTS" | "COMPONENTS" | "POLICY"
  const [searchTerm, setSearchTerm] = useState("");

  // Manifest Viewer Modal State
  const [manifestModalArtifact, setManifestModalArtifact] = useState(null);
  const [manifestJson, setManifestJson] = useState(null);

  // Register Artifact Form State
  const [artifactId, setArtifactId] = useState("");
  const [artifactType, setArtifactType] = useState("DOCKER_IMAGE");
  const [sha256Digest, setSha256Digest] = useState("");

  // Ingest Component Form State
  const [targetArtifactId, setTargetArtifactId] = useState("medtrack-backend-api:v2.4.0");
  const [packageName, setPackageName] = useState("");
  const [packageVersion, setPackageVersion] = useState("");
  const [ecosystem, setEcosystem] = useState("MAVEN");
  const [licenseType, setLicenseType] = useState("APACHE_2_0");
  const [directDependency, setDirectDependency] = useState(true);

  // Load SBOM Telemetry
  const loadSbomData = useCallback(async () => {
    setLoading(true);
    try {
      const [artList, compList] = await Promise.all([
        getAllArtifacts().catch(() => []),
        getAllComponents().catch(() => [])
      ]);

      setArtifacts(artList);
      setComponents(compList);
      if (artList.length > 0) {
        setTargetArtifactId(artList[0].artifactId);
      }
    } catch (err) {
      console.error("Failed to load SBOM data:", err);
      setMessage({ type: "error", text: "Failed connecting to SBOM service." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSbomData();
  }, [loadSbomData]);

  // Metrics
  const metrics = useMemo(() => {
    const totalArtifacts = artifacts.length;
    const totalComponents = components.length;
    const prohibitedLicenses = components.filter((c) => c.riskLevel === "PROHIBITED_LICENSE").length;
    const vulnerableComponents = components.filter((c) => c.cveMatches && c.cveMatches.length > 0).length;
    return { totalArtifacts, totalComponents, prohibitedLicenses, vulnerableComponents };
  }, [artifacts, components]);

  // Handlers
  const handleRegisterArtifact = async (e) => {
    e.preventDefault();
    if (!artifactId.trim() || !sha256Digest.trim()) return;

    setActionLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const registered = await registerArtifact({
        artifactId: artifactId.trim(),
        artifactType,
        sha256Digest: sha256Digest.trim()
      });

      setArtifactId("");
      setSha256Digest("");
      setMessage({ type: "success", text: `Build Artifact ${registered.artifactId} registered for SBOM tracking!` });
      await loadSbomData();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to register artifact." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleIngestComponent = async (e) => {
    e.preventDefault();
    if (!packageName.trim() || !packageVersion.trim()) return;

    setActionLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const ingested = await ingestComponent({
        artifactId: targetArtifactId,
        packageName: packageName.trim(),
        packageVersion: packageVersion.trim(),
        ecosystem,
        licenseType,
        directDependency
      });

      setPackageName("");
      setPackageVersion("");
      setMessage({ type: "success", text: `SBOM Component ${ingested.componentId} (${ingested.packageName}) ingested!` });
      await loadSbomData();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to ingest component." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateAttestation = async (artId) => {
    setActionLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const att = await generateAttestation(artId);

      // `attestationId: null` is the service saying no provenance record was created. Showing
      // "Attestation Bundle generated" over it is a SLSA claim nothing backs.
      if (!att || att.attestationId == null) {
        setAttestation(null);
        setMessage({
          type: "error",
          text: (att && att.message) || `No attestation was created for ${artId} - the provenance service was unreachable.`
        });
        return;
      }

      setAttestation(att);
      setMessage({ type: "success", text: `SHA-256 Attestation Bundle generated for ${att.artifactId}!` });
    } catch (err) {
      setMessage({ type: "error", text: "Attestation generation failed." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewManifest = async (artId) => {
    setActionLoading(true);
    try {
      const manifest = await getCycloneDxManifest(artId);
      setManifestModalArtifact(artId);
      setManifestJson(manifest);
    } catch (err) {
      setMessage({ type: "error", text: "Failed generating CycloneDX manifest." });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredComponents = useMemo(() => {
    return components.filter(
      (c) =>
        c.packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ecosystem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.licenseType.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [components, searchTerm]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* 1. Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5 font-mono">
                <Package size={12} /> CYCLONEDX 1.5 & SPDX 2.3
              </span>
              <span className="px-3 py-1 text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center gap-1 font-mono">
                <ShieldCheck size={12} /> SLSA LEVEL 3 PROVENANCE
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Software Bill of Materials (SBOM) & Supply Chain Security
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Open-source component inventory, automated NVD CVE vulnerability mapping, prohibited license policy enforcement, and cryptographic build attestations.
            </p>
          </div>

          {/* Telemetry Widget */}
          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl w-full lg:w-auto text-xs space-y-2">
            <div className="flex items-center justify-between gap-6 font-mono">
              <span className="text-slate-400 font-sans font-bold uppercase text-[10px]">Supply Chain Security</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                VERIFIED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700/80 font-mono text-[11px]">
              <div>Build Artifacts: <strong className="text-white">{metrics.totalArtifacts} Tracked</strong></div>
              <div>Dependencies: <strong className="text-sky-300">{metrics.totalComponents} Cataloged</strong></div>
              <div>Prohibited Licenses: <strong className="text-red-400">{metrics.prohibitedLicenses} Flagged</strong></div>
              <div>CVE Matches: <strong className="text-amber-400">{metrics.vulnerableComponents} Detected</strong></div>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {message.text && (
          <div
            className={`mt-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              message.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              <span>{message.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setMessage({ type: "", text: "" })}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Attestation Certificate Display */}
        {attestation && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono space-y-2 text-slate-200">
            <div className="flex items-center justify-between font-sans">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-sm">
                <FileCheck size={18} /> SHA-256 Supply Chain Attestation Certificate
              </h4>
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => setAttestation(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
              <div><span className="text-slate-400">Artifact:</span> <strong className="text-white">{attestation.artifactId}</strong></div>
              <div><span className="text-slate-400">Verdict:</span> <strong className="text-emerald-400">{attestation.complianceVerdict}</strong></div>
              <div><span className="text-slate-400">Total Components:</span> <strong className="text-white">{attestation.totalComponents}</strong></div>
              <div><span className="text-slate-400">Prohibited Licenses:</span> <strong className="text-red-400">{attestation.prohibitedLicenseCount}</strong></div>
            </div>
            <div className="pt-2 text-[10px] text-slate-300 truncate">
              <span className="text-emerald-400 font-bold">SHA-256 Bundle Checksum:</span> {attestation.attestationSha256Checksum}
            </div>
          </div>
        )}
      </div>

      {/* 2. Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("ARTIFACTS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "ARTIFACTS"
                ? "bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Package size={15} /> Build Artifacts ({artifacts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("COMPONENTS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "COMPONENTS"
                ? "bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <FileText size={15} /> Dependency Catalog ({components.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadSbomData}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Catalog
        </button>
      </div>

      {/* 3. ARTIFACTS & INGESTION TAB */}
      {activeTab === "ARTIFACTS" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Register Artifact & Ingest Component */}
          <div className="space-y-6 lg:col-span-1">
            {/* Register Artifact Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <PlusCircle size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Register Build Artifact</h3>
              </div>

              <form onSubmit={handleRegisterArtifact} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Artifact Tag / Image ID:</label>
                  <input
                    type="text"
                    placeholder="e.g. medtrack-backend-api:v2.4.0"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={artifactId}
                    onChange={(e) => setArtifactId(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Artifact Type:</label>
                  <select
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={artifactType}
                    onChange={(e) => setArtifactType(e.target.value)}
                  >
                    <option value="DOCKER_IMAGE">DOCKER CONTAINER IMAGE</option>
                    <option value="MAVEN_JAR">MAVEN JAR BUNDLE</option>
                    <option value="NPM_PACKAGE">NPM WEB BUNDLE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">SHA-256 Checksum Digest:</label>
                  <input
                    type="text"
                    placeholder="sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={sha256Digest}
                    onChange={(e) => setSha256Digest(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
                  disabled={actionLoading}
                >
                  Register Build Artifact
                </button>
              </form>
            </div>

            {/* Ingest Component Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Package size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Ingest CycloneDX Component</h3>
              </div>

              <form onSubmit={handleIngestComponent} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Target Artifact:</label>
                  <select
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={targetArtifactId}
                    onChange={(e) => setTargetArtifactId(e.target.value)}
                  >
                    {artifacts.map((a, i) => (
                      <option key={i} value={a.artifactId}>{a.artifactId}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Package Name:</label>
                    <input
                      type="text"
                      placeholder="spring-boot-security"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Version:</label>
                    <input
                      type="text"
                      placeholder="3.2.1"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={packageVersion}
                      onChange={(e) => setPackageVersion(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Ecosystem:</label>
                    <select
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={ecosystem}
                      onChange={(e) => setEcosystem(e.target.value)}
                    >
                      <option value="MAVEN">MAVEN</option>
                      <option value="NPM">NPM</option>
                      <option value="PYPI">PYPI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">License:</label>
                    <select
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                    >
                      <option value="APACHE_2_0">APACHE 2.0</option>
                      <option value="MIT">MIT</option>
                      <option value="GPL_3_0">GPL 3.0 (PROHIBITED)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition"
                  disabled={actionLoading}
                >
                  Ingest Component
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Tracked Artifacts Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Tracked Build Artifacts & Provenance</h3>
                <p className="text-xs text-slate-400 font-mono">Continuous SLSA Level 3 attestations and component count matrix</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Artifact ID</th>
                    <th className="p-3">Type & Checksum</th>
                    <th className="p-3">Compliance</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {artifacts.map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60">
                      <td className="p-3 font-bold text-emerald-400">{a.artifactId}</td>
                      <td className="p-3 font-sans">
                        <div className="font-semibold text-white">{a.artifactType}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{a.sha256Digest}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.complianceStatus === "COMPLIANT"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {a.complianceStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right font-sans space-x-2">
                        <button
                          type="button"
                          onClick={() => handleViewManifest(a.artifactId)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px] font-bold transition"
                        >
                          Manifest
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateAttestation(a.artifactId)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition"
                        >
                          Attest
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. DEPENDENCY CATALOG TAB */}
      {activeTab === "COMPONENTS" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Open-Source Dependency Component Catalog</h3>
              <p className="text-xs text-slate-400 font-mono">CycloneDX 1.5 spec inventory, license compliance, and NVD CVE vulnerability mappings</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search package or ecosystem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Component ID</th>
                  <th className="p-3">Package & Version</th>
                  <th className="p-3">Ecosystem & License</th>
                  <th className="p-3">CVE Matches</th>
                  <th className="p-3 text-right">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredComponents.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/60">
                    <td className="p-3 font-bold text-sky-400">{c.componentId}</td>
                    <td className="p-3 font-sans">
                      <div className="font-semibold text-white">{c.packageName}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">v{c.packageVersion}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-200">{c.ecosystem}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{c.licenseType}</div>
                    </td>
                    <td className="p-3">
                      {c.cveMatches && c.cveMatches.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {c.cveMatches.map((cve, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-bold">
                              {cve}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold">CLEAN</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.riskLevel === "PROHIBITED_LICENSE"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {c.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CYCLONEDX MANIFEST INSPECTOR MODAL */}
      {manifestModalArtifact && manifestJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="text-emerald-400" size={20} />
                <h3 className="text-base font-bold text-white">CycloneDX 1.5 JSON Manifest Inspector</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManifestModalArtifact(null);
                  setManifestJson(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>Artifact: <strong className="text-emerald-400">{manifestModalArtifact}</strong></span>
                <span>Format: <strong className="text-sky-300">{manifestJson.bomFormat} v{manifestJson.specVersion}</strong></span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl max-h-80 overflow-y-auto font-mono text-[10px] text-emerald-300">
                <pre>{JSON.stringify(manifestJson, null, 2)}</pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(manifestJson, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `cyclonedx-${manifestModalArtifact.replace(/[:/]/g, "_")}.json`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-2 text-xs"
                >
                  <Download size={14} /> Download CycloneDX JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
