import React, { useState, useEffect, useMemo } from 'react';
import {
  Dna,
  Activity,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Microscope,
  Zap,
  TrendingUp,
  Award,
  Layers,
  ChevronRight,
  Database,
  Share2,
  RefreshCw,
  Cpu,
  Flame,
  Stethoscope,
  Radio,
  Eye,
  Sliders,
  Send,
  Download,
  AlertCircle
} from 'lucide-react';

const PATIENTS_MOCK = [
  {
    id: "PAT-ONC-8821",
    name: "Eleanor Vance",
    age: 58,
    gender: "Female",
    mrn: "MRN-8492048",
    diagnosis: "Stage IV Non-Small Cell Lung Carcinoma (Adenocarcinoma)",
    tissueSource: "Left Upper Lobe Core Needle Biopsy (FFPE)",
    tmbScore: 16.4,
    msiStatus: "MSI-High",
    hrdScore: 54.2,
    pdl1Tps: 85,
    ctDnaVaf: 14.8,
    organismStatus: "Active Therapy - Line 2",
    vitalTelemetry: { hr: 82, bp: "128/78", spo2: 97, temp: 37.1, ecog: 1 },
    alterations: [
      {
        gene: "EGFR",
        variant: "Exon 19 Deletion (p.E746_A750del)",
        vaf: "38.4%",
        tier: "Tier I - Strong Clinical Significance",
        therapy: "Osimertinib 80mg PO QD",
        fdaApproval: "FDA Approved (NCCN Category 1)",
        resistance: "T790M / C797S Negative",
        readDepth: "1,420x"
      },
      {
        gene: "TP53",
        variant: "Missense mutation (p.R273H)",
        vaf: "42.1%",
        tier: "Tier II - Potential Significance",
        therapy: "Investigational WEE1 / ATR Inhibitors",
        fdaApproval: "Off-label / Trial Matching",
        resistance: "Impaired Apoptosis",
        readDepth: "1,180x"
      },
      {
        gene: "MET",
        variant: "Exon 14 Skipping Amplification (CN: 6.2)",
        vaf: "18.2%",
        tier: "Tier I - Strong Clinical Significance",
        therapy: "Capmatinib / Tepotinib",
        fdaApproval: "FDA Approved (NCCN Cat 1)",
        resistance: "Potential bypass resistance",
        readDepth: "980x"
      }
    ],
    pharmacogenomics: [
      { gene: "DPYD", genotype: "*1/*1 (Normal Metabolizer)", risk: "Standard Fluoropyrimidine Dosing", status: "SAFE" },
      { gene: "CYP2D6", genotype: "*4/*4 (Poor Metabolizer)", risk: "Impaired Tamoxifen/Codeine Bioactivation", status: "WARNING" },
      { gene: "UGT1A1", genotype: "*1/*28 (Intermediate)", risk: "Moderate Irinotecan Toxicity Risk", status: "CAUTION" }
    ],
    trials: [
      { id: "NCT05048797", title: "Trastuzumab Deruxtecan in HER2/EGFR Mutant Thoracic Malignancies", phase: "Phase 2", matchScore: "98%" },
      { id: "NCT04611113", title: "Dual Target MET + EGFR Tyrosine Kinase Blockade", phase: "Phase 3", matchScore: "94%" }
    ]
  },
  {
    id: "PAT-ONC-9104",
    name: "Marcus Sterling",
    age: 64,
    gender: "Male",
    mrn: "MRN-3910241",
    diagnosis: "Metastatic Colorectal Adenocarcinoma (MSS, BRAF Mutant)",
    tissueSource: "Hepatic Metastasis Resection",
    tmbScore: 6.2,
    msiStatus: "MSS (Stable)",
    hrdScore: 22.0,
    pdl1Tps: 5,
    ctDnaVaf: 28.5,
    organismStatus: "Relapsed refractory",
    vitalTelemetry: { hr: 94, bp: "110/68", spo2: 95, temp: 37.8, ecog: 2 },
    alterations: [
      {
        gene: "BRAF",
        variant: "p.V600E (c.1799T>A)",
        vaf: "46.2%",
        tier: "Tier I - Strong Clinical Significance",
        therapy: "Encorafenib + Cetuximab",
        fdaApproval: "FDA Approved (BEACON Regimen)",
        resistance: "MAPK pathway reactivation",
        readDepth: "2,240x"
      },
      {
        gene: "KRAS",
        variant: "Wild-Type (Exons 2, 3, 4)",
        vaf: "0.0%",
        tier: "Predictive Biomarker",
        therapy: "Permits Anti-EGFR Monoclonal Antibody",
        fdaApproval: "NCCN Guideline Standard",
        resistance: "None",
        readDepth: "3,100x"
      },
      {
        gene: "PIK3CA",
        variant: "p.E545K (Exon 9)",
        vaf: "14.5%",
        tier: "Tier II - Actionable Biomarker",
        therapy: "Alpelisib (Clinical Study Setting)",
        fdaApproval: "Off-label exploration",
        resistance: "PI3K/AKT/mTOR activation",
        readDepth: "1,520x"
      }
    ],
    pharmacogenomics: [
      { gene: "DPYD", genotype: "*2A/*1 (Intermediate Metabolizer)", risk: "HIGH: MANDATORY 50% 5-FU/Capecitabine reduction", status: "DANGER" },
      { gene: "UGT1A1", genotype: "*28/*28 (Poor Metabolizer)", risk: "SEVERE: Irinotecan-induced Grade 4 Diarrhea", status: "DANGER" }
    ],
    trials: [
      { id: "NCT03693170", title: "Encorafenib + Cetuximab + Binimetinib Triplet in BRAF V600E mCRC", phase: "Phase 3", matchScore: "99%" }
    ]
  },
  {
    id: "PAT-ONC-7749",
    name: "Dr. Anya Kowalski",
    age: 49,
    gender: "Female",
    mrn: "MRN-6729104",
    diagnosis: "Triple-Negative High-Grade Serous Ovarian Carcinoma",
    tissueSource: "Peritoneal Omental Biopsy",
    tmbScore: 22.8,
    msiStatus: "MSI-High",
    hrdScore: 68.4,
    pdl1Tps: 90,
    ctDnaVaf: 8.2,
    organismStatus: "Neoadjuvant Protocol",
    vitalTelemetry: { hr: 76, bp: "122/74", spo2: 99, temp: 36.8, ecog: 0 },
    alterations: [
      {
        gene: "BRCA1",
        variant: "Deleterious Frameshift (p.C61G / c.181T>G)",
        vaf: "52.0%",
        tier: "Tier I - Germline Pathogenic & Somatic LOH",
        therapy: "Olaparib / Niraparib Maintenance",
        fdaApproval: "FDA Approved (SOLO-1 / PAOLA-1)",
        resistance: "Secondary reversion mutations monitored",
        readDepth: "2,890x"
      },
      {
        gene: "NTRK1",
        variant: "TPM3-NTRK1 Gene Fusion",
        vaf: "31.4%",
        tier: "Tier I - Strong Clinical Significance",
        therapy: "Larotrectinib / Entrectinib",
        fdaApproval: "FDA Agnostic Approval",
        resistance: "NTRK kinase solvent front mutations",
        readDepth: "1,980x"
      }
    ],
    pharmacogenomics: [
      { gene: "DPYD", genotype: "*1/*1 (Normal)", risk: "Standard Fluoropyrimidine Tolerability", status: "SAFE" },
      { gene: "TPMT", genotype: "*1/*1 (Normal)", risk: "Standard Thiopurine clearance", status: "SAFE" }
    ],
    trials: [
      { id: "NCT04837209", title: "Dual PARP + ATR Inhibitor in BRCA-Mutated Solid Tumors", phase: "Phase 1b/2", matchScore: "97%" }
    ]
  }
];

export default function PrecisionOncologyMolecularHub() {
  const [selectedPatientId, setSelectedPatientId] = useState(PATIENTS_MOCK[0].id);
  const [activeTab, setActiveTab] = useState('genomics'); // genomics, mtb, pgx, trials, emergency
  const [telemetryTick, setTelemetryTick] = useState(0);
  const [isSimulatingNgs, setIsSimulatingNgs] = useState(false);
  const [selectedAlteration, setSelectedAlteration] = useState(null);
  const [filterGene, setFilterGene] = useState('');
  const [emergencyAlertActive, setEmergencyAlertActive] = useState(false);
  const [auditLog, setAuditLog] = useState([
    { time: "18:40:12", user: "Dr. H. Chen (Chief Oncologist)", action: "Signed off Molecular Tumor Board Recommendation" },
    { time: "18:25:05", user: "Bioinformatics Pipeline v4.8", action: "Illumina NovaSeq 6000 VCF / BAM alignment synchronized" }
  ]);

  const patient = useMemo(() => {
    return PATIENTS_MOCK.find(p => p.id === selectedPatientId) || PATIENTS_MOCK[0];
  }, [selectedPatientId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick(t => t + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const triggerNgsReanalysis = () => {
    setIsSimulatingNgs(true);
    setTimeout(() => {
      setIsSimulatingNgs(false);
      setAuditLog(prev => [
        { time: new Date().toLocaleTimeString(), user: "System", action: `NGS Variant Caller re-annotated for ${patient.id} against ClinVar & COSMIC 2026` },
        ...prev
      ]);
    }, 1800);
  };

  const filteredAlterations = patient.alterations.filter(a =>
    a.gene.toLowerCase().includes(filterGene.toLowerCase()) ||
    a.variant.toLowerCase().includes(filterGene.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
            <Dna className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-400">
                Precision Oncology & Molecular Tumor Board Hub
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80 uppercase">
                21 CFR Part 11 / NCCN 2026
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Next-Generation Genomic Variant Sequencing, Biomarker Stratification & Actionable Targeted Decision Support
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setEmergencyAlertActive(!emergencyAlertActive)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
              emergencyAlertActive
                ? 'bg-rose-600 text-white animate-bounce shadow-rose-900/60'
                : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{emergencyAlertActive ? "TOXICITY OVERWATCH ACTIVE" : "EMERGENCY PROTOCOL"}</span>
          </button>

          <button
            onClick={triggerNgsReanalysis}
            disabled={isSimulatingNgs}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/60 text-indigo-300 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-4 h-4 ${isSimulatingNgs ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isSimulatingNgs ? "Re-aligning BAM..." : "Re-run NGS Pipeline"}</span>
          </button>
        </div>
      </div>

      {/* Emergency Toxicity Protocol Alert Modal / Banner */}
      {emergencyAlertActive && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-red-900/80 to-slate-900 border border-rose-500 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center space-x-3">
            <Flame className="w-7 h-7 text-rose-400 animate-pulse flex-shrink-0" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-rose-200 tracking-wider">CODE ONCOLOGY TOXICITY / IMMUNE-RELATED ADVERSE EVENT (irAE)</span>
                <span className="px-2 py-0.5 text-xs bg-rose-600 text-white font-bold rounded">GRADE 3/4 TRIGGER</span>
              </div>
              <p className="text-xs text-rose-300 mt-1">
                Active Protocol: Cytokine Release Syndrome (CRS) / Immune Effector Cell Neurotoxicity (ICANS) / Febrile Neutropenia.
                Initiate IV Methylprednisolone 2mg/kg QD, Tocilizumab 8mg/kg IV, and Infectious Disease Broad-Spectrum Coverage.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <button
              onClick={() => {
                alert("Order Placed: STAT Tocilizumab 8mg/kg + Solu-Medrol 125mg IV administered.");
                setEmergencyAlertActive(false);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-rose-950"
            >
              Order STAT Rescue Meds
            </button>
            <button
              onClick={() => setEmergencyAlertActive(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Patient Selection & Core Telemetry Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-6">
        {/* Patient Selection Box */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <label className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between mb-2">
            <span>Select Active Patient Profile</span>
            <Database className="w-3.5 h-3.5 text-cyan-400" />
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
          >
            {PATIENTS_MOCK.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id}) — {p.gender}, {p.age}y
              </option>
            ))}
          </select>
          <div className="mt-3 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>MRN:</span> <span className="font-mono text-slate-200">{patient.mrn}</span>
            </div>
            <div className="flex justify-between">
              <span>Primary Diagnosis:</span> <span className="text-slate-200 font-medium truncate max-w-[180px]">{patient.diagnosis}</span>
            </div>
            <div className="flex justify-between">
              <span>Specimen:</span> <span className="text-slate-300">{patient.tissueSource}</span>
            </div>
          </div>
        </div>

        {/* Genomic Biomarkers Snapshot */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Tumor Mutational Burden (TMB)</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-cyan-300">{patient.tmbScore} <span className="text-xs font-normal text-slate-400">mut/Mb</span></div>
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded ${patient.tmbScore >= 10 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-300'}`}>
              {patient.tmbScore >= 10 ? "TMB-High (FDA Agnostic Response >=10)" : "TMB-Low / Intermediate"}
            </span>
          </div>
          <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
            <span>MSI Status:</span>
            <span className="font-bold text-amber-300">{patient.msiStatus}</span>
          </div>
        </div>

        {/* HRD & PD-L1 Status */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">HRD & PD-L1 Expression</span>
            <Microscope className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xl font-bold text-indigo-300">{patient.hrdScore}</div>
              <span className="text-xs text-slate-400">HRD Scar Score</span>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-300">{patient.pdl1Tps}%</div>
              <span className="text-xs text-slate-400">PD-L1 TPS</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
            <span>ctDNA Liquid Biopsy VAF:</span>
            <span className="font-mono text-cyan-300 font-bold">{patient.ctDnaVaf}%</span>
          </div>
        </div>

        {/* Vital Telemetry stream */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Real-Time Bedside Telemetry</span>
            </span>
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="grid grid-cols-3 gap-2 my-2 text-center">
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-xs text-slate-400">HR</span>
              <div className="text-lg font-bold text-emerald-300">{patient.vitalTelemetry.hr + (telemetryTick % 3) - 1} <span className="text-xs font-normal">bpm</span></div>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-xs text-slate-400">BP</span>
              <div className="text-sm font-bold text-slate-200">{patient.vitalTelemetry.bp}</div>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-xs text-slate-400">SpO2</span>
              <div className="text-lg font-bold text-cyan-300">{patient.vitalTelemetry.spo2}%</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
            <span>ECOG Performance:</span>
            <span className="font-bold text-emerald-400">Score {patient.vitalTelemetry.ecog}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 mt-6 pb-2 overflow-x-auto">
        {[
          { id: 'genomics', label: 'Actionable Genomic Alterations', icon: Dna, count: patient.alterations.length },
          { id: 'mtb', label: 'Molecular Tumor Board (MTB) Deliberation', icon: Stethoscope },
          { id: 'pgx', label: 'Pharmacogenomics (PGx) Safety', icon: ShieldAlert, count: patient.pharmacogenomics.length },
          { id: 'trials', label: 'Biomarker-Matched Clinical Trials', icon: Award, count: patient.trials.length },
          { id: 'fhir', label: 'HL7 FHIR R4 & Audit Ledger', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-600 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-xs ${activeTab === tab.id ? 'bg-cyan-800 text-cyan-100' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="mt-6">
        {activeTab === 'genomics' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by Gene (EGFR, BRAF, BRCA1...)"
                  value={filterGene}
                  onChange={(e) => setFilterGene(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 pl-9 pr-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Filter className="w-4 h-4 text-cyan-400" />
                <span>Tier Classification Standard: <strong>AMP / ASCO / CAP 2026</strong></span>
              </div>
            </div>

            {/* Alterations Grid / Table */}
            <div className="grid grid-cols-1 gap-4">
              {filteredAlterations.map((alt, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedAlteration(alt)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 ${
                    selectedAlteration?.gene === alt.gene
                      ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-cyan-400 font-mono font-bold text-base">
                        {alt.gene}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100">{alt.variant}</span>
                          <span className="px-2 py-0.5 text-xs bg-slate-800 text-cyan-300 font-mono rounded">
                            VAF: {alt.vaf}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 rounded">
                            Depth: {alt.readDepth}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{alt.tier}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{alt.fdaApproval}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Targeted Therapeutic Option:</span>{' '}
                      <span className="text-cyan-300 font-semibold">{alt.therapy}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Known Resistance Pathways:</span>{' '}
                      <span className="text-rose-300">{alt.resistance}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Inspector Modal / Section */}
            {selectedAlteration && (
              <div className="bg-slate-900 border border-cyan-500/60 p-5 rounded-xl shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Microscope className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold text-base text-cyan-300">
                      Molecular Variant Deep Inspector: {selectedAlteration.gene} ({selectedAlteration.variant})
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedAlteration(null)}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 bg-slate-800 rounded"
                  >
                    Close Inspector
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-semibold uppercase">Bioinformatics QC</span>
                    <ul className="mt-2 space-y-1 text-slate-300 font-mono">
                      <li>Sequencing Platform: Illumina NovaSeq 6000</li>
                      <li>Mean Base Quality (Q30): 99.4%</li>
                      <li>Strand Bias Fisher P-val: 0.0012</li>
                      <li>Allele Depth: {selectedAlteration.readDepth}</li>
                    </ul>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-semibold uppercase">Therapeutic Regimens</span>
                    <p className="mt-2 text-cyan-200 font-medium leading-relaxed">
                      First-line recommendation: {selectedAlteration.therapy}.
                      Cross-referenced against ESMO Scale for Clinical Actionability of molecular Targets (ESCAT: Tier I-A).
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-semibold uppercase">Resistance Surveillance</span>
                    <p className="mt-2 text-amber-200">
                      Liquid biopsy ctDNA surveillance suggested every 6-8 weeks to capture emerging resistance: {selectedAlteration.resistance}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mtb' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                  <Stethoscope className="w-5 h-5 text-indigo-400" />
                  <span>Multidisciplinary Molecular Tumor Board (MTB) Deliberation</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Consensus recommendation engine integrating Pathology, Medical Oncology, Clinical Genomics, and Pharmacokinetics.
                </p>
              </div>
              <button
                onClick={() => alert("Consensus Protocol Exported to EHR & Clinician Mobile Portal.")}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition"
              >
                <Share2 className="w-4 h-4" />
                <span>Export MTB Consensus</span>
              </button>
            </div>

            {/* Deliberation Synthesizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Computational Decision Matrix (NCCN Category 1)</span>
                </h4>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>Primary Target:</strong> Patient exhibits actionable biomarker profile ({patient.alterations.map(a => a.gene).join(', ')}).
                  </p>
                  <p>
                    <strong>Immunotherapy Stratification:</strong> TMB score of {patient.tmbScore} mut/Mb indicates high likelihood of neoantigen presentation.
                    {patient.tmbScore >= 10 ? ' Combined with PD-L1 expression, immune checkpoint blockade is strongly indicated.' : ' Monotherapy immune checkpoint inhibition may exhibit diminished overall response.'}
                  </p>
                  <p>
                    <strong>DNA Damage Repair:</strong> HRD Score {patient.hrdScore} exceeds homologous recombination deficiency threshold (Score &gt;= 42), qualifying for synthetic lethality PARP inhibition.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proposed Multidisciplinary Plan</span>
                </h4>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>Initiate targeted precision agent: <span className="text-cyan-300 font-semibold">{patient.alterations[0]?.therapy}</span>.</li>
                  <li>Schedule baseline brain MRI and thoracic CT with IV contrast in 8 weeks.</li>
                  <li>Perform Serial Liquid Biopsy ctDNA sampling at Cycle 2 Day 1 to evaluate molecular response kinetic.</li>
                  <li>Review Pharmacogenomic alerts prior to initiating any fluoropyrimidine or irinotecan cytotoxic backbones.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pgx' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>Pharmacogenomic (PGx) Safety & Dosing Calculator</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  CPIC & DPWG guideline-adherent metabolic phenotypes to prevent life-threatening chemotherapy toxicities.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {patient.pharmacogenomics.map((pg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    pg.status === 'DANGER'
                      ? 'bg-rose-950/40 border-rose-600'
                      : pg.status === 'WARNING'
                      ? 'bg-amber-950/40 border-amber-600'
                      : pg.status === 'CAUTION'
                      ? 'bg-yellow-950/30 border-yellow-700'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-cyan-300">{pg.gene}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded ${
                        pg.status === 'DANGER'
                          ? 'bg-rose-600 text-white'
                          : pg.status === 'WARNING'
                          ? 'bg-amber-600 text-white'
                          : pg.status === 'CAUTION'
                          ? 'bg-yellow-600 text-slate-950'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {pg.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-mono text-slate-300">{pg.genotype}</div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{pg.risk}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'trials' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <span>Precision Genomic Clinical Trial Matching Engine</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically matches patient genomic variants, TMB, and MSI biomarkers against ClinicalTrials.gov NCT registries.
              </p>
            </div>

            <div className="space-y-3">
              {patient.trials.map((trial, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                        {trial.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{trial.phase}</span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Biomarker Match: {trial.matchScore}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 mt-1.5">{trial.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Inclusion Criteria: Stage IV solid tumors harboring {patient.alterations.map(a => a.gene).join(' or ')} alteration with prior progression.
                    </p>
                  </div>
                  <button
                    onClick={() => alert(`Pre-screening dossier generated for ${trial.id}`)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition"
                  >
                    Generate Pre-Screening Packet
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fhir' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>HL7 FHIR R4 DiagnosticReport & Audit Ledger (21 CFR Part 11)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Standardized interoperability resource payload for electronic health record (EHR) ingestion and tamper-evident audit logging.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <span>FHIR R4 MolecularSequence JSON Payload</span>
                  <Download className="w-4 h-4 text-cyan-400 cursor-pointer" onClick={() => alert("FHIR JSON Exported.")} />
                </div>
                <pre className="mt-3 p-3 bg-slate-900 rounded-lg text-slate-300 text-xs font-mono overflow-x-auto max-h-64">
{JSON.stringify({
  resourceType: "DiagnosticReport",
  id: `dr-onc-${patient.id.toLowerCase()}`,
  status: "final",
  category: [{
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/v2-0074",
      code: "GE",
      display: "Genetics"
    }]
  }],
  code: {
    coding: [{
      system: "http://loinc.org",
      code: "69548-6",
      display: "Genetic variant assessment"
    }]
  },
  subject: {
    reference: `Patient/${patient.id}`,
    display: patient.name
  },
  effectiveDateTime: new Date().toISOString(),
  conclusion: `Actionable biomarkers: ${patient.alterations.map(a => `${a.gene} ${a.variant}`).join(', ')}. TMB: ${patient.tmbScore} mut/Mb. MSI: ${patient.msiStatus}.`
}, null, 2)}
                </pre>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="pb-2 border-b border-slate-800 text-xs font-bold text-slate-300">
                    Cryptographic Audit Trail (21 CFR Part 11)
                  </div>
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {auditLog.map((log, i) => (
                      <div key={i} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-mono text-cyan-400">{log.time}</span>
                          <span className="text-slate-300 font-semibold">{log.user}</span>
                        </div>
                        <p className="text-slate-200 mt-1">{log.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      const signer = prompt("Enter Digital Signature Credentials (MD License / ID):", "DR-CHEN-88912");
                      if (signer) {
                        setAuditLog(prev => [
                          { time: new Date().toLocaleTimeString(), user: signer, action: "Digital Signature Affixed (21 CFR Part 11 Compliant SHA-256)" },
                          ...prev
                        ]);
                        alert("Report Signed and Sealed Cryptographically.");
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold tracking-wider uppercase transition shadow-lg"
                  >
                    Affix Attending Digital Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
