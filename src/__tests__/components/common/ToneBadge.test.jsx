import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { DEFAULT_TONE, ToneBadge, resolveTone, toneClass } from "../../../components/common/ToneBadge";
import { CompactStatCard, StatCard, statToneClass } from "../../../components/common/StatCard";

const classOf = (container) => container.firstChild.getAttribute("class");

/** The PACU console's classifier, copied verbatim so the assertions run against the real thing. */
const pacuToneOf = (value) => {
  const v = String(value);
  if (/^(To PACU|Ready|Clear|down)$/.test(v)) return "green";
  if (/^(Maintenance|Emergence|8|7|flat)$/.test(v)) return "amber";
  if (/^(Difficult|Aspiration risk|Desat|Hypoventilating|Delayed wake|PONV|5|6)$/.test(v)) return "red";
  return "slate";
};

describe("resolveTone", () => {
  it("uses a tone that is already a colour key", () => {
    for (const key of Object.keys(toneClass)) {
      expect(resolveTone(key, "anything", () => "red")).toBe(key);
    }
  });

  it("classifies the badge text when no tone is given", () => {
    expect(resolveTone(undefined, "Ready", pacuToneOf)).toBe("green");
    expect(resolveTone(undefined, "Emergence", pacuToneOf)).toBe("amber");
    expect(resolveTone(undefined, "Desat", pacuToneOf)).toBe("red");
    expect(resolveTone(null, "Ready", pacuToneOf)).toBe("green");
    expect(resolveTone("", "Ready", pacuToneOf)).toBe("green");
  });

  it("classifies a domain word passed as `tone` instead of giving up on it", () => {
    // This is the case `tone ||` short-circuited past. The word carries the meaning, so it is the
    // word that gets classified - not the badge text beside it.
    expect(resolveTone("Ready", "Discharge", pacuToneOf)).toBe("green");
    expect(resolveTone("Emergence", "Phase", pacuToneOf)).toBe("amber");
    expect(resolveTone("Desat", "Airway", pacuToneOf)).toBe("red");
  });

  it("falls back to slate when neither the caller nor the classifier resolves a key", () => {
    expect(resolveTone("Catheter d1", "Catheter", pacuToneOf)).toBe(DEFAULT_TONE);
    expect(resolveTone("Not ready", "Not ready", pacuToneOf)).toBe(DEFAULT_TONE);
    expect(resolveTone(undefined, "Induction", pacuToneOf)).toBe(DEFAULT_TONE);
  });

  it("survives a classifier that returns nonsense, or is not a function", () => {
    expect(resolveTone(undefined, "x", () => "chartreuse")).toBe(DEFAULT_TONE);
    expect(resolveTone(undefined, "x", () => undefined)).toBe(DEFAULT_TONE);
    expect(resolveTone(undefined, "x", null)).toBe(DEFAULT_TONE);
    expect(resolveTone(undefined, "x", "not a function")).toBe(DEFAULT_TONE);
  });

  it("does not resolve a key inherited from Object.prototype", () => {
    // `toneClass["constructor"]` is truthy without `hasOwnProperty`, and interpolating a function
    // into a className is its own kind of mess.
    expect(resolveTone("constructor", "x", pacuToneOf)).toBe(DEFAULT_TONE);
    expect(resolveTone("toString", "x", pacuToneOf)).toBe(DEFAULT_TONE);
  });
});

describe("ToneBadge", () => {
  it("never writes the string 'undefined' into its class list", () => {
    for (const tone of ["Ready", "Not ready", "Catheter d1", "critical", "high", "purple", undefined, null, 42]) {
      const { container } = render(<ToneBadge tone={tone}>Label</ToneBadge>);
      expect(classOf(container)).not.toContain("undefined");
    }
  });

  it("always carries a border, a background and a text colour", () => {
    const { container } = render(<ToneBadge tone="Not ready">Not ready</ToneBadge>);
    const cls = classOf(container);
    expect(cls).toContain("bg-slate-500/10");
    expect(cls).toContain("text-slate-400");
    expect(cls).toContain("border-slate-500/30");
  });

  it("styles each known tone as it always did", () => {
    for (const [tone, cls] of Object.entries(toneClass)) {
      expect(classOf(render(<ToneBadge tone={tone}>x</ToneBadge>).container)).toContain(cls);
    }
  });

  it("renders its children", () => {
    render(<ToneBadge tone="red">Below 2-day floor</ToneBadge>);
    expect(screen.getByText("Below 2-day floor")).toBeInTheDocument();
  });

  it("keeps the classifier route working for the pages that rely on it", () => {
    // e.g. EndocrinologyMetabolicHub: <ToneBadge toneOf={toneOf}>{children}</ToneBadge>
    const { container } = render(<ToneBadge toneOf={pacuToneOf}>Ready</ToneBadge>);
    expect(classOf(container)).toContain(toneClass.green);
  });

  it("colours a PACU discharge verdict now that the tone reaches it", () => {
    // aldreteReadiness() returns { verdict: "Not ready", tone: "red" }. The console passed the
    // verdict where the tone belonged, so the badge resolved nothing and rendered unstyled.
    const readiness = { verdict: "Not ready", tone: "red" };
    const { container } = render(<ToneBadge tone={readiness.tone} toneOf={pacuToneOf}>{readiness.verdict}</ToneBadge>);
    expect(classOf(container)).toContain(toneClass.red);
  });
});

describe("statToneClass", () => {
  it("returns the tile classes for a known tone", () => {
    expect(statToneClass("rose")).toContain("text-rose-400");
    expect(statToneClass("violet")).toContain("text-violet-400");
  });

  it("falls back to sky rather than undefined", () => {
    for (const tone of ["blue", "critical", "high", undefined, null, ""]) {
      expect(statToneClass(tone)).toContain("text-sky-400");
      expect(statToneClass(tone)).not.toContain("undefined");
    }
  });
});

describe("StatCard", () => {
  it("never writes the string 'undefined' into the icon tile's class list", () => {
    // Dashboard.jsx passes tone="blue" twice, which is not a key in the tone map.
    const { container } = render(<StatCard icon={Activity} label="Assets" value="128" tone="blue" />);
    expect(container.querySelector(".rounded-xl").getAttribute("class")).not.toContain("undefined");
  });

  it("renders label, value and sub", () => {
    render(<StatCard icon={Activity} label="Assets" value="128" sub="+3 this week" />);
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("+3 this week")).toBeInTheDocument();
  });

  it("renders without an icon instead of throwing", () => {
    // `<Icon size={18} />` on an undefined `icon` took the whole console down.
    expect(() => render(<StatCard label="Assets" value="128" />)).not.toThrow();
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("keeps the icon tile when an icon is given", () => {
    const { container } = render(<StatCard icon={Activity} label="Assets" value="128" tone="rose" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".rounded-xl").getAttribute("class")).toContain("text-rose-400");
  });
});

describe("CompactStatCard", () => {
  it("renders without an icon instead of throwing", () => {
    expect(() => render(<CompactStatCard label="Cases" value="12" />)).not.toThrow();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("applies the accent class to the icon it is given", () => {
    const { container } = render(<CompactStatCard icon={Activity} label="Cases" value="12" accent="text-amber-400" />);
    expect(container.querySelector("svg").getAttribute("class")).toContain("text-amber-400");
  });
});
