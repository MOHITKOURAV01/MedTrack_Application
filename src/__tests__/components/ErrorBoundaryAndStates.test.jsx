import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("lucide-react", () => ({
  AlertCircle: (props) => <svg data-testid="alert-circle" {...props} />,
  RefreshCw: (props) => <svg data-testid="refresh-cw" {...props} />,
}));

import ErrorBoundary from "../../components/common/ErrorBoundary";
import { LoadingSpinner, SkeletonLoader } from "../../components/common/LoadingStates";

function Bomb() {
  throw new Error("Test bomb");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(<ErrorBoundary><div>Safe content</div></ErrorBoundary>);
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("⚠️")).toBeInTheDocument();
    expect(screen.getByText("Go Home")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("Go Home button navigates", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete window.location;
    window.location = { href: "", pathname: "/" };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    screen.getByText("Go Home").click();
    expect(window.location.href).toBe("/");
    spy.mockRestore();
  });

  it("Go Home handles MedTrack path", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    window.location = { href: "", pathname: "/MedTrack_Application/dashboard" };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    screen.getByText("Go Home").click();
    expect(window.location.href).toBe("/MedTrack_Application");
    spy.mockRestore();
  });
});

describe("LoadingSpinner", () => {
  it("renders with default text", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
  it("renders with custom text", () => {
    render(<LoadingSpinner text="Fetching data..." />);
    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
  });
  it("renders spinner element", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});

describe("SkeletonLoader", () => {
  it("renders default 5 rows", () => {
    const { container } = render(<SkeletonLoader />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });
  it("renders custom rows", () => {
    const { container } = render(<SkeletonLoader rows={3} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
  it("applies custom className", () => {
    const { container } = render(<SkeletonLoader className="my-custom" />);
    expect(container.firstChild.className).toContain("my-custom");
  });
});
