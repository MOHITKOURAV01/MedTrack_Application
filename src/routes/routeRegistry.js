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
const ProcurementLifecycleTimeline = lazy(() => import("../pages/hospital/ProcurementLifecycleTimeline"));

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
const NephrologyCrrtStationPage = lazy(() => import("../pages/renal/NephrologyCrrtStationPage"));
const PharmacySupplyHub = lazy(() => import("../pages/pharmacy/PharmacySupplyHub"));
const OncologyInfusionHub = lazy(() => import("../pages/oncology/OncologyInfusionHub"));
const PrecisionOncologyMolecularHub = lazy(() => import("../pages/oncology/PrecisionOncologyMolecularHub"));
const ColdChainCommandHub = lazy(() => import("../pages/coldchain/ColdChainCommandHub"));
const ClinicalTrialHub = lazy(() => import("../pages/research/ClinicalTrialHub"));
const EmergencyTriageHub = lazy(() => import("../pages/emergency/EmergencyTriageHub"));
const EmergencyDisasterMciCommandHub = lazy(() => import("../pages/emergency/EmergencyDisasterMciCommandHub"));

// Consoles that existed under src/pages/ with no route entry. An import alone is not
// reachability - DialysisRenalHub and SterileProcessingHub sat on main imported and unreferenced -
// so each of these has an entry in ROUTES below.
const AnesthesiologyPacuHub = lazy(() => import("../pages/anesthesiology/AnesthesiologyPacuHub"));
const BioAiDiagnosticsHub = lazy(() => import("../pages/bioai/BioAiDiagnosticsHub"));
const CardiovascularHemodynamicsHub = lazy(() => import("../pages/hemodynamics/CardiovascularHemodynamicsHub"));
const NephrologyCrrtHub = lazy(() => import("../pages/nephrology/NephrologyCrrtHub"));
const NeuroIcuIcpHub = lazy(() => import("../pages/neuro/NeuroIcuIcpHub"));
const PrecisionOncologyHub = lazy(() => import("../pages/oncology/PrecisionOncologyHub"));
const PediatricIcuTelemetryHub = lazy(() => import("../pages/picu/PediatricIcuTelemetryHub"));
const DisasterTriageIncidentCommandHub = lazy(() => import("../pages/triage/DisasterTriageIncidentCommandHub"));
const ZeroTrustBiomedicalSecurityHub = lazy(() => import("../pages/security/ZeroTrustBiomedicalSecurityHub"));
const RegulatoryAuditHub = lazy(() => import("../pages/audit/RegulatoryAuditHub"));
const HospitalCommandOrchestrationSuitePage = lazy(() => import("../pages/command/HospitalCommandOrchestrationSuitePage"));
const LabAutomationHub = lazy(() => import("../pages/lab/LabAutomationHub"));
const PediatricNeonatalIcuHubPage = lazy(() => import("../pages/pediatric/PediatricNeonatalIcuHubPage"));
const PediatricIcuHfovCommandHub = lazy(() => import("../pages/pediatric/PediatricIcuHfovCommandHub"));
const PharmacovigilanceHub = lazy(() => import("../pages/pharmacovigilance/PharmacovigilanceHub"));
const MedicationSupplyColdChainHubPage = lazy(() => import("../pages/supply/MedicationSupplyColdChainHubPage"));
const SurgicalRoboticsHub = lazy(() => import("../pages/surgical/SurgicalRoboticsHub"));
const TelehealthRemoteMonitoringHubPage = lazy(() => import("../pages/telehealth/TelehealthRemoteMonitoringHubPage"));
const GenomicClinicalTrialsHubPage = lazy(() => import("../pages/trials/GenomicClinicalTrialsHubPage"));
const NeonatalNicuHub = lazy(() => import("../pages/neonatal/NeonatalNicuHub"));
const BiomedicalAiDiagnosticsOverwatchPage = lazy(() => import("../pages/ai/BiomedicalAiDiagnosticsOverwatchPage"));
const BackendAuthenticationSecurityInfrastructurePage = lazy(() => import("../pages/auth/BackendAuthenticationSecurityInfrastructurePage"));
const EnterpriseZeroTrustSecurityGovernancePage = lazy(() => import("../pages/auth/EnterpriseZeroTrustSecurityGovernancePage"));
const BloodBankHub = lazy(() => import("../pages/bloodbank/BloodBankHub"));
const BloodBankTransfusionHub = lazy(() => import("../pages/bloodbank/BloodBankTransfusionHub"));
const CardiologyCathLabHub = lazy(() => import("../pages/cardiology/CardiologyCathLabHub"));
const CardiovascularHemodynamicsEcmoPage = lazy(() => import("../pages/cardiology/CardiovascularHemodynamicsEcmoPage"));
const ICUTelemetryOverwatchHubPage = lazy(() => import("../pages/hospital/ICUTelemetryOverwatchHubPage"));
const PathologyDigitalHub = lazy(() => import("../pages/pathology/PathologyDigitalHub"));
const PatientEhrAnalyticsPredictivePage = lazy(() => import("../pages/patient/PatientEhrAnalyticsPredictivePage"));
const GenomicsPrecisionHub = lazy(() => import("../pages/genomics/GenomicsPrecisionHub"));
const OphthalmologyVisionHub = lazy(() => import("../pages/ophthalmology/OphthalmologyVisionHub"));
const RegulatoryAuditProvenanceHub = lazy(() => import("../pages/audit/RegulatoryAuditProvenanceHub"));
const ComplianceProvenanceLedgerHub = lazy(() => import("../pages/audit/ComplianceProvenanceLedgerHub"));
const BehavioralHealthHub = lazy(() => import("../pages/behavioral/BehavioralHealthHub"));
const DentalOralHub = lazy(() => import("../pages/dental/DentalOralHub"));
const PatientEhrAnalyticsHub = lazy(() => import("../pages/ehr/PatientEhrAnalyticsHub"));
const ClinicalNlpSubsystemHub = lazy(() => import("../pages/nlp/ClinicalNlpSubsystemHub"));
const PopulationHealthHub = lazy(() => import("../pages/pophealth/PopulationHealthHub"));
const RehabPtHub = lazy(() => import("../pages/rehab/RehabPtHub"));
const EnterpriseSecurityHub = lazy(() => import("../pages/security/EnterpriseSecurityHub"));
const EnterpriseSecurityComplianceHub = lazy(() => import("../pages/security/EnterpriseSecurityComplianceHub"));
const TelehealthRemotePatientHub = lazy(() => import("../pages/telehealth/TelehealthRemotePatientHub"));
const MaternityObgynHub = lazy(() => import("../pages/maternity/MaternityObgynHub"));
const NutritionDieteticsHub = lazy(() => import("../pages/nutrition/NutritionDieteticsHub"));
const DermatologyHub = lazy(() => import("../pages/dermatology/DermatologyHub"));
const AudiologyEntHub = lazy(() => import("../pages/ent/AudiologyEntHub"));
const UrologyHub = lazy(() => import("../pages/urology/UrologyHub"));

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
const EndocrinologyMetabolicHub = lazy(() => import("../pages/endocrinology/EndocrinologyMetabolicHub"));


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
  { page: "procurement-timeline", slugs: ["procurement-timeline"], component: ProcurementLifecycleTimeline, access: HOSPITAL_ONLY, param: "requestId" },
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
  { page: "biomedical-ai-diagnostics", slugs: ["biomedical-ai-diagnostics", "ai-diagnostics", "ai-diagnostics-overwatch"], component: BiomedicalAiDiagnosticsOverwatchPage, access: AUTHENTICATED },
  { page: "blood-bank", slugs: ["blood-bank", "transfusion", "bloodbank", "haemovigilance"], component: BloodBankHub, access: AUTHENTICATED },
  { page: "blood-bank-transfusion", slugs: ["blood-bank-transfusion", "transfusion-medicine"], component: BloodBankTransfusionHub, access: AUTHENTICATED },
  { page: "cardiology-cath-lab", slugs: ["cardiology-cath-lab", "cath-lab", "cardiology", "cardiology-cathlab"], component: CardiologyCathLabHub, access: AUTHENTICATED },
  { page: "cardiovascular-hemodynamics-ecmo", slugs: ["cardiovascular-hemodynamics-ecmo", "hemodynamics-ecmo", "ecmo-station"], component: CardiovascularHemodynamicsEcmoPage, access: AUTHENTICATED },
  { page: "icu-telemetry-overwatch", slugs: ["icu-telemetry-overwatch", "icu-overwatch"], component: ICUTelemetryOverwatchHubPage, access: AUTHENTICATED },
  { page: "pathology-digital", slugs: ["pathology-digital", "pathology", "digital-pathology"], component: PathologyDigitalHub, access: AUTHENTICATED },
  { page: "patient-ehr-analytics", slugs: ["patient-ehr-analytics", "ehr-analytics"], component: PatientEhrAnalyticsPredictivePage, access: AUTHENTICATED },
  { page: "dialysis-renal", slugs: ["dialysis-renal", "dialysis", "nephrology", "renal-replacement"], component: DialysisRenalHub, access: AUTHENTICATED },
  { page: "nephrology-crrt-dialysis", slugs: ["nephrology-crrt-dialysis", "crrt-dialysis", "crrt-station"], component: NephrologyCrrtStationPage, access: AUTHENTICATED },
  { page: "sterile-processing", slugs: ["sterile-processing", "cssd", "instrument-traceability"], component: SterileProcessingHub, access: AUTHENTICATED },
  { page: "genomics-precision", slugs: ["genomics-precision", "precision-medicine", "genomic-medicine"], component: GenomicsPrecisionHub, access: AUTHENTICATED },
  { page: "emergency-disaster-mci", slugs: ["emergency-disaster-mci", "disaster-triage", "mci-command"], component: EmergencyDisasterMciCommandHub, access: AUTHENTICATED },

  // --- consoles restored from src/pages/ ------------------------------------
  // Each of these was a finished component that no URL reached. Slugs avoid the near misses that
  // already exist in the table: "nephrology" belongs to dialysis-renal, "pediatric-icu" to
  // pediatric-neonatal-icu, "disaster-triage" to emergency-disaster-mci, and "hemodynamics-ecmo"
  // to cardiovascular-hemodynamics-ecmo.
  { page: "anesthesiology-pacu", slugs: ["anesthesiology-pacu", "pacu", "anesthesiology"], component: AnesthesiologyPacuHub, access: AUTHENTICATED },
  { page: "bioai-diagnostics", slugs: ["bioai-diagnostics", "bio-ai", "ai-pathology"], component: BioAiDiagnosticsHub, access: AUTHENTICATED },
  { page: "cardiovascular-hemodynamics", slugs: ["cardiovascular-hemodynamics", "hemodynamics", "swan-ganz"], component: CardiovascularHemodynamicsHub, access: AUTHENTICATED },
  { page: "nephrology-crrt", slugs: ["nephrology-crrt", "crrt", "aki-overwatch"], component: NephrologyCrrtHub, access: AUTHENTICATED },
  { page: "neuro-icu-icp", slugs: ["neuro-icu-icp", "neuro-icu", "icp-monitoring"], component: NeuroIcuIcpHub, access: AUTHENTICATED },
  { page: "precision-oncology", slugs: ["precision-oncology", "molecular-tumour-board", "tumour-board"], component: PrecisionOncologyHub, access: AUTHENTICATED },
  { page: "pediatric-icu-telemetry", slugs: ["pediatric-icu-telemetry", "picu", "picu-telemetry"], component: PediatricIcuTelemetryHub, access: AUTHENTICATED },
  { page: "disaster-triage-command", slugs: ["disaster-triage-command", "mci-triage", "incident-command"], component: DisasterTriageIncidentCommandHub, access: AUTHENTICATED },

  // --- consoles restored from the orphan set ------------------------------------
  // Finished page components that had no entry here at all, so no URL reached them. Each is
  // authenticated rather than role-scoped, matching every other clinical console.
  { page: "ophthalmology-vision", slugs: ["ophthalmology-vision", "ophthalmology", "eye-unit"], component: OphthalmologyVisionHub, access: AUTHENTICATED },
  { page: "regulatory-audit-provenance", slugs: ["regulatory-audit-provenance", "audit-provenance", "provenance-ledger"], component: RegulatoryAuditProvenanceHub, access: AUTHENTICATED },
  { page: "compliance-provenance-ledger", slugs: ["compliance-provenance-ledger", "c2pa-hipaa", "provenance-audit"], component: ComplianceProvenanceLedgerHub, access: AUTHENTICATED },
  { page: "behavioral-health", slugs: ["behavioral-health", "behavioral", "mental-health"], component: BehavioralHealthHub, access: AUTHENTICATED },
  { page: "dental-oral", slugs: ["dental-oral", "dental", "oral-surgery"], component: DentalOralHub, access: AUTHENTICATED },
  { page: "patient-ehr-analytics-hub", slugs: ["patient-ehr-analytics-hub", "ehr-hub", "ehr-analytics-hub"], component: PatientEhrAnalyticsHub, access: AUTHENTICATED },
  { page: "clinical-nlp", slugs: ["clinical-nlp", "nlp", "nlp-subsystem"], component: ClinicalNlpSubsystemHub, access: AUTHENTICATED },
  { page: "population-health", slugs: ["population-health", "pop-health", "care-management"], component: PopulationHealthHub, access: AUTHENTICATED },
  { page: "rehab-pt", slugs: ["rehab-pt", "rehabilitation", "physical-therapy"], component: RehabPtHub, access: AUTHENTICATED },
  { page: "enterprise-security-hub", slugs: ["enterprise-security-hub", "enterprise-security", "security-command"], component: EnterpriseSecurityHub, access: AUTHENTICATED },
  { page: "enterprise-security-compliance", slugs: ["enterprise-security-compliance", "sec-compliance", "zero-trust-kms"], component: EnterpriseSecurityComplianceHub, access: AUTHENTICATED },
  { page: "telehealth-remote-patient", slugs: ["telehealth-remote-patient", "remote-patient", "telehealth-patient"], component: TelehealthRemotePatientHub, access: AUTHENTICATED },
  { page: "maternity-obgyn", slugs: ["maternity-obgyn", "ob-gyn", "maternity", "labor-delivery"], component: MaternityObgynHub, access: AUTHENTICATED },
  { page: "nutrition-dietetics", slugs: ["nutrition-dietetics", "nutrition", "dietetics", "clinical-nutrition"], component: NutritionDieteticsHub, access: AUTHENTICATED },
  { page: "dermatology", slugs: ["dermatology", "derm", "skin-clinic"], component: DermatologyHub, access: AUTHENTICATED },
  { page: "audiology-ent", slugs: ["audiology-ent", "ent", "audiology", "hearing-clinic"], component: AudiologyEntHub, access: AUTHENTICATED },
  { page: "endocrinology-metabolic", slugs: ["endocrinology-metabolic", "endo-metabolic", "diabetes-thyroid"], component: EndocrinologyMetabolicHub, access: AUTHENTICATED },
  { page: "urology", slugs: ["urology", "urology-clinic", "stone-clinic"], component: UrologyHub, access: AUTHENTICATED },

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
  { page: "zerotrust-biomedical-security", slugs: ["zerotrust-biomedical-security", "biomedical-zero-trust", "ebpf-microsegmentation"], component: ZeroTrustBiomedicalSecurityHub, access: HOSPITAL_ONLY },
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


/** The longest slug a route declares, used to order the prefix scan below. */
const longestSlug = (route) =>
  route.slugs.reduce((longest, slug) => Math.max(longest, slug.length), 0);

/**
 * Routes carrying a dynamic path segment, e.g. `/edit-equipment/EQ-1001`.
 *
 * Ordered longest-prefix-first so a route registered under a slug that begins with another route's
 * slug is considered first. This used to be a bare `filter`, which preserves declaration order and
 * sorts nothing, under a comment claiming the ordering as a guarantee. No two slugs currently shadow
 * each other, so it was latent - but the next parameterised route added under an existing prefix
 * would have taken the wrong branch, and silently.
 */
const PARAMETERISED_ROUTES = ROUTES.filter((route) => route.param).sort(
  (a, b) => longestSlug(b) - longestSlug(a)
);

/**
 * slug -> page key. Built once; duplicates are a build failure, see scripts/check-routes.js.
 *
 * Built in two passes, because the two kinds of route have different claims on a bare slug:
 *
 *   1. A route without a parameter owns its slug outright.
 *   2. A parameterised route claims its bare slug only where no list page has taken it.
 *
 * The second pass is the fix for #25. Parameterised routes used to be excluded entirely, on the
 * reasoning that a detail route shares its prefix with its list page and the bare slug belongs to
 * the list page. That is right for `blog`, which has one. Five of the six had no list page at all,
 * so nothing claimed their bare slug and it fell through to `not-found` - while `buildPath` happily
 * emitted that same bare slug whenever it was called without data:
 *
 *   buildPath("update-task", null)  ->  "/update-task"  ->  resolvePath  ->  "not-found"
 *
 * App.jsx sets `currentPage` in state *and* pushes that URL, so the page rendered correctly and the
 * URL was dead. The two only diverged on the next reload - which is when a technician who reached
 * "Update Task" from the navbar lost the page by pressing F5.
 *
 * A detail page reached without its record renders its own empty state: UpdateTask and OrderStatus
 * both open an id-search form, which is a perfectly good destination and is what the navbar links
 * were already relying on.
 */
export const SLUG_TO_PAGE = (() => {
  const table = {};

  ROUTES.filter((route) => !route.param).forEach((route) => {
    route.slugs.forEach((slug) => {
      table[slug] = route.page;
    });
  });

  ROUTES.filter((route) => route.param).forEach((route) => {
    route.slugs.forEach((slug) => {
      if (!Object.prototype.hasOwnProperty.call(table, slug)) {
        table[slug] = route.page;
      }
    });
  });

  return table;
})();

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
