import { X, XIcon } from "lucide-react";
import useDialog, { useBackdropDismiss } from "../../hooks/useDialog";

/**
 * Shared modal primitives.
 *
 * Thirteen hub pages previously defined their own (near-identical) `Modal` component inline. This
 * module is the single source of truth in three flavors:
 *
 *  - `InspectionModal`  - the "inspection panel" modal: controlled via `open`, closes on Escape or
 *    backdrop click, optional `wide` layout, and an icon tile whose accent color is configurable
 *    (`text-sky-400` default; the Cold Chain hub uses `text-cyan-400`).
 *  - `SimpleModal`      - the lightweight confirmation/detail modal: always rendered, closes on
 *    backdrop click, optional custom `closeIcon`.
 *  - `DetailModal`      - the transfusion/oncology/renal/sterile detail modal.
 *
 * All three preserve the exact markup of the page-local versions they replace.
 *
 * Dialog behaviour
 * ----------------
 * All three now go through `useDialog`, which supplies the behaviour the `role="dialog"
 * aria-modal="true"` attributes were already promising: focus moves into the panel on open, Tab is
 * trapped inside it, focus returns to the opener on close, Escape closes, and the page behind stops
 * scrolling. `InspectionModal` previously had Escape and nothing else; the other two had neither
 * the behaviour nor - in `SimpleModal`'s case - the role.
 *
 * The backdrop closes on a click that *began* on the backdrop rather than on any click that reaches
 * it, so releasing a text selection outside the panel no longer discards the panel.
 */

export function InspectionModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  wide = false,
  accent = "text-sky-400",
}) {
  const { panelRef } = useDialog({ open, onClose });
  const backdrop = useBackdropDismiss(onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" {...backdrop} />
      <div ref={panelRef} className={`relative w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[86vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 animate-scale-up`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            {Icon ? (
              <div className={`rounded-xl border border-slate-700 bg-slate-800 p-2 ${accent}`}>
                <Icon size={18} />
              </div>
            ) : null}
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close inspection panel">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function SimpleModal({ title, subtitle, onClose, children, closeIcon: CloseIcon = XIcon }) {
  // Always rendered by its callers, so it is open for as long as it exists.
  const { panelRef } = useDialog({ open: true, onClose });
  const backdrop = useBackdropDismiss(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm text-slate-300">{children}</div>
      </div>
    </div>
  );
}

/**
 * Detail modal used by the transfusion/oncology/renal/sterile hubs: identical to their page-local
 * `Modal`, with an `aria-label` on the dialog and a `gap-4` header row.
 */
export function DetailModal({ title, subtitle, onClose, children }) {
  const { panelRef } = useDialog({ open: true, onClose });
  const backdrop = useBackdropDismiss(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm text-slate-300">{children}</div>
      </div>
    </div>
  );
}
