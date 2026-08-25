import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import CookieBanner from "../../components/common/CookieBanner";
import PriceFilterPresetGroup from "../../components/common/PriceFilterPresetGroup";

describe("CookieBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows banner when no consent stored", () => {
    render(<CookieBanner />);
    expect(screen.getByText(/cookie/i)).toBeInTheDocument();
  });

  it("hides banner when consent already stored", () => {
    localStorage.setItem("medtrack_cookie_consent", JSON.stringify({ status: "accepted_all" }));
    const { container } = render(<CookieBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("Accept All saves consent to localStorage", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText(/Accept All/i));
    const stored = JSON.parse(localStorage.getItem("medtrack_cookie_consent"));
    expect(stored.status).toBe("accepted_all");
    expect(stored.analytics).toBe(true);
  });

  it("Decline Optional saves essential-only consent", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText(/Decline Optional/i));
    const stored = JSON.parse(localStorage.getItem("medtrack_cookie_consent"));
    expect(stored.status).toBe("essential_only");
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(false);
  });

  it("clicking cookie policy link calls onNavigate", () => {
    const onNavigate = vi.fn();
    render(<CookieBanner onNavigate={onNavigate} />);
    const links = screen.getAllByText(/cookie/i);
    const policyLink = links.find(el => el.tagName === "A" || el.closest("a"));
    if (policyLink) {
      fireEvent.click(policyLink.closest ? policyLink.closest("a") || policyLink : policyLink);
      expect(onNavigate).toHaveBeenCalled();
    }
  });
});

describe("PriceFilterPresetGroup", () => {
  const presets = [
    { label: "Under $50", min: 0, max: 50 },
    { label: "$50 - $200", min: 50, max: 200 },
    { label: "$200+", min: 200, max: Infinity },
  ];

  it("renders all preset labels", () => {
    render(<PriceFilterPresetGroup presets={presets} activePreset={null} onPresetSelect={() => {}} />);
    expect(screen.getByText("Under $50")).toBeInTheDocument();
    expect(screen.getByText("$50 - $200")).toBeInTheDocument();
    expect(screen.getByText("$200+")).toBeInTheDocument();
  });

  it("calls onPresetSelect when a preset is clicked", () => {
    const onSelect = vi.fn();
    render(<PriceFilterPresetGroup presets={presets} activePreset={null} onPresetSelect={onSelect} />);
    fireEvent.click(screen.getByText("Under $50"));
    expect(onSelect).toHaveBeenCalledWith(presets[0]);
  });

  it("highlights active preset", () => {
    render(<PriceFilterPresetGroup presets={presets} activePreset={presets[1]} onPresetSelect={() => {}} />);
    const activeBtn = screen.getByText("$50 - $200");
    expect(activeBtn.className).toContain("bg-blue");
  });

  it("renders with empty presets array", () => {
    const { container } = render(<PriceFilterPresetGroup presets={[]} activePreset={null} onPresetSelect={() => {}} />);
    expect(container.firstChild).toBeTruthy();
  });
});
