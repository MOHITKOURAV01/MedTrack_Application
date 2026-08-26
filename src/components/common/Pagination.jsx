import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * How many numbered page buttons are rendered at once. The window slides so the current page stays
 * inside it; the total is not derivable from what is on screen, which is why it is also announced.
 */
const MAX_VISIBLE = 5;

/**
 * The sliding window of page indexes to render, clamped to the real range.
 *
 * @param {number} page 0-based index of the current page
 * @param {number} totalPages total number of pages
 * @returns {number[]} 0-based page indexes, ascending
 */
export function visiblePageRange(page, totalPages) {
  let start = Math.max(0, page - Math.floor(MAX_VISIBLE / 2));
  const end = Math.min(totalPages, start + MAX_VISIBLE);
  if (end - start < MAX_VISIBLE) {
    start = Math.max(0, end - MAX_VISIBLE);
  }

  const pages = [];
  for (let i = start; i < end; i += 1) {
    pages.push(i);
  }
  return pages;
}

/**
 * The pager shared by the Equipment, Maintenance, Retired Assets, Orders and Tasks consoles.
 *
 * `page` is a 0-based index throughout - that is what every caller passes and what `onPageChange`
 * receives back - while the labels are 1-based, because "page 0" means nothing to a user.
 *
 * Two things this component has to get right beyond the click handling:
 *
 * Theme. It is the only shared component that used to hard-code light-theme greys, so in dark mode
 * `text-gray-700` numbers sat on the dark surface at roughly 2:1 contrast and `hover:bg-gray-100`
 * painted a near-white pill under them - the number only became readable at the moment the control
 * inverted. Every colour now has a dark counterpart, matching the vocabulary the other shared
 * components use.
 *
 * Announced state. The active page used to be signalled by `bg-blue-600` alone, so a screen reader
 * read five identical buttons named "1" to "5" with nothing to say where the user was. `aria-current`
 * carries that now, the buttons are named "Page N", and the position and total are exposed as text -
 * with `MAX_VISIBLE` capping the window, the total genuinely cannot be inferred from what is
 * rendered.
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = visiblePageRange(page, totalPages);
  const isFirst = page <= 0;
  const isLast = page >= totalPages - 1;

  const arrowClasses =
    "p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-300 " +
    "hover:bg-slate-100 dark:hover:bg-slate-800 " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 py-4"
    >
      {/*
        The position is announced but not drawn: the numbered buttons already show it, and a second
        visible copy would be noise. `aria-live` is deliberately absent - the buttons move focus
        themselves, so the new page is announced by focus, and a live region would say it twice.
      */}
      <span className="sr-only">
        Page {page + 1} of {totalPages}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={isFirst}
        className={arrowClasses}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      {pages.map((pageNum) => {
        const isCurrent = pageNum === page;
        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            // The property, not a class name: this is what assistive technology reads, and what the
            // test asserts. The background is the sighted half of the same signal.
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`Page ${pageNum + 1}`}
            className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isCurrent
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {pageNum + 1}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={isLast}
        className={arrowClasses}
        aria-label="Next page"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
