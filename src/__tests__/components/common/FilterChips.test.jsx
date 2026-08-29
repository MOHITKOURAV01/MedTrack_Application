import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { FilterChips } from "../../../components/common/FilterChips";

/** The Lab Automation fleet-tab cluster, which is the shape all nine consoles pass. */
const FLEET = ["All", "Running", "Idle", "Maintenance"];

describe("FilterChips pressed state", () => {
  it("marks the applied filter as pressed", () => {
    render(<FilterChips options={FLEET} value="Idle" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Idle", pressed: true })).toBeInTheDocument();
  });

  it("marks every other chip as not pressed", () => {
    render(<FilterChips options={FLEET} value="Idle" onChange={() => {}} />);
    ["All", "Running", "Maintenance"].forEach((name) => {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("treats All as an ordinary pressable option", () => {
    // "All" is the reset, but it is still the applied filter when selected and
    // has to say so - a user cannot otherwise tell an unfiltered table from a
    // filtered one.
    render(<FilterChips options={FLEET} value="All" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
  });

  it("presses nothing when the value matches no option", () => {
    render(<FilterChips options={FLEET} value="Decommissioned" onChange={() => {}} />);
    screen.getAllByRole("button").forEach((chip) => {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("exposes exactly one pressed chip", () => {
    render(<FilterChips options={FLEET} value="Running" onChange={() => {}} />);
    const pressed = screen.getAllByRole("button").filter(
      (chip) => chip.getAttribute("aria-pressed") === "true"
    );
    expect(pressed).toHaveLength(1);
  });
});

describe("FilterChips grouping", () => {
  it("becomes a named group when a label is given", () => {
    render(
      <FilterChips label="Filter analyzers by status" options={FLEET} value="All" onChange={() => {}} />
    );
    expect(screen.getByRole("group", { name: "Filter analyzers by status" })).toBeInTheDocument();
  });

  it("keeps all its chips inside the group", () => {
    render(
      <FilterChips label="Filter analyzers by status" options={FLEET} value="All" onChange={() => {}} />
    );
    const group = screen.getByRole("group");
    expect(group.querySelectorAll("button")).toHaveLength(4);
  });

  it("does not claim to be a group when it has no name", () => {
    // A group role with no accessible name adds a nesting level and says
    // nothing, which is worse than leaving the container generic.
    render(<FilterChips options={FLEET} value="All" onChange={() => {}} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("ignores an empty label", () => {
    render(<FilterChips label="" options={FLEET} value="All" onChange={() => {}} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("distinguishes two clusters that share option text", () => {
    // Lab Automation's fleet and Ophthalmology's imaging cluster are the same
    // four words; only the group name tells them apart.
    render(
      <>
        <FilterChips label="Filter analyzers by status" options={FLEET} value="All" onChange={() => {}} />
        <FilterChips label="Filter imaging units by status" options={FLEET} value="All" onChange={() => {}} />
      </>
    );
    expect(screen.getByRole("group", { name: "Filter analyzers by status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter imaging units by status" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "All" })).toHaveLength(2);
  });
});

describe("FilterChips non-colour cue", () => {
  it("gives the pressed chip weight and an outline, not only a hue", () => {
    render(<FilterChips options={FLEET} value="Idle" onChange={() => {}} />);
    const pressed = screen.getByRole("button", { name: "Idle" });
    expect(pressed.className).toContain("font-bold");
    expect(pressed.className).toContain("ring-1");
  });

  it("leaves unpressed chips without the cue", () => {
    render(<FilterChips options={FLEET} value="Idle" onChange={() => {}} />);
    const other = screen.getByRole("button", { name: "Running" });
    expect(other.className).not.toContain("font-bold");
    expect(other.className).not.toContain("ring-1");
  });

  it("keeps the emerald active palette", () => {
    render(<FilterChips options={FLEET} value="Idle" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Idle" }).className).toContain("text-emerald-300");
  });
});

describe("FilterChips button type", () => {
  it("never submits a surrounding form", () => {
    render(<FilterChips options={FLEET} value="All" onChange={() => {}} />);
    screen.getAllByRole("button").forEach((chip) => expect(chip).toHaveAttribute("type", "button"));
  });

  it("does not submit the form it is dropped into", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <FilterChips options={FLEET} value="All" onChange={() => {}} />
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: "Running" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("FilterChips behaviour", () => {
  it("reports the clicked option", () => {
    const onChange = vi.fn();
    render(<FilterChips options={FLEET} value="All" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Maintenance" }));
    expect(onChange).toHaveBeenCalledWith("Maintenance");
  });

  it("reports a click on the already-applied option", () => {
    const onChange = vi.fn();
    render(<FilterChips options={FLEET} value="Idle" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Idle" }));
    expect(onChange).toHaveBeenCalledWith("Idle");
  });

  it("renders one chip per option, in order", () => {
    render(<FilterChips options={FLEET} value="All" onChange={() => {}} />);
    expect(screen.getAllByRole("button").map((c) => c.textContent)).toEqual(FLEET);
  });

  it("renders options containing punctuation and non-ASCII text", () => {
    // Anaesthesiology passes "Catheter ≥ 3d"; Surgical passes an em dash.
    const options = ["All", "Catheter ≥ 3d", "Expired — Re-sterilize"];
    render(<FilterChips options={options} value="Catheter ≥ 3d" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Catheter ≥ 3d", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expired — Re-sterilize" })).toBeInTheDocument();
  });
});

describe("FilterChips degenerate input", () => {
  it("renders nothing for an empty option list", () => {
    render(<FilterChips options={[]} value="All" onChange={() => {}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("tolerates a missing options prop", () => {
    const { container } = render(<FilterChips value="All" onChange={() => {}} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("keeps every chip when an option is repeated", () => {
    // Keying on the option text alone silently dropped the duplicate.
    render(<FilterChips options={["All", "Idle", "Idle"]} value="All" onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
