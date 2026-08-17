// Single source of truth for SPA routing.
//
// Route information used to live in three places that had to be edited together and had drifted:
//
//   1. the `routeMap` object in src/App.jsx        (URL slug  -> page key)
//   2. the `switch` statement in src/routes/AppRoutes.jsx (page key -> component + role guard)
//   3. the import list at the top of AppRoutes.jsx (page key -> module)
//
// Nothing kept them consistent, and the accumulated drift was: two components rendered without ever
// being imported (a runtime ReferenceError), four route keys declared twice so the second was dead,
// and fourteen security consoles that existed as page components but were unreachable from any URL.
//
// One entry per page here means a new console cannot be half-registered: scripts/check-routes.js
// runs from `prebuild` and fails the build if a page under src/pages/auth/ is missing from this
// list, if two entries claim the same slug, or if a referenced component is never imported.

import { lazy } from "react";

const LandingPage = lazy(() => import("../pages/LandingPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const Blog = lazy(() => import("../pages/Blog"));
const BlogPost = lazy(() => import("../pages/BlogPost"));
const CareersPage = lazy(() => import("../pages/CareersPage"));
const JobApplicationPage = lazy(() => import("../pages/JobApplicationPage"));
const CertificateGeneratorPage = lazy(() => import("../pages/CertificateGeneratorPage"));
const AboutPage = lazy(() => import("../pages/AboutPage"));
const ContactPage = lazy(() => import("../pages/ContactPage"));
const GuidelinesPage = lazy(() => import("../pages/GuidelinesPage"));
const HelpCenterPage = lazy(() => import("../pages/HelpCenterPage"));
const AwardsPage = lazy(() => import("../pages/AwardsPage"));
const TermsPage = lazy(() => import("../pages/TermsPage"));
const GuidesPage = lazy(() => import("../pages/GuidesPage"));
const SecurityPage = lazy(() => import("../pages/SecurityPage"));
const SystemStatusPage = lazy(() => import("../pages/SystemStatusPage"));
const DualRangeSliderStudio = lazy(() => import("../components/common/DualRangeSliderStudio"));
const ResearchPage = lazy(() => import("../pages/ResearchPage"));
const SupplierCentrePage = lazy(() => import("../pages/SupplierCentrePage"));
const PrivacyPage = lazy(() => import("../pages/PrivacyPage"));
const CookieConsentPage = lazy(() => import("../pages/CookieConsentPage"));
const DoNotSellPage = lazy(() => import("../pages/DoNotSellPage"));

const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("../pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../pages/auth/ForgotPasswordPage"));
const VerifyOtpPage = lazy(() => import("../pages/auth/VerifyOtpPage"));
const ResetPasswordPage = lazy(() => import("../pages/auth/ResetPasswordPage"));

const Dashboard = lazy(() => import("../pages/hospital/Dashboard"));
const AnalyticsDashboard = lazy(() => import("../pages/hospital/AnalyticsDashboard"));
const EquipmentList = lazy(() => import("../pages/hospital/EquipmentList"));
const MaintenanceSchedule = lazy(() => import("../pages/hospital/MaintenanceSchedule"));
const AddEquipmentForm = lazy(() => import("../pages/hospital/AddEquipmentForm"));
const EditEquipmentForm = lazy(() => import("../pages/hospital/EditEquipmentForm"));
const ScheduleMaintenancePage = lazy(() => import("../pages/hospital/ScheduleMaintenancePage"));
const RequestEquipmentPage = lazy(() => import("../pages/hospital/RequestEquipmentPage"));
const PreventiveMaintenanceRules = lazy(() => import("../pages/hospital/PreventiveMaintenanceRules"));
const MaintenanceSlaDashboard = lazy(() => import("../pages/hospital/MaintenanceSlaDashboard"));
const EquipmentCalibrationHub = lazy(() => import("../pages/hospital/EquipmentCalibrationHub"));
const RetiredAssets = lazy(() => import("../pages/hospital/RetiredAssets"));
const EquipmentLifecyclePredictor = lazy(() => import("../pages/hospital/EquipmentLifecyclePredictor"));
const ProcurementRequestWizard = lazy(() => import("../pages/hospital/ProcurementRequestWizard"));
const ApprovalInbox = lazy(() => import("../pages/hospital/ApprovalInbox"));
const DynamicRiskDashboard = lazy(() => import("../pages/hospital/DynamicRiskDashboard"));

const TaskList = lazy(() => import("../pages/technician/TaskList"));
const UpdateTask = lazy(() => import("../pages/technician/UpdateTask"));

const OrdersList = lazy(() => import("../pages/supplier/OrdersList"));
const OrderStatus = lazy(() => import("../pages/supplier/OrderStatus"));
const TenderBids = lazy(() => import("../pages/supplier/TenderBids"));

const TenderList = lazy(() => import("../pages/hospital/TenderList"));
const TenderCreate = lazy(() => import("../pages/hospital/TenderCreate"));
const TenderDetail = lazy(() => import("../pages/hospital/TenderDetail"));

const TelehealthHub = lazy(() => import("../pages/telehealth/TelehealthHub"));
const SecurityComplianceHub = lazy(() => import("../pages/security/SecurityComplianceHub"));
const ClinicalAIHub = lazy(() => import("../pages/clinical/ClinicalAIHub"));
const BiomedicalAiGovernancePage = lazy(() => import("../pages/ai/BiomedicalAiGovernancePage"));
const QuantumCryptoKmsVaultPage = lazy(() => import("../pages/security/QuantumCryptoKmsVaultPage"));
const ConfidentialComputeEnclavePage = lazy(() => import("../pages/security/ConfidentialComputeEnclavePage"));
const CtemAttackSurfaceHubPage = lazy(() => import("../pages/security/CtemAttackSurfaceHubPage"));
const IcuVitalsTelemetryHubPage = lazy(() => import("../pages/telemetry/IcuVitalsTelemetryHubPage"));
const RadiologyImagingHub = lazy(() => import("../pages/radiology/RadiologyImagingHub"));
const SterileProcessingHub = lazy(() => import("../pages/sterile/SterileProcessingHub"));
const IcuTelemetryHub = lazy(() => import("../pages/icu/IcuTelemetryHub"));
const DialysisRenalHub = lazy(() => import("../pages/renal/DialysisRenalHub"));
const PharmacySupplyHub = lazy(() => import("../pages/pharmacy/PharmacySupplyHub"));
const OncologyInfusionHub = lazy(() => import("../pages/oncology/OncologyInfusionHub"));
const ColdChainCommandHub = lazy(() => import("../pages/coldchain/ColdChainCommandHub"));
const ClinicalTrialHub = lazy(() => import("../pages/research/ClinicalTrialHub"));
const EmergencyTriageHub = lazy(() => import("../pages/emergency/EmergencyTriageHub"));
const RegulatoryAuditHub = lazy(() => import("../pages/audit/RegulatoryAuditHub"));
const HospitalCommandOrchestrationSuitePage = lazy(() => import("../pages/command/HospitalCommandOrchestrationSuitePage"));
const LabAutomationHub = lazy(() => import("../pages/lab/LabAutomationHub"));
const PediatricNeonatalIcuHubPage = lazy(() => import("../pages/pediatric/PediatricNeonatalIcuHubPage"));
const PharmacovigilanceHub = lazy(() => import("../pages/pharmacovigilance/PharmacovigilanceHub"));
const MedicationSupplyColdChainHubPage = lazy(() => import("../pages/supply/MedicationSupplyColdChainHubPage"));
const SurgicalRoboticsHub = lazy(() => import("../pages/surgical/SurgicalRoboticsHub"));
const TelehealthRemoteMonitoringHubPage = lazy(() => import("../pages/telehealth/TelehealthRemoteMonitoringHubPage"));
const GenomicClinicalTrialsHubPage = lazy(() => import("../pages/trials/GenomicClinicalTrialsHubPage"));
const NeonatalNicuHub = lazy(() => import("../pages/neonatal/NeonatalNicuHub"));
const GenomicsPrecisionHub = lazy(() => import("../pages/genomics/GenomicsPrecisionHub"));

// Eleven consoles that were merged as page components and never given a registry entry, so no URL
// reached them and every one of them rendered the 404 page. They are grouped here rather than
// interleaved above because they were restored as a set, in one change, for one reason.
//
// This block was written twice - once here and once immediately above - because two pull requests
// restored the same eleven consoles in parallel and the merge took both. A duplicate `const` in
// module scope is a SyntaxError rather than a warning: the module never evaluated, so there was no
// bundle at all. One declaration of each survives, along with the comments explaining the two that
// are not self-evident.
const BiomedicalAiDiagnosticsOverwatchPage = lazy(() => import("../pages/ai/BiomedicalAiDiagnosticsOverwatchPage"));
const BloodBankHub = lazy(() => import("../pages/bloodbank/BloodBankHub"));
const BloodBankTransfusionHub = lazy(() => import("../pages/bloodbank/BloodBankTransfusionHub"));
const CardiologyCathLabHub = lazy(() => import("../pages/cardiology/CardiologyCathLabHub"));
// The binding name has to match the file name character for character: scripts/check-routes.js
// audits reachability by comparing the file stem under src/pages/ against the component bindings
// this module renders, so `IcuTelemetryOverwatchHubPage` would leave the page reported as orphaned.
const ICUTelemetryOverwatchHubPage = lazy(() => import("../pages/hospital/ICUTelemetryOverwatchHubPage"));
const PathologyDigitalHub = lazy(() => import("../pages/pathology/PathologyDigitalHub"));
const PatientEhrAnalyticsPredictivePage = lazy(() => import("../pages/patient/PatientEhrAnalyticsPredictivePage"));
// DialysisRenalHub and SterileProcessingHub are deliberately absent from this block: both were
// already imported above and then never referenced by a route, which is why they read as unused.
// Re-declaring either here is a SyntaxError, not a duplicate-looking line.
const BackendAuthenticationSecurityInfrastructurePage = lazy(() => import("../pages/auth/BackendAuthenticationSecurityInfrastructurePage"));
const EnterpriseZeroTrustSecurityGovernancePage = lazy(() => import("../pages/auth/EnterpriseZeroTrustSecurityGovernancePage"));

const RegulatoryAuditProvenanceHub = lazy(() => import("../pages/audit/RegulatoryAuditProvenanceHub"));
const BehavioralHealthHub = lazy(() => import("../pages/behavioral/BehavioralHealthHub"));
const DentalOralHub = lazy(() => import("../pages/dental/DentalOralHub"));
const PatientEhrAnalyticsHub = lazy(() => import("../pages/ehr/PatientEhrAnalyticsHub"));
const ClinicalNlpSubsystemHub = lazy(() => import("../pages/nlp/ClinicalNlpSubsystemHub"));
const PopulationHealthHub = lazy(() => import("../pages/pophealth/PopulationHealthHub"));
const RehabPtHub = lazy(() => import("../pages/rehab/RehabPtHub"));
const EnterpriseSecurityHub = lazy(() => import("../pages/security/EnterpriseSecurityHub"));
const TelehealthRemotePatientHub = lazy(() => import("../pages/telehealth/TelehealthRemotePatientHub"));

const AuthoritySecurityPage = lazy(() => import("../pages/auth/AuthoritySecurityPage"));
const MfaSecurityPage = lazy(() => import("../pages/auth/MfaSecurityPage"));
const EnterpriseSsoPage = lazy(() => import("../pages/auth/EnterpriseSsoPage"));
const RbacSecurityPage = lazy(() => import("../pages/auth/RbacSecurityPage"));
const ZeroTrustSecurityPage = lazy(() => import("../pages/auth/ZeroTrustSecurityPage"));
const ComplianceSecurityPage = lazy(() => import("../pages/auth/ComplianceSecurityPage"));
const ThreatDetectionSoarPage = lazy(() => import("../pages/auth/ThreatDetectionSoarPage"));
const KeyVaultSecurityPage = lazy(() => import("../pages/auth/KeyVaultSecurityPage"));
const SecurityKeyVaultPage = lazy(() => import("../pages/auth/SecurityKeyVaultPage"));
const DlpPrivacyGuardPage = lazy(() => import("../pages/auth/DlpPrivacyGuardPage"));
const PasskeyPasswordlessPage = lazy(() => import("../pages/auth/PasskeyPasswordlessPage"));
const ZeroTrustNetworkPage = lazy(() => import("../pages/auth/ZeroTrustNetworkPage"));
const MicrosegmentationPage = lazy(() => import("../pages/auth/MicrosegmentationPage"));
const ScimProvisioningPage = lazy(() => import("../pages/auth/ScimProvisioningPage"));
const SiemSecurityAnalyticsPage = lazy(() => import("../pages/auth/SiemSecurityAnalyticsPage"));
const GrcAuditCompliancePage = lazy(() => import("../pages/auth/GrcAuditCompliancePage"));
const SecurityPosturePage = lazy(() => import("../pages/auth/SecurityPosturePage"));
const SecurityCommandCenterPage = lazy(() => import("../pages/auth/SecurityCommandCenterPage"));
const VulnerabilityManagementPage = lazy(() => import("../pages/auth/VulnerabilityManagementPage"));
const SecurityVulnerabilityPage = lazy(() => import("../pages/auth/SecurityVulnerabilityPage"));
const PamPage = lazy(() => import("../pages/auth/PamPage"));
const SbomPage = lazy(() => import("../pages/auth/SbomPage"));
const CspmPage = lazy(() => import("../pages/auth/CspmPage"));
const SoarPage = lazy(() => import("../pages/auth/SoarPage"));
const SamlIdentityProviderPage = lazy(() => import("../pages/auth/SamlIdentityProviderPage"));
const ThreatIntelligencePage = lazy(() => import("../pages/auth/ThreatIntelligencePage"));
const SecurityThreatPage = lazy(() => import("../pages/auth/SecurityThreatPage"));
const SecurityGovernancePage = lazy(() => import("../pages/auth/SecurityGovernancePage"));
const SecurityObservabilityPage = lazy(() => import("../pages/auth/SecurityObservabilityPage"));
const SecurityPlaybookPage = lazy(() => import("../pages/auth/SecurityPlaybookPage"));
const IncidentResponsePlaybookPage = lazy(() => import("../pages/auth/IncidentResponsePlaybookPage"));
const ComplianceEvidencePage = lazy(() => import("../pages/auth/ComplianceEvidencePage"));
const ComplianceReportingPage = lazy(() => import("../pages/auth/ComplianceReportingPage"));
const SocOperationsConsolePage = lazy(() => import("../pages/auth/SocOperationsConsolePage"));


/**
 * Path prefix the bundle is served under on GitHub Pages.
 *
 * Declared here rather than in App.jsx so the two halves of the round trip - stripping it when
 * reading `window.location`, re-adding it when pushing state - can never disagree about what the
 * prefix is.
 */
export const BASE_PATH = "/MedTrack_Application";

/**
 * Access levels.
 *
 * PUBLIC        - no session required.
 * AUTHENTICATED - any signed-in role.
 * anything else - an array of lower-cased role names permitted on the route.
 */
export const PUBLIC = "public";
export const AUTHENTICATED = "authenticated";

/** Hospital-admin-only consoles: these manage policy for every account in the tenant. */
const HOSPITAL_ONLY = ["hospital"];

/**
 * Every route in the application.
 *
 * @property {string}   page      canonical page key, used as `currentPage`
 * @property {string[]} slugs     URL slugs resolving to this page; the first is canonical
 * @property {Function} component React component to render
 * @property {string|string[]} access PUBLIC, AUTHENTICATED, or an array of permitted roles
 * @property {boolean}  chrome    whether the navbar and footer are shown (defaults to true)
 * @property {string}   param     name of the dynamic path segment, if the route takes one
 * @property {string}   permission fine-grained permission code the session must hold
 *              (see src/security/permissions.js). Enforced by AppRoutes after the
 *              role check, so a permission revoked through the RBAC console locks
 *              the route immediately. Optional - most routes are role-gated only.
 */
export const ROUTES = [
  // --- public marketing and content -----------------------------------------
  { page: "landing", slugs: [""], component: LandingPage, access: PUBLIC },
  // Terminal route for an unrecognised slug. resolvePath() resolves to this rather than silently
  // showing the landing page, so a mistyped URL is visibly a mistyped URL.
  { page: "not-found", slugs: ["not-found"], component: NotFoundPage, access: PUBLIC },
  { page: "blog", slugs: ["blog"], component: Blog, access: PUBLIC },
  { page: "blog-post", slugs: ["blog"], component: BlogPost, access: PUBLIC, param: "slug" },
  { page: "careers", slugs: ["careers"], component: CareersPage, access: PUBLIC },
  { page: "apply", slugs: ["apply"], component: JobApplicationPage, access: PUBLIC, param: "jobId", chrome: false },
  { page: "certificate", slugs: ["certificate"], component: CertificateGeneratorPage, access: PUBLIC },
  { page: "about", slugs: ["about"], component: AboutPage, access: PUBLIC },
  { page: "contact", slugs: ["contact"], component: ContactPage, access: PUBLIC },
  { page: "guidelines", slugs: ["guidelines"], component: GuidelinesPage, access: PUBLIC },
  { page: "help", slugs: ["help", "help-center"], component: HelpCenterPage, access: PUBLIC },
  { page: "awards", slugs: ["awards"], component: AwardsPage, access: PUBLIC },
  { page: "terms", slugs: ["terms"], component: TermsPage, access: PUBLIC },
  { page: "privacy", slugs: ["privacy"], component: PrivacyPage, access: PUBLIC },
  { page: "cookies", slugs: ["cookies", "cookie-consent"], component: CookieConsentPage, access: PUBLIC },
  { page: "do-not-sell", slugs: ["do-not-sell"], component: DoNotSellPage, access: PUBLIC },
  { page: "research", slugs: ["research"], component: ResearchPage, access: PUBLIC },
  { page: "supplier-centre", slugs: ["supplier-centre"], component: SupplierCentrePage, access: PUBLIC },
  { page: "guides", slugs: ["guides"], component: GuidesPage, access: PUBLIC },
  { page: "security", slugs: ["security"], component: SecurityPage, access: PUBLIC },
  { page: "status", slugs: ["status"], component: SystemStatusPage, access: PUBLIC },
  { page: "dual-range-slider", slugs: ["dual-range-slider", "range-slider-studio"], component: DualRangeSliderStudio, access: PUBLIC },

  // --- authentication flows (no chrome: these are full-bleed layouts) --------
  { page: "login", slugs: ["login"], component: LoginPage, access: PUBLIC, chrome: false },
  { page: "register", slugs: ["register"], component: RegisterPage, access: PUBLIC, chrome: false },
  { page: "forgot-password", slugs: ["forgot-password"], component: ForgotPasswordPage, access: PUBLIC, chrome: false },
  { page: "verify-otp", slugs: ["verify-otp"], component: VerifyOtpPage, access: PUBLIC, chrome: false },
  { page: "reset-password", slugs: ["reset-password"], component: ResetPasswordPage, access: PUBLIC, chrome: false },

  // --- hospital ---------------------------------------------------------------
  { page: "dashboard", slugs: ["dashboard"], component: Dashboard, access: AUTHENTICATED, chrome: false },
  { page: "equipment", slugs: ["equipment"], component: EquipmentList, access: AUTHENTICATED, permission: "READ_EQUIPMENT" },
  { page: "maintenance", slugs: ["maintenance"], component: MaintenanceSchedule, access: AUTHENTICATED, permission: "READ_MAINTENANCE" },
  { page: "analytics", slugs: ["analytics"], component: AnalyticsDashboard, access: HOSPITAL_ONLY },
  { page: "add-equipment", slugs: ["add-equipment"], component: AddEquipmentForm, access: HOSPITAL_ONLY, permission: "WRITE_EQUIPMENT" },
  { page: "edit-equipment", slugs: ["edit-equipment"], component: EditEquipmentForm, access: HOSPITAL_ONLY, param: "equipmentId", permission: "WRITE_EQUIPMENT" },
  { page: "schedule-maintenance", slugs: ["schedule-maintenance"], component: ScheduleMaintenancePage, access: HOSPITAL_ONLY },
  { page: "request-equipment", slugs: ["request-equipment"], component: RequestEquipmentPage, access: HOSPITAL_ONLY },
  { page: "equipment-lifecycle", slugs: ["equipment-lifecycle", "lifecycle"], component: EquipmentLifecyclePredictor, access: HOSPITAL_ONLY },
  { page: "procurement-wizard", slugs: ["procurement-wizard"], component: ProcurementRequestWizard, access: HOSPITAL_ONLY },
  { page: "risk-dashboard", slugs: ["risk-dashboard", "la-razt"], component: DynamicRiskDashboard, access: HOSPITAL_ONLY },
  { page: "approval-inbox", slugs: ["approval-inbox"], component: ApprovalInbox, access: HOSPITAL_ONLY },
  { page: "maintenance-rules", slugs: ["maintenance-rules"], component: PreventiveMaintenanceRules, access: HOSPITAL_ONLY },
  { page: "sla-dashboard", slugs: ["sla-dashboard"], component: MaintenanceSlaDashboard, access: HOSPITAL_ONLY },
  { page: "calibration", slugs: ["calibration", "equipment-calibration"], component: EquipmentCalibrationHub, access: HOSPITAL_ONLY },
  { page: "retired-assets", slugs: ["retired-assets", "retired"], component: RetiredAssets, access: HOSPITAL_ONLY },
  { page: "tenders", slugs: ["tenders"], component: TenderList, access: HOSPITAL_ONLY },
  { page: "tender-create", slugs: ["tender-create", "new-tender"], component: TenderCreate, access: HOSPITAL_ONLY },
  { page: "tender-detail", slugs: ["tender"], component: TenderDetail, access: HOSPITAL_ONLY, param: "tenderId" },

  // --- telehealth & remote patient management consoles ------------------------
  { page: "telehealth", slugs: ["telehealth", "remote-care"], component: TelehealthHub, access: AUTHENTICATED },

  // --- enterprise security & compliance consoles -------------------------------
  //
  // One entry per console. Each of these three used to be declared three times over - once here,
  // once in the clinical block below and once in the "any authenticated role" block at the bottom -
  // with a different secondary slug each time. Only the first entry was ever reachable, so
  // /enclaves, /ctem-hub and /kms-vault all 404ed while looking registered. The alternative slugs
  // are folded into the single surviving entry instead of being dropped, because the sidebars and
  // the security hub already link to them.
  { page: "security-compliance", slugs: ["security-compliance", "security-hub"], component: SecurityComplianceHub, access: AUTHENTICATED },
  { page: "confidential-compute", slugs: ["confidential-compute", "confidential-compute-enclave", "enclaves", "secure-enclave"], component: ConfidentialComputeEnclavePage, access: AUTHENTICATED },
  { page: "ctem", slugs: ["ctem", "ctem-attack-surface", "ctem-hub", "attack-surface"], component: CtemAttackSurfaceHubPage, access: AUTHENTICATED },
  { page: "quantum-kms", slugs: ["quantum-kms", "quantum-crypto", "kms-vault"], component: QuantumCryptoKmsVaultPage, access: AUTHENTICATED },

  // --- clinical / operational hub consoles --------------------------------------
  { page: "icu-telemetry", slugs: ["icu-telemetry", "icu"], component: IcuTelemetryHub, access: AUTHENTICATED },
  { page: "icu-vitals-telemetry", slugs: ["icu-vitals-telemetry", "bedside-telemetry", "icu-vitals", "vitals-telemetry"], component: IcuVitalsTelemetryHubPage, access: AUTHENTICATED },
  { page: "clinical-ai", slugs: ["clinical-ai", "biomedical-ai"], component: ClinicalAIHub, access: AUTHENTICATED },
  { page: "biomedical-ai-governance", slugs: ["biomedical-ai-governance", "ai-governance"], component: BiomedicalAiGovernancePage, access: AUTHENTICATED },

  // --- radiology imaging & PACS console ----------------------------------------
  { page: "radiology-imaging", slugs: ["radiology-imaging", "pacs-hub", "imaging"], component: RadiologyImagingHub, access: AUTHENTICATED },
  { page: "pharmacy-supply", slugs: ["pharmacy-supply", "pharmacy"], component: PharmacySupplyHub, access: AUTHENTICATED },
  { page: "oncology-infusion", slugs: ["oncology-infusion", "chemotherapy-safety"], component: OncologyInfusionHub, access: AUTHENTICATED },
  { page: "cold-chain", slugs: ["cold-chain", "coldchain", "cryo-telemetry"], component: ColdChainCommandHub, access: AUTHENTICATED },
  { page: "clinical-trial", slugs: ["clinical-trial", "clinical-research"], component: ClinicalTrialHub, access: AUTHENTICATED },
  { page: "emergency-triage", slugs: ["emergency-triage", "triage-hub"], component: EmergencyTriageHub, access: AUTHENTICATED },
  // --- medtech & specialty consoles --------------------------------------------
  { page: "neonatal-nicu", slugs: ["neonatal-nicu", "nicu", "neonatology"], component: NeonatalNicuHub, access: AUTHENTICATED },
  { page: "regulatory-audit", slugs: ["regulatory-audit", "audit-hub", "provenance"], component: RegulatoryAuditHub, access: AUTHENTICATED },
  { page: "pharmacovigilance", slugs: ["pharmacovigilance", "drug-safety", "pv-hub"], component: PharmacovigilanceHub, access: AUTHENTICATED },
  { page: "surgical-robotics", slugs: ["surgical-robotics", "or-orchestration", "robotics"], component: SurgicalRoboticsHub, access: AUTHENTICATED },
  { page: "lab-automation", slugs: ["lab-automation", "lab-hub", "diagnostics"], component: LabAutomationHub, access: AUTHENTICATED },
  { page: "hospital-command", slugs: ["hospital-command", "command-orchestration"], component: HospitalCommandOrchestrationSuitePage, access: AUTHENTICATED },
  { page: "pediatric-neonatal-icu", slugs: ["pediatric-neonatal-icu", "pediatric-icu", "neonatal-icu"], component: PediatricNeonatalIcuHubPage, access: AUTHENTICATED },
  { page: "medication-cold-chain", slugs: ["medication-cold-chain", "med-supply-chain"], component: MedicationSupplyColdChainHubPage, access: AUTHENTICATED },
  { page: "telehealth-remote-monitoring", slugs: ["telehealth-remote-monitoring", "remote-monitoring"], component: TelehealthRemoteMonitoringHubPage, access: AUTHENTICATED },
  { page: "genomic-clinical-trials", slugs: ["genomic-clinical-trials", "genomics"], component: GenomicClinicalTrialsHubPage, access: AUTHENTICATED },
  { page: "genomics-precision", slugs: ["genomics-precision", "precision-medicine", "genomic-medicine"], component: GenomicsPrecisionHub, access: AUTHENTICATED },

  // --- consoles restored from the orphan set ------------------------------------
  // Eleven finished page components that had no entry here at all. Each is authenticated rather
  // than role-scoped, matching every other clinical console: biomedical engineering, nursing and
  // supplier-side staff all read them, and the pages carry no write actions against the API.
  //
  // These nine were registered twice, because two pull requests restored the same set in parallel
  // and the merge took both blocks. PAGE_TO_ROUTE and SLUG_TO_PAGE are both built with a reduce
  // that overwrites, so the second declaration silently won and the slugs on the first became
  // unreachable without anything failing - which is the failure mode this registry exists to make
  // impossible. One entry each survives, carrying the union of the slugs both blocks claimed, so
  // no URL that either PR published stops resolving.
  { page: "biomedical-ai-diagnostics", slugs: ["biomedical-ai-diagnostics", "ai-diagnostics-overwatch", "ai-diagnostics"], component: BiomedicalAiDiagnosticsOverwatchPage, access: AUTHENTICATED },
  { page: "blood-bank", slugs: ["blood-bank", "haemovigilance", "transfusion", "bloodbank"], component: BloodBankHub, access: AUTHENTICATED },
  { page: "blood-bank-transfusion", slugs: ["blood-bank-transfusion", "transfusion-medicine"], component: BloodBankTransfusionHub, access: AUTHENTICATED },
  { page: "cardiology-cath-lab", slugs: ["cardiology-cath-lab", "cath-lab", "cardiology", "cardiology-cathlab"], component: CardiologyCathLabHub, access: AUTHENTICATED },
  { page: "icu-telemetry-overwatch", slugs: ["icu-telemetry-overwatch", "icu-overwatch"], component: ICUTelemetryOverwatchHubPage, access: AUTHENTICATED },
  { page: "pathology-digital", slugs: ["pathology-digital", "digital-pathology", "pathology"], component: PathologyDigitalHub, access: AUTHENTICATED },
  { page: "patient-ehr-analytics", slugs: ["patient-ehr-analytics", "ehr-analytics"], component: PatientEhrAnalyticsPredictivePage, access: AUTHENTICATED },
  { page: "dialysis-renal", slugs: ["dialysis-renal", "dialysis", "renal-replacement", "nephrology"], component: DialysisRenalHub, access: AUTHENTICATED },
  { page: "sterile-processing", slugs: ["sterile-processing", "cssd", "instrument-traceability"], component: SterileProcessingHub, access: AUTHENTICATED },

  // --- consoles merged after the orphan set, registered here for the same reason ---------------
  // Nine more finished pages that arrived with no registry entry. Same defect, same consequence:
  // the file exists, nothing imports it, and every URL a user might try resolves to the 404 page.
  { page: "regulatory-audit-provenance", slugs: ["regulatory-audit-provenance", "provenance-ledger"], component: RegulatoryAuditProvenanceHub, access: AUTHENTICATED },
  { page: "behavioral-health", slugs: ["behavioral-health", "mental-health"], component: BehavioralHealthHub, access: AUTHENTICATED },
  { page: "dental-oral", slugs: ["dental-oral", "dental", "oral-surgery"], component: DentalOralHub, access: AUTHENTICATED },
  { page: "ehr-analytics-suite", slugs: ["ehr-analytics-suite", "ehr-suite"], component: PatientEhrAnalyticsHub, access: AUTHENTICATED },
  { page: "clinical-nlp", slugs: ["clinical-nlp", "nlp", "narrative-extraction"], component: ClinicalNlpSubsystemHub, access: AUTHENTICATED },
  { page: "population-health", slugs: ["population-health", "care-management"], component: PopulationHealthHub, access: AUTHENTICATED },
  { page: "rehab-physical-therapy", slugs: ["rehab-physical-therapy", "rehabilitation", "physio"], component: RehabPtHub, access: AUTHENTICATED },
  { page: "enterprise-security", slugs: ["enterprise-security", "security-kms"], component: EnterpriseSecurityHub, access: AUTHENTICATED },
  { page: "telehealth-remote-patient", slugs: ["telehealth-remote-patient", "remote-patient"], component: TelehealthRemotePatientHub, access: AUTHENTICATED },

  // --- technician -------------------------------------------------------------
  { page: "tasks", slugs: ["tasks"], component: TaskList, access: AUTHENTICATED, permission: "READ_MAINTENANCE" },
  { page: "update-task", slugs: ["update-task", "updatetask"], component: UpdateTask, access: AUTHENTICATED, param: "task", permission: "UPDATE_MAINTENANCE" },

  // --- supplier ---------------------------------------------------------------
  { page: "orders", slugs: ["orders"], component: OrdersList, access: AUTHENTICATED, permission: "READ_ORDERS" },
  { page: "orderstatus", slugs: ["orderstatus"], component: OrderStatus, access: AUTHENTICATED, param: "order", permission: "READ_ORDERS" },
  { page: "tender-bids", slugs: ["tender-bids", "open-tenders"], component: TenderBids, access: AUTHENTICATED },

  // --- security consoles: tenant-wide policy, hospital admin only -------------
  // Two of the eleven restored consoles are tenant-wide security governance rather than clinical
  // operations, so they are scoped to the hospital admin role like every other console in this
  // block rather than to any signed-in user.
  { page: "backend-auth-infrastructure", slugs: ["backend-auth-infrastructure", "auth-infrastructure", "backend-auth-security", "auth-security-infrastructure"], component: BackendAuthenticationSecurityInfrastructurePage, access: HOSPITAL_ONLY },
  { page: "zerotrust-governance", slugs: ["zerotrust-governance", "zero-trust-governance", "zero-trust"], component: EnterpriseZeroTrustSecurityGovernancePage, access: HOSPITAL_ONLY },
  { page: "authority-security", slugs: ["authority-security", "authority"], component: AuthoritySecurityPage, access: HOSPITAL_ONLY },
  { page: "sso-security", slugs: ["sso-security", "sso"], component: EnterpriseSsoPage, access: HOSPITAL_ONLY },
  { page: "rbac-security", slugs: ["rbac-security", "rbac"], component: RbacSecurityPage, access: HOSPITAL_ONLY },
  { page: "zerotrust-security", slugs: ["zerotrust-security", "zerotrust"], component: ZeroTrustSecurityPage, access: HOSPITAL_ONLY },
  { page: "saml-identity", slugs: ["saml", "saml-identity", "identity-federation"], component: SamlIdentityProviderPage, access: HOSPITAL_ONLY },
  { page: "scim-provisioning", slugs: ["scim-provisioning", "scim"], component: ScimProvisioningPage, access: HOSPITAL_ONLY },
  { page: "security-governance", slugs: ["governance", "security-governance"], component: SecurityGovernancePage, access: HOSPITAL_ONLY },

  // --- security consoles: any authenticated role ------------------------------
  { page: "mfa-security", slugs: ["mfa-security", "mfa"], component: MfaSecurityPage, access: AUTHENTICATED },
  { page: "compliance-security", slugs: ["compliance-security", "compliance"], component: ComplianceSecurityPage, access: AUTHENTICATED },
  { page: "threat-detection", slugs: ["threat-detection", "soar-security"], component: ThreatDetectionSoarPage, access: AUTHENTICATED },
  { page: "soar", slugs: ["soar", "orchestration"], component: SoarPage, access: AUTHENTICATED },
  { page: "keyvault-security", slugs: ["keyvault-security", "keyvault", "key-vault"], component: KeyVaultSecurityPage, access: AUTHENTICATED },
  { page: "security-keyvault", slugs: ["security-keyvault", "hsm"], component: SecurityKeyVaultPage, access: AUTHENTICATED },
  { page: "dlp-privacy", slugs: ["dlp-privacy", "dlp", "privacy-guard"], component: DlpPrivacyGuardPage, access: AUTHENTICATED },
  { page: "passkeys", slugs: ["passkeys", "passwordless", "webauthn"], component: PasskeyPasswordlessPage, access: AUTHENTICATED },
  { page: "ztna", slugs: ["ztna", "network-access"], component: ZeroTrustNetworkPage, access: AUTHENTICATED },
  { page: "microsegmentation", slugs: ["microsegmentation", "sdp", "perimeter-security"], component: MicrosegmentationPage, access: AUTHENTICATED },
  { page: "siem-analytics", slugs: ["siem-analytics", "siem", "siem-security"], component: SiemSecurityAnalyticsPage, access: AUTHENTICATED },
  { page: "grc-compliance", slugs: ["grc-compliance", "grc", "audit-ledger"], component: GrcAuditCompliancePage, access: AUTHENTICATED },
  { page: "security-posture", slugs: ["posture", "security-posture"], component: SecurityPosturePage, access: AUTHENTICATED },
  { page: "security-commandcenter", slugs: ["security-commandcenter", "command-center"], component: SecurityCommandCenterPage, access: AUTHENTICATED },
  { page: "vulnerability", slugs: ["vulnerability", "patch-management"], component: VulnerabilityManagementPage, access: AUTHENTICATED },
  { page: "security-vulnerability", slugs: ["cve-registry", "security-vulnerability"], component: SecurityVulnerabilityPage, access: AUTHENTICATED },
  { page: "pam", slugs: ["pam", "privileged-access", "jit-elevation"], component: PamPage, access: AUTHENTICATED },
  { page: "sbom", slugs: ["sbom", "supply-chain"], component: SbomPage, access: AUTHENTICATED },
  { page: "cspm", slugs: ["cspm", "cloud-posture"], component: CspmPage, access: AUTHENTICATED },
  { page: "threat-intelligence", slugs: ["threat-intel", "threat-intelligence"], component: ThreatIntelligencePage, access: AUTHENTICATED },
  { page: "security-threat", slugs: ["threats", "security-threat"], component: SecurityThreatPage, access: AUTHENTICATED },
  { page: "security-observability", slugs: ["observability", "security-observability"], component: SecurityObservabilityPage, access: AUTHENTICATED },
  { page: "security-playbook", slugs: ["playbooks", "security-playbook"], component: SecurityPlaybookPage, access: AUTHENTICATED },
  { page: "incident-response", slugs: ["incident-response", "ir-playbook"], component: IncidentResponsePlaybookPage, access: AUTHENTICATED },
  { page: "compliance-evidence", slugs: ["evidence", "compliance-evidence"], component: ComplianceEvidencePage, access: AUTHENTICATED },
  { page: "compliance-reporting", slugs: ["compliance-reporting", "reporting"], component: ComplianceReportingPage, access: AUTHENTICATED },
  { page: "soc-console", slugs: ["soc-console", "soc-command-center"], component: SocOperationsConsolePage, access: AUTHENTICATED },
];


/**
 * Routes carrying a dynamic path segment, e.g. `/edit-equipment/EQ-1001`.
 *
 * Ordered longest-prefix-first so `blog-post` is considered before any shorter prefix could
 * shadow it.
 */
const PARAMETERISED_ROUTES = ROUTES.filter((route) => route.param);

/** slug -> page key. Built once; duplicates are a build failure, see scripts/check-routes.js. */
export const SLUG_TO_PAGE = ROUTES.reduce((accumulator, route) => {
  route.slugs.forEach((slug) => {
    // A parameterised route shares its prefix with its list page (`blog` and `blog/:slug`);
    // the bare slug belongs to the list page, so never let the detail page claim it.
    if (!route.param) {
      accumulator[slug] = route.page;
    }
  });
  return accumulator;
}, {});

/** page key -> route definition. */
export const PAGE_TO_ROUTE = ROUTES.reduce((accumulator, route) => {
  accumulator[route.page] = route;
  return accumulator;
}, {});

export function getRoute(page) {
  return PAGE_TO_ROUTE[page];
}

/** Whether the navbar and footer should be rendered for a page. Defaults to true. */
export function hasChrome(page) {
  const route = getRoute(page);
  return route ? route.chrome !== false : true;
}

/**
 * Resolves a URL path (already stripped of any base path and surrounding slashes) to a
 * `{ page, data }` pair.
 *
 * Unknown paths resolve to `not-found` so a mistyped URL renders the 404 page instead of silently
 * showing the landing page, which is what the previous `routeMap[path] || "landing"` fallback did.
 */
export function resolvePath(path) {
  if (!path) {
    return { page: "landing", data: null };
  }

  const normalised = path.toLowerCase();

  for (const route of PARAMETERISED_ROUTES) {
    for (const slug of route.slugs) {
      const prefix = `${slug}/`;
      if (normalised.startsWith(prefix)) {
        return { page: route.page, data: decodeURIComponent(path.slice(prefix.length)) };
      }
    }
  }

  const page = SLUG_TO_PAGE[normalised];
  return page ? { page, data: null } : { page: "not-found", data: null };
}

/**
 * Builds the URL path for a navigation target. Inverse of {@link resolvePath}.
 */
export function buildPath(page, data) {
  const route = getRoute(page);
  if (!route) {
    return `/${page}`;
  }
  const slug = route.slugs[0];
  if (route.param && data) {
    return `/${slug}/${encodeURIComponent(data)}`;
  }
  return slug ? `/${slug}` : "/";
}

/**
 * Builds a full, base-path-aware URL for a navigation target.
 *
 * The app is served from a sub-path on GitHub Pages (BASE_PATH, e.g.
 * "/MedTrack_Application"), so a bare path like "/login" bypasses it and
 * 404s. Mirror App.jsx's base-path detection so fallback navigation (plain
 * <a href> targets and window.location redirects used when onNavigate is
 * unavailable) lands on the real route in both dev and the deployed site.
 */
export function buildHref(page, data) {
  const basePath = window.location.pathname.includes(BASE_PATH) ? BASE_PATH : "";
  return `${basePath}${buildPath(page, data)}`;
}

/**
 * The page that will actually be rendered for a request.
 *
 * AppRoutes substitutes the login screen for an unauthenticated hit on a protected route, and the
 * 404 page for an unknown slug. Layout chrome has to be decided from that substituted page rather
 * than the requested one: keying it off the request wrapped the full-bleed login screen in the
 * navbar and footer whenever a signed-out visitor hit /equipment. Both the router and App.jsx call
 * this, so the two cannot disagree about what is on screen.
 *
 * @param {object|null} user  the authenticated user, or null
 * @param {string} page       requested page key
 * @returns {string} the page key that will be rendered
 */
export function resolveEffectivePage(user, page) {
  if (!getRoute(page)) {
    return "not-found";
  }
  const { allowed, reason } = checkAccess(user, page);
  if (!allowed && reason === "unauthenticated") {
    return "login";
  }
  return page;
}

/**
 * Whether a user may view a page.
 *
 * @param {object|null} user  the authenticated user, or null
 * @param {string} page       page key
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function checkAccess(user, page) {
  const route = getRoute(page);
  if (!route || route.access === PUBLIC) {
    return { allowed: true, reason: null };
  }

  if (!user) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (route.access === AUTHENTICATED) {
    return { allowed: true, reason: null };
  }

  const role = (user.role || "").toLowerCase();
  if (route.access.includes(role)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: `This console is restricted to the ${route.access.join(", ")} role.`,
  };
}
