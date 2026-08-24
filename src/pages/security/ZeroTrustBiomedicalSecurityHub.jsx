import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Server, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Cpu, 
  ShieldAlert,
  Zap,
  Globe
} from 'lucide-react';

const ZeroTrustBiomedicalSecurityHub = () => {
  const [selectedDevice, setSelectedDevice] = useState('DEV-ICU-891');
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [protocolStatus, setProtocolStatus] = useState({
    microsegmentation: false,
    quantumKeyRotate: false,
    deviceQuarantine: false,
    ebpfEnforcement: false
  });

  // Security Telemetry Metrics State
  const [secMetrics, setSecMetrics] = useState({
    activeDevices: 482,
    threatLevel: 'LOW_NOMINAL',
    blockedIntrusions: 142,
    quantumKeyAgeDays: 4,
    attestationScore: 99.8,
    hipaaAuditLogs: 184920
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSecMetrics(prev => ({
        ...prev,
        blockedIntrusions: prev.blockedIntrusions + Math.floor(Math.random() * 2),
        hipaaAuditLogs: prev.hipaaAuditLogs + Math.floor(Math.random() * 12)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const deviceList = [
    { id: 'DEV-ICU-891', name: 'Baxter Spectrum IQ Infusion Pump', ip: '10.240.12.84', segment: 'VLAN-ICU-CRITICAL', attestation: 'TPM 2.0 VERIFIED', status: 'COMPLIANT' },
    { id: 'DEV-PAC-302', name: 'GE Carescape B850 Monitor', ip: '10.240.14.19', segment: 'VLAN-TELEMETRY-01', attestation: 'FIPS 140-3 PASSED', status: 'COMPLIANT' },
    { id: 'DEV-RAD-904', name: 'Siemens Somatom CT Scanner', ip: '10.240.80.110', segment: 'VLAN-IMAGING-SEC', attestation: 'MTLS ACTIVE', status: 'WARNING' },
    { id: 'DEV-LAB-551', name: 'Roche Cobas 6000 Analyzer', ip: '10.240.95.44', segment: 'VLAN-LAB-ISOLATED', attestation: 'TPM 2.0 VERIFIED', status: 'COMPLIANT' }
  ];

  const secAlerts = [
    { id: 'ALT-SEC01', time: '15:14:02', type: 'CRITICAL', title: 'Unauthorized Port Scanning Detected (eBPF Blocked)', desc: 'Anomalous TCP SYN scan origin 10.240.80.110 targeted telemetry broker port 8883. eBPF Kernel Policy auto-dropped packets.', standard: 'NIST SP 800-207 Zero Trust Architecture' },
    { id: 'ALT-SEC02', time: '14:50:33', type: 'WARNING', title: 'mTLS Identity Token Approaching Expiration', desc: 'X.509 client certificate for CT Scanner node expires in 4 hours. Automatic PQC ACME renewal triggered.', standard: 'FDA Cybersecurity Postmarket Guidance' },
    { id: 'ALT-SEC03', time: '13:10:15', type: 'INFO', title: 'Post-Quantum KMS Key Rotation Complete', desc: 'Kyber-1024 HSM master key rotated across all medical device microsegments.', standard: 'FDA 21 CFR Part 11 / NIST PQC Standard' }
  ];

  const toggleProtocol = (proto) => {
    setProtocolStatus(prev => ({
      ...prev,
      [proto]: !prev[proto]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
                Zero-Trust Biomedical Security & Microsegmentation Overwatch
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                NIST SP 800-207 Zero Trust Architecture, eBPF Kernel Perimeter Enforcement & Post-Quantum KMS Security
              </p>
            </div>
          </div>
        </div>

        {/* Security Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => toggleProtocol('deviceQuarantine')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 border flex items-center gap-1.5 ${
              protocolStatus.deviceQuarantine 
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/50 animate-bounce' 
                : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            QUARANTINE ANOMALOUS DEVICE
          </button>

          <button 
            onClick={() => toggleProtocol('quantumKeyRotate')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 border flex items-center gap-1.5 ${
              protocolStatus.quantumKeyRotate 
                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/50' 
                : 'bg-purple-950/40 text-purple-300 border-purple-800/60 hover:bg-purple-900/40'
            }`}
          >
            <Key className="w-4 h-4" />
            ROTATE PQC KMS KEYS
          </button>

          <button 
            onClick={() => toggleProtocol('ebpfEnforcement')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 border flex items-center gap-1.5 ${
              protocolStatus.ebpfEnforcement 
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/50' 
                : 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60 hover:bg-cyan-900/40'
            }`}
          >
            <Cpu className="w-4 h-4" />
            ENFORCE eBPF POLICIES
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Device Inventory */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                IoMT Medical Devices
              </h2>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full font-mono">
                {secMetrics.activeDevices} Authenticated
              </span>
            </div>

            <div className="space-y-2">
              {deviceList.map(dev => (
                <div 
                  key={dev.id}
                  onClick={() => setSelectedDevice(dev.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedDevice === dev.id ? 'bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10' : 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{dev.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{dev.id} • {dev.ip}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      dev.status === 'COMPLIANT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {dev.attestation}
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-400 mt-2 font-mono">{dev.segment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Security Telemetry Widget */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-purple-400" />
              Cryptographic Key Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>KMS Algorithm:</span>
                <span className="font-mono text-purple-400">Kyber-1024 / Dilithium5</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>TPM Attestation Score:</span>
                <span className="font-mono text-emerald-400">{secMetrics.attestationScore}%</span>
              </div>
              <div className="flex justify-between py-1 text-slate-300">
                <span>HIPAA Audit Records:</span>
                <span className="font-mono text-cyan-400">{secMetrics.hipaaAuditLogs.toLocaleString()} Logs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Security Operations Dashboard */}
        <div className="lg:col-span-6 space-y-6">
          {/* Device Header Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap justify-between items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100">Baxter Spectrum IQ Infusion Pump</h2>
                <span className="px-2.5 py-0.5 text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-semibold">
                  ZERO TRUST ATTESTED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                IP: 10.240.12.84 | MAC: 00:1A:2B:3C:4D:5E | TLS 1.3 mTLS Active | Hardware Root of Trust (TPM 2.0)
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-700">
                NIST SP 800-207
              </span>
            </div>
          </div>

          {/* Core Security Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4">
              <div className="text-xs font-bold text-emerald-400 mb-1">SECURITY POSTURE</div>
              <div className="text-2xl font-black font-mono text-emerald-300">NOMINAL</div>
              <div className="text-[10px] text-slate-400 mt-1">Zero Vulnerabilities</div>
            </div>

            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4">
              <div className="text-xs font-bold text-cyan-400 mb-1">eBPF DROPPED</div>
              <div className="text-2xl font-black font-mono text-cyan-300">{secMetrics.blockedIntrusions} <span className="text-xs font-normal text-slate-400">pkts</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Port Scan Defense</div>
            </div>

            <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4">
              <div className="text-xs font-bold text-purple-400 mb-1">PQC KMS ROTATION</div>
              <div className="text-2xl font-black font-mono text-purple-300">{secMetrics.quantumKeyAgeDays} <span className="text-xs font-normal text-slate-400">days ago</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Kyber-1024 HSM</div>
            </div>

            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-xs font-bold text-amber-400 mb-1">HIPAA PRIVACY</div>
              <div className="text-2xl font-black font-mono text-amber-300">100%</div>
              <div className="text-[10px] text-slate-400 mt-1">Zero Data Egress</div>
            </div>
          </div>

          {/* Microsegmentation Network Stream */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-300 tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                REAL-TIME eBPF MICROSEGMENTATION NETWORK TRAFFIC ENFORCEMENT
              </h3>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                <span>KERNEL FILTER ACTIVE</span>
              </div>
            </div>
            
            <div className="h-32 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-center p-4 font-mono text-xs text-slate-300 overflow-hidden relative">
              <div className="space-y-1 w-full text-center">
                <p className="text-emerald-400">[ALLOW] 10.240.12.84:443 --(mTLS PQC)--&gt; 10.240.0.10:8443 (EHR Telemetry Sync)</p>
                <p className="text-rose-400 font-bold bg-rose-950/40 py-0.5 rounded animate-pulse">[DENY] 10.240.80.110:53120 --(TCP SYN)--&gt; 10.240.12.84:8883 (Unauthorized Scan Blocked)</p>
                <p className="text-slate-500 text-[10px]">eBPF Program: bpf_telemetry_guard.o | Action: XDP_DROP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts & Compliance */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Security Alerts
              </h2>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full font-mono">
                {secAlerts.length} Events
              </span>
            </div>

            <div className="space-y-3">
              {secAlerts.map(alt => (
                <div 
                  key={alt.id}
                  onClick={() => { setSelectedAlert(alt); setShowModal(true); }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                    alt.type === 'CRITICAL' ? 'bg-rose-950/40 border-rose-800/80' :
                    alt.type === 'WARNING' ? 'bg-amber-950/40 border-amber-800/80' :
                    'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span className="font-mono">{alt.time}</span>
                    <span className={`font-bold ${alt.type === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`}>{alt.type}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">{alt.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{alt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Regulatory Standards Compliance Badge */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Cybersecurity Standards
            </h3>
            <div className="text-[11px] text-slate-400 space-y-1">
              <p className="flex justify-between"><span>NIST SP 800-207:</span> <span className="text-emerald-400 font-semibold">Verified</span></p>
              <p className="flex justify-between"><span>FDA 21 CFR Part 11:</span> <span className="text-emerald-400 font-semibold">Encrypted</span></p>
              <p className="flex justify-between"><span>Post-Quantum Crypto:</span> <span className="text-emerald-400 font-semibold">Kyber-1024</span></p>
            </div>
          </div>
        </div>

      </div>

      {/* Modal Inspector */}
      {showModal && selectedAlert && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 rounded-md">
                  {selectedAlert.type} SECURITY EVENT
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-2">{selectedAlert.title}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 font-mono text-xl">×</button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{selectedAlert.desc}</p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <p><strong className="text-slate-200">Security Framework:</strong> {selectedAlert.standard}</p>
              <p><strong className="text-slate-200">SOC Enforcement:</strong> eBPF kernel rule dynamically injected. Source IP isolated into VLAN-QUARANTINE.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold">Dismiss</button>
              <button onClick={() => { alert('Zero-Trust Device Quarantine Applied'); setShowModal(false); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/40">Isolate Node</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeroTrustBiomedicalSecurityHub;
