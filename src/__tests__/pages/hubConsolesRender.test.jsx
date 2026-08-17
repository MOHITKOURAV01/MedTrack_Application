// Every hub console must render.
//
// Why this file exists
// --------------------
// Thirteen hub consoles rendered nothing but the ErrorBoundary fallback on `main`. The extraction of
// the page-local UI primitives into src/components/common removed each page's local `StatCard`,
// `SearchBox`, `InfoRow`, `Modal`, `Badge`, `TabsBar`, `SEVERITY_META` and friends, and never added
// the imports that replace them. Every one of those identifiers was a free variable, so the first
// render threw:
//
//   ReferenceError: SEVERITY_META is not defined
//     at ColdChainCommandHub (src/pages/coldchain/ColdChainCommandHub.jsx:977:49)
//
// Three of the thirteen had a test file and went red. The other ten had none, so they shipped broken
// and stayed broken: a page that throws on render is not distinguishable from a page nobody looked
// at, and nothing in the suite looked at them.
//
// The gap is what this file closes. It is deliberately shallow - render the console, assert the
// heading is on screen - because the defect class it guards is "the module cannot render at all",
// and depth buys nothing against that. A single smoke assertion per console would have caught all
// thirteen. Ten of them had no assertion of any kind.
//
// The three consoles that already have their own suites are included anyway. They are cheap, and
// listing all thirteen in one place makes the set auditable: a new console added to the registry
// without an entry here is visible in review, where a missing separate test file is not.

import { screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderWithProviders } from "../utils/renderWithProviders";

import ClinicalAIHub from "../../pages/clinical/ClinicalAIHub";
import IcuTelemetryHub from "../../pages/icu/IcuTelemetryHub";
import PharmacySupplyHub from "../../pages/pharmacy/PharmacySupplyHub";
import TelehealthHub from "../../pages/telehealth/TelehealthHub";
import ColdChainCommandHub from "../../pages/coldchain/ColdChainCommandHub";
import EmergencyTriageHub from "../../pages/emergency/EmergencyTriageHub";
import ClinicalTrialHub from "../../pages/research/ClinicalTrialHub";
import RegulatoryAuditHub from "../../pages/audit/RegulatoryAuditHub";
import RadiologyImagingHub from "../../pages/radiology/RadiologyImagingHub";
import SecurityComplianceHub from "../../pages/security/SecurityComplianceHub";
import SurgicalRoboticsHub from "../../pages/surgical/SurgicalRoboticsHub";
import LabAutomationHub from "../../pages/lab/LabAutomationHub";
import PharmacovigilanceHub from "../../pages/pharmacovigilance/PharmacovigilanceHub";

// The second wave: consoles merged after the first restoration, which arrived with the same missing
// imports and, in one case, a shadowed `const` that threw before its own initialiser finished.
import RegulatoryAuditProvenanceHub from "../../pages/audit/RegulatoryAuditProvenanceHub";
import BehavioralHealthHub from "../../pages/behavioral/BehavioralHealthHub";
import DentalOralHub from "../../pages/dental/DentalOralHub";
import PatientEhrAnalyticsHub from "../../pages/ehr/PatientEhrAnalyticsHub";
import ClinicalNlpSubsystemHub from "../../pages/nlp/ClinicalNlpSubsystemHub";
import PopulationHealthHub from "../../pages/pophealth/PopulationHealthHub";
import RehabPtHub from "../../pages/rehab/RehabPtHub";
import EnterpriseSecurityHub from "../../pages/security/EnterpriseSecurityHub";
import TelehealthRemotePatientHub from "../../pages/telehealth/TelehealthRemotePatientHub";
import GenomicsPrecisionHub from "../../pages/genomics/GenomicsPrecisionHub";

/**
 * The thirteen consoles the extraction broke, each with the heading it renders.
 *
 * `heading` is a substring rather than an exact string: the headings carry an ampersand written as
 * `&amp;` in the source, which the DOM normalises to `&`, and several are split across a line break
 * by the formatter. Matching a distinctive fragment is stable against both.
 */
const CONSOLES = [
  // variant A - tone-driven stat cards, severity vocabulary, inspection modal
  { name: "ClinicalAIHub", Component: ClinicalAIHub, heading: /Biomedical & Clinical AI Hub/ },
  { name: "IcuTelemetryHub", Component: IcuTelemetryHub, heading: /Real-Time Telemetry & ICU Monitoring/ },
  { name: "PharmacySupplyHub", Component: PharmacySupplyHub, heading: /Pharmacy & Med-Supply Chain/ },
  { name: "TelehealthHub", Component: TelehealthHub, heading: /Telehealth & Remote Patient Management/ },
  { name: "ColdChainCommandHub", Component: ColdChainCommandHub, heading: /Cold-Chain & Med-Supply Chain/ },
  { name: "EmergencyTriageHub", Component: EmergencyTriageHub, heading: /Hospital Operations & Emergency Triage/ },
  { name: "ClinicalTrialHub", Component: ClinicalTrialHub, heading: /Clinical Trial & Genomic Research/ },

  // variant B - accent-driven compact cards, toneOf vocabulary, simple modal
  { name: "RegulatoryAuditHub", Component: RegulatoryAuditHub, heading: /Regulatory Audit & Provenance Ledger Hub/ },
  { name: "RadiologyImagingHub", Component: RadiologyImagingHub, heading: /Radiology Imaging & PACS Overwatch Hub/ },
  { name: "SecurityComplianceHub", Component: SecurityComplianceHub, heading: /Enterprise Security & Compliance Hub/ },
  { name: "SurgicalRoboticsHub", Component: SurgicalRoboticsHub, heading: /Surgical Robotics & OR Orchestration Hub/ },
  { name: "LabAutomationHub", Component: LabAutomationHub, heading: /Lab Automation & Diagnostics Fleet Hub/ },
  { name: "PharmacovigilanceHub", Component: PharmacovigilanceHub, heading: /Pharmacovigilance & Drug Safety Hub/ },

  // the second wave
  { name: "RegulatoryAuditProvenanceHub", Component: RegulatoryAuditProvenanceHub, heading: /Regulatory Audit & C2PA Provenance Ledger Hub/ },
  { name: "BehavioralHealthHub", Component: BehavioralHealthHub, heading: /Behavioral Health Command/ },
  { name: "DentalOralHub", Component: DentalOralHub, heading: /Dental & Oral Surgery/ },
  { name: "PatientEhrAnalyticsHub", Component: PatientEhrAnalyticsHub, heading: /Patient EHR Analytics & Population Risk Profiler/ },
  { name: "ClinicalNlpSubsystemHub", Component: ClinicalNlpSubsystemHub, heading: /Clinical NLP & Medical Narrative Extraction Subsystem/ },
  { name: "PopulationHealthHub", Component: PopulationHealthHub, heading: /Population Health & Care Management/ },
  { name: "RehabPtHub", Component: RehabPtHub, heading: /Rehabilitation & Physical Therapy/ },
  { name: "EnterpriseSecurityHub", Component: EnterpriseSecurityHub, heading: /Enterprise Security & Post-Quantum KMS Subsystem/ },
  { name: "TelehealthRemotePatientHub", Component: TelehealthRemotePatientHub, heading: /Telehealth & Remote Patient Management Hub/ },
  { name: "GenomicsPrecisionHub", Component: GenomicsPrecisionHub, heading: /Genomics & Precision Medicine/ },
];

// Every console drives itself from a setInterval, so the clock is faked for all of them. Without it
// a console can advance between render and assertion, and - worse for a smoke test - a throw raised
// from inside a timer callback lands outside the assertion and is reported as an unhandled error
// rather than as a failing test.
describe("hub consoles render", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("covers every console the shared-primitive extraction touched", () => {
    // Guards the list itself. The number is not chosen for neatness - it is every console the two
    // extraction waves touched, and a shrunken list would silently stop testing one.
    expect(CONSOLES).toHaveLength(23);
    expect(new Set(CONSOLES.map((entry) => entry.name)).size).toBe(23);
  });

  for (const { name, Component, heading } of CONSOLES) {
    it(`${name} renders its heading without throwing`, () => {
      // renderWithProviders throws through, so a ReferenceError from a free variable fails here with
      // the identifier and the source line in the message - which is the whole diagnostic.
      expect(() => renderWithProviders(<Component />)).not.toThrow();
      // getAllByText, not getByText: several consoles repeat the console name in the header and again
      // in a footer or standards strip, and a smoke test should not be sensitive to that.
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    });

    it(`${name} survives its own simulation ticks`, () => {
      // The identifiers used only in a modal, an inspection panel or a branch that needs a few ticks
      // of state before it is reachable are exactly the ones a bare render misses. Advancing the
      // clock exercises the tick loop and the derived state it feeds.
      renderWithProviders(<Component />);

      expect(() => {
        act(() => {
          vi.advanceTimersByTime(12_000);
        });
      }).not.toThrow();

      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    });
  }

  it("renders every console without writing a React error to the console", () => {
    // A component that throws inside a child boundary can still produce a passing render, so the
    // absence of a logged React error is asserted separately. `console.error` is the channel React
    // uses for a caught render error, an invalid prop type and a broken hook order alike.
    const errors = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });

    for (const { Component } of CONSOLES) {
      const { unmount } = renderWithProviders(<Component />);
      unmount();
    }

    spy.mockRestore();

    const reactErrors = errors.filter((message) => /is not defined|Cannot read|Each child in a list/.test(message));
    expect(reactErrors).toEqual([]);
  });
});
