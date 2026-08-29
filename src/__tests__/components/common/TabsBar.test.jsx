import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TabsBar, nextTabIndex } from "../../../components/common/TabsBar";

/** Stand-in for a lucide icon; TabsBar only ever calls it as a component. */
const Icon = (props) => <svg data-testid="tab-icon" {...props} />;

/** The shape SecurityComplianceHub passes (`id` + `icon`). */
const ID_TABS = [
  { id: "zero-trust", label: "Zero-Trust Access", icon: Icon },
  { id: "kms", label: "Quantum KMS & Enclaves", icon: Icon },
  { id: "ctem", label: "CTEM & SIEM Overwatch", icon: Icon },
];

/** The shape IcuTelemetryHub passes (`key` + `icon`). */
const KEY_TABS = [
  { key: "vitals", label: "Vitals Stream", icon: Icon },
  { key: "devices", label: "IoT Device Mesh", icon: Icon },
  { key: "alerts", label: "Alert Escalation", icon: Icon },
];

describe("nextTabIndex", () => {
  it("moves right and wraps at the end", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
  });

  it("moves left and wraps at the start", () => {
    expect(nextTabIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
  });

  it("jumps to the first and last tab", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("leaves the index alone for an unrelated key", () => {
    expect(nextTabIndex("a", 1, 3)).toBe(1);
    expect(nextTabIndex("Enter", 1, 3)).toBe(1);
  });

  it("does not divide by zero on an empty strip", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBe(0);
    expect(nextTabIndex("End", 0, 0)).toBe(0);
  });
});

describe("TabsBar semantics", () => {
  it("exposes the strip as a labelled tablist", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getByRole("tablist", { name: "Modules" })).toBeInTheDocument();
  });

  it("takes the tablist label from the label prop", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} label="Security modules" />);
    expect(screen.getByRole("tablist", { name: "Security modules" })).toBeInTheDocument();
  });

  it("renders every tab with role=tab", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks only the active tab as selected", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Quantum KMS/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Zero-Trust/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /CTEM/ })).toHaveAttribute("aria-selected", "false");
  });

  it("resolves the active tab through the key field too", () => {
    render(<TabsBar tabs={KEY_TABS} active="alerts" onChange={() => {}} accent="sky" />);
    expect(screen.getByRole("tab", { name: /Alert Escalation/ })).toHaveAttribute("aria-selected", "true");
  });

  it("gives the selected tab a non-colour cue", () => {
    // The regression this guards: the active state used to be a hue swap and
    // nothing else, so a user who cannot separate the two tints had no cue.
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Quantum KMS/ }).className).toContain("after:bg-current");
    expect(screen.getByRole("tab", { name: /CTEM/ }).className).not.toContain("after:bg-current");
  });

  it("gives every tab a type so it cannot submit a surrounding form", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    screen.getAllByRole("tab").forEach((tab) => expect(tab).toHaveAttribute("type", "button"));
  });

  it("gives each tab a unique id", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    const ids = screen.getAllByRole("tab").map((tab) => tab.id);
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(id).toBeTruthy());
  });
});

describe("TabsBar aria-controls", () => {
  it("omits aria-controls when no panel id resolver is given", () => {
    // Pointing at an id that does not exist is worse than saying nothing.
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    screen.getAllByRole("tab").forEach((tab) => expect(tab).not.toHaveAttribute("aria-controls"));
  });

  it("wires aria-controls when the caller supplies one", () => {
    render(
      <TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} panelIdFor={(id) => `panel-${id}`} />
    );
    expect(screen.getByRole("tab", { name: /Quantum KMS/ })).toHaveAttribute("aria-controls", "panel-kms");
  });
});

describe("TabsBar roving tab stop", () => {
  it("makes the strip a single tab stop", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Quantum KMS/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Zero-Trust/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /CTEM/ })).toHaveAttribute("tabindex", "-1");
  });
});

describe("TabsBar keyboard navigation", () => {
  it("selects the next tab on ArrowRight", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="zero-trust" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Zero-Trust/ }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("kms");
  });

  it("selects the previous tab on ArrowLeft", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Quantum KMS/ }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("zero-trust");
  });

  it("wraps from the last tab to the first", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="ctem" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /CTEM/ }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("zero-trust");
  });

  it("jumps to the last tab on End", () => {
    // The case the overflow-x-auto variant needed: the later tabs are scrolled
    // out of view, and End was the only way to reach them without guessing.
    const onChange = vi.fn();
    render(<TabsBar tabs={KEY_TABS} active="vitals" onChange={onChange} accent="sky" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Vitals/ }), { key: "End" });
    expect(onChange).toHaveBeenCalledWith("alerts");
  });

  it("jumps to the first tab on Home", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={KEY_TABS} active="alerts" onChange={onChange} accent="sky" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Alert Escalation/ }), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("vitals");
  });

  it("moves focus to the newly selected tab", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="zero-trust" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Zero-Trust/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Quantum KMS/ })).toHaveFocus();
  });

  it("ignores keys that are not navigation keys", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Quantum KMS/ }), { key: "a" });
    fireEvent.keyDown(screen.getByRole("tab", { name: /Quantum KMS/ }), { key: "ArrowDown" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not fire onChange when the target is already active", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={[ID_TABS[0]]} active="zero-trust" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Zero-Trust/ }), { key: "Home" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still responds when active matches no tab", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="nothing-matches" onChange={onChange} />);
    fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "End" });
    expect(onChange).toHaveBeenCalledWith("ctem");
  });
});

describe("TabsBar clicking", () => {
  it("reports the clicked tab's id", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /CTEM/ }));
    expect(onChange).toHaveBeenCalledWith("ctem");
  });

  it("reports the clicked tab's key for key-shaped tabs", () => {
    const onChange = vi.fn();
    render(<TabsBar tabs={KEY_TABS} active="vitals" onChange={onChange} accent="sky" />);
    fireEvent.click(screen.getByRole("tab", { name: /IoT Device Mesh/ }));
    expect(onChange).toHaveBeenCalledWith("devices");
  });
});

describe("TabsBar icons", () => {
  it("renders an icon when the tab supplies one", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getAllByTestId("tab-icon")).toHaveLength(3);
  });

  it("hides the decorative icon from assistive technology", () => {
    render(<TabsBar tabs={[ID_TABS[0]]} active="zero-trust" onChange={() => {}} />);
    expect(screen.getByTestId("tab-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a tab that has no icon instead of throwing", () => {
    // Previously `<Icon />` with `Icon === undefined` threw "Element type is
    // invalid" out of TabsBar and unmounted the whole console.
    render(<TabsBar tabs={[{ id: "plain", label: "No Icon Tab" }]} active="plain" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "No Icon Tab" })).toBeInTheDocument();
    expect(screen.queryByTestId("tab-icon")).not.toBeInTheDocument();
  });
});

describe("TabsBar variants", () => {
  it("keeps the emerald wrapper for the default accent", () => {
    render(<TabsBar tabs={ID_TABS} active="kms" onChange={() => {}} />);
    expect(screen.getByRole("tablist").className).toContain("mt-5 flex flex-wrap gap-2");
  });

  it("keeps the scrollable row for the sky accent", () => {
    render(<TabsBar tabs={KEY_TABS} active="vitals" onChange={() => {}} accent="sky" />);
    expect(screen.getByRole("tablist").className).toContain("overflow-x-auto");
  });

  it("applies the cyan active styling for the cold-chain console", () => {
    render(<TabsBar tabs={KEY_TABS} active="vitals" onChange={() => {}} accent="cyan" />);
    expect(screen.getByRole("tab", { name: /Vitals/ }).className).toContain("text-cyan-400");
  });

  it("applies the sky active styling", () => {
    render(<TabsBar tabs={KEY_TABS} active="vitals" onChange={() => {}} accent="sky" />);
    expect(screen.getByRole("tab", { name: /Vitals/ }).className).toContain("text-sky-400");
  });

  it("renders an empty but valid tablist for an empty tab list", () => {
    render(<TabsBar tabs={[]} active={undefined} onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("tolerates a non-array tabs prop", () => {
    render(<TabsBar tabs={undefined} active={undefined} onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
