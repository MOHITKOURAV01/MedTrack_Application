import { useCallback, useRef, useState } from "react";
import { Download } from "lucide-react";

/**
 * Shared "Export CSV" buttons.
 *
 * Both were extracted from the same page-local original, and only one kept the
 * re-entrancy guard. `ExportButton` takes an `exporting` flag from its page and
 * disables itself; `ExportCsvButton` - the button on ten of the sixteen
 * consoles - took no such flag, was never disabled, and never changed its
 * label. Nothing stopped a second click.
 *
 * That is not a theoretical double-fire. The unguarded handlers are synchronous
 * and end in `downloadCsv(...)` with `Date.now()` in the filename, so a second
 * click lands a second, differently-named file in the user's Downloads folder
 * and raises a second toast. These consoles export clinical data - analyzer QC
 * runs, sample manifests, adverse-event cases, audit evidence - and two
 * near-identical exports timestamped milliseconds apart is exactly the
 * ambiguity an audit trail should not contain.
 *
 * The guard therefore lives *here* rather than in ten pages that each have to
 * remember a busy flag: `useExportGuard` ignores a repeat click while an export
 * is in flight, so all ten consoles are covered without being touched.
 *
 * A page that already tracks its own `exporting` state keeps working - the
 * prop and the internal guard are ORed, so whichever says "busy" wins.
 */

/**
 * How long a click keeps the button busy when the page supplies no `exporting`
 * flag of its own.
 *
 * The unguarded handlers are synchronous: they build the rows, hand the browser
 * a Blob and return, all within one task. So there is no promise to await and
 * nothing to key the busy window to except a timer. This is deliberately in the
 * same range as the 450ms the six guarded consoles already use for their own
 * `setExporting(false)`, which is long enough to swallow a double-click and
 * short enough that a user who genuinely wants a second export is not left
 * wondering why the button is dead.
 */
export const EXPORT_BUSY_MS = 600;

/**
 * Wraps an export handler so a repeat click during the busy window is dropped.
 *
 * @param {Function} onClick the page's export handler
 * @param {number} [busyMs] how long to stay busy after a click
 * @returns {{busy: boolean, handleClick: Function}}
 */
export function useExportGuard(onClick, busyMs = EXPORT_BUSY_MS) {
  const [busy, setBusy] = useState(false);
  // The ref, not the state, is what gates the second click: two clicks in the
  // same frame both read the pre-update `busy`, and the second would slip
  // through. The ref is written synchronously and is already true by then.
  const inFlight = useRef(false);
  const timer = useRef(null);

  const handleClick = useCallback(
    (event) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setBusy(true);
      if (typeof onClick === "function") {
        onClick(event);
      }
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        inFlight.current = false;
        setBusy(false);
      }, busyMs);
    },
    [onClick, busyMs]
  );

  return { busy, handleClick };
}

const ACCENTS = {
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20",
};

/**
 * The status line both buttons render.
 *
 * The busy state used to be conveyed by swapping the visible label to "Writing…"
 * and setting `disabled` - a change a sighted user sees and a screen reader user
 * does not, since the accessible name simply changed under a control that had
 * just become unfocusable. A polite live region announces both ends of it.
 */
function ExportStatus({ busy }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {busy ? "Writing CSV export" : ""}
    </span>
  );
}

/** Variant-A bordered accent export button (sky default, cyan for Cold Chain). */
export function ExportButton({ onClick, exporting, accent = "sky" }) {
  const { busy, handleClick } = useExportGuard(onClick);
  // Either source of truth can say "busy": the page's own flag, which the six
  // variant-A consoles already maintain, or the internal guard.
  const isBusy = Boolean(exporting) || busy;
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-busy={isBusy}
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition disabled:opacity-60 ${
          // An unrecognised accent used to interpolate `undefined` into the
          // class list, leaving the button with no border, background or text
          // colour at all.
          ACCENTS[accent] || ACCENTS.sky
        }`}
      >
        <Download size={14} aria-hidden="true" /> {isBusy ? "Writing…" : "Export CSV"}
      </button>
      <ExportStatus busy={isBusy} />
    </>
  );
}

/** Variant-B slate export button (emerald hover) for the compact command-hub header. */
export function ExportCsvButton({ onClick, exporting }) {
  const { busy, handleClick } = useExportGuard(onClick);
  const isBusy = Boolean(exporting) || busy;
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-busy={isBusy}
        className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
      >
        <Download size={14} aria-hidden="true" /> {isBusy ? "Writing…" : "Export CSV"}
      </button>
      <ExportStatus busy={isBusy} />
    </>
  );
}
