import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../utils/renderWithProviders";
import ColdChainCommandHub from "../../../pages/coldchain/ColdChainCommandHub";

describe("ColdChainCommandHub Component", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders the main heading, stat row and all five module tabs", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    expect(screen.getByText(/Pharmaceutical Cold-Chain & Med-Supply Chain/)).toBeInTheDocument();
    expect(screen.getByText("Cryo excursions")).toBeInTheDocument();
    expect(screen.getByText("Tags out of range")).toBeInTheDocument();
    expect(screen.getByText("Suspect products")).toBeInTheDocument();
    expect(screen.getByText("High-impact excursions")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /Cryo Telemetry/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /RFID Serialization/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /DSCSA Track & Trace/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Narcotic Vault Audit/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Arrhenius Kinetics/ })).toBeInTheDocument();
  });

  it("shows the cryo freezer fleet with live telemetry on the default tab", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    expect(screen.getByText("Cryo Vault A · mRNA Bank")).toBeInTheDocument();
    expect(screen.getByText("Cryo Vault E · Biobank")).toBeInTheDocument();
    expect(screen.getByText("Dry Shipper · CAR-T Run 12")).toBeInTheDocument();
  });

  it("opens the cryo inspection modal when a freezer card is clicked", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    fireEvent.click(screen.getByText("Cryo Vault A · mRNA Bank"));

    expect(screen.getByRole("dialog", { name: "Cryo Vault A · mRNA Bank" })).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Thermo TSX -86°C")).toBeInTheDocument();
  });

  it("switches to the RFID tab and filters tags by search query", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("tab", { name: /RFID Serialization/ }));

    expect(screen.getByText("Fentanyl citrate 50 mcg/mL")).toBeInTheDocument();
    expect(screen.getByText("Adderall XR 20 mg caps")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search rfid serialization/i);
    fireEvent.change(searchInput, { target: { value: "Fentanyl" } });

    expect(screen.getByText("Fentanyl citrate 50 mcg/mL")).toBeInTheDocument();
    expect(screen.queryByText("Adderall XR 20 mg caps")).not.toBeInTheDocument();
  });

  it("switches to the vault tab and surfaces Schedule II discrepancies", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("tab", { name: /Narcotic Vault Audit/ }));

    expect(screen.getByText("Sufentanil citrate 50 mcg/mL")).toBeInTheDocument();
    expect(screen.getByText("Audit trail")).toBeInTheDocument();
    expect(screen.getAllByText(/DEA Schedule II/).length).toBeGreaterThan(0);
  });

  it("switches to the Arrhenius tab and shows kinetic impact labels", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole("tab", { name: /Arrhenius Kinetics/ }));

    expect(screen.getByText("Gene therapy vector lot GT-114")).toBeInTheDocument();
    expect(screen.getAllByText(/shelf-life loss/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/kJ\/mol/).length).toBeGreaterThan(0);
  });

  it("toggles the simulation loop with the pause / resume control", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    const pauseButton = screen.getByRole("button", { name: "Pause simulation" });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(screen.getByRole("button", { name: "Resume simulation" })).toBeInTheDocument();
  });

  it("exposes the CSV export action from the toolbar", () => {
    renderWithProviders(<ColdChainCommandHub onNavigate={() => {}} />);

    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
  });
});
