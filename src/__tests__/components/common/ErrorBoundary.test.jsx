import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ErrorBoundary from "../../../components/common/ErrorBoundary";
import { BASE_PATH } from "../../../routes/routeRegistry";

function ThrowingComponent({ shouldThrow = true }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Child content</div>;
}

/**
 * A child whose throwing is driven by the test rather than by a render count.
 *
 * "Try again" is only meaningful against a failure that does not repeat - a fetch that rejected, a
 * payload that has since been replaced - so the test needs a child that throws and then stops. A
 * self-resetting one-shot flag does not survive React's development-mode re-render of a subtree
 * that threw: the flag is spent before the assertion runs. Flipping the condition explicitly is
 * both deterministic and a fair model of what recovery means here - the underlying cause is gone by
 * the time the user retries.
 */
function ControlledChild({ ctl }) {
  if (ctl.throws) {
    throw new Error("Transient failure");
  }
  return <div>Recovered content</div>;
}

const errorPanel = () => screen.queryByText("Something went wrong");
const goHome = () => screen.getByRole("button", { name: /go home/i });
const tryAgain = () => screen.getByRole("button", { name: /try again/i });

describe("ErrorBoundary", () => {
  const originalError = console.error;
  const originalLocation = window.location;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    window.location = originalLocation;
  });

  describe("rendering", () => {
    it("renders children when no error occurs", () => {
      render(<ErrorBoundary><ThrowingComponent shouldThrow={false} /></ErrorBoundary>);
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("renders the error UI when a child throws", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      expect(errorPanel()).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByText("⚠️")).toBeInTheDocument();
    });

    it("does not render children when an error occurs", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      expect(screen.queryByText("Child content")).not.toBeInTheDocument();
    });

    it("announces the panel to assistive technology", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("logs the error to console.error", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      expect(console.error).toHaveBeenCalledWith(
        "ErrorBoundary caught an error:",
        expect.any(Error),
        expect.any(Object),
      );
    });

    it("calls an onError hook when one is given", () => {
      const onError = vi.fn();
      render(<ErrorBoundary onError={onError}><ThrowingComponent /></ErrorBoundary>);
      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    });

    it("renders without crashing when children is null", () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("recovery", () => {
    it("offers both a retry and a way home", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      expect(tryAgain()).toBeInTheDocument();
      expect(goHome()).toBeInTheDocument();
    });

    it("makes retry the primary action", () => {
      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      // Retrying in place costs the user nothing; a full document navigation costs them their
      // unsaved state. The cheaper action is the one that should carry the primary styling.
      expect(tryAgain().className).toContain("bg-blue-600");
      expect(goHome().className).not.toContain("bg-blue-600");
    });

    it("re-renders the subtree when retry is clicked", () => {
      const ctl = { throws: true };
      render(<ErrorBoundary><ControlledChild ctl={ctl} /></ErrorBoundary>);
      expect(errorPanel()).toBeInTheDocument();

      ctl.throws = false;
      fireEvent.click(tryAgain());

      expect(errorPanel()).not.toBeInTheDocument();
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });

    it("returns to the panel when retry hits the same failure again", () => {
      const ctl = { throws: true };
      render(<ErrorBoundary><ControlledChild ctl={ctl} /></ErrorBoundary>);

      fireEvent.click(tryAgain());

      expect(errorPanel()).toBeInTheDocument();
    });

    // The regression: hasError was never cleared, so in a pushState SPA one broken console
    // disabled every route until the document was reloaded.
    it("clears a caught error when the browser navigates back", () => {
      const ctl = { throws: true };
      render(<ErrorBoundary><ControlledChild ctl={ctl} /></ErrorBoundary>);
      expect(errorPanel()).toBeInTheDocument();

      ctl.throws = false;
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      expect(errorPanel()).not.toBeInTheDocument();
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });

    it("clears a caught error when resetKey changes", () => {
      const ctl = { throws: true };
      const { rerender } = render(
        <ErrorBoundary resetKey="equipment"><ControlledChild ctl={ctl} /></ErrorBoundary>
      );
      expect(errorPanel()).toBeInTheDocument();

      ctl.throws = false;
      rerender(<ErrorBoundary resetKey="dashboard"><ControlledChild ctl={ctl} /></ErrorBoundary>);

      expect(errorPanel()).not.toBeInTheDocument();
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });

    it("keeps the error while resetKey is unchanged", () => {
      const ctl = { throws: true };
      const { rerender } = render(
        <ErrorBoundary resetKey="equipment"><ControlledChild ctl={ctl} /></ErrorBoundary>
      );
      ctl.throws = false;
      rerender(<ErrorBoundary resetKey="equipment"><ControlledChild ctl={ctl} /></ErrorBoundary>);
      expect(errorPanel()).toBeInTheDocument();
    });

    it("detaches its popstate listener on unmount", () => {
      const remove = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      unmount();
      expect(remove).toHaveBeenCalledWith("popstate", expect.any(Function));
      remove.mockRestore();
    });
  });

  describe("go home", () => {
    it("navigates to the base path when the app is served under it", () => {
      delete window.location;
      window.location = { href: "", pathname: `${BASE_PATH}/equipment` };

      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      fireEvent.click(goHome());

      expect(window.location.href).toBe(BASE_PATH);
    });

    it("navigates to the origin root when it is not", () => {
      delete window.location;
      window.location = { href: "", pathname: "/equipment" };

      render(<ErrorBoundary><ThrowingComponent /></ErrorBoundary>);
      fireEvent.click(goHome());

      expect(window.location.href).toBe("/");
    });

    it("uses the registry's BASE_PATH rather than a hand-written copy", () => {
      // The literal this file used to carry drifted from the registry by nothing but luck.
      expect(BASE_PATH).toBe("/MedTrack_Application");
    });
  });
});
