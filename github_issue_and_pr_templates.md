# MedTrack — Issue & PR Templates / Feature Deployment Audit Log

This file is the canonical record of automated feature-hub deployments: every new
domain feature created for the MedTrack application gets a branch, a commit, a GitHub
Issue, a Pull Request and (once CI deploys) a live GitHub Pages link, logged below.

---

## Deployment Checklist (per feature)

1. `git checkout main` -> `git pull upstream main` -> `git checkout -b feature/frontend-<feature-name>-hub`
2. Write the 500+ line React page under `src/pages/<domain>/` and register it in `src/routes/routeRegistry.js`
3. Stage, commit, push to the fork (`git push -u origin feature/...`)
4. Open Issue -> `gh issue create --repo kRamu81/MedTrack_Application --title "[FEATURE] ..."`
5. Open PR -> `gh pr create --repo kRamu81/MedTrack_Application --head <fork>:<branch> --base main --title "feat(frontend): ... (#<issue>)"`
6. Update this audit log with Issue #, PR # and Live Link.

## Issue / PR Templates

### Issue Template

```markdown
## Overview
[What the feature page does and why it matters for the MedTrack ecosystem]

## Industry Standards Alignment
- [Regulatory / interoperability standard the feature maps to]

## Files
- `src/pages/<domain>/<FeaturePageName>.jsx`
- `src/routes/routeRegistry.js`

## Acceptance Criteria
- [ ] New page exceeds 500 lines of production-grade, dark-themed React
- [ ] Registered route; `check-routes.js` passes
- [ ] Interactive simulation / search / filter / inspection controls
```

### PR Template

```markdown
## Description
[Summary of the consoles and interactions added]

Fixes #<issue>

#Closed #<issue>
```

---

## Audit Log

| # | Feature | Domain | Branch | Issue | PR | Live Link | Date |
|---|---------|--------|--------|-------|----|-----------|------|
| 1 | Biomedical & Clinical AI Hub | Biomedical & Clinical AI | `feature/frontend-biomedical-ai-hub` | [#1126](https://github.com/kRamu81/MedTrack_Application/issues/1126) | [#1127](https://github.com/kRamu81/MedTrack_Application/pull/1127) | https://kRamu81.github.io/MedTrack_Application/clinical-ai | 2026-08-14 |
| 2 | Real-Time Telemetry & ICU Monitoring Hub | ICU Telemetry & Monitoring | `feature/frontend-icu-telemetry-hub` | [#1129](https://github.com/kRamu81/MedTrack_Application/issues/1129) | [#1130](https://github.com/kRamu81/MedTrack_Application/pull/1130) | https://kRamu81.github.io/MedTrack_Application/icu-telemetry | 2026-08-14 |
| 3 | Pharmacy & Med-Supply Chain Hub | Pharmacy & Med-Supply Chain | `feature/frontend-pharmacy-supply-hub` | [#1132](https://github.com/kRamu81/MedTrack_Application/issues/1132) | [#1133](https://github.com/kRamu81/MedTrack_Application/pull/1133) | https://kRamu81.github.io/MedTrack_Application/pharmacy-supply | 2026-08-14 |
| 4 | Clinical Trial & Genomic Research Hub | Clinical Trial & Genomic Research | `feature/frontend-clinical-trial-hub` | [#1135](https://github.com/kRamu81/MedTrack_Application/issues/1135) | [#1136](https://github.com/kRamu81/MedTrack_Application/pull/1136) | https://kRamu81.github.io/MedTrack_Application/clinical-trial | 2026-08-14 |
| 5 | Hospital Operations & Emergency Triage Hub | Hospital Operations & Emergency Triage | `feature/frontend-emergency-triage-hub` | [#1138](https://github.com/kRamu81/MedTrack_Application/issues/1138) | [#1139](https://github.com/kRamu81/MedTrack_Application/pull/1139) | https://kRamu81.github.io/MedTrack_Application/emergency-triage | 2026-08-14 |
| 6 | Telehealth & Remote Patient Management Hub | Telehealth & Remote Patient Management | `feature/frontend-telehealth-hub` | [#1140](https://github.com/kRamu81/MedTrack_Application/issues/1140) | [#1141](https://github.com/kRamu81/MedTrack_Application/pull/1141) | https://kRamu81.github.io/MedTrack_Application/telehealth | 2026-08-14 |
| 7 | Enterprise Security & Compliance Hub | Enterprise Security & Compliance | `feature/frontend-security-compliance-hub` | [#1170](https://github.com/kRamu81/MedTrack_Application/issues/1170) | [#1171](https://github.com/kRamu81/MedTrack_Application/pull/1171) | https://kRamu81.github.io/MedTrack_Application/security-compliance | 2026-08-14 |
| 8 | Regulatory Audit & Provenance Ledger Hub | Regulatory Audit & Provenance Ledger | `feature/frontend-regulatory-audit-hub` | [#1204](https://github.com/kRamu81/MedTrack_Application/issues/1204) | [#1205](https://github.com/kRamu81/MedTrack_Application/pull/1205) | https://kRamu81.github.io/MedTrack_Application/regulatory-audit | 2026-08-15 |
| 9 | Pharmacovigilance & Drug Safety Hub | Pharmacovigilance & Drug Safety | `feature/frontend-pharmacovigilance-hub` | [#1206](https://github.com/kRamu81/MedTrack_Application/issues/1206) | [#1207](https://github.com/kRamu81/MedTrack_Application/pull/1207) | https://kRamu81.github.io/MedTrack_Application/pharmacovigilance | 2026-08-15 |
| 10 | Surgical Robotics & OR Orchestration Hub | Surgical Robotics & OR Orchestration | `feature/frontend-surgical-robotics-hub` | [#1208](https://github.com/kRamu81/MedTrack_Application/issues/1208) | [#1209](https://github.com/kRamu81/MedTrack_Application/pull/1209) | https://kRamu81.github.io/MedTrack_Application/surgical-robotics | 2026-08-15 |
| 11 | Lab Automation & Diagnostics Fleet Hub | Lab Automation & Diagnostics | `feature/frontend-lab-automation-hub` | [#1210](https://github.com/kRamu81/MedTrack_Application/issues/1210) | [#1211](https://github.com/kRamu81/MedTrack_Application/pull/1211) | https://kRamu81.github.io/MedTrack_Application/lab-automation | 2026-08-15 |
| 12 | Radiology Imaging & PACS Overwatch Hub | Radiology Imaging & PACS | `feature/frontend-radiology-imaging-hub` | [#1212](https://github.com/kRamu81/MedTrack_Application/issues/1212) | [#1213](https://github.com/kRamu81/MedTrack_Application/pull/1213) | https://kRamu81.github.io/MedTrack_Application/radiology-imaging | 2026-08-15 |
| 17 | Maternal & Neonatal NICU Hub | Maternal & Neonatal NICU | `feature/frontend-neonatal-nicu-hub` | [#1242](https://github.com/kRamu81/MedTrack_Application/issues/1242) | [#1243](https://github.com/kRamu81/MedTrack_Application/pull/1243) | https://kRamu81.github.io/MedTrack_Application/neonatal-nicu | 2026-08-16 |
| 22 | Genomics & Precision Medicine Hub | Genomics & Precision Medicine | `feature/frontend-genomics-precision-hub` | [#1319](https://github.com/kRamu81/MedTrack_Application/issues/1319) | [#1320](https://github.com/kRamu81/MedTrack_Application/pull/1320) | https://kRamu81.github.io/MedTrack_Application/genomics-precision | 2026-08-17 |
| 23 | Ophthalmology & Vision Diagnostics Hub | Ophthalmology & Vision Diagnostics | `feature/frontend-ophthalmology-vision-hub` | [#1357](https://github.com/kRamu81/MedTrack_Application/issues/1357) | [#1358](https://github.com/kRamu81/MedTrack_Application/pull/1358) | https://kRamu81.github.io/MedTrack_Application/ophthalmology-vision | 2026-08-17 |
