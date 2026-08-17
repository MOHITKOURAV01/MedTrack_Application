import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Bell, Brain, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Cpu, Database, Download, Eye, FileText, Filter,
  FlaskConical, Gauge, HeartPulse, Hospital, Info, Layers, Lock, Microscope,
  Pause, Play, Plus, Radio, RefreshCw, ScanLine, Search, Server, ShieldCheck,
  SlidersHorizontal, Sparkles, Stethoscope, Syringe, TestTube, TrendingDown,
  TrendingUp, User, Users, Workflow, X, Zap
} from "lucide-react";
import { clamp, round1, fmtNumber, seededSeries as series } from "../../utils/series";
import PlaybackControls from "../../components/common/PlaybackControls";
import { ExportButton } from "../../components/common/ExportButton";
import LiveStatus from "../../components/common/LiveStatus";
import ToastStack, { useToasts } from "../../components/common/ToastStack";
// Shared primitives this console renders. The extraction into src/components/common removed the
// page-local definitions; these imports replace them. Without them each name is a free variable and
// the first render throws, which is what the console did before this line existed.
import { downloadCsv } from "../../utils/csv";
// The shared primitives this console renders. They were page-local components until the
// extraction into src/components/common; the local definitions were removed then, but these
// imports were never added, so every identifier below was a ReferenceError at first render.
import { SEVERITY_META, SeverityBadge as Badge } from "../../components/common/SeverityBadge";
import { SeverityChips } from "../../components/common/SeverityChips";
import { StatCard } from "../../components/common/StatCard";
import { SearchBox } from "../../components/common/SearchBox";
import { InfoRow } from "../../components/common/InfoRow";
import { MiniSparkline } from "../../components/common/Sparkline";
import { StatusPill } from "../../components/common/StatusPill";
import { TabsBar } from "../../components/common/TabsBar";
import { InspectionModal as Modal } from "../../components/common/Modal";

/* ------------------------------------------------------------------ *
 *  MedTrack Biomedical & Clinical AI Hub
 *  ------------------------------------------------------------------
 *  Four live consoles in one command surface:
 *    1. Diagnostic Overwatch  - AI-assisted imaging triage queue with
 *       per-study confidence drift and radiologist hand-off.
 *    2. Patient Risk Models   - interactive risk factor sandbox; toggling
 *       a factor recomputes the acuity score live on every heartbeat.
 *    3. EHR Insights          - searchable record stream with medication
 *       interaction flags and lab trend sparklines.
 *    4. Model Registry        - deployed inference fleet with AUC / F1 /
 *       latency telemetry and regulatory clearance status.
 *
 *  Everything is simulated client-side so the console is fully
 *  interactive without a backend: vitals drift on a timer, confidence
 *  scores walk toward their decision threshold, and alerts bubble into
 *  a live feed and toast stack.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Constants & seed data
 * ------------------------------------------------------------------ */



const STATUS_META = {
  RUNNING: { label: "Inference", cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  REVIEW: { label: "Needs Review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  APPROVED: { label: "Approved", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  ESCALATED: { label: "Escalated", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const TABS = [
  { key: "overwatch", label: "Diagnostic Overwatch", icon: ScanLine, blurb: "AI triage queue with live confidence drift" },
  { key: "risk", label: "Patient Risk Models", icon: HeartPulse, blurb: "Interactive acuity scoring sandbox" },
  { key: "ehr", label: "EHR Insights", icon: FileText, blurb: "Record stream, interactions & lab trends" },
  { key: "models", label: "Model Registry", icon: Cpu, blurb: "Deployed inference fleet telemetry" },
];

const AI_MODELS = [
  { id: "MOD-SEP-014", name: "SepsisGuard", version: "3.2.1", domain: "Sepsis Prediction", modality: "EHR + Vitals Stream", auc: 0.941, f1: 0.912, threshold: 0.62, latencyMs: 84, callsToday: 4218, status: "FDA Cleared", cleared: "FDA 510(k) K241772", lastValidated: "2026-07-28", deployZone: "ICU West", drift: 0.012 },
  { id: "MOD-CXR-027", name: "ChestXNet", version: "2.7.4", domain: "Chest Radiograph Triage", modality: "Imaging (DICOM)", auc: 0.938, f1: 0.905, threshold: 0.55, latencyMs: 210, callsToday: 1893, status: "CE Marked", cleared: "CE Class IIa / MDR", lastValidated: "2026-07-15", deployZone: "Radiology North", drift: 0.021 },
  { id: "MOD-ECG-009", name: "RhythmGuard", version: "1.9.6", domain: "Arrhythmia Detection", modality: "12-Lead ECG", auc: 0.956, f1: 0.933, threshold: 0.48, latencyMs: 46, callsToday: 3621, status: "FDA Cleared", cleared: "FDA 510(k) K240119", lastValidated: "2026-08-02", deployZone: "Cardiology", drift: 0.008 },
  { id: "MOD-GLU-021", name: "GlycemiaForecast", version: "4.0.2", domain: "Glucose Trajectory", modality: "CGM + Lab History", auc: 0.889, f1: 0.861, threshold: 0.57, latencyMs: 132, callsToday: 974, status: "Clinical Hold", cleared: "IRB Protocol 2026-112", lastValidated: "2026-06-30", deployZone: "Endocrine Ward", drift: 0.064 },
  { id: "MOD-DIS-033", name: "DischargeReady", version: "1.4.0", domain: "Readmission Risk", modality: "EHR Snapshot", auc: 0.872, f1: 0.844, threshold: 0.51, latencyMs: 38, callsToday: 512, status: "CE Marked", cleared: "CE Class I / MDR", lastValidated: "2026-07-20", deployZone: "Care Coordination", drift: 0.017 },
  { id: "MOD-DRUG-011", name: "InteractionWatch", version: "2.1.8", domain: "Drug-Drug Interaction", modality: "Medication Orders", auc: 0.918, f1: 0.897, threshold: 0.44, latencyMs: 21, callsToday: 7034, status: "FDA Cleared", cleared: "FDA 510(k) K239981", lastValidated: "2026-08-05", deployZone: "Pharmacy Core", drift: 0.004 },
];

const DIAGNOSTIC_CASES = [
  { id: "IMG-26114", patientName: "Eleanor Vance", mrn: "MRN-884120", age: 71, modality: "CT", study: "CT Chest w/ Contrast", model: "MOD-CXR-027", confidence: 0.82, status: "REVIEW", priority: "high", radiologist: "Dr. A. Okafor", requestedBy: "Dr. L. Reyes", elapsed: 14, findings: ["Consolidation in right lower lobe with air bronchogram", "No pleural effusion", "Mild cardiomegaly noted"], impression: "Community-acquired pneumonia, moderate severity", action: "Correlate with CBC and blood cultures before antibiotic escalation" },
  { id: "IMG-26115", patientName: "Marcus Bell", mrn: "MRN-770218", age: 58, modality: "MRI", study: "MRI Brain w/o Contrast", model: "MOD-CXR-027", confidence: 0.64, status: "RUNNING", priority: "medium", radiologist: "Dr. P. Lindqvist", requestedBy: "Dr. H. Nakamura", elapsed: 6, findings: ["Awaiting inference completion"], impression: "Pending", action: "Auto-follow-up: stroke protocol checklist armed" },
  { id: "IMG-26116", patientName: "Priya Raman", mrn: "MRN-903441", age: 44, modality: "X-Ray", study: "Chest X-Ray PA", model: "MOD-CXR-027", confidence: 0.91, status: "APPROVED", priority: "low", radiologist: "Dr. S. Whitfield", requestedBy: "Dr. M. Alvarez", elapsed: 31, findings: ["Clear lung fields bilaterally", "Costophrenic angles sharp"], impression: "Normal study", action: "Auto-filed; no follow-up required" },
  { id: "IMG-26117", patientName: "Derek Osei", mrn: "MRN-664509", age: 63, modality: "CT", study: "CT Abdomen w/ Contrast", model: "MOD-CXR-027", confidence: 0.73, status: "REVIEW", priority: "critical", radiologist: "Dr. A. Okafor", requestedBy: "ER Triage Auto-Order", elapsed: 22, findings: ["Focal wall thickening of sigmoid colon", "Small volume free fluid in pelvis", "Mesenteric stranding adjacent to sigmoid"], impression: "Suspected diverticulitis with contained perforation", action: "Urgent surgical consult + IV antibiotics; repeat labs in 4h" },
  { id: "IMG-26118", patientName: "Yuki Tanaka", mrn: "MRN-558173", age: 29, modality: "US", study: "Abdominal Ultrasound", model: "MOD-CXR-027", confidence: 0.87, status: "APPROVED", priority: "low", radiologist: "Dr. P. Lindqvist", requestedBy: "Dr. C. Fontaine", elapsed: 48, findings: ["Gallbladder wall 3mm, no stones", "Common duct 4mm"], impression: "Normal hepatobiliary study", action: "Auto-filed" },
  { id: "IMG-26119", patientName: "Amara Nwosu", mrn: "MRN-441927", age: 82, modality: "CT", study: "CT Head w/o Contrast", model: "MOD-CXR-027", confidence: 0.58, status: "RUNNING", priority: "critical", radiologist: "Dr. S. Whitfield", requestedBy: "Dr. R. Callahan", elapsed: 3, findings: ["Awaiting inference completion"], impression: "Pending", action: "Stroke team on standby; perfusion suite reserved" },
  { id: "IMG-26120", patientName: "Liam O'Connor", mrn: "MRN-335882", age: 50, modality: "ECG", study: "12-Lead ECG", model: "MOD-ECG-009", confidence: 0.95, status: "APPROVED", priority: "medium", radiologist: "Cardiology Auto", requestedBy: "Dr. E. Sorensen", elapsed: 12, findings: ["Sinus rhythm, rate 78", "Normal axis", "No ST deviation"], impression: "Normal ECG", action: "Auto-filed" },
  { id: "IMG-26121", patientName: "Sofia Marchetti", mrn: "MRN-229634", age: 67, modality: "X-Ray", study: "Chest X-Ray AP Portable", model: "MOD-CXR-027", confidence: 0.79, status: "REVIEW", priority: "high", radiologist: "Dr. A. Okafor", requestedBy: "ICU West Auto-Order", elapsed: 19, findings: ["Bilateral interstitial opacities", "ETT tip 4cm above carina", "Small right apical pneumothorax"], impression: "Possible ARDS pattern; ETT position acceptable", action: "Confirm with supine CT; consider PEEP optimization" },
  { id: "IMG-26122", patientName: "James Whitaker", mrn: "MRN-118467", age: 76, modality: "MRI", study: "MRI Lumbar Spine", model: "MOD-CXR-027", confidence: 0.88, status: "APPROVED", priority: "low", radiologist: "Dr. P. Lindqvist", requestedBy: "Dr. G. Duval", elapsed: 55, findings: ["L4-L5 disc bulge", "Mild bilateral foraminal narrowing"], impression: "Degenerative changes, no surgical emergency", action: "Auto-filed; PT referral suggested" },
  { id: "IMG-26123", patientName: "Fatima Zahra", mrn: "MRN-775316", age: 38, modality: "CT", study: "CT Pulmonary Angiogram", model: "MOD-CXR-027", confidence: 0.69, status: "REVIEW", priority: "high", radiologist: "Dr. S. Whitfield", requestedBy: "ER Triage Auto-Order", elapsed: 27, findings: ["Filling defect in segmental branch right lower lobe", "Small bilateral pleural effusions", "Right heart strain pattern"], impression: "Acute segmental pulmonary embolism", action: "Anticoagulation order suggested; echo for RV strain" },
  { id: "IMG-26124", patientName: "Haruto Sato", mrn: "MRN-660283", age: 9, modality: "X-Ray", study: "Chest X-Ray PA", model: "MOD-CXR-027", confidence: 0.93, status: "APPROVED", priority: "low", radiologist: "Dr. A. Okafor", requestedBy: "Pediatrics Clinic", elapsed: 8, findings: ["Clear lung fields", "No cardiomegaly"], impression: "Normal study", action: "Auto-filed" },
  { id: "IMG-26125", patientName: "Grace Adeyemi", mrn: "MRN-554190", age: 61, modality: "CT", study: "CT Chest w/o Contrast", model: "MOD-CXR-027", confidence: 0.61, status: "RUNNING", priority: "medium", radiologist: "Dr. P. Lindqvist", requestedBy: "Oncology Service", elapsed: 5, findings: ["Awaiting inference completion"], impression: "Pending", action: "Comparison with prior 2025-11 study queued" },
];

const INITIAL_PATIENTS = [
  { id: "PT-1093", name: "Robert Callahan", age: 74, sex: "M", mrn: "MRN-335802", ward: "ICU West", bed: "Bed 07", diagnosis: "Septic Shock (source: urine)", losDays: 3.2, baseRisk: 74, vitals: { hr: 118, rr: 26, spo2: 91, sbp: 92, temp: 38.9, glucose: 168 }, factors: [ { key: "hypotension", label: "Hypotension (MAP < 65)", weight: 16 }, { key: "lactate", label: "Lactate > 4 mmol/L", weight: 14 }, { key: "ventilated", label: "Mechanically ventilated", weight: 10 }, { key: "immunocompromised", label: "Immunocompromised", weight: 8 } ] },
  { id: "PT-1094", name: "Amara Nwosu", age: 82, sex: "F", mrn: "MRN-441927", ward: "ICU East", bed: "Bed 12", diagnosis: "Large Vessel Occlusion Stroke", losDays: 1.1, baseRisk: 81, vitals: { hr: 104, rr: 22, spo2: 96, sbp: 176, temp: 37.1, glucose: 142 }, factors: [ { key: "thrombectomy", label: "Pending thrombectomy", weight: 12 }, { key: "afib", label: "Atrial fibrillation", weight: 9 }, { key: "age80", label: "Age ≥ 80", weight: 6 } ] },
  { id: "PT-1095", name: "Derek Osei", age: 63, sex: "M", mrn: "MRN-664509", ward: "Surgical 3", bed: "Bed 04", diagnosis: "Diverticulitis w/ contained perforation", losDays: 2.0, baseRisk: 58, vitals: { hr: 96, rr: 18, spo2: 97, sbp: 118, temp: 38.2, glucose: 121 }, factors: [ { key: "perforation", label: "Contained perforation", weight: 11 }, { key: "leukocytosis", label: "WBC > 15k", weight: 7 } ] },
  { id: "PT-1096", name: "Fatima Zahra", age: 38, sex: "F", mrn: "MRN-775316", ward: "Cardiology 2", bed: "Bed 09", diagnosis: "Acute Pulmonary Embolism", losDays: 0.8, baseRisk: 63, vitals: { hr: 112, rr: 24, spo2: 92, sbp: 106, temp: 36.9, glucose: 108 }, factors: [ { key: "rvstrain", label: "Right heart strain on echo", weight: 13 }, { key: "hypoxia", label: "SpO2 < 94% on room air", weight: 9 } ] },
  { id: "PT-1097", name: "Eleanor Vance", age: 71, sex: "F", mrn: "MRN-884120", ward: "Respiratory 1", bed: "Bed 15", diagnosis: "Community-Acquired Pneumonia", losDays: 1.6, baseRisk: 47, vitals: { hr: 102, rr: 22, spo2: 93, sbp: 124, temp: 38.1, glucose: 156 }, factors: [ { key: "hypoxia", label: "SpO2 < 94% on room air", weight: 9 }, { key: "copd", label: "COPD comorbidity", weight: 6 } ] },
  { id: "PT-1098", name: "Sofia Marchetti", age: 67, sex: "F", mrn: "MRN-229634", ward: "ICU West", bed: "Bed 02", diagnosis: "ARDS on invasive ventilation", losDays: 5.4, baseRisk: 88, vitals: { hr: 124, rr: 31, spo2: 88, sbp: 88, temp: 38.6, glucose: 189 }, factors: [ { key: "ventilated", label: "Mechanically ventilated", weight: 10 }, { key: "hypotension", label: "Hypotension (MAP < 65)", weight: 16 }, { key: "pneumothorax", label: "Pneumothorax (drained)", weight: 8 }, { key: "renal", label: "AKI stage 2", weight: 7 } ] },
  { id: "PT-1099", name: "Marcus Bell", age: 58, sex: "M", mrn: "MRN-770218", ward: "Neurology 1", bed: "Bed 11", diagnosis: "Rule out stroke (TIA workup)", losDays: 0.4, baseRisk: 34, vitals: { hr: 78, rr: 16, spo2: 98, sbp: 134, temp: 36.8, glucose: 104 }, factors: [ { key: "hypertension", label: "Uncontrolled HTN", weight: 5 } ] },
  { id: "PT-1100", name: "Grace Adeyemi", age: 61, sex: "F", mrn: "MRN-554190", ward: "Oncology 2", bed: "Bed 06", diagnosis: "Metastatic NSCLC - cycle 3 chemo", losDays: 2.7, baseRisk: 41, vitals: { hr: 88, rr: 17, spo2: 96, sbp: 128, temp: 37.4, glucose: 132 }, factors: [ { key: "neutropenia", label: "Neutropenia (ANC < 1.0)", weight: 11 }, { key: "immunocompromised", label: "Immunocompromised", weight: 8 } ] },
];

const INITIAL_RECORDS = [
  { id: "EHR-55210", patientName: "Sofia Marchetti", mrn: "MRN-229634", type: "Lab Result", title: "Arterial Blood Gas - STAT", provider: "Dr. K. Iversen", dept: "Critical Care Lab", timestamp: "2026-08-14T04:12:00Z", critical: true, tags: ["ABG", "Respiratory", "STAT"], summary: "pH 7.21, PaCO2 58, PaO2 54, HCO3 22 - uncompensated respiratory acidosis with hypoxemia.", body: "pH 7.21 (7.35-7.45), PaCO2 58 mmHg (35-45), PaO2 54 mmHg (80-100), HCO3 22 mmol/L (22-28), Base excess -4.1. Consistent with acute respiratory acidosis with hypoxemia, concordant with the ARDS picture. Recommend ventilator settings review and repeat ABG in 60 minutes." },
  { id: "EHR-55209", patientName: "Robert Callahan", mrn: "MRN-335802", type: "Medication Order", title: "Norepinephrine infusion titrated", provider: "Dr. L. Reyes", dept: "ICU West", timestamp: "2026-08-14T03:48:00Z", critical: true, tags: ["Vasopressor", "Septic Shock", "ICU"], summary: "Norepinephrine started at 0.12 mcg/kg/min; InteractionWatch flagged concurrent metoprolol.", body: "Norepinephrine 8mg/250mL NS, titrate to MAP ≥ 65. InteractionWatch v2.1 flagged concurrent metoprolol tartrate 25mg BID: beta-blockade may blunt the pressor response. Consider holding metoprolol while titrating; pharmacy notified." },
  { id: "EHR-55208", patientName: "Fatima Zahra", mrn: "MRN-775316", type: "Imaging Report", title: "CTPA - final read", provider: "Dr. S. Whitfield", dept: "Radiology", timestamp: "2026-08-14T03:31:00Z", critical: false, tags: ["CT", "Vascular", "PE"], summary: "Confirmed segmental PE; RV:LV ratio 1.1 suggesting mild strain.", body: "Filling defect in segmental branch of right lower lobe pulmonary artery. RV:LV ratio 1.1 (upper limit of normal). Mild bilateral pleural effusions. Findings correlate with ChestXNet triage confidence 0.69." },
  { id: "EHR-55207", patientName: "Eleanor Vance", mrn: "MRN-884120", type: "Progress Note", title: "Day 2 progress - pneumonia", provider: "Dr. M. Alvarez", dept: "Respiratory 1", timestamp: "2026-08-14T02:55:00Z", critical: false, tags: ["Progress", "Antibiotics"], summary: "Clinical improvement; sputum culture grew S. pneumoniae, azithromycin added.", body: "Patient improved overnight. Sputum culture grew Streptococcus pneumoniae, penicillin-sensitive. Azithromycin 500mg PO added for atypical coverage. ChestXNet re-read confirms consolidation improving. Continue ceftriaxone." },
  { id: "EHR-55206", patientName: "Grace Adeyemi", mrn: "MRN-554190", type: "Lab Result", title: "CBC with differential", provider: "Dr. N. Fonseca", dept: "Oncology Lab", timestamp: "2026-08-14T02:20:00Z", critical: true, tags: ["CBC", "Oncology", "Neutropenia"], summary: "ANC 0.62 - febrile neutropenia threshold breached.", body: "WBC 1.8, ANC 0.62 (reference 1.5-8.0), Hgb 9.8, Plt 112. ANC below the 1.0 threshold triggers the febrile neutropenia pathway: G-CSF order suggested, hold next chemo cycle pending count recovery." },
  { id: "EHR-55205", patientName: "Derek Osei", mrn: "MRN-664509", type: "Medication Order", title: "IV antibiotics initiated", provider: "Dr. C. Fontaine", dept: "Surgical 3", timestamp: "2026-08-14T01:47:00Z", critical: false, tags: ["Antibiotics", "Surgery"], summary: "Piperacillin-tazobactam 4.5g q6h started; no interaction flags.", body: "Piperacillin-tazobactam 4.5g IV q6h. InteractionWatch v2.1: no flags against current medications. Renal dosing verified against eGFR 68." },
  { id: "EHR-55204", patientName: "Haruto Sato", mrn: "MRN-660283", type: "Progress Note", title: "Pediatric asthma follow-up", provider: "Dr. G. Duval", dept: "Pediatrics", timestamp: "2026-08-13T23:58:00Z", critical: false, tags: ["Pediatrics", "Asthma"], summary: "Peak flow 82% predicted; spacer technique corrected.", body: "Peak flow 82% of predicted, up from 64%. Spacer technique demonstrated and corrected. Albuterol HFA 90mcg 2 puffs q4-6h PRN. Return to clinic in 2 weeks." },
  { id: "EHR-55203", patientName: "Amara Nwosu", mrn: "MRN-441927", type: "Imaging Report", title: "CT Head - preliminary", provider: "Dr. R. Callahan", dept: "Radiology", timestamp: "2026-08-13T23:12:00Z", critical: true, tags: ["CT", "Stroke", "Code Stroke"], summary: "Hyperdense MCA sign; ASPECTS 8; thrombectomy window open.", body: "Hyperdense left MCA sign with ASPECTS score of 8. No hemorrhage. LVO likely; mechanical thrombectomy window open (last known well 2h). Stroke team activated." },
];

const INITIAL_ALERTS = [
  { id: "AL-9001", severity: "critical", title: "Deterioration risk spike", body: "PT-1098 Sofia Marchetti crossed 85-point acuity threshold", time: "2026-08-14T04:10:00Z" },
  { id: "AL-9000", severity: "high", title: "Case escalated", body: "IMG-26117 diverticulitis study flagged for surgical review", time: "2026-08-14T04:05:00Z" },
  { id: "AL-8999", severity: "medium", title: "Model drift detected", body: "GlycemiaForecast PSI drift 0.064 exceeds review band", time: "2026-08-14T03:58:00Z" },
];

const SEED_POINTS = 18;

/* ------------------------------------------------------------------ *
 *  Pure helpers
 * ------------------------------------------------------------------ */


const seededSeries = (seed, n = SEED_POINTS, base = 50, amp = 18) =>
  series(seed, n, base, amp, { seedMult: 7919, pull: 0.06 });

const jitter = (v, amount, lo, hi) => clamp(v + (Math.random() * 2 - 1) * amount, lo, hi);

const formatClock = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};



const scoreToLevel = (score) => (score >= 80 ? "critical" : score >= 65 ? "high" : score >= 45 ? "medium" : "low");

const confidenceTone = (c) => (c >= 0.85 ? "text-emerald-400" : c >= 0.7 ? "text-sky-400" : c >= 0.55 ? "text-amber-400" : "text-rose-400");

const MODEL_BY_ID = (id) => AI_MODELS.find((m) => m.id === id) || AI_MODELS[1];

/** Acuity score recomputed from base risk, active factor weights and vitals stress. */
const computeRisk = (patient, overrides = {}) => {
  const o = overrides[patient.id] || {};
  let score = patient.baseRisk;
  patient.factors.forEach((f) => {
    const active = o[f.key] !== undefined ? o[f.key] : true;
    if (active) score += f.weight;
  });
  const v = patient.vitals;
  if (v.hr > 115) score += 6;
  else if (v.hr < 50) score += 4;
  if (v.spo2 < 92) score += 10;
  else if (v.spo2 < 95) score += 4;
  if (v.sbp < 90) score += 8;
  if (v.temp > 38.5) score += 4;
  if (v.glucose > 180) score += 3;
  return clamp(Math.round(score), 0, 99);
};

/* ------------------------------------------------------------------ *
 *  Small presentational components
 * ------------------------------------------------------------------ */










function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-sky-500" : "bg-slate-700"} ${disabled ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}


function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-sky-500" : pct >= 55 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-right text-[11px] font-bold tabular-nums ${confidenceTone(value)}`}>{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 1 - Diagnostic Overwatch
 * ------------------------------------------------------------------ */

function DiagnosticOverwatchTab({ cases, search, severity, onInspect }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesSearch = !q || [c.patientName, c.mrn, c.id, c.study, c.modality].some((f) => String(f).toLowerCase().includes(q));
      const matchesSeverity = severity === "all" || c.priority === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [cases, search, severity]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <ScanLine size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No studies match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Clear the search or switch severity to see the triage queue.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((c) => {
        const model = MODEL_BY_ID(c.model);
        const sev = SEVERITY_META[c.priority] || SEVERITY_META.medium;
        const running = c.status === "RUNNING";
        return (
          <button
            key={c.id}
            onClick={() => onInspect(c)}
            className={`group rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up ${sev.border}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${sev.bg} ${sev.text}`}>
                  {c.modality === "CT" ? <ScanLine size={16} /> : c.modality === "MRI" ? <Brain size={16} /> : c.modality === "ECG" ? <Activity size={16} /> : <Radio size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{c.patientName}</p>
                  <p className="text-[11px] text-slate-500">{c.study} · {c.mrn}</p>
                </div>
              </div>
              <StatusPill status={c.status} map={STATUS_META} fallback={STATUS_META.RUNNING} />
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-500"><Cpu size={12} /> {model.name} v{model.version}</span>
                <span className="text-slate-500">{c.elapsed} min ago</span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Triage confidence</span>
                  <span className={`${running ? "text-sky-400" : "text-slate-400"}`}>{running ? "inferring…" : "final"}</span>
                </div>
                <ConfidenceBar value={c.confidence} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <User size={12} /> {c.radiologist}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 transition group-hover:gap-2">
                Inspect <ChevronRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 2 - Patient Risk Models (interactive sandbox)
 * ------------------------------------------------------------------ */

function PatientRiskTab({ patients, search, severity, onInspect, overrides, onToggleFactor, onResetFactors }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesSearch = !q || [p.name, p.mrn, p.id, p.diagnosis, p.ward].some((f) => String(f).toLowerCase().includes(q));
      const level = scoreToLevel(computeRisk(p, overrides));
      const matchesSeverity = severity === "all" || level === severity;
      return matchesSearch && matchesSeverity;
    });
  }, [patients, search, severity, overrides]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
        <HeartPulse size={32} className="mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">No patients match the current filters</p>
        <p className="mt-1 text-xs text-slate-600">Adjust the search or severity chips to widen the cohort.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
      {filtered.map((p) => {
        const score = computeRisk(p, overrides);
        const level = scoreToLevel(score);
        const sev = SEVERITY_META[level] || SEVERITY_META.medium;
        const trend = seededSeries(p.id.length + p.baseRisk, SEED_POINTS, Math.max(20, p.baseRisk - 12), 16);
        const ovr = overrides[p.id] || {};
        const activeFactors = p.factors.filter((f) => (ovr[f.key] !== undefined ? ovr[f.key] : true));
        return (
          <div key={p.id} className={`rounded-2xl border bg-slate-900/70 p-4 shadow-lg shadow-black/20 animate-fade-up ${sev.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg border p-2 ${sev.bg} ${sev.text}`}>
                  <HeartPulse size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{p.name} <span className="ml-1 text-[11px] font-medium text-slate-500">· {p.age}y {p.sex}</span></p>
                  <p className="text-[11px] text-slate-500">{p.ward} · {p.bed} · LOS {p.losDays.toFixed(1)}d</p>
                </div>
              </div>
              <div className={`rounded-xl border px-2.5 py-1 text-center ${sev.bg} ${sev.border}`}>
                <p className={`text-xl font-black tabular-nums ${sev.text}`}>{score}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">acuity</p>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-slate-400">{p.diagnosis}</p>

            <div className="mt-3 grid grid-cols-6 gap-1.5 text-center">
              {[
                { k: "hr", label: "HR" }, { k: "rr", label: "RR" }, { k: "spo2", label: "SpO₂" }, { k: "sbp", label: "SBP" }, { k: "temp", label: "Temp" }, { k: "glucose", label: "Glu" },
              ].map(({ k, label }) => (
                <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/60 px-1 py-1.5">
                  <p className={`text-[10px] font-bold tabular-nums ${k === "spo2" && p.vitals[k] < 92 ? "text-rose-400" : k === "hr" && p.vitals[k] > 115 ? "text-rose-400" : "text-slate-200"}`}>{p.vitals[k]}</p>
                  <p className="text-[9px] text-slate-600">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-slate-400">
                {activeFactors.length} active risk factor{activeFactors.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <MiniSparkline points={trend} tone={level === "critical" ? "rose" : level === "high" ? "amber" : "sky"} width={92} height={28} filled={false} />
                <button onClick={() => onResetFactors(p.id)} className="text-[11px] font-semibold text-slate-500 transition hover:text-sky-400">
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-2 space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
              {p.factors.map((f) => {
                const on = ovr[f.key] !== undefined ? ovr[f.key] : true;
                return (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] ${on ? "text-slate-300" : "text-slate-600 line-through"}`}>{f.label} <span className="text-slate-600">(+{f.weight})</span></span>
                    <Toggle checked={on} onChange={(v) => onToggleFactor(p.id, f.key, v)} />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Brain size={12} /> SepsisGuard·RiskEngine v3.2
              </span>
              <button onClick={() => onInspect(p)} className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 transition hover:gap-2">
                Inspect <ChevronRight size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 3 - EHR Insights
 * ------------------------------------------------------------------ */

const RECORD_TYPE_META = {
  "Lab Result": { cls: "text-violet-400 bg-violet-500/10 border-violet-500/30", icon: TestTube },
  "Medication Order": { cls: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Syringe },
  "Imaging Report": { cls: "text-sky-400 bg-sky-500/10 border-sky-500/30", icon: ScanLine },
  "Progress Note": { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: FileText },
};

function EhrInsightsTab({ records, search, severity, typeFilter, setTypeFilter, onInspect }) {
  const types = useMemo(() => ["All", ...Array.from(new Set(records.map((r) => r.type)))], [records]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchesSearch = !q || [r.patientName, r.mrn, r.title, r.provider, r.tags.join(" ")].some((f) => String(f).toLowerCase().includes(q));
      const matchesType = typeFilter === "All" || r.type === typeFilter;
      const matchesSeverity = severity === "all" ? true : severity === "critical" ? r.critical : !r.critical;
      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [records, search, severity, typeFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              typeFilter === t ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">{filtered.length} record{filtered.length === 1 ? "" : "s"} · streamed from EHR Core</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-20 text-center">
          <FileText size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No records match the current filters</p>
          <p className="mt-1 text-xs text-slate-600">Try a different search term, record type, or severity chip.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="divide-y divide-slate-800/70">
            {filtered.map((r) => {
              const meta = RECORD_TYPE_META[r.type] || RECORD_TYPE_META["Progress Note"];
              const Icon = meta.icon;
              return (
                <button key={r.id} onClick={() => onInspect(r)} className="flex w-full flex-col gap-2 bg-slate-900/70 px-4 py-3.5 text-left transition hover:bg-slate-800/60 sm:flex-row sm:items-center sm:gap-4">
                  <div className={`shrink-0 rounded-lg border p-2 ${meta.cls}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{r.title}</p>
                      {r.critical && <Badge tone="critical">Critical value</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{r.summary}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{r.patientName} · {r.mrn}</span>
                      <span className="flex items-center gap-1"><User size={11} /> {r.provider}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatClock(r.timestamp)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[10px] font-semibold text-slate-300">{r.type}</span>
                    <ChevronRight size={15} className="text-slate-600" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Tab 4 - Model Registry
 * ------------------------------------------------------------------ */

function ModelRegistryTab({ search, onInspect }) {
  const [driftFilter, setDriftFilter] = useState("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AI_MODELS.filter((m) => {
      const matchesSearch = !q || [m.name, m.id, m.domain, m.modality, m.cleared].some((f) => String(f).toLowerCase().includes(q));
      const driftBand = m.drift > 0.05 ? "high" : m.drift > 0.02 ? "medium" : "low";
      const matchesSeverity = driftFilter === "all" || driftBand === driftFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [search, driftFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All models" }, { key: "low", label: "Stable drift" }, { key: "medium", label: "Monitor drift" }, { key: "high", label: "High drift" },
        ].map(({ key, label }) => {
          const active = driftFilter === key;
          return (
            <button
              key={key}
              onClick={() => setDriftFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "border-sky-500/40 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-500">{filtered.length} deployed · {AI_MODELS.reduce((a, m) => a + m.callsToday, 0).toLocaleString()} inferences today</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m) => {
          const driftBand = m.drift > 0.05 ? "high" : m.drift > 0.02 ? "medium" : "low";
          const driftMeta = SEVERITY_META[driftBand];
          const cleared = m.status !== "Clinical Hold";
          return (
            <button
              key={m.id}
              onClick={() => onInspect(m)}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-slate-700 animate-fade-up"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-sky-400">
                    <Brain size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{m.name} <span className="ml-1 font-mono text-[11px] text-slate-500">v{m.version}</span></p>
                    <p className="text-[11px] text-slate-500">{m.domain}</p>
                  </div>
                </div>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${cleared ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
                  {m.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                  <p className="text-sm font-black text-white tabular-nums">{m.auc.toFixed(3)}</p>
                  <p className="text-[10px] text-slate-600">AUC</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                  <p className="text-sm font-black text-white tabular-nums">{m.f1.toFixed(3)}</p>
                  <p className="text-[10px] text-slate-600">F1</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                  <p className="text-sm font-black text-white tabular-nums">{m.latencyMs}<span className="text-[10px] font-semibold text-slate-500">ms</span></p>
                  <p className="text-[10px] text-slate-600">p50</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-500"><Server size={12} /> {m.deployZone}</span>
                  <span className="text-slate-500">{fmtNumber(m.callsToday)} calls</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Data drift (PSI)</span>
                  <span className={`flex items-center gap-1 font-bold ${driftMeta.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${driftMeta.dot}`} /> {m.drift.toFixed(3)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Main hub component
 * ------------------------------------------------------------------ */

export default function ClinicalAIHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("overwatch");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [cases, setCases] = useState(DIAGNOSTIC_CASES);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [records] = useState(INITIAL_RECORDS);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [overrides, setOverrides] = useState({});
  const [inspect, setInspect] = useState(null);
  const [exporting, setExporting] = useState(false);
  const toastSeq = useRef(100);
  const patientsRef = useRef(patients);
  const overridesRef = useRef(overrides);
  useEffect(() => { patientsRef.current = patients; }, [patients]);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);



  const pushAlert = useCallback((title, body, severityLevel = "medium") => {
    const id = `AL-${9000 + toastSeq.current++}`;
    const entry = { id, severity: severityLevel, title, body, time: new Date().toISOString() };
    setAlerts((prev) => [entry, ...prev].slice(0, 8));
    if (severityLevel === "critical" || severityLevel === "high") {
      pushToast(title, body, severityLevel);
    }
  }, [pushToast]);

  /* Live simulation loop: vitals drift, confidence walks, alerts bubble. */
  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);

      setPatients((prev) =>
        prev.map((p) => {
          const v = p.vitals;
          const next = {
            hr: jitter(v.hr, 4, 48, 160),
            rr: jitter(v.rr, 2, 10, 40),
            spo2: jitter(v.spo2, 1.4, 78, 100),
            sbp: jitter(v.sbp, 5, 70, 200),
            temp: jitter(v.temp, 0.2, 35.5, 40.5),
            glucose: jitter(v.glucose, 6, 60, 260),
          };
          return { ...p, vitals: next };
        })
      );

      setCases((prev) =>
        prev.map((c) => {
          if (c.status !== "RUNNING") return c;
          const model = MODEL_BY_ID(c.model);
          const drift = (Math.random() * 2 - 1) * 0.02;
          const confidence = clamp(c.confidence + drift, 0.3, 0.99);
          const finished = confidence >= model.threshold;
          if (!finished) return { ...c, confidence };
          return {
            ...c,
            confidence,
            status: c.priority === "critical" ? "ESCALATED" : "REVIEW",
            findings: ["Inference complete - awaiting radiologist confirmation"],
            impression: "Auto-flagged for human review",
            action: "Radiologist queue prioritised by confidence + priority",
          };
        })
      );

      if (Math.random() < 0.28) {
        const pool = patientsRef.current;
        if (pool.length > 0) {
          const p = pool[Math.floor(Math.random() * pool.length)];
          const level = scoreToLevel(computeRisk(p, overridesRef.current));
          if (level === "critical" || level === "high") {
            pushAlert(
              `${p.name} risk ${level}`,
              `Acuity ${computeRisk(p, overridesRef.current)} on ${p.ward} ${p.bed} - reassess vitals now`,
              level
            );
          }
        }
      }

      if (Math.random() < 0.12) {
        pushAlert(
          "Triage queue updated",
          "New study routed to Diagnostic Overwatch from ER auto-order",
          "low"
        );
      }
    }, 3000 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, pushAlert]);

  const resetSimulation = useCallback(() => {
    setCases(DIAGNOSTIC_CASES.map((c) => ({ ...c, confidence: c.confidence, status: c.status })));
    setPatients(INITIAL_PATIENTS.map((p) => ({ ...p, vitals: { ...p.vitals } })));
    setAlerts(INITIAL_ALERTS);
    setOverrides({});
    setTick(0);
    pushToast("Simulation reset", "Seeded cohort and triage queue restored to baseline", "medium");
  }, [pushToast]);

  const handleToggleFactor = useCallback((patientId, factorKey, value) => {
    setOverrides((prev) => ({
      ...prev,
      [patientId]: { ...(prev[patientId] || {}), [factorKey]: value },
    }));
    pushToast("Risk factor updated", `${factorKey} ${value ? "enabled" : "disabled"} - acuity score recomputed`, "low");
  }, [pushToast]);

  const handleResetFactors = useCallback((patientId) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[patientId];
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    setExporting(true);
    const rows = activeTab === "risk" ? patients : cases;
    const header = activeTab === "risk"
      ? ["id", "name", "mrn", "ward", "bed", "diagnosis", "hr", "rr", "spo2", "sbp", "temp", "glucose", "acuity"]
      : ["id", "patient", "mrn", "study", "modality", "confidence", "status", "priority"];
    const table = [
      header,
      ...rows.map((r) =>
        (activeTab === "risk"
          ? [r.id, r.name, r.mrn, r.ward, r.bed, r.diagnosis, r.vitals.hr, r.vitals.rr, r.vitals.spo2, r.vitals.sbp, r.vitals.temp, r.vitals.glucose, computeRisk(r, overrides)]
          : [r.id, r.patientName, r.mrn, r.study, r.modality, r.confidence.toFixed(3), r.status, r.priority]
        )
      ),
    ];
    downloadCsv(`medtrack-${activeTab}-export-${Date.now()}.csv`, table);
    window.setTimeout(() => {
      setExporting(false);
      pushToast("Export complete", `${rows.length} rows written to CSV · audit entry logged`, "low");
    }, 450);
  }, [activeTab, cases, patients, overrides, pushToast]);

  const stats = useMemo(() => {
    const pending = cases.filter((c) => c.status === "RUNNING" || c.status === "REVIEW").length;
    const critical = patients.filter((p) => scoreToLevel(computeRisk(p, overrides)) === "critical").length;
    const liveModels = AI_MODELS.filter((m) => m.status !== "Clinical Hold").length;
    const p50 = Math.round(AI_MODELS.reduce((a, m) => a + m.latencyMs, 0) / AI_MODELS.length);
    return { pending, critical, liveModels, p50, tick };
  }, [cases, patients, overrides, tick]);

  const activeMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-sky-400 shadow-lg shadow-sky-500/10">
                <Brain size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Biomedical &amp; Clinical AI Hub</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <LiveStatus playing={playing} tick={tick} livePrefix="Live · inference tick #" />
                  <span className="text-slate-600">·</span>
                  <span>Diagnostic Overwatch · Risk Models · EHR · Model Fleet</span>
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
          <StatCard icon={ScanLine} label="Queue under review" value={stats.pending} sub={`${cases.filter((c) => c.status === "RUNNING").length} inferring now`} tone="sky" />
          <StatCard icon={AlertTriangle} label="Critical-risk patients" value={stats.critical} sub={`of ${patients.length} in the risk cohort`} tone="rose" />
          <StatCard icon={Cpu} label="Models live" value={stats.liveModels} sub={`${AI_MODELS.length} deployed fleet-wide`} tone="emerald" />
          <StatCard icon={Gauge} label="Inference p50" value={`${stats.p50}ms`} sub={`across ${fmtNumber(AI_MODELS.reduce((a, m) => a + m.callsToday, 0))} calls today`} tone="amber" />
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="mt-8">
          <TabsBar tabs={TABS} active={activeTab} onChange={setActiveTab} accent="sky" />

          {/* ---------- Toolbar ---------- */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${activeMeta.label.toLowerCase()}…`} />
              <SeverityChips value={severity} onChange={setSeverity} meta={SEVERITY_META} />
            </div>
            <p className="text-[11px] text-slate-500">{activeMeta.blurb}</p>
          </div>

          {/* ---------- Active tab content ---------- */}
          <div className="mt-5">
            {activeTab === "overwatch" && (
              <DiagnosticOverwatchTab cases={cases} search={search} severity={severity} onInspect={setInspect} />
            )}
            {activeTab === "risk" && (
              <PatientRiskTab
                patients={patients}
                search={search}
                severity={severity}
                overrides={overrides}
                onInspect={setInspect}
                onToggleFactor={handleToggleFactor}
                onResetFactors={handleResetFactors}
              />
            )}
            {activeTab === "ehr" && (
              <EhrInsightsTab
                records={records}
                search={search}
                severity={severity}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                onInspect={setInspect}
              />
            )}
            {activeTab === "models" && (
              <ModelRegistryTab search={search} onInspect={setInspect} />
            )}
          </div>
        </div>

        {/* ---------- Live alert feed ---------- */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Bell size={14} className="text-amber-400" /> Live alert feed
            </p>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{alerts.length} events</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {alerts.map((a) => {
              const meta = SEVERITY_META[a.severity] || SEVERITY_META.medium;
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200">{a.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{a.body}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold ${meta.text}`}>{meta.label}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-600">{formatClock(a.time)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Toast stack ---------- */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} severityMeta={SEVERITY_META} />

      {/* ---------- Inspection modal ---------- */}
      {inspect && (
        (() => {
          if (inspect.radiologist) {
            const c = inspect;
            const model = MODEL_BY_ID(c.model);
            const sev = SEVERITY_META[c.priority] || SEVERITY_META.medium;
            return (
              <Modal open onClose={() => setInspect(null)} title={c.study} subtitle={`${c.patientName} · ${c.mrn} · routed ${c.elapsed} min ago`} icon={ScanLine} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={c.status} map={STATUS_META} fallback={STATUS_META.RUNNING} />
                    <Badge tone={c.priority}>Priority: {c.priority}</Badge>
                    <span className="text-[11px] text-slate-500">Modality {c.modality} · Requested by {c.requestedBy}</span>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Model inference</p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-300"><Cpu size={13} className="text-sky-400" /> {model.name} v{model.version}</span>
                        <span className="text-slate-500">threshold {model.threshold.toFixed(2)}</span>
                      </div>
                      <div className="mt-2">
                        <ConfidenceBar value={c.confidence} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Findings</p>
                    <ul className="space-y-1.5">
                      {c.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Impression</p>
                    <p className="mt-1 text-xs text-slate-200">{c.impression}</p>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recommended action</p>
                    <p className="mt-1 text-xs text-sky-300">{c.action}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20">
                      <CheckCircle2 size={14} /> Approve read
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20">
                      <Eye size={14} /> Request re-read
                    </button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <Lock size={14} /> Open in PACS
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.vitals) {
            const p = inspect;
            const score = computeRisk(p, overrides);
            const level = scoreToLevel(score);
            const sev = SEVERITY_META[level] || SEVERITY_META.medium;
            return (
              <Modal open onClose={() => setInspect(null)} title={p.name} subtitle={`${p.age}y ${p.sex} · ${p.mrn} · ${p.ward} ${p.bed}`} icon={HeartPulse} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={level}>Acuity {score}/99 · {sev.label}</Badge>
                    <span className="text-[11px] text-slate-500">Admitting: {p.diagnosis}</span>
                    <span className="text-[11px] text-slate-500">LOS {p.losDays.toFixed(1)} days</span>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Live vitals snapshot</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[
                        { k: "hr", label: "Heart rate", unit: "bpm" }, { k: "rr", label: "Resp rate", unit: "/min" }, { k: "spo2", label: "SpO₂", unit: "%" }, { k: "sbp", label: "Systolic BP", unit: "mmHg" }, { k: "temp", label: "Temp", unit: "°C" }, { k: "glucose", label: "Glucose", unit: "mg/dL" },
                      ].map(({ k, label, unit }) => (
                        <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                          <p className="text-lg font-black text-white tabular-nums">{p.vitals[k]}</p>
                          <p className="text-[10px] text-slate-500">{label} <span className="text-slate-600">({unit})</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Score trajectory</p>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <MiniSparkline points={seededSeries(p.id.length + p.baseRisk, 24, Math.max(20, p.baseRisk - 12), 16)} tone={level === "critical" ? "rose" : level === "high" ? "amber" : "sky"} width={220} height={48} filled={false} />
                      <span className={`text-xl font-black tabular-nums ${sev.text}`}>{score}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Active risk factors</p>
                    <div className="flex flex-wrap gap-2">
                      {p.factors.filter((f) => (overrides[p.id]?.[f.key] !== undefined ? overrides[p.id][f.key] : true)).map((f) => (
                        <span key={f.key} className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                          {f.label} <span className="text-slate-500">+{f.weight}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Bell size={14} /> Watch patient
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FileText size={14} /> Open chart
                    </button>
                    {typeof onNavigate === "function" && (
                      <button
                        onClick={() => onNavigate("analytics")}
                        className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
                      >
                        <BarChart3 size={14} /> Analytics
                      </button>
                    )}
                  </div>
                </div>
              </Modal>
            );
          }
          if (inspect.cleared !== undefined) {
            const m = inspect;
            return (
              <Modal open onClose={() => setInspect(null)} title={m.name} subtitle={`${m.id} · v${m.version} · ${m.status}`} icon={Cpu} wide>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={m.drift > 0.05 ? "high" : m.drift > 0.02 ? "medium" : "low"}>
                      Data drift {m.drift.toFixed(3)} PSI
                    </Badge>
                    <span className="text-[11px] text-slate-500">{m.domain} · {m.modality}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <p className="text-lg font-black text-white tabular-nums">{m.auc.toFixed(3)}</p>
                      <p className="text-[10px] text-slate-500">AUC</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <p className="text-lg font-black text-white tabular-nums">{m.f1.toFixed(3)}</p>
                      <p className="text-[10px] text-slate-500">F1</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <p className="text-lg font-black text-white tabular-nums">{m.latencyMs}<span className="text-xs text-slate-500">ms</span></p>
                      <p className="text-[10px] text-slate-500">Inference p50</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                      <p className="text-lg font-black text-white tabular-nums">{fmtNumber(m.callsToday)}</p>
                      <p className="text-[10px] text-slate-500">Calls today</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                    <InfoRow label="Deployment zone" value={m.deployZone} />
                    <InfoRow label="Decision threshold" value={m.threshold.toFixed(2)} mono />
                    <InfoRow label="Regulatory clearance" value={m.cleared} />
                    <InfoRow label="Last validation pass" value={m.lastValidated} mono />
                    <InfoRow label="Drift band" value={`${m.drift.toFixed(3)} PSI ${m.drift > 0.05 ? "(review required)" : m.drift > 0.02 ? "(monitor)" : "(stable)"}`} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <button className="flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20">
                      <Activity size={14} /> Open telemetry
                    </button>
                    <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                      <FlaskConical size={14} /> Validation suite
                    </button>
                  </div>
                </div>
              </Modal>
            );
          }
          const r = inspect;
          const meta = RECORD_TYPE_META[r.type] || RECORD_TYPE_META["Progress Note"];
          return (
            <Modal open onClose={() => setInspect(null)} title={r.title} subtitle={`${r.patientName} · ${r.mrn} · ${r.provider}`} icon={meta.icon} wide>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {r.critical && <Badge tone="critical">Critical value</Badge>}
                  <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[10px] font-semibold text-slate-300">{r.type}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500"><Clock size={12} /> {formatClock(r.timestamp)} · {r.dept}</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs leading-relaxed text-slate-200">{r.body}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{t}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <button className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20">
                    <Workflow size={14} /> Start care pathway
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                    <ShieldCheck size={14} /> Audit trail
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
            <ShieldCheck size={12} className="text-emerald-500" />
            Simulated environment · no PHI transmitted · FHIR R4 output contract enforced
          </p>
          <p className="flex items-center gap-1.5">
            <Lock size={12} /> All inference decisions remain under clinician oversight (21 CFR 820 · EU MDR)
          </p>
        </div>
      </div>
    </div>
  );
}
