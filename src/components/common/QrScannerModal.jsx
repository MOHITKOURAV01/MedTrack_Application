import React, { useCallback, useEffect, useId, useRef, useState } from "react";

const HISTORY_KEY = "medtrack-scan-history";
const HISTORY_LIMIT = 5;

/** Barcode formats the native BarcodeDetector should accept. */
const SUPPORTED_FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "data_matrix",
];

/**
 * Parses the content of a MedTrack asset tag into a structured result.
 *
 * The backend encodes QR tags as multi-line text:
 *   MedTrack Asset:
 *   ID: <id>
 *   Code: <code>
 *   Name: <name>
 *   SN: <sn>
 *   Dept: <dept>
 *
 * Also tolerates a bare numeric ID, an "EQ-..." code, or any single-line value so
 * third-party labels and barcodes keep working.
 */
export function parseAssetTag(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const idMatch = text.match(/^ID:\s*(.+)$/im);
  const codeMatch = text.match(/^Code:\s*(.+)$/im);
  const nameMatch = text.match(/^Name:\s*(.+)$/im);

  if (idMatch || codeMatch) {
    return {
      id: (idMatch ? idMatch[1] : codeMatch[1]).trim(),
      code: codeMatch ? codeMatch[1].trim() : null,
      name: nameMatch ? nameMatch[1].trim() : null,
      raw: text,
    };
  }

  const singleLine = text.split("\n")[0].trim();
  if (/^EQ-[\w-]+$/i.test(singleLine) || /^\d+$/.test(singleLine)) {
    return { id: singleLine, code: singleLine, name: null, raw: text };
  }

  return { id: text, code: null, name: null, raw: text };
}

/** Reads the persisted last-scanned history. */
export function getScanHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/** Records a scan into the last-scanned history (most recent first). */
export function addScanHistory(entry) {
  const history = getScanHistory().filter(
    (item) => String(item.id) !== String(entry.id)
  );
  history.unshift({ ...entry, at: Date.now() });
  const trimmed = history.slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable (private mode, quota) - history is best-effort only
  }
  return trimmed;
}

/**
 * Camera-based QR / barcode scanner modal.
 *
 * Uses the native BarcodeDetector API (Chromium-based browsers: Chrome, Edge,
 * Android Chrome) with zero external dependencies. Where BarcodeDetector or a
 * camera is unavailable, the modal falls back to manual ID entry and the
 * last-scanned history, so the flow always works.
 *
 * @param {boolean}  open     whether the modal is visible
 * @param {Function} onClose  called when the user dismisses the modal
 * @param {Function} onScan   called with the parsed result ({id, code, name, raw})
 * @param {string}   title    modal heading, defaults to "Scan Asset Tag"
 */
export default function QrScannerModal({ open, onClose, onScan, title }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const firedRef = useRef(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  // The element focus came from, so it can be given back on close.
  const returnFocusRef = useRef(null);
  const headingId = useId();

  // `onScan` and `onClose` are held in refs, not read from the closure, for the
  // reason useIdleTimer documents for its own onLock: both call sites declare
  // their handler as a plain function in the component body, so its identity
  // changes on every parent render. Read directly, that identity flows through
  // handleResult -> scanFrame -> the camera effect's dependency array, and any
  // parent state update while the scanner is open would tear the stream down
  // and call getUserMedia again - a camera that blinks off and on and never
  // settles long enough to read a tag.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [detectorSupported] = useState(() => {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  });
  const [manualId, setManualId] = useState("");
  const [manualError, setManualError] = useState(null);
  const [history, setHistory] = useState([]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  /**
   * Dispatches a scan result exactly once.
   *
   * The camera is released here rather than being left to the caller. Both
   * current callers happen to close the modal in their handler, so the stream
   * was stopped by the effect cleanup - but a caller that kept the scanner open
   * to show a confirmation would have been left with a live camera and a frame
   * loop that had already halted: recording, and no longer reading anything.
   * A result means the scanner is done with the lens.
   */
  const handleResult = useCallback(
    (result) => {
      if (!result || firedRef.current) return;
      firedRef.current = true;
      const parsed = parseAssetTag(result);
      if (parsed) {
        stopCamera();
        addScanHistory({ id: parsed.id, name: parsed.name });
        onScanRef.current?.(parsed);
      }
    },
    [stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || firedRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    detector
      .detect(video)
      .then((codes) => {
        if (codes && codes.length > 0 && codes[0].rawValue) {
          handleResult(codes[0].rawValue);
          return;
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        rafRef.current = requestAnimationFrame(scanFrame);
      });
  }, [handleResult]);

  useEffect(() => {
    setHistory(getScanHistory());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    firedRef.current = false;
    setCameraError(null);
    setScanning(false);

    if (!detectorSupported) {
      setCameraError(
        "Live camera scanning is not supported in this browser. Use the manual ID entry below instead."
      );
      return undefined;
    }

    let cancelled = false;

    const start = async () => {
      try {
        detectorRef.current = new window.BarcodeDetector({
          formats: SUPPORTED_FORMATS,
        });
      } catch (err) {
        console.error("BarcodeDetector init failed:", err);
        detectorRef.current = null;
      }
      if (!detectorRef.current) {
        if (!cancelled) {
          setCameraError(
            "Camera scanning is unavailable in this browser. Use the manual ID entry below instead."
          );
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setScanning(true);
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error("Camera start failed:", err);
        if (!cancelled) {
          setCameraError(
            "Camera is unavailable or permission was denied. Use the manual ID entry below instead."
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stopCamera();
      detectorRef.current = null;
    };
  }, [open, detectorSupported, scanFrame, stopCamera]);

  // ---- Dialog behaviour -------------------------------------------------
  //
  // This overlay is hand-rolled rather than built on components/common/Modal,
  // so none of the shared dialog work reaches it. Until now it was two plain
  // divs: no role, no key handling, no focus management - and unlike every
  // other overlay in the app, this one is holding a camera open. A user who
  // opened it by mistake had no way out but to find a 36px close button with a
  // mouse, because Escape and the backdrop both did nothing.

  /** Elements inside the panel that can hold focus, in document order. */
  const focusablesIn = (root) =>
    root
      ? Array.from(
          root.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
      : [];

  useEffect(() => {
    if (!open) return undefined;

    // Remember where focus was so it can be handed back, rather than dropping
    // to <body> and making the next Tab restart from the top of the page.
    returnFocusRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    // Move focus into the dialog. Without this a screen reader user gets no
    // announcement that anything opened, and Tab walks straight out of the
    // overlay into the table behind it.
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      // Keep Tab inside the panel. The page behind is still in the document and
      // fully focusable; nothing is inert.
      const focusables = focusablesIn(panelRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = returnFocusRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  // Both manual paths go through firedRef and stopCamera for the same reason
  // the camera path does: a detect() promise already in flight can resolve
  // after the user has submitted an ID by hand, and would then dispatch a
  // second, different result for the same scan.
  const submitManual = (e) => {
    e.preventDefault();
    const value = manualId.trim();
    if (!value) {
      setManualError("Enter an asset ID, e.g. EQ-001 or 12.");
      return;
    }
    setManualError(null);
    if (firedRef.current) return;
    firedRef.current = true;
    stopCamera();
    const parsed = parseAssetTag(value);
    addScanHistory({ id: parsed.id, name: parsed.name });
    onScanRef.current?.(parsed);
  };

  const reuseHistory = (entry) => {
    if (firedRef.current) return;
    firedRef.current = true;
    stopCamera();
    onScanRef.current?.({ id: entry.id, name: entry.name, raw: entry.id });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      // Only a click that both starts and ends on the backdrop dismisses. A
      // plain onClick here also fires for a text selection that begins inside
      // the panel and is released outside it, which would throw the dialog away
      // mid-drag.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      data-testid="qr-scanner-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-card rounded-3xl p-8 max-w-lg w-full shadow-2xl relative border border-subtle"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-hover text-secondary border-none flex items-center justify-center text-xl font-bold cursor-pointer transition-colors hover:bg-subtle"
          aria-label="Close scanner"
        >
          &times;
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
            📷
          </div>
          <div>
            <h2 id={headingId} className="text-2xl font-extrabold text-primary m-0">
              {title || "Scan Asset Tag"}
            </h2>
            <p className="text-secondary text-sm mt-1">
              Point the camera at the equipment QR tag or barcode.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-h-72 w-full flex items-center justify-center">
            {detectorSupported && !cameraError && (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
            )}
            {!scanning && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                <div className="inline-block w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-xs font-semibold">Starting camera...</p>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <span className="text-3xl">📵</span>
                <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
              </div>
            )}
          </div>

          <form onSubmit={submitManual} className="flex gap-2">
            {/* On every non-Chromium browser BarcodeDetector is absent, so this
                input *is* the scanner - and it was a nameless text box with a
                placeholder for a label. */}
            <input
              type="text"
              aria-label="Asset ID"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Or enter asset ID manually (e.g. EQ-001)"
              className="flex-1 px-4 py-3 rounded-xl border border-subtle bg-surface text-primary text-sm outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm border-none cursor-pointer shadow-sm"
            >
              Look Up
            </button>
          </form>
          {manualError && (
            <p className="text-red-500 text-xs font-semibold -mt-2">{manualError}</p>
          )}

          {history.length > 0 && (
            <div>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-wider mb-2">
                Last Scanned
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((entry) => (
                  <button
                    key={`${entry.id}-${entry.at}`}
                    type="button"
                    onClick={() => reuseHistory(entry)}
                    className="px-3 py-1.5 rounded-full bg-hover hover:bg-subtle border border-subtle text-xs font-bold text-primary cursor-pointer transition-colors"
                  >
                    {entry.name ? `${entry.name} (${entry.id})` : entry.id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-secondary font-bold hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
