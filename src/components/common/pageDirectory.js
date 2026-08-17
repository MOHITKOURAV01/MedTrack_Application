/**
 * Human-readable names, search keywords and menu grouping for every reachable page.
 *
 * Why this module exists
 * ----------------------
 * The registry knows a console exists. Nothing knew what to call it, and nothing offered a way in.
 *
 * Thirty-four clinical and operational consoles - blood bank, dialysis, sterile processing, the cath
 * lab, digital pathology, the NICU, cold chain, oncology infusion, and the rest - are registered
 * routes with no entry anywhere in the navigation. The navbar carries six links for a hospital
 * admin, two for a technician and two for a supplier, and not one of them is a console. The only way
 * to reach any of them is to know the URL and type it.
 *
 * The command palette does index every route automatically, which is what kept them nominally
 * reachable, but it fell back to `humanize(page)` for anything without an entry in its label map -
 * fifty of the registered pages. That fallback produces "Icu Telemetry Overwatch" and "Ctem", and it
 * supplies no keywords at all, so the palette could not find the blood bank console from
 * "transfusion", the cold chain console from "freezer", or the dialysis console from "renal". A
 * search box that only matches the string you would have had to know already is not a way in
 * either.
 *
 * So this module is the one place a page's name lives:
 *
 *   - `PAGE_LABELS`  - every reachable page key -> { label, keywords }, consumed by the palette.
 *   - `CONSOLE_GROUPS` - the clinical and operational consoles arranged by care area, consumed by
 *                        the navbar menu.
 *
 * `CONSOLE_GROUPS` names page keys and nothing else; the label for each comes from `PAGE_LABELS`, so
 * the menu and the palette cannot disagree about what a console is called. A test asserts every key
 * in either structure is a registered route, and that every registered route has a label - the
 * `humanize` fallback stays in the palette as a safety net, but nothing is supposed to reach it.
 *
 * Keywords are the terms a clinician or a biomed would actually type, which is usually not the
 * console's name: "freezer" and "excursion" for cold chain, "crossmatch" and "transfusion" for the
 * blood bank, "autoclave" and "tray" for sterile processing, "kt/v" for dialysis.
 */

export const PAGE_LABELS = {
  landing: { label: "Home", keywords: "landing start welcome" },
  blog: { label: "Blog", keywords: "articles news posts" },
  careers: { label: "Careers", keywords: "jobs hiring positions apply" },
  certificate: { label: "Certificate Generator", keywords: "certificate training completion" },
  about: { label: "About", keywords: "company about us employers" },
  contact: { label: "Contact", keywords: "support reach email" },
  guidelines: { label: "Guidelines", keywords: "rules policy" },
  help: { label: "Help Center", keywords: "help faq support" },
  awards: { label: "Awards", keywords: "recognition honors" },
  terms: { label: "Terms of Service", keywords: "terms legal" },
  guides: { label: "Guides", keywords: "documentation how to" },
  security: { label: "Security", keywords: "security overview" },
  status: { label: "System Status", keywords: "uptime health status" },
  "dual-range-slider": { label: "Range Slider Studio", keywords: "dual range slider filter demo" },
  dashboard: { label: "Dashboard", keywords: "home overview" },
  equipment: { label: "Equipment", keywords: "inventory assets list" },
  maintenance: { label: "Maintenance Schedule", keywords: "maintenance calendar plan" },
  analytics: { label: "Analytics", keywords: "reports insights statistics" },
  "add-equipment": { label: "Add Equipment", keywords: "new asset create" },
  "schedule-maintenance": { label: "Schedule Maintenance", keywords: "new maintenance plan" },
  "request-equipment": { label: "Request Equipment", keywords: "purchase order request" },
  "maintenance-rules": { label: "Preventive Maintenance Rules", keywords: "pm rules automation" },
  "sla-dashboard": { label: "SLA Dashboard", keywords: "sla compliance service level" },
  calibration: { label: "Calibration Hub", keywords: "calibration compliance" },
  tasks: { label: "My Tasks", keywords: "tasks technician work orders" },
  orders: { label: "Orders", keywords: "purchase orders supplier" },
  "authority-security": { label: "Authority Security", keywords: "authority version revocation tokens" },
  "sso-security": { label: "Single Sign-On", keywords: "sso saml oauth login" },
  "rbac-security": { label: "Role-Based Access Control", keywords: "rbac roles permissions" },
  "zerotrust-security": { label: "Zero Trust", keywords: "zt security" },
  "saml-identity": { label: "SAML Identity", keywords: "saml idp federation" },
  "scim-provisioning": { label: "SCIM Provisioning", keywords: "scim user provisioning" },
  "security-governance": { label: "Security Governance", keywords: "governance policies" },
  "mfa-security": { label: "Multi-Factor Authentication", keywords: "mfa 2fa totp authenticator" },
  "compliance-security": { label: "Compliance", keywords: "compliance standards" },
  "threat-detection": { label: "Threat Detection", keywords: "threats alerts" },
  soar: { label: "SOAR", keywords: "soar orchestration automation response" },
  "keyvault-security": { label: "Key Vault", keywords: "secrets keys certificates" },
  "security-keyvault": { label: "Key Vault (Security)", keywords: "secrets keys vault" },
  "dlp-privacy": { label: "DLP & Privacy", keywords: "data loss prevention privacy" },
  passkeys: { label: "Passkeys", keywords: "passkey webauthn fido" },
  ztna: { label: "ZTNA", keywords: "zero trust network access" },
  microsegmentation: { label: "Microsegmentation", keywords: "segmentation network" },
  "siem-analytics": { label: "SIEM Analytics", keywords: "siem logs security events" },
  "grc-compliance": { label: "GRC Compliance", keywords: "governance risk compliance" },
  "security-posture": { label: "Security Posture", keywords: "posture score" },
  "security-commandcenter": { label: "Security Command Center", keywords: "command center soc" },
  vulnerability: { label: "Vulnerability Management", keywords: "vulnerabilities cve scan" },
  "security-vulnerability": { label: "Vulnerability Scan", keywords: "vulnerabilities cve" },
  pam: { label: "Privileged Access Management", keywords: "pam privileged credentials" },
  sbom: { label: "SBOM", keywords: "software bill of materials supply chain" },
  cspm: { label: "CSPM", keywords: "cloud security posture" },
  "threat-intelligence": { label: "Threat Intelligence", keywords: "threat intel ioc" },
  "security-threat": { label: "Threats", keywords: "threats attacks" },
  "security-observability": { label: "Observability", keywords: "telemetry monitoring" },
  "security-playbook": { label: "Security Playbooks", keywords: "playbook automation" },
  "incident-response": { label: "Incident Response", keywords: "incidents response ir" },
  "compliance-evidence": { label: "Compliance Evidence", keywords: "evidence audits" },
  "compliance-reporting": { label: "Compliance Reporting", keywords: "reports audits" },

  // --- public pages that had no entry -------------------------------------------------------
  privacy: { label: "Privacy Policy", keywords: "privacy gdpr data protection personal information" },
  cookies: { label: "Cookie Consent", keywords: "cookies consent tracking preferences ccpa" },
  "do-not-sell": { label: "Do Not Sell or Share", keywords: "ccpa cpra opt out sale sharing" },
  research: { label: "Research", keywords: "research papers publications evidence" },
  "supplier-centre": { label: "Supplier Centre", keywords: "supplier vendor onboarding partners" },

  // --- hospital workflow pages that had no entry ---------------------------------------------
  "equipment-lifecycle": { label: "Equipment Lifecycle Predictor", keywords: "lifecycle replacement end of life depreciation forecast" },
  "procurement-wizard": { label: "New Procurement Request", keywords: "procurement purchase requisition wizard buy" },
  "risk-dashboard": { label: "Dynamic Risk Dashboard", keywords: "risk score failure prediction criticality" },
  "approval-inbox": { label: "Approval Inbox", keywords: "approvals sign off authorise pending requests" },
  "retired-assets": { label: "Retired Assets", keywords: "retired decommissioned disposed archive" },
  tenders: { label: "Tenders", keywords: "tender rfq bidding procurement" },
  "tender-create": { label: "Create Tender", keywords: "new tender rfq publish" },
  "tender-bids": { label: "Open Tenders & Bids", keywords: "bid tender supplier quote submit" },

  // --- critical care and monitoring consoles ---------------------------------------------------
  "icu-telemetry": { label: "ICU Telemetry", keywords: "icu intensive care telemetry vitals bedside monitor" },
  "icu-vitals-telemetry": { label: "ICU Vitals Telemetry", keywords: "vitals heart rate spo2 waveform bedside icu" },
  "icu-telemetry-overwatch": { label: "ICU Telemetry Overwatch", keywords: "icu overwatch isolation negative pressure ventilator census" },
  "pediatric-neonatal-icu": { label: "Pediatric & Neonatal ICU", keywords: "picu nicu paediatric child infant incubator" },
  "neonatal-nicu": { label: "Neonatal NICU", keywords: "nicu neonate newborn incubator preterm apnoea" },
  "emergency-triage": { label: "Emergency Triage", keywords: "ed emergency triage esi ambulance bed board boarding" },
  "hospital-command": { label: "Hospital Command & Orchestration", keywords: "command centre capacity census orchestration operations" },

  // --- diagnostics and imaging -----------------------------------------------------------------
  "radiology-imaging": { label: "Radiology Imaging & PACS", keywords: "radiology pacs dicom ct mri xray scanner imaging" },
  "pathology-digital": { label: "Digital Pathology", keywords: "pathology histology slide scanner biopsy specimen frozen section" },
  "lab-automation": { label: "Lab Automation & Diagnostics", keywords: "laboratory analyser assay specimen track qc turnaround" },
  "clinical-ai": { label: "Biomedical & Clinical AI", keywords: "ai model inference deterioration risk triage cds" },
  "biomedical-ai-diagnostics": { label: "AI Diagnostics Overwatch", keywords: "ai diagnostics drift inference overwatch model monitoring" },
  "biomedical-ai-governance": { label: "Biomedical AI Governance", keywords: "ai governance model registry approval bias validation" },
  "patient-ehr-analytics": { label: "Patient EHR Analytics", keywords: "ehr analytics readmission cohort predictive patient record" },

  // --- treatment and procedure consoles --------------------------------------------------------
  "cardiology-cath-lab": { label: "Cardiology & Cath Lab", keywords: "cardiology cath lab pci stent icd pacemaker hemodynamic fluoroscopy" },
  "surgical-robotics": { label: "Surgical Robotics & OR", keywords: "operating theatre robot surgery or turnover instrument" },
  "oncology-infusion": { label: "Oncology Infusion", keywords: "chemotherapy infusion vesicant cytotoxic dose chair oncology" },
  "dialysis-renal": { label: "Dialysis & Renal Replacement", keywords: "dialysis renal haemodialysis ktv water loop crrt nephrology" },
  "blood-bank": { label: "Blood Bank", keywords: "blood bank haemovigilance donor unit inventory group" },
  "blood-bank-transfusion": { label: "Transfusion Medicine", keywords: "transfusion crossmatch blood product reaction abo compatibility" },
  "telehealth": { label: "Telehealth", keywords: "telehealth virtual consult video remote appointment" },
  "telehealth-remote-monitoring": { label: "Remote Patient Monitoring", keywords: "rpm remote monitoring home wearable adherence" },

  // --- supply, sterilisation and pharmacy ------------------------------------------------------
  "sterile-processing": { label: "Sterile Processing (CSSD)", keywords: "cssd sterile autoclave tray instrument decontamination bowie dick" },
  "cold-chain": { label: "Cold Chain Command", keywords: "cold chain freezer excursion temperature vaccine cryo dscsa" },
  "medication-cold-chain": { label: "Medication Supply & Cold Chain", keywords: "medication supply cold chain distribution shipment pedigree" },
  "pharmacy-supply": { label: "Pharmacy & Med-Supply Chain", keywords: "pharmacy dispensing stock shortage formulary supply" },
  "pharmacovigilance": { label: "Pharmacovigilance & Drug Safety", keywords: "adverse event drug safety signal meddra pharmacovigilance recall" },

  // --- research, quality and regulatory --------------------------------------------------------
  "clinical-trial": { label: "Clinical Trials & Genomic Research", keywords: "trial protocol enrollment cohort biomarker research" },
  "genomic-clinical-trials": { label: "Genomic Clinical Trials", keywords: "genomics sequencing variant precision medicine trial" },
  "regulatory-audit": { label: "Regulatory Audit & Provenance", keywords: "audit provenance c2pa hipaa evidence attestation ledger" },

  // --- enterprise security consoles that had no entry ------------------------------------------
  "security-compliance": { label: "Security & Compliance Hub", keywords: "security compliance posture controls overview" },
  "confidential-compute": { label: "Confidential Compute Enclaves", keywords: "enclave sgx sev attestation confidential compute" },
  ctem: { label: "CTEM & Attack Surface", keywords: "ctem attack surface exposure continuous threat exposure management" },
  "quantum-kms": { label: "Post-Quantum KMS Vault", keywords: "quantum kms key management pqc kyber dilithium vault" },
  "backend-auth-infrastructure": { label: "Backend Authentication Infrastructure", keywords: "abac authentication token infrastructure policy decision point" },
  "zerotrust-governance": { label: "Zero Trust Security Governance", keywords: "zero trust governance policy clearance dea vault attribute" },
  "soc-console": { label: "SOC Operations Console", keywords: "soc security operations centre analyst queue triage" },
  // --- consoles merged after this directory was written ----------------------------------------
  "genomics-precision": { label: "Genomics & Precision Medicine", keywords: "genomics sequencing variant pharmacogenomics precision oncology germline somatic" },
  "regulatory-audit-provenance": { label: "Regulatory Audit & C2PA Provenance", keywords: "provenance c2pa manifest audit ledger tamper attestation chain of custody" },
  "behavioral-health": { label: "Behavioral Health Command", keywords: "mental health psychiatry crisis suicide risk caseload phq gad antipsychotic" },
  "dental-oral": { label: "Dental & Oral Surgery", keywords: "dental oral surgery chair implant orthodontic extraction endodontic cassette autoclave" },
  "ehr-analytics-suite": { label: "Patient EHR Analytics Suite", keywords: "ehr longitudinal cohort risk profiler readmission chart record" },
  "clinical-nlp": { label: "Clinical NLP & Narrative Extraction", keywords: "nlp narrative note extraction entity negation snomed icd coding transcription" },
  "population-health": { label: "Population Health & Care Management", keywords: "population health hedis hcc risk adjustment care gap sdoh outreach panel" },
  "rehab-physical-therapy": { label: "Rehabilitation & Physical Therapy", keywords: "rehab physiotherapy physio gait range of motion exercise mobility outcome measure" },
  "enterprise-security": { label: "Enterprise Security & Post-Quantum KMS", keywords: "security kms post quantum key rotation hsm envelope encryption crypto agility" },
  "telehealth-remote-patient": { label: "Telehealth & Remote Patient Management", keywords: "telehealth remote patient video consult home monitoring wearable escalation" },
};

/**
 * The clinical and operational consoles, arranged by care area for the navbar menu.
 *
 * Entries are page keys only. Labels come from PAGE_LABELS above, so the menu and the palette cannot
 * drift apart on what a console is called.
 *
 * Grouping is by what a user is doing rather than by the directory the page lives in: a biomed
 * looking for the cath lab is thinking "cardiology", not "src/pages/cardiology". The enterprise
 * security consoles are deliberately absent - there are twenty-eight of them, they are hospital-admin
 * only, and they already have their own hub at /security-compliance.
 */
export const CONSOLE_GROUPS = [
  {
    id: "critical-care",
    label: "Critical care",
    pages: [
      "icu-telemetry",
      "icu-telemetry-overwatch",
      "icu-vitals-telemetry",
      "neonatal-nicu",
      "pediatric-neonatal-icu",
      "emergency-triage",
      "hospital-command",
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics & imaging",
    pages: [
      "radiology-imaging",
      "pathology-digital",
      "lab-automation",
      "clinical-ai",
      "biomedical-ai-diagnostics",
      "patient-ehr-analytics",
      "ehr-analytics-suite",
      "clinical-nlp",
    ],
  },
  {
    id: "treatment",
    label: "Treatment & procedures",
    pages: [
      "cardiology-cath-lab",
      "surgical-robotics",
      "oncology-infusion",
      "dialysis-renal",
      "blood-bank",
      "blood-bank-transfusion",
      "telehealth",
      "telehealth-remote-monitoring",
      "telehealth-remote-patient",
      "behavioral-health",
      "dental-oral",
      "rehab-physical-therapy",
    ],
  },
  {
    id: "supply",
    label: "Supply & sterilisation",
    pages: [
      "sterile-processing",
      "cold-chain",
      "medication-cold-chain",
      "pharmacy-supply",
      "pharmacovigilance",
    ],
  },
  {
    id: "research",
    label: "Research & regulatory",
    pages: [
      "clinical-trial",
      "genomic-clinical-trials",
      "regulatory-audit",
      "regulatory-audit-provenance",
      "genomics-precision",
      "population-health",
      "biomedical-ai-governance",
      "security-compliance",
      "enterprise-security",
    ],
  },
];

/** Every page key that appears in the navbar console menu. */
export const CONSOLE_PAGES = CONSOLE_GROUPS.flatMap((group) => group.pages);
