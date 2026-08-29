import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmergencyTriageHub from "../../../pages/emergency/EmergencyTriageHub";

describe("EmergencyTriageHub", () => {
  it("renders the bed board with valid button nesting", () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => {
      errors.push(args.map((a) => String(a)).join(" "));
    };

    try {
      render(<EmergencyTriageHub onNavigate={() => {}} />);
      fireEvent.click(screen.getByRole("tab", { name: /Bed Capacity Board/i }));

      // Each unit card is interactive and carries a real "Reserve bed" button.
      // They must not nest: a button inside a button is invalid HTML that React
      // flags as a hydration error (and browsers close the outer button early).
      const reserveButtons = screen.getAllByText(/Reserve bed/);
      expect(reserveButtons.length).toBeGreaterThan(0);
      fireEvent.click(reserveButtons[0]);

      const nestedButtonWarnings = errors.filter(
        (text) => text.includes("cannot be a descendant of") || text.includes("cannot contain a nested")
      );
      expect(nestedButtonWarnings).toEqual([]);
    } finally {
      console.error = originalError;
    }
  });

  it("opens the inspection panel when a unit card is activated", () => {
    render(<EmergencyTriageHub onNavigate={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /Bed Capacity Board/i }));

    // Unit cards are interactive divs (role=button) named by their text content.
    const unitCard = screen.getByRole("button", { name: /ICU West/i });
    fireEvent.click(unitCard);

    // The inspection modal exposes a unique close control.
    expect(screen.getByRole("button", { name: "Close inspection panel" })).toBeInTheDocument();
  });
});
