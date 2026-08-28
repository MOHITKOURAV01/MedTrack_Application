/**
 * Shared tone map + badge.
 *
 * Six hub pages (regulatory audit, lab automation, pharmacovigilance, radiology, security
 * compliance, surgical robotics) previously defined the same `toneClass` map and the same
 * text-derived `Badge` component inline. This module consolidates both. Each page keeps its own
 * domain-specific `toneOf` word->tone classifier (the vocabularies genuinely differ between
 * domains) and passes it through the `toneOf` prop.
 *
 * Resolving a tone
 * ----------------
 * `tone` is a colour key. `toneOf` turns a domain word into one. The lookup used to be:
 *
 *   toneClass[tone || toneOf(children)]
 *
 * which has two failure modes that compound. `toneClass[...]` has no fallback, so an unrecognised
 * key interpolates the string `"undefined"` into the class list and the badge renders with no
 * border, no background and no text colour. And `tone ||` short-circuits, so passing a *domain
 * word* as `tone` - which several call sites do - skips the classifier that exists to translate
 * it, and lands on exactly that unrecognised key.
 *
 * `resolveTone` closes both. A `tone` that is already a colour key is used as-is; a `tone` that is
 * not is offered to `toneOf` before being given up on; anything still unresolved is `slate`, the
 * neutral tone the page classifiers already return for a word they do not know.
 */

export const toneClass = {
  red: "bg-red-500/10 text-red-400 border-red-500/30",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  sky: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  slate: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

/** The tone used for anything the caller and its classifier both leave unresolved. */
export const DEFAULT_TONE = "slate";

/**
 * Picks the colour key for a badge.
 *
 * @param {unknown} tone the caller's `tone` prop: a colour key, a domain word, or nothing
 * @param {unknown} children the badge text, offered to the classifier when `tone` is absent
 * @param {Function} toneOf the page's word->tone classifier
 * @returns {string} a key that is definitely present in `toneClass`
 */
export function resolveTone(tone, children, toneOf) {
  const classify = typeof toneOf === "function" ? toneOf : () => DEFAULT_TONE;

  // A colour key wins outright.
  if (tone && Object.prototype.hasOwnProperty.call(toneClass, tone)) {
    return tone;
  }

  // Not a colour key. If something was passed it is a domain word, so classify *that* rather than
  // the badge text - `tone={readiness.verdict}` means the verdict is what carries the meaning.
  // Falling back to the text keeps the no-tone call sites working unchanged.
  const subject = tone == null || tone === "" ? children : tone;
  const classified = classify(subject);

  return Object.prototype.hasOwnProperty.call(toneClass, classified) ? classified : DEFAULT_TONE;
}

export const ToneBadge = ({ children, tone, toneOf = () => DEFAULT_TONE }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      toneClass[resolveTone(tone, children, toneOf)]
    }`}
  >
    {children}
  </span>
);
