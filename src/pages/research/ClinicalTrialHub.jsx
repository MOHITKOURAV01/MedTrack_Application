import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Beaker, BookOpen,
  CheckCircle2, ChevronRight, ClipboardList, Clock, Cpu, Dna, Download,
  FileText, Filter, FlaskConical, Gauge, HeartPulse, Info, Layers, Lock, Microscope,
  Pause, Play, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles,
  Stethoscope, TestTube, Timer, TrendingDown, TrendingUp, User, Users, X, Zap
} from "lucide-react";
import { clamp, round1, fmtNumber, seededSeries as series } from "../../utils/series";
import PlaybackControls from "../../components/common/PlaybackControls";
import { ExportButton } from "../../components/common/ExportButton";
import LiveStatus from "../../components/common/LiveStatus";
import ToastStack, { useToasts } from "../../components/common/ToastStack";
import { downloadCsv } from "../../utils/csv";
import { ProgressBar } from "../../components/common/ProgressBar";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Clinical Trial & Genomic Research Hub
 *  ------------------------------------------------------------------
 *  Three consoles for translational research operations:
 *    1. Biomarker Explorer    - gene/protein biomarker catalogue with
 *                               expression, significance, direction and
 *                               clinical relevance, plus distribution
 *                               charts per assay.
 *    2. Patient Cohort Sandbox - build a trial cohort by toggling
 *                               inclusion criteria (stage, ECOG, genotype,
 *                               PD-L1 cutoff) and watch the match count
 *                               recompute live.
 *    3. Trial Portfolio       - active protocols with arms, enrollment
 *                               progress, sites and milestone tracking.
 *
 *  Enrollment and expression data simulate on a tick loop; the cohort
 *  matcher is a pure function of the criteria so it recomputes instantly.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const RELEVANCE_META = {
  approved: { label: "Approved companion", tone: "emerald", note: "FDA-approved companion diagnostic" },
  prognostic: { label: "Prognostic", tone: "sky", note: "Validated outcome correlation" },
  exploratory: { label: "Exploratory", tone: "amber", note: "Hypothesis-generating, research use only" },
};

// Relevance badges use emerald/sky/amber tones (see RELEVANCE_META.tone), which are not keys of
// SEVERITY_META (critical/high/medium/low). Indexing SEVERITY_META with one of them returned
// undefined and crashed the biomarker cards with "Cannot read properties of undefined (reading
// 'border')" the moment the hub rendered.
const RELEVANCE_CLS = {
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  sky: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
};

const ASSAY_META = {
  "RNA-seq": { icon: Dna, cls: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  Proteomics: { icon: Beaker, cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  Methylation: { icon: FlaskConical, cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  "ctDNA": { icon: TestTube, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};

const TABS = [
  { key: "biomarkers", label: "Biomarker Explorer", icon: Dna, blurb: "Expression, significance & clinical relevance across assays" },
  { key: "cohort", label: "Patient Cohort Sandbox", icon: Users, blurb: "Toggle inclusion criteria and watch the match set recompute" },
  { key: "trials", label: "Trial Portfolio", icon: ClipboardList, blurb: "Protocols, arms, enrollment progress & milestones" },
];

const BIOMARKERS = [
  { id: "BMK-0001", gene: "PD-L1", name: "Programmed death-ligand 1", assay: "Proteomics", expression: 64, foldChange: 2.8, pValue: 0.0004, qValue: 0.0012, direction: "up", relevance: "approved", trials: ["NCT-4410", "NCT-4403"], cohortN: 218 },
  { id: "BMK-0002", gene: "EGFR", name: "Epidermal growth factor receptor", assay: "ctDNA", expression: 71, foldChange: 3.4, pValue: 0.0001, qValue: 0.0004, direction: "up", relevance: "approved", trials: ["NCT-4401", "NCT-4410"], cohortN: 184 },
  { id: "BMK-0003", gene: "Ki-67", name: "Proliferation marker Ki-67", assay: "Proteomics", expression: 42, foldChange: 1.9, pValue: 0.0031, qValue: 0.0058, direction: "up", relevance: "prognostic", trials: ["NCT-4402"], cohortN: 311 },
  { id: "BMK-0004", gene: "TP53", name: "Tumor protein p53", assay: "RNA-seq", expression: 33, foldChange: 0.6, pValue: 0.0017, qValue: 0.0039, direction: "down", relevance: "prognostic", trials: ["NCT-4406", "NCT-4402"], cohortN: 267 },
  { id: "BMK-0005", gene: "ctDNA-MAF", name: "Circulating tumor DNA allele fraction", assay: "ctDNA", expression: 12, foldChange: 4.7, pValue: 0.0009, qValue: 0.0022, direction: "up", relevance: "prognostic", trials: ["NCT-4407"], cohortN: 156 },
  { id: "BMK-0006", gene: "MSI", name: "Microsatellite instability score", assay: "Methylation", expression: 8, foldChange: 2.2, pValue: 0.012, qValue: 0.021, direction: "up", relevance: "approved", trials: ["NCT-4405"], cohortN: 98 },
  { id: "BMK-0007", gene: "TMB", name: "Tumor mutational burden", assay: "RNA-seq", expression: 22, foldChange: 1.5, pValue: 0.024, qValue: 0.038, direction: "up", relevance: "exploratory", trials: ["NCT-4409"], cohortN: 143 },
  { id: "BMK-0008", gene: "BRCA1", name: "Breast cancer gene 1", assay: "Methylation", expression: 29, foldChange: 0.4, pValue: 0.006, qValue: 0.011, direction: "down", relevance: "prognostic", trials: ["NCT-4408"], cohortN: 121 },
  { id: "BMK-0009", gene: "HER2", name: "Human epidermal growth factor receptor 2", assay: "Proteomics", expression: 58, foldChange: 3.1, pValue: 0.0003, qValue: 0.0010, direction: "up", relevance: "approved", trials: ["NCT-4404", "NCT-4403"], cohortN: 202 },
  { id: "BMK-0010", gene: "ALK", name: "Anaplastic lymphoma kinase fusion", assay: "ctDNA", expression: 17, foldChange: 2.5, pValue: 0.008, qValue: 0.014, direction: "up", relevance: "approved", trials: ["NCT-4401"], cohortN: 88 },
  { id: "BMK-0011", gene: "MGMT", name: "O6-methylguanine-DNA methyltransferase", assay: "Methylation", expression: 36, foldChange: 0.7, pValue: 0.031, qValue: 0.047, direction: "down", relevance: "exploratory", trials: ["NCT-4406"], cohortN: 74 },
  { id: "BMK-0012", gene: "VEGF", name: "Vascular endothelial growth factor", assay: "Proteomics", expression: 49, foldChange: 1.8, pValue: 0.019, qValue: 0.030, direction: "up", relevance: "exploratory", trials: ["NCT-4408"], cohortN: 167 },
];

const PATIENT_POOL = [
  { id: "PTR-4401", age: 64, sex: "F", stage: "IV", ecog: 1, genotype: "EGFR+", pdl1: 72, ki67: 58, priorLines: 1, arm: "Arm A · EGFR TKI" },
  { id: "PTR-4402", age: 71, sex: "M", stage: "III", ecog: 2, genotype: "KRAS", pdl1: 41, ki67: 33, priorLines: 2, arm: "Arm B · Chemo + IO" },
  { id: "PTR-4403", age: 58, sex: "F", stage: "IV", ecog: 1, genotype: "HER2+", pdl1: 55, ki67: 74, priorLines: 0, arm: "Arm A · Dual HER2 block" },
  { id: "PTR-4404", age: 66, sex: "M", stage: "II", ecog: 0, genotype: "BRAF", pdl1: 28, ki67: 21, priorLines: 0, arm: "Screening" },
  { id: "PTR-4405", age: 49, sex: "F", stage: "III", ecog: 1, genotype: "ALK+", pdl1: 63, ki67: 47, priorLines: 1, arm: "Arm C · ALK inhibitor" },
  { id: "PTR-4406", age: 74, sex: "M", stage: "IV", ecog: 3, genotype: "None", pdl1: 12, ki67: 19, priorLines: 3, arm: "Excluded · ECOG" },
  { id: "PTR-4407", age: 61, sex: "F", stage: "III", ecog: 1, genotype: "EGFR+", pdl1: 88, ki67: 69, priorLines: 1, arm: "Arm A · EGFR TKI" },
  { id: "PTR-4408", age: 53, sex: "M", stage: "IV", ecog: 0, genotype: "None", pdl1: 91, ki67: 62, priorLines: 0, arm: "Arm B · IO monotherapy" },
  { id: "PTR-4409", age: 69, sex: "F", stage: "II", ecog: 1, genotype: "KRAS", pdl1: 35, ki67: 27, priorLines: 1, arm: "Screening" },
  { id: "PTR-4410", age: 44, sex: "M", stage: "IV", ecog: 2, genotype: "BRAF", pdl1: 22, ki67: 15, priorLines: 2, arm: "Arm C · BRAF combo" },
  { id: "PTR-4411", age: 67, sex: "F", stage: "III", ecog: 0, genotype: "HER2+", pdl1: 46, ki67: 81, priorLines: 0, arm: "Arm A · Dual HER2 block" },
  { id: "PTR-4412", age: 59, sex: "M", stage: "IV", ecog: 1, genotype: "None", pdl1: 17, ki67: 24, priorLines: 2, arm: "Excluded · PD-L1 low" },
  { id: "PTR-4413", age: 72, sex: "F", stage: "IV", ecog: 1, genotype: "EGFR+", pdl1: 68, ki67: 52, priorLines: 1, arm: "Arm A · EGFR TKI" },
  { id: "PTR-4414", age: 38, sex: "M", stage: "III", ecog: 0, genotype: "ALK+", pdl1: 51, ki67: 44, priorLines: 0, arm: "Arm C · ALK inhibitor" },
  { id: "PTR-4415", age: 76, sex: "F", stage: "IV", ecog: 2, genotype: "None", pdl1: 39, ki67: 31, priorLines: 1, arm: "Screening" },
  { id: "PTR-4416", age: 55, sex: "M", stage: "II", ecog: 1, genotype: "KRAS", pdl1: 26, ki67: 22, priorLines: 0, arm: "Screening" },
];

const TRIALS = [
  { id: "NCT-4401", title: "FLAURA2-adj: EGFR TKI vs chemo in resected EGFR+ NSCLC", phase: "III", status: "Recruiting", sponsor: "AstraZeneca", sites: 14, target: 240, enrolled: 168, arms: 2, endpoint: "DFS", biomarkers: ["EGFR", "ctDNA-MAF"], milestone: "Milestone 2 of 5 · interim readout Q4" },
  { id: "NCT-4402", title: "BRIGHT-IO: PD-L1 high-dose IO in TMB-high tumors", phase: "II", status: "Recruiting", sponsor: "MedTrack R&D", sites: 9, target: 120, enrolled: 74, arms: 2, endpoint: "ORR", biomarkers: ["TMB", "PD-L1", "Ki-67"], milestone: "Milestone 1 of 4 · cohort A open" },
  { id: "NCT-4403", title: "HERMIONE: dual HER2 blockade in HER2+ gastric cancer", phase: "II", status: "Active, not recruiting", sponsor: "Roche", sites: 11, target: 90, enrolled: 90, arms: 2, endpoint: "PFS", biomarkers: ["HER2", "PD-L1"], milestone: "Enrollment complete · follow-up phase" },
  { id: "NCT-4404", title: "ADJUVANT-HER2: post-op T-DM1 in HER2+ breast", phase: "III", status: "Recruiting", sponsor: "MedTrack R&D", sites: 18, target: 320, enrolled: 211, arms: 2, endpoint: "iDFS", biomarkers: ["HER2"], milestone: "Milestone 3 of 6 · site activation wave 4" },
  { id: "NCT-4405", title: "MMR-STOP: pembrolizumab in MSI-H colorectal", phase: "II", status: "Recruiting", sponsor: "Merck", sites: 7, target: 60, enrolled: 41, arms: 1, endpoint: "pCR", biomarkers: ["MSI"], milestone: "Milestone 2 of 3 · biomarker substudy open" },
  { id: "NCT-4406", title: "GLIOMA-Epi: MGMT methylation-guided temozolomide", phase: "III", status: "On hold", sponsor: "MedTrack R&D", sites: 6, target: 150, enrolled: 88, arms: 2, endpoint: "OS", biomarkers: ["MGMT", "TP53"], milestone: "Hold — DSMB safety review pending" },
  { id: "NCT-4407", title: "CLEAR-MAF: ctDNA-guided de-escalation in lung cancer", phase: "II", status: "Recruiting", sponsor: "Guardant", sites: 10, target: 140, enrolled: 96, arms: 2, endpoint: "MRD-negativity", biomarkers: ["ctDNA-MAF"], milestone: "Milestone 2 of 4 · adaptive arm 2 opening" },
  { id: "NCT-4408", title: "PARP-SELECT: olaparib in BRCA1/2 ovarian maintenance", phase: "III", status: "Recruiting", sponsor: "AstraZeneca", sites: 15, target: 400, enrolled: 322, arms: 2, endpoint: "PFS", biomarkers: ["BRCA1", "VEGF"], milestone: "Milestone 4 of 6 · final analysis locked" },
  { id: "NCT-4409", title: "TMB-ASSIST: TMB as companion biomarker for IO sequencing", phase: "I", status: "Recruiting", sponsor: "MedTrack R&D", sites: 4, target: 45, enrolled: 27, arms: 1, endpoint: "Safety + ORR", biomarkers: ["TMB"], milestone: "Milestone 1 of 3 · dose escalation ongoing" },
  { id: "NCT-4410", title: "LUNG-Biomark: umbrella screen for EGFR/PD-L1 enriched arms", phase: "II", status: "Recruiting", sponsor: "MedTrack R&D", sites: 12, target: 200, enrolled: 133, arms: 3, endpoint: "ORR", biomarkers: ["EGFR", "PD-L1"], milestone: "Milestone 2 of 4 · arm B opened" },
];

const SEED_POINTS = 22;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 50, amp = 12, lo = 0, hi = 100) =>
  series(seed, n, base, amp, { lo, hi, seedMult: 7919, pull: 0.08 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);


const fmtP = (v) => v.toExponential(2).replace("e", " × 10^");

const enrollmentPct = (t) => Math.round((t.enrolled / t.target) * 100);

/* Cohort matcher: pure function of criteria so the sandbox recomputes instantly. */
const matchCohort = (patients, criteria) => patients.filter((p) => {
  const { ageMin, ageMax, stages, ecogMax, genotypes, pdl1Min, priorLinesMax } = criteria;
  if (p.age < ageMin || p.age > ageMax) return false;
  if (stages.length > 0 && !stages.includes(p.stage)) return false;
  if (p.ecog > ecogMax) return false;
  if (genotypes.length > 0 && !genotypes.includes(p.genotype)) return false;
  if (p.pdl1 < pdl1Min) return false;
  if (p.priorLines > priorLinesMax) return false;
  return true;
});

const DEFAULT_CRITERIA = { ageMin: 18, ageMax: 85, stages: [], ecogMax: 2, genotypes: [], pdl1Min: 0, priorLinesMax: 5 };

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */









function CriteriaToggle({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        checked ? "border-sky-500/40 bg-sky-500/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
      }`}
    >
      <span>
        <span className={`block text-xs font-bold ${checked ? "text-sky-300" : "text-slate-300"}`}>{label}</span>
        {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-sky-500" : "bg-slate-700"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 1 - Biomarker Explorer
 * ------------------------------------------------------------------ */

function BiomarkerTab({ biomarkers, search, assayFilter, setAssayFilter, relevanceFilter, setRelevanceFilter, onInspect }) {
  const assays = ["All", ...Array.from(new Set(biomarkers.map((b) => b.assay)))];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return biomarkers.filter((b) => {
      const matchesSearch = !q || [b.id, b.gene, b.name, ...b.trials].some((f) => String(f).toLowerCase().includes(q));
      const matchesAssay = assayFilter === "All" || b.assay === assayFilter;
      const matchesRelevance = relevanceFilter === "all" || b.relevance === relevanceFilter;
      return matchesSearch && matchesAssay && matchesRelevance;
    });
  }, [biomarkers, search, assayFilter, relevanceFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {assays.map((a) => (
          <button
            key={a}
            onClick={() => setAssayFilter(a)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              assayFilter === a ? "border-violet-500/40 bg-violet-500/10 text-violet-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {a}
          </button>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {["all", "approved", "prognostic", "exploratory"].map((r) => (
            <button
              key={r}
              onClick={() => setRelevanceFilter(r)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                relevanceFilter === r ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {r === "all" ? "All relevance" : r}
            </button>
          ))}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <Dna size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No biomarkers match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Try a different search term, assay or relevance class.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const meta = ASSAY_META[b.assay] || ASSAY_META["RNA-seq"];
            const Icon = meta.icon;
            const rel = RELEVANCE_META[b.relevance] || RELEVANCE_META.exploratory;
            const series = seededSeries(b.id.length * 11 + 2, SEED_POINTS, b.expression, 9);
            const significant = b.qValue < 0.05;
            return (
              <button
                key={b.id}
                onClick={() => onInspect(b)}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg border p-2 ${meta.cls}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{b.gene}</p>
                      <p className="text-[11px] text-slate-500">{b.name}</p>
                    </div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${RELEVANCE_CLS[rel.tone] || "text-slate-400 bg-slate-500/10 border-slate-500/30"}`}>
                    {rel.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                    <p className="text-sm font-black text-white tabular-nums">{b.expression}</p>
                    <p className="text-[9px] text-slate-600">norm. expr</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                    <p className={`text-sm font-black tabular-nums ${b.direction === "up" ? "text-emerald-400" : b.direction === "down" ? "text-rose-400" : "text-slate-200"}`}>
                      {b.direction === "up" ? "↑" : b.direction === "down" ? "↓" : "—"} {b.foldChange.toFixed(1)}×
                    </p>
                    <p className="text-[9px] text-slate-600">fold change</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                    <p className={`text-sm font-black tabular-nums ${significant ? "text-emerald-400" : "text-amber-400"}`}>{fmtP(b.qValue)}</p>
                    <p className="text-[9px] text-slate-600">q-value</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Cohort distribution</p>
                  <MiniSparkline points={series} tone={b.direction === "up" ? "violet" : b.direction === "down" ? "rose" : "sky"} width={260} height={40} min={0} max={100} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Users size={11} /> n={b.cohortN}</span>
                    <span className="flex items-center gap-1"><ClipboardList size={11} /> {b.trials.length} trials</span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                    Inspect <ChevronRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 2 - Patient Cohort Sandbox
 * ------------------------------------------------------------------ */

function CohortSandboxTab({ patients, onInspect, criteria, setCriteria, onExportCohort, selected, onToggleSelect }) {
  const matched = useMemo(() => matchCohort(patients, criteria), [patients, criteria]);
  const toggleStage = (s) => setCriteria((c) => ({ ...c, stages: c.stages.includes(s) ? c.stages.filter((x) => x !== s) : [...c.stages, s] }));
  const toggleGenotype = (g) => setCriteria((c) => ({ ...c, genotypes: c.genotypes.includes(g) ? c.genotypes.filter((x) => x !== g) : [...c.genotypes, g] }));

  const poolSummary = useMemo(() => {
    const stages = Array.from(new Set(patients.map((p) => p.stage))).sort();
    const genotypes = Array.from(new Set(patients.map((p) => p.genotype))).filter((g) => g !== "None").sort();
    return { stages, genotypes };
  }, [patients]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Criteria panel */}
      <div className="space-y-4 lg:col-span-1">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <SlidersHorizontal size={14} className="text-sky-400" /> Inclusion criteria
            </p>
            <button onClick={() => setCriteria(DEFAULT_CRITERIA)} className="text-[11px] font-semibold text-slate-500 transition hover:text-sky-400">
              Reset
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Age range</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={criteria.ageMin}
                  onChange={(e) => setCriteria((c) => ({ ...c, ageMin: clamp(Number(e.target.value) || 18, 18, 100) }))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-sky-500/50"
                />
                <span className="text-xs text-slate-600">to</span>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={criteria.ageMax}
                  onChange={(e) => setCriteria((c) => ({ ...c, ageMax: clamp(Number(e.target.value) || 100, 18, 100) }))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-sky-500/50"
                />
                <span className="ml-auto text-[10px] text-slate-600">years</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Disease stage</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {poolSummary.stages.map((s) => {
                  const on = criteria.stages.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStage(s)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${on ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                    >
                      {s}
                    </button>
                  );
                })}
                <span className="ml-auto self-center text-[9px] text-slate-600">{criteria.stages.length === 0 ? "all" : "selected"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ECOG performance ≤</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4].map((e) => (
                  <button
                    key={e}
                    onClick={() => setCriteria((c) => ({ ...c, ecogMax: e }))}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${criteria.ecogMax === e ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Genotype</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {poolSummary.genotypes.map((g) => {
                  const on = criteria.genotypes.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenotype(g)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${on ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                    >
                      {g}
                    </button>
                  );
                })}
                <span className="ml-auto self-center text-[9px] text-slate-600">{criteria.genotypes.length === 0 ? "any" : "selected"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PD-L1 TPS ≥</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0, 1, 10, 20, 50, 90].map((v) => (
                  <button
                    key={v}
                    onClick={() => setCriteria((c) => ({ ...c, pdl1Min: v }))}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${criteria.pdl1Min === v ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prior lines ≤</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setCriteria((c) => ({ ...c, priorLinesMax: v }))}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${criteria.priorLinesMax === v ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Match summary */}
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Live match set</p>
          <p className="mt-1 text-3xl font-black text-white tabular-nums">{matched.length}<span className="text-lg text-slate-400"> / {patients.length}</span></p>
          <p className="mt-1 text-[11px] text-slate-400">{matched.length === 0 ? "No patients satisfy every criterion — loosen a filter." : `${(matched.length / patients.length) * 100}% of the screened pool matches all active criteria.`}</p>
          <div className="mt-3">
            <ProgressBar pct={(matched.length / patients.length) * 100} tone="sky" />
          </div>
          <button
            onClick={onExportCohort}
            disabled={matched.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/20 px-3 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Download size={14} /> Export cohort CSV ({matched.length})
          </button>
        </div>
      </div>

      {/* Matched patient list */}
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Screened patients · {matched.length} matched</p>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <CheckCircle2 size={12} className="text-emerald-400" /> {selected.size} selected
            </span>
          </div>
          <div className="divide-y divide-slate-800/70">
            {matched.length === 0 ? (
              <div className="flex flex-col items-center justify-center bg-slate-900/40 py-16 text-center">
                <Users size={30} className="mb-3 text-slate-600" />
                <p className="text-sm font-semibold text-slate-400">Empty match set</p>
                <p className="mt-1 text-xs text-slate-600">Relax the inclusion criteria in the left panel.</p>
              </div>
            ) : (
              matched.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-slate-900/70 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggleSelect(p.id)}
                      className="h-4 w-4 shrink-0 accent-sky-500"
                      aria-label={`select ${p.id}`}
                    />
                    <button onClick={() => onInspect(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300">
                        <User size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white">{p.id} <span className="ml-1 font-normal text-slate-500">· {p.age}y {p.sex} · Stage {p.stage} · ECOG {p.ecog}</span></p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                          <span className="font-semibold text-slate-400">{p.genotype}</span>
                          <span>PD-L1 {p.pdl1}%</span>
                          <span>Ki-67 {p.ki67}%</span>
                          <span>{p.priorLines} prior line{p.priorLines === 1 ? "" : "s"}</span>
                          <span className="text-slate-600">{p.arm}</span>
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-slate-600" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - Trial Portfolio
 * ------------------------------------------------------------------ */

function TrialPortfolioTab({ trials, search, statusFilter, setStatusFilter, tick, onInspect }) {
  const statuses = ["All", "Recruiting", "Active, not recruiting", "On hold"];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trials.filter((t) => {
      const matchesSearch = !q || [t.id, t.title, t.sponsor, ...t.biomarkers].some((f) => String(f).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trials, search, statusFilter]);

  const totalEnrolled = trials.reduce((a, t) => a + t.enrolled, 0);
  const totalTarget = trials.reduce((a, t) => a + t.target, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === s ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">{fmtNumber(totalEnrolled)} / {fmtNumber(totalTarget)} enrolled across portfolio · tick #{tick}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <ClipboardList size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No protocols match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Adjust the search or status chips.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const pct = enrollmentPct(t);
            const nearlyFull = pct >= 90;
            const onHold = t.status === "On hold";
            return (
              <button
                key={t.id}
                onClick={() => onInspect(t)}
                className={`w-full rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${onHold ? "border-amber-500/30" : "border-slate-800"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-bold text-sky-400">{t.id}</p>
                      <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-300">Phase {t.phase}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${onHold ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : t.status === "Recruiting" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-sky-500/30 bg-sky-500/10 text-sky-400"}`}>
                        {t.status}
                      </span>
                      {nearlyFull && <Badge tone="high">Enrollment near target</Badge>}
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-white">{t.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{t.sponsor}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {t.sites} sites</span>
                      <span className="flex items-center gap-1"><Microscope size={11} /> {t.arms} arm{t.arms === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1"><Gauge size={11} /> endpoint: {t.endpoint}</span>
                      <span className="flex items-center gap-1"><Dna size={11} /> {t.biomarkers.join(", ")}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-white tabular-nums">{fmtNumber(t.enrolled)}<span className="text-xs font-semibold text-slate-500"> / {fmtNumber(t.target)}</span></p>
                    <p className={`text-[10px] font-bold tabular-nums ${pct >= 90 ? "text-emerald-400" : pct >= 60 ? "text-sky-400" : "text-slate-500"}`}>{pct}% enrolled</p>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar pct={pct} tone={onHold ? "amber" : pct >= 90 ? "emerald" : "sky"} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><Clock size={12} /> {t.milestone}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                    Inspect <ChevronRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function ClinicalTrialHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("biomarkers");
  const [search, setSearch] = useState("");
  const [assayFilter, setAssayFilter] = useState("All");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(20);
  const [biomarkers, setBiomarkers] = useState(BIOMARKERS);
  const [trials, setTrials] = useState(TRIALS);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [selected, setSelected] = useState(() => new Set());
  const { toasts, pushToast, dismissToast } = useToasts();
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const seqRef = useRef(9000);
  const trialsRef = useRef(trials);
  useEffect(() => { trialsRef.current = trials; }, [trials]);



  const toggleSelect = useCallback((patientId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }, []);

  /* Live simulation loop: enrollment creeps, expression jitters, milestones fire. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      setBiomarkers((prev) =>
        prev.map((b) => ({ ...b, expression: Math.round(jitter(b.expression, 2, 1, 100)) }))
      );

      setTrials((prev) =>
        prev.map((t) => {
          if (t.status !== "Recruiting" || t.enrolled >= t.target) return t;
          const gain = Math.min(Math.round(Math.random() * 2), t.target - t.enrolled);
          return { ...t, enrolled: t.enrolled + gain };
        })
      );

      // Milestone / enrollment toasts.
      const before = trialsRef.current;
      const after = before.map((t) => {
        if (t.status !== "Recruiting" || t.enrolled >= t.target) return t;
        return { ...t, enrolled: t.enrolled + Math.min(Math.round(Math.random() * 2), t.target - t.enrolled) };
      });
      after.forEach((t) => {
        const prev = before.find((x) => x.id === t.id);
        if (prev && prev.enrolled < t.target && t.enrolled >= t.target) {
          pushToast("Trial enrollment complete", `${t.id} — ${t.title} reached its target of ${t.target}`, "high");
        }
        if (prev && Math.floor((prev.enrolled / prev.target) * 100) < 90 && Math.floor((t.enrolled / t.target) * 100) >= 90) {
          pushToast("Trial approaching target", `${t.id} passed 90% enrollment — site activation freeze suggested`, "medium");
        }
      });
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, pushToast]);

  const resetSimulation = useCallback(() => {
    setBiomarkers(BIOMARKERS.map((b) => ({ ...b })));
    setTrials(TRIALS.map((t) => ({ ...t })));
    setCriteria(DEFAULT_CRITERIA);
    setSelected(new Set());
    setTick(20);
    setInspect(null);
    pushToast("Research reset", "Biomarkers, trials and cohort criteria restored to baseline", "medium");
  }, [pushToast]);

  const handleExportCohort = useCallback(() => {
    const matched = matchCohort(PATIENT_POOL, criteria);
    setExporting(true);
    downloadCsv(`medtrack-cohort-${matched.length}-patients-${Date.now()}.csv`, [
      ["id", "age", "sex", "stage", "ecog", "genotype", "pdl1", "ki67", "priorLines", "arm"],
      ...matched.map((p) => [p.id, p.age, p.sex, p.stage, p.ecog, p.genotype, p.pdl1, p.ki67, p.priorLines, p.arm]),
    ]);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Cohort exported", `${matched.length} patients matched current criteria and written to CSV`, "low");
    }, 450);
  }, [criteria, pushToast]);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "trials" ? trials : biomarkers;
    const header = activeTab === "trials"
      ? ["id", "title", "phase", "status", "sponsor", "sites", "target", "enrolled", "endpoint", "biomarkers"]
      : ["id", "gene", "name", "assay", "expression", "foldChange", "pValue", "qValue", "direction", "relevance"];
    downloadCsv(`medtrack-research-${activeTab}-${Date.now()}.csv`, [
      header,
      ...rows.map((r) =>
        (activeTab === "trials"
          ? [r.id, r.title, r.phase, r.status, r.sponsor, r.sites, r.target, r.enrolled, r.endpoint, r.biomarkers.join(" | ")]
          : [r.id, r.gene, r.name, r.assay, r.expression, r.foldChange, r.pValue, r.qValue, r.direction, r.relevance]
        )
      ),
    ]);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, biomarkers, trials, pushToast]);

  const stats = useMemo(() => {
    const recruiting = trials.filter((t) => t.status === "Recruiting").length;
    const approved = biomarkers.filter((b) => b.relevance === "approved").length;
    const significant = biomarkers.filter((b) => b.qValue < 0.05).length;
    const enrolled = trials.reduce((a, t) => a + t.enrolled, 0);
    const matched = matchCohort(PATIENT_POOL, criteria).length;
    return { recruiting, approved, significant, enrolled, matched };
  }, [trials, biomarkers, criteria]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3 text-violet-400 shadow-lg shadow-violet-500/10">
                <Dna size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Clinical Trial &amp; Genomic Research</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} livePrefix="Simulating · tick #" />
                  <span className="text-slate-600">·</span>
                  <span>Biomarker Explorer · Cohort Sandbox · Trial Portfolio</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlaybackControls
              playing={playing}
              onToggle={() => setPlaying((p) => !p)}
              speed={speed}
              onSpeedChange={setSpeed}
              onReset={resetSimulation}
            />
            <ExportButton onClick={handleExport} exporting={exporting} />
          </div>
        </div>

        {/* ---------- Stat row ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={ClipboardList} label="Recruiting trials" value={stats.recruiting} sub={`of ${trials.length} protocols in portfolio`} tone="sky" />
          <StatCard icon={Users} label="Cohort match set" value={stats.matched} sub={`of ${PATIENT_POOL.length} screened patients`} tone="violet" />
          <StatCard icon={Microscope} label="Companion diagnostics" value={stats.approved} sub={`${stats.significant} biomarkers pass FDR q<0.05`} tone="emerald" />
          <StatCard icon={Activity} label="Enrolled across trials" value={fmtNumber(stats.enrolled)} sub={`portfolio-wide headcount`} tone="amber" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              {activeTab === "biomarkers" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> assay &amp; relevance filters above</span>
              )}
              {activeTab === "trials" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><Filter size={13} /> status filters above</span>
              )}
              {activeTab === "cohort" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><SlidersHorizontal size={13} /> toggle criteria in the left panel</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "biomarkers" && (
              <BiomarkerTab
                biomarkers={biomarkers}
                search={search}
                assayFilter={assayFilter}
                setAssayFilter={setAssayFilter}
                relevanceFilter={relevanceFilter}
                setRelevanceFilter={setRelevanceFilter}
                onInspect={setInspect}
              />
            )}
            {activeTab === "cohort" && (
              <CohortSandboxTab
                patients={PATIENT_POOL}
                criteria={criteria}
                setCriteria={setCriteria}
                selected={selected}
                onToggleSelect={toggleSelect}
                onInspect={setInspect}
                onExportCohort={handleExportCohort}
              />
            )}
            {activeTab === "trials" && (
              <TrialPortfolioTab trials={trials} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} tick={tick} onInspect={setInspect} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.assay !== undefined) {
            const b = inspect;
            const meta = ASSAY_META[b.assay] || ASSAY_META["RNA-seq"];
            const Icon = meta.icon;
            const rel = RELEVANCE_META[b.relevance] || RELEVANCE_META.exploratory;
            const series = seededSeries(b.id.length * 11 + 2, SEED_POINTS, b.expression, 9);
            const linkedTrials = TRIALS.filter((t) => b.trials.includes(t.id));
            return (
              <Modal open onClose={() => setInspect(null)} title={b.gene} subtitle={`${b.id} · ${b.name}`} icon={Icon} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{b.assay}</span>
                    <Badge tone={rel.tone}>{rel.label}</Badge>
                    <span className="text-[11px] text-slate-500">{rel.note}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Gauge size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{b.expression}</p>
                      <p className="text-[10px] text-slate-500">Normalized expr</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <TrendingUp size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${b.direction === "up" ? "text-emerald-400" : b.direction === "down" ? "text-rose-400" : "text-white"}`}>
                        {b.direction === "up" ? "↑" : b.direction === "down" ? "↓" : "—"} {b.foldChange.toFixed(1)}×
                      </p>
                      <p className="text-[10px] text-slate-500">Fold change</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <FlaskConical size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{fmtP(b.pValue)}</p>
                      <p className="text-[10px] text-slate-500">p-value</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <ShieldCheck size={14} className="mx-auto text-slate-500" />
                      <p className={`mt-1 text-lg font-black tabular-nums ${b.qValue < 0.05 ? "text-emerald-400" : "text-amber-400"}`}>{fmtP(b.qValue)}</p>
                      <p className="text-[10px] text-slate-500">FDR q-value</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cohort expression distribution</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <MiniSparkline points={series} tone={b.direction === "up" ? "violet" : b.direction === "down" ? "rose" : "sky"} width={560} height={48} min={0} max={100} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Linked protocols</p>
                    <div className="space-y-1.5">
                      {linkedTrials.length === 0 ? (
                        <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">No protocols currently reference this biomarker.</p>
                      ) : (
                        linkedTrials.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                            <span className="text-xs text-slate-200">{t.id} · {t.title}</span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-500"><Users size={11} /> {t.enrolled}/{t.target}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Assay platform" value={b.assay} />
                    <InfoRow label="Cohort size" value={`n = ${b.cohortN}`} mono />
                    <InfoRow label="Direction" value={b.direction === "up" ? "Upregulated" : b.direction === "down" ? "Downregulated" : "Flat"} />
                    <InfoRow label="Clinical relevance" value={rel.label} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Plus size={14} /> Add to watchlist
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <BookOpen size={14} /> Literature evidence
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Lock size={14} /> GxP assay metadata
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.age !== undefined) {
            const p = inspect;
            return (
              <Modal open onClose={() => setInspect(null)} title={p.id} subtitle={`${p.age}y ${p.sex} · Stage ${p.stage} · ECOG ${p.ecog}`} icon={User} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-300">{p.genotype}</span>
                    <Badge tone={p.ecog >= 2 ? "high" : "medium"}>ECOG {p.ecog}</Badge>
                    <span className="text-[11px] text-slate-500">assigned: {p.arm}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Gauge size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{p.pdl1}%</p>
                      <p className="text-[10px] text-slate-500">PD-L1 TPS</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Activity size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{p.ki67}%</p>
                      <p className="text-[10px] text-slate-500">Ki-67</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Layers size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{p.priorLines}</p>
                      <p className="text-[10px] text-slate-500">Prior lines</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <Dna size={14} className="mx-auto text-slate-500" />
                      <p className="mt-1 text-lg font-black tabular-nums text-white">{p.genotype}</p>
                      <p className="text-[10px] text-slate-500">Genotype</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Patient ID" value={p.id} mono />
                    <InfoRow label="Age / Sex" value={`${p.age}y / ${p.sex}`} />
                    <InfoRow label="Disease stage" value={p.stage} />
                    <InfoRow label="Current arm assignment" value={p.arm} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Plus size={14} /> Add to cohort
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Stethoscope size={14} /> Full screening file
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <ShieldCheck size={14} /> Consent &amp; ICF status
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const t = inspect;
          const pct = enrollmentPct(t);
          return (
            <Modal open onClose={() => setInspect(null)} title={t.title} subtitle={`${t.id} · Phase ${t.phase} · ${t.status}`} icon={ClipboardList} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${t.status === "On hold" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : t.status === "Recruiting" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-sky-500/30 bg-sky-500/10 text-sky-400"}`}>
                    {t.status}
                  </span>
                  <span className="text-[11px] text-slate-500">{t.sponsor} · {t.sites} sites · {t.arms} arm{t.arms === 1 ? "" : "s"}</span>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Enrollment</p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-white tabular-nums">{fmtNumber(t.enrolled)} <span className="text-slate-500">/ {fmtNumber(t.target)} enrolled</span></span>
                      <span className={`font-bold tabular-nums ${pct >= 90 ? "text-emerald-400" : "text-sky-400"}`}>{pct}%</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar pct={pct} tone={t.status === "On hold" ? "amber" : pct >= 90 ? "emerald" : "sky"} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">{t.milestone}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Assay biomarkers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.biomarkers.map((g) => {
                      const bm = BIOMARKERS.find((b) => b.gene === g);
                      return (
                        <span key={g} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                          {g}{bm ? ` · n=${bm.cohortN}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                  <InfoRow label="Primary endpoint" value={t.endpoint} />
                  <InfoRow label="Sponsor" value={t.sponsor} />
                  <InfoRow label="Active sites" value={t.sites} mono />
                  <InfoRow label="Phase" value={t.phase} />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                    <Users size={14} /> Open cohort builder
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <FileText size={14} /> Protocol summary
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <Lock size={14} /> DSMB reports
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()
      )}

      {/* ---------- Footer strip ---------- */}
      <div className="border-t border-slate-800/60 bg-slate-950 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-[11px] text-slate-600 sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5">
            <Dna size={12} className="text-violet-500" />
            Simulated translational research · no PHI · GCLP &amp; 21 CFR Part 11 aligned
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> ICF-gated data · DSMB oversight · biomarker results locked pre-interim
          </p>
        </div>
      </div>
    </div>
  );
}
