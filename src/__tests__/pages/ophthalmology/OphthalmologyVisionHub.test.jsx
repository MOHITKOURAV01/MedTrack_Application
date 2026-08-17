// Tests for the Ophthalmology & Vision Diagnostics Hub.
//
// The weight is on the IOL biometry console, because that is the part of the page that makes a claim
// rather than displays a number. It recalculates the lens power from the measurements the surgical
// plan was built on and compares; if the recalculation is wrong, the console silently endorses bad
// plans and rejects good ones, which is worse than not checking at all.
//
// So the formula is tested against hand-worked values rather than against itself, each A-constant
// band is pinned separately, and - the case that matters most - the eyes the console *refuses* to
// calculate are asserted as refusals rather than as agreement.

import { screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderWithProviders } from "../../utils/renderWithProviders";
import OphthalmologyVisionHub, {
  iolPower,
  biometryFlags,
  verifyBiometry,
  laserEnergyDeviation,
  laserFaults,
  referralFor,
} from "../../../pages/ophthalmology/OphthalmologyVisionHub";

/** A well-behaved eye: mid-range axial length, ordinary cornea, symmetrical fellow eye. */
const ordinaryEye = {
  id: "BIO-TEST",
  patient: "PT-0000 — Test",
  eye: "OD",
  axial: 23.42,
  keratometry: 43.75,
  aConstant: 118.9,
  lens: "SN60WF",
  targetRefraction: 0,
  plannedPower: 21.5,
  fellowAxial: 23.51,
  constantOptimised: true,
  biometer: "IOLMaster 700",
};

describe("iolPower", () => {
  it("computes the SRK II power for an ordinary eye", () => {
    // Hand-worked: 22.0 <= 23.42 <= 24.5, so A is unbanded at 118.9.
    //   118.9 - 2.5(23.42) - 0.9(43.75) = 118.9 - 58.55 - 39.375 = 20.975
    // Emmetropic is below 14? No - 20.975 > 14, so CR is 1.5, and the target is 0, so the corrected
    // power is unchanged. Rounded to the quarter-dioptre step: 21.00.
    const result = iolPower({ axial: 23.42, keratometry: 43.75, aConstant: 118.9, targetRefraction: 0 });

    expect(result.adjustedA).toBe(118.9);
    expect(result.emmetropic).toBe(20.98);
    expect(result.correctionFactor).toBe(1.5);
    expect(result.power).toBe(21);
  });

  it("bands the A-constant by axial length, which is the whole reason SRK II exists", () => {
    // Plain SRK is one regression line through eyes of every length. The bands are the admission
    // that one line does not fit, so each boundary is pinned individually.
    const base = { keratometry: 44, aConstant: 118.9, targetRefraction: 0 };

    expect(iolPower({ ...base, axial: 19.5 }).adjustedA).toBe(121.9); // A + 3
    expect(iolPower({ ...base, axial: 20.5 }).adjustedA).toBe(120.9); // A + 2
    expect(iolPower({ ...base, axial: 21.5 }).adjustedA).toBe(119.9); // A + 1
    expect(iolPower({ ...base, axial: 23.0 }).adjustedA).toBe(118.9); // A
    expect(iolPower({ ...base, axial: 25.0 }).adjustedA).toBe(118.4); // A - 0.5
  });

  it("puts each band boundary on the correct side", () => {
    // 20.0, 21.0, 22.0 and 24.5 are the edges. An off-by-one here shifts a whole cohort of eyes into
    // the wrong band, and every one of them still gets a plausible-looking number.
    const base = { keratometry: 44, aConstant: 118.9, targetRefraction: 0 };

    expect(iolPower({ ...base, axial: 19.99 }).adjustedA).toBe(121.9);
    expect(iolPower({ ...base, axial: 20.0 }).adjustedA).toBe(120.9);
    expect(iolPower({ ...base, axial: 20.99 }).adjustedA).toBe(120.9);
    expect(iolPower({ ...base, axial: 21.0 }).adjustedA).toBe(119.9);
    expect(iolPower({ ...base, axial: 21.99 }).adjustedA).toBe(119.9);
    expect(iolPower({ ...base, axial: 22.0 }).adjustedA).toBe(118.9);
    expect(iolPower({ ...base, axial: 24.5 }).adjustedA).toBe(118.9);
    expect(iolPower({ ...base, axial: 24.51 }).adjustedA).toBe(118.4);
  });

  it("applies the refractive correction factor to reach the target", () => {
    // A myopic target needs more power, not less: P(target) = P(emmetropia) - target x CR, and for a
    // negative target that subtraction adds.
    const emmetropic = iolPower({ axial: 23.42, keratometry: 43.75, aConstant: 118.9, targetRefraction: 0 });
    const myopic = iolPower({ axial: 23.42, keratometry: 43.75, aConstant: 118.9, targetRefraction: -1.0 });

    expect(myopic.power).toBeGreaterThan(emmetropic.power);
    expect(myopic.power - emmetropic.power).toBeCloseTo(1.5, 5); // CR of 1.5 at this power
  });

  it("drops the correction factor to 1.0 for a low-power lens", () => {
    // CR is 1.5 only above 14 D. A long eye needing a weak lens is the case that gets this wrong if
    // the factor is hardcoded.
    //
    //   118.7 - 0.5 = 118.2 (banded for L > 24.5)
    //   118.2 - 2.5(27.0) - 0.9(42.0) = 118.2 - 67.5 - 37.8 = 12.9
    //
    // A 27 mm eye is beyond REGRESSION_SAFE_AXIAL, which is why verifyBiometry would refuse it -
    // but iolPower is the formula on its own, and the low-power branch only exists for eyes like
    // this one, so it is the right input to exercise it with.
    const lowPower = iolPower({ axial: 27.0, keratometry: 42.0, aConstant: 118.7, targetRefraction: -1.0 });

    expect(lowPower.emmetropic).toBeLessThan(14);
    expect(lowPower.correctionFactor).toBe(1);
    // 12.9 - (-1.0 x 1.0) = 13.9, which is not a step a lens is supplied in, so 14.00.
    expect(lowPower.power).toBe(14);
  });

  it("rounds to the quarter-dioptre step lenses are actually supplied in", () => {
    // A recalculation of 21.13 D is not orderable and would read as a disagreement with a correct
    // 21.00 D plan.
    for (const axial of [22.1, 23.0, 23.37, 24.02, 24.49]) {
      const { power } = iolPower({ axial, keratometry: 43.9, aConstant: 118.9, targetRefraction: -0.25 });
      expect((power * 4) % 1, `quarter-dioptre step at ${axial} mm`).toBe(0);
    }
  });
});

describe("biometryFlags", () => {
  it("passes a clean eye with nothing to say", () => {
    expect(biometryFlags(ordinaryEye)).toEqual([]);
  });

  it("flags an axial length outside the range the regression was fitted on", () => {
    const short = biometryFlags({ ...ordinaryEye, axial: 21.36, fellowAxial: 21.44 });
    const long = biometryFlags({ ...ordinaryEye, axial: 26.9, fellowAxial: 26.85 });

    expect(short.map((f) => f.code)).toContain("AXIAL_OUT_OF_RANGE");
    expect(long.map((f) => f.code)).toContain("AXIAL_OUT_OF_RANGE");
    expect(short[0].tone).toBe("red");
  });

  it("flags a cornea outside the plausible keratometric range", () => {
    const flat = biometryFlags({ ...ordinaryEye, keratometry: 38.9 });
    expect(flat.map((f) => f.code)).toContain("KERATOMETRY_IMPLAUSIBLE");
  });

  it("flags inter-eye asymmetry beyond the re-measure tolerance", () => {
    const asymmetric = biometryFlags({ ...ordinaryEye, axial: 23.9, fellowAxial: 24.85 });
    const flag = asymmetric.find((f) => f.code === "INTEROCULAR_ASYMMETRY");

    expect(flag).toBeTruthy();
    expect(flag.text).toMatch(/0\.95 mm/);
    // Amber, not red: the measurement is repeatable, so this is a hold rather than a refusal.
    expect(flag.tone).toBe("amber");
  });

  it("does not flag symmetry inside tolerance", () => {
    const within_ = biometryFlags({ ...ordinaryEye, axial: 23.42, fellowAxial: 23.70 });
    expect(within_.map((f) => f.code)).not.toContain("INTEROCULAR_ASYMMETRY");
  });

  it("flags a lens constant that has not been optimised for this theatre", () => {
    const unoptimised = biometryFlags({ ...ordinaryEye, constantOptimised: false });
    expect(unoptimised.map((f) => f.code)).toContain("CONSTANT_NOT_OPTIMISED");
  });

  it("reports every problem at once rather than stopping at the first", () => {
    // The short-circuit is the tempting mistake: the reviewer fixes one, re-runs, and meets the
    // next. An eye can be short, flat, asymmetric and on an unoptimised constant simultaneously.
    const bad = biometryFlags({
      ...ordinaryEye,
      axial: 21.0,
      keratometry: 49.5,
      fellowAxial: 22.4,
      constantOptimised: false,
    });

    expect(bad.map((f) => f.code).sort()).toEqual([
      "AXIAL_OUT_OF_RANGE",
      "CONSTANT_NOT_OPTIMISED",
      "INTEROCULAR_ASYMMETRY",
      "KERATOMETRY_IMPLAUSIBLE",
    ]);
  });
});

describe("verifyBiometry", () => {
  it("verifies a plan that matches the recalculation", () => {
    const result = verifyBiometry({ ...ordinaryEye, plannedPower: 21.0, targetRefraction: 0 });

    expect(result.verdict).toBe("Verified");
    expect(result.variance).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it("holds a plan that disagrees by more than the tolerance", () => {
    const result = verifyBiometry({ ...ordinaryEye, plannedPower: 24.0, targetRefraction: 0 });

    expect(result.verdict).toBe("Held");
    expect(result.variance).toBe(-3);
  });

  it("verifies a plan sitting exactly on the tolerance boundary", () => {
    // Tighter and every legitimate rounding decision fires; looser and a real error passes. The
    // boundary itself has to be inclusive or the console holds a correct plan.
    const result = verifyBiometry({ ...ordinaryEye, plannedPower: 21.5, targetRefraction: 0 });

    expect(Math.abs(result.variance)).toBe(0.5);
    expect(result.verdict).toBe("Verified");
  });

  it("refuses to produce a number for an eye outside the formula's range", () => {
    // The case that matters most. A number here would be read as agreement or disagreement with the
    // plan, and it is neither - the regression is systematically wrong at the extremes, so a
    // confident output is worse than no output.
    const result = verifyBiometry({ ...ordinaryEye, axial: 21.36, fellowAxial: 21.44, plannedPower: 27.0 });

    expect(result.blocked).toBe(true);
    expect(result.verdict).toBe("Not calculable");
    expect(result.calculated).toBeNull();
    expect(result.variance).toBeNull();
  });

  it("still calculates when the only problems are advisory", () => {
    // An unoptimised constant is worth saying and is not a reason to withhold the check.
    const result = verifyBiometry({ ...ordinaryEye, constantOptimised: false, plannedPower: 21.0 });

    expect(result.blocked).toBe(false);
    expect(result.calculated).not.toBeNull();
    expect(result.flags.map((f) => f.code)).toEqual(["CONSTANT_NOT_OPTIMISED"]);
  });
});

describe("laser safety", () => {
  const laser = {
    id: "OPH-LAS-TEST",
    shots: 10_000,
    shotLimit: 200_000,
    setEnergyMj: 2.0,
    deliveredMj: 2.0,
    interlock: true,
    keyOut: true,
    lastServiceDays: 30,
  };

  it("reports delivered energy as a signed percentage of the set point", () => {
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 2.2 }).deviationPct).toBe(10);
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 1.8 }).deviationPct).toBe(-10);
    expect(laserEnergyDeviation(laser).deviationPct).toBe(0);
  });

  it("holds the tolerance at exactly twenty per cent in both directions", () => {
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 2.4 }).inTolerance).toBe(true);
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 1.6 }).inTolerance).toBe(true);
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 2.45 }).inTolerance).toBe(false);
    expect(laserEnergyDeviation({ ...laser, deliveredMj: 1.55 }).inTolerance).toBe(false);
  });

  it("clears a laser with nothing wrong", () => {
    expect(laserFaults(laser)).toEqual([]);
  });

  it("puts the interlock first, because it is the fault that endangers the room", () => {
    // Every other fault harms the patient on the table. An open interlock means the beam can be
    // fired into an unprotected room, so it leads the list a safety officer reads.
    const faults = laserFaults({ ...laser, interlock: false, keyOut: false, lastServiceDays: 400 });

    expect(faults[0].code).toBe("INTERLOCK_OPEN");
    expect(faults[0].tone).toBe("red");
  });

  it("takes a laser out of service past its shot limit", () => {
    const faults = laserFaults({ ...laser, shots: 250_001, shotLimit: 250_000 });
    const fault = faults.find((f) => f.code === "SHOT_LIMIT");

    expect(fault.tone).toBe("red");
  });

  it("treats key control and an overdue service as advisory rather than out of service", () => {
    const faults = laserFaults({ ...laser, keyOut: false, lastServiceDays: 400 });

    expect(faults.map((f) => f.code).sort()).toEqual(["KEY_LEFT_IN", "SERVICE_OVERDUE"]);
    expect(faults.every((f) => f.tone === "amber")).toBe(true);
  });
});

describe("referralFor", () => {
  const episode = { grade: "R0", maculopathy: "M0", gradable: true };

  it("puts proliferative disease on the two-week pathway", () => {
    // R3 is the reason grading carries a clock at all: the eye can lose vision inside the time a
    // routine appointment takes to arrive.
    const referral = referralFor({ ...episode, grade: "R3" });

    expect(referral.days).toBe(14);
    expect(referral.tone).toBe("red");
  });

  it("puts pre-proliferative disease on the routine pathway", () => {
    expect(referralFor({ ...episode, grade: "R2" }).days).toBe(91);
  });

  it("does not refer background or absent retinopathy", () => {
    expect(referralFor({ ...episode, grade: "R0" }).days).toBeNull();
    expect(referralFor({ ...episode, grade: "R1" }).days).toBeNull();
  });

  it("refers on maculopathy even when the retinopathy grade would not", () => {
    // M1 with R1 is the combination that a retinopathy-only rule misses entirely.
    expect(referralFor({ ...episode, grade: "R1", maculopathy: "M1" }).days).toBe(91);
  });

  it("takes whichever of the two grades is more urgent", () => {
    expect(referralFor({ ...episode, grade: "R3", maculopathy: "M1" }).days).toBe(14);
  });

  it("refers ungradable images rather than treating them as normal", () => {
    // An ungradable image is an absence of evidence, not evidence of absence.
    const referral = referralFor({ ...episode, gradable: false });

    expect(referral.days).toBe(91);
    expect(referral.reason).toMatch(/slit-lamp/);
  });
});

describe("OphthalmologyVisionHub rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the heading, the stat strip and all four consoles", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    expect(screen.getByText(/Ophthalmology & Vision Diagnostics Hub/)).toBeInTheDocument();
    expect(screen.getByText("Calibration Overdue")).toBeInTheDocument();
    expect(screen.getByText("Lasers Out of Service")).toBeInTheDocument();
    expect(screen.getByText("Urgent DR Referrals")).toBeInTheDocument();
    expect(screen.getByText("Lens Powers Held")).toBeInTheDocument();

    for (const label of ["Imaging Fleet", "Laser Suite", "DR Screening", "IOL Biometry"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("opens on the imaging fleet and marks a lapsed calibration", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    expect(screen.getByText("OPH-OCT-01")).toBeInTheDocument();
    // OPH-VF-01 seeds at -3 days.
    expect(screen.getByText("3d over")).toBeInTheDocument();
    expect(screen.getByText(/plausible, wrong measurement/)).toBeInTheDocument();
  });

  it("records a calibration and clears the overdue state", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    const card = screen.getByText("OPH-VF-01").closest("article");
    fireEvent.click(within(card).getByRole("button", { name: /Record calibration/ }));

    expect(screen.queryByText("3d over")).not.toBeInTheDocument();
  });

  it("filters imaging units by status", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: "Maintenance" }));

    expect(screen.getByText("OPH-VF-02")).toBeInTheDocument();
    expect(screen.queryByText("OPH-OCT-01")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches the search", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.change(screen.getByPlaceholderText(/Search units, lasers/), {
      target: { value: "no-such-device" },
    });

    expect(screen.getByText("No imaging units match the current filters.")).toBeInTheDocument();
  });

  it("takes the interlock-open and over-limit lasers out of service", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /Laser Suite/ }));

    // OPH-LAS-04 has interlock false; OPH-LAS-05 is past its shot limit; OPH-LAS-02 and OPH-LAS-06
    // are outside the energy tolerance.
    expect(screen.getAllByText("Out of service").length).toBeGreaterThanOrEqual(3);
  });

  it("records a laser output check and returns it to tolerance", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /Laser Suite/ }));
    const before = screen.getAllByText("Out of service").length;

    const row = screen.getByText("OPH-LAS-02").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: /Record output check/ }));

    expect(screen.getAllByText("Out of service").length).toBe(before - 1);
  });

  it("surfaces the referral window and the AI disagreement on a screening episode", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /DR Screening/ }));

    expect(screen.getByText("DRS-4473")).toBeInTheDocument();
    expect(screen.getAllByText(/Refer urgently/).length).toBeGreaterThan(0);
    // DRS-4477 was pre-screened R2 and graded R1.
    expect(screen.getAllByText(/Pre-screen returned/).length).toBeGreaterThan(0);
  });

  it("filters screening episodes down to the referable ones", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /DR Screening/ }));
    fireEvent.click(screen.getByRole("button", { name: "Referable" }));

    // The R0/R0 pair is the only non-referable, fully clear patient in the seed set.
    expect(screen.queryByText("DRS-4475")).not.toBeInTheDocument();
    expect(screen.getByText("DRS-4473")).toBeInTheDocument();
  });

  it("shows the recalculated power beside the plan on the biometry console", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /IOL Biometry/ }));

    expect(screen.getByText("BIO-2201")).toBeInTheDocument();
    expect(screen.getAllByText("Recalc.").length).toBeGreaterThan(0);
    expect(screen.getByText(/never treats it as an input|recalculated from the biometry/)).toBeInTheDocument();
  });

  it("refuses a power for the short and post-refractive eyes and says so", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /IOL Biometry/ }));
    fireEvent.click(screen.getByRole("button", { name: "Not calculable" }));

    // BIO-2203 is 21.36 mm; BIO-2205 has a 38.90 D cornea.
    expect(screen.getByText("BIO-2203")).toBeInTheDocument();
    expect(screen.getByText("BIO-2205")).toBeInTheDocument();
    expect(screen.queryByText("BIO-2201")).not.toBeInTheDocument();
  });

  it("opens the biometry inspection panel with the worked calculation", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    fireEvent.click(screen.getByRole("button", { name: /IOL Biometry/ }));
    fireEvent.click(screen.getByRole("button", { name: "BIO-2201" }));

    expect(screen.getByText(/SRK II bands the A-constant/)).toBeInTheDocument();
    expect(screen.getByText("Fellow eye")).toBeInTheDocument();
  });

  it("keeps running through its own simulation ticks", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(12_000);
      });
    }).not.toThrow();

    expect(screen.getByText(/Ophthalmology & Vision Diagnostics Hub/)).toBeInTheDocument();
  });

  it("pauses and resumes the simulation", () => {
    renderWithProviders(<OphthalmologyVisionHub />);

    expect(screen.getByText(/Live simulation at 1×/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Pause simulation"));

    expect(screen.getByText("Simulation paused")).toBeInTheDocument();
  });
});
