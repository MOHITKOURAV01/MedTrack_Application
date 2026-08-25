import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("lucide-react", () => ({
  ChevronLeft: (props) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props) => <svg data-testid="chevron-right" {...props} />,
  ArrowUp: (props) => <svg data-testid="arrow-up" {...props} />,
}));

import Pagination from "../../components/common/Pagination";
import MedTrackLogo from "../../components/common/MedTrackLogo";
import ScrollToTopButton from "../../components/common/ScrollToTopButton";
import AnimatedSection from "../../components/common/AnimatedSection";

describe("Pagination", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(<Pagination page={0} totalPages={1} onPageChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons", () => {
    render(<Pagination page={0} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls onPageChange when page clicked", () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onPageChange={onChange} />);
    fireEvent.click(screen.getByText("3"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("disables previous on first page", () => {
    render(<Pagination page={0} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("disables next on last page", () => {
    render(<Pagination page={4} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("highlights current page", () => {
    render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
    const currentBtn = screen.getByText("3");
    expect(currentBtn.className).toContain("bg-blue-600");
  });
});

describe("MedTrackLogo", () => {
  it("renders medtrack text", () => {
    render(<MedTrackLogo />);
    expect(screen.getByText('"medtrack"')).toBeInTheDocument();
  });

  it("applies custom size class", () => {
    render(<MedTrackLogo size="text-xl" />);
    const el = screen.getByText('"medtrack"');
    expect(el.className).toContain("text-xl");
  });

  it("applies custom className", () => {
    render(<MedTrackLogo className="my-logo" />);
    const el = screen.getByText('"medtrack"');
    expect(el.className).toContain("my-logo");
  });
});

describe("ScrollToTopButton", () => {
  it("renders nothing when scrolled to top", () => {
    const { container } = render(<ScrollToTopButton />);
    expect(container.innerHTML).toBe("");
  });

  it("appears when scrolled past 300px", () => {
    render(<ScrollToTopButton />);
    fireEvent.scroll(window, { target: { scrollY: 500 } });
    expect(screen.getByLabelText("Scroll to top")).toBeInTheDocument();
  });

  it("calls scrollTo when clicked", () => {
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy;
    render(<ScrollToTopButton />);
    fireEvent.scroll(window, { target: { scrollY: 500 } });
    fireEvent.click(screen.getByLabelText("Scroll to top"));
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

describe("AnimatedSection", () => {
  it("renders children", () => {
    render(<AnimatedSection><div>Animated content</div></AnimatedSection>);
    expect(screen.getByText("Animated content")).toBeInTheDocument();
  });

  it("applies opacity-0 initially", () => {
    const { container } = render(<AnimatedSection><div>Content</div></AnimatedSection>);
    expect(container.firstChild.className).toContain("opacity-0");
  });

  it("applies custom animation class", () => {
    const { container } = render(
      <AnimatedSection animation="animate-fade-left"><div>Content</div></AnimatedSection>
    );
    expect(container.firstChild.className).toContain("animate-fade-left");
  });

  it("applies delay class", () => {
    const { container } = render(
      <AnimatedSection delay="delay-200"><div>Content</div></AnimatedSection>
    );
    expect(container.firstChild.className).toContain("delay-200");
  });

  it("applies custom className", () => {
    const { container } = render(
      <AnimatedSection className="my-section"><div>Content</div></AnimatedSection>
    );
    expect(container.firstChild.className).toContain("my-section");
  });
});
