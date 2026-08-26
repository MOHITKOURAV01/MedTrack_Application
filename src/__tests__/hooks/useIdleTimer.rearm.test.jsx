import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { useState } from "react";
import useIdleTimer from "../../hooks/useIdleTimer";

/**
 * Second-session behaviour (#23).
 *
 * SessionGuard wraps the whole application and is never unmounted; signing out only flips its
 * `enabled` flag. So "a second session" is not a second mount - it is the same hook instance being
 * re-enabled, and everything held in a ref survives the transition.
 *
 * That is what made the original bug so hard to see from the existing suite: every case in
 * useIdleTimer.test.js renders with `enabled` fixed for the life of the test, so the hook is only
 * ever exercised for one session. These tests drive the transition the way SessionGuard does.
 */

const TIMEOUT_MS = 10_000;
const TICK_MS = 1_000;

/** Mirrors SessionGuard: one long-lived hook whose `enabled` flag follows the session. */
function Harness({ onLock, timeoutMs = TIMEOUT_MS }) {
  const [enabled, setEnabled] = useState(true);
  const { remainingMs, reset } = useIdleTimer({
    timeoutMs,
    onLock,
    tickMs: TICK_MS,
    enabled,
  });
  return (
    <>
      <span data-testid="remaining">{remainingMs}</span>
      <button onClick={() => setEnabled(false)}>sign out</button>
      <button onClick={() => setEnabled(true)}>sign in</button>
      <button onClick={reset}>stay signed in</button>
    </>
  );
}

const remaining = () => Number(screen.getByTestId("remaining").textContent);
const press = (name) => act(() => { screen.getByText(name).click(); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe("useIdleTimer across sessions", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does not lock the next session on the tick after signing back in", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    // Session one idles out.
    advance(TIMEOUT_MS);
    expect(onLock).toHaveBeenCalledTimes(1);

    // SessionGuard's logout(), then the user signs back in. No activity in between: the sign-in
    // click happens while the listeners are still uninstalled, which is the whole trap.
    press("sign out");
    press("sign in");

    advance(TICK_MS);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("reports a full window immediately on re-enable, not a stale zero", () => {
    render(<Harness onLock={vi.fn()} />);

    advance(TIMEOUT_MS);
    expect(remaining()).toBe(0);

    press("sign out");
    press("sign in");

    // SessionGuard derives showWarning from this value, so a stale zero flashes the countdown
    // dialog over a session that is seconds old.
    expect(remaining()).toBe(TIMEOUT_MS);
  });

  it("still locks the second session after a full idle window", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    advance(TIMEOUT_MS);
    expect(onLock).toHaveBeenCalledTimes(1);

    press("sign out");
    press("sign in");

    // Re-arming must not mean "never lock again": the policy still applies to session two.
    advance(TIMEOUT_MS - TICK_MS);
    expect(onLock).toHaveBeenCalledTimes(1);
    advance(TICK_MS);
    expect(onLock).toHaveBeenCalledTimes(2);
  });

  it("survives repeated sign-out / sign-in cycles without a spurious lock", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    advance(TIMEOUT_MS);
    expect(onLock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i += 1) {
      press("sign out");
      press("sign in");
      advance(TICK_MS * 2);
    }
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("gives a session that never locked a full window when it is re-enabled", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    // Sign out deliberately, part-way through the window.
    advance(7_000);
    expect(remaining()).toBe(3_000);
    press("sign out");

    // The next session inherits nothing: it gets the whole timeout, not the 3s that were left.
    press("sign in");
    expect(remaining()).toBe(TIMEOUT_MS);

    advance(TIMEOUT_MS - TICK_MS);
    expect(onLock).not.toHaveBeenCalled();
  });

  it("installs no timers while disabled, however long the gap", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    press("sign out");
    advance(60 * 60 * 1000);
    expect(onLock).not.toHaveBeenCalled();

    press("sign in");
    advance(TICK_MS);
    expect(onLock).not.toHaveBeenCalled();
  });
});

describe("reset() after the countdown has stopped", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("re-arms the interval so the session is monitored again", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    advance(TIMEOUT_MS);
    expect(onLock).toHaveBeenCalledTimes(1);

    // The interval stopped itself at zero. reset() has to install a new one, or the countdown
    // would show a full window over a session nothing is watching.
    press("stay signed in");
    expect(remaining()).toBe(TIMEOUT_MS);

    advance(4_000);
    expect(remaining()).toBe(6_000);

    advance(6_000);
    expect(onLock).toHaveBeenCalledTimes(2);
  });

  it("resets mid-session without disturbing the countdown", () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);

    advance(6_000);
    expect(remaining()).toBe(4_000);

    press("stay signed in");
    expect(remaining()).toBe(TIMEOUT_MS);

    advance(3_000);
    expect(remaining()).toBe(7_000);
    expect(onLock).not.toHaveBeenCalled();
  });
});
