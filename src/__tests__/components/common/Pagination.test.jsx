import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../../../components/common/Pagination";

describe("Pagination", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(<Pagination page={0} totalPages={1} onPageChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons for multiple pages", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onPageChange when a page button is clicked", () => {
    const handleChange = vi.fn();
    render(<Pagination page={0} totalPages={3} onPageChange={handleChange} />);
    fireEvent.click(screen.getByText("2"));
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("highlights the current page", () => {
    // Asserted through aria-current rather than a Tailwind class. The class version tested the
    // stylesheet, not the contract - it passed whatever the theme did, and would have kept passing
    // while the control was invisible in dark mode, which is exactly what #26 was.
    render(<Pagination page={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute("aria-current");
  });

  it("disables Previous button on first page", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={() => {}} />);
    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    expect(prevBtn).toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(<Pagination page={2} totalPages={3} onPageChange={() => {}} />);
    const nextBtn = screen.getByRole("button", { name: /next page/i });
    expect(nextBtn).toBeDisabled();
  });

  it("enables Previous and Next on middle pages", () => {
    render(<Pagination page={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
  });

  it("Previous button navigates to previous page", () => {
    const handleChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onPageChange={handleChange} />);
    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it("Next button navigates to next page", () => {
    const handleChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onPageChange={handleChange} />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it("handles large page counts with windowed display", () => {
    render(<Pagination page={5} totalPages={20} onPageChange={() => {}} />);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders 1-indexed page numbers (not 0-indexed)", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
