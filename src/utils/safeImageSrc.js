/**
 * Scheme and media-type allowlist for a URL that will be used as an image source.
 *
 * `escapeHtml` is the right tool for text interpolated into HTML and the wrong tool for a URL
 * interpolated into an attribute, because the danger in a URL is not its punctuation. Entity
 * decoding is the *first* thing the HTML parser does to an attribute value, so
 *
 *     <img src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;">
 *
 * reaches the image loader as the original SVG document. SVG loaded through `<img>` still runs
 * its own `onload`, and `javascript:` in an attribute never needed escaping to survive. What
 * decides whether a URL is safe here is its scheme and, for a `data:` URL, its media type.
 *
 * The technician maintenance report (UpdateTask.jsx) is the motivating case: it renders the
 * signature attached to a task, and a task fetched from the backend carries whatever was stored
 * on it. The report is opened via `window.open("")`, so the print document is `about:blank` -
 * same origin as the app, holding the technician's session.
 */

/**
 * Bitmap `data:` media types a signature can legitimately be.
 *
 * `image/svg+xml` is deliberately absent. An SVG is a script-bearing document, not a bitmap, and
 * nothing in this app produces one as a signature - the capture path is
 * `canvas.toDataURL("image/png")`.
 */
const ALLOWED_DATA_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

/**
 * A `data:` URL whose media type is one of the above and whose payload is base64.
 *
 * Base64 is required rather than merely permitted: a percent-encoded `data:image/png,...` payload
 * is not something the capture path emits, and allowing raw payloads widens the parser surface
 * for no gain. Parameters between the media type and the encoding (`;charset=`, say) are tolerated
 * because they are legal and harmless, but `;base64` must be the last one before the comma.
 */
const SAFE_DATA_URL = new RegExp(
  "^data:(" +
    ALLOWED_DATA_MEDIA_TYPES.join("|").replace(/[+/]/g, "\\$&") +
    ")" +
    "(;[a-zA-Z0-9\\-.+]+=[a-zA-Z0-9\\-.+]+)*" +
    ";base64,[A-Za-z0-9+/]+={0,2}$",
  "i"
);

/**
 * Schemes that are never an image, listed for the error message rather than for the decision -
 * the decision is an allowlist, so an unrecognised scheme is rejected whether or not it is here.
 */
const KNOWN_DANGEROUS_SCHEMES = [
  "javascript:",
  "vbscript:",
  "data:text/html",
  "data:image/svg+xml",
];

/**
 * Leading control characters and whitespace are stripped by the URL parser before the scheme is
 * read, so `"java\tscript:..."` and `" javascript:..."` are both live. Strip them the same way
 * before deciding, rather than after.
 */
// eslint-disable-next-line no-control-regex
const STRIPPED_CHARS = /[\u0000-\u001F\u007F]/g;

function normalise(value) {
  return String(value).replace(STRIPPED_CHARS, "").trim();
}

/**
 * @param {unknown} value a candidate image URL
 * @returns {boolean} true if it is safe to use as an `<img src>`
 */
export function isSafeImageSrc(value) {
  if (typeof value !== "string") return false;

  const url = normalise(value);
  if (!url) return false;

  const lower = url.toLowerCase();

  if (lower.startsWith("data:")) {
    return SAFE_DATA_URL.test(url);
  }

  // https and protocol-relative are fine; the image is fetched, not executed.
  if (lower.startsWith("https://") || lower.startsWith("//")) return true;

  // A same-origin absolute path. Excludes "//" (handled above) and anything carrying a scheme.
  if (url.startsWith("/")) return true;

  // Everything else - http:, javascript:, vbscript:, file:, blob:, an unrecognised scheme, or a
  // bare relative path that could be read as one - is rejected.
  return false;
}

/**
 * @param {unknown} value a candidate image URL
 * @returns {string|null} the normalised URL if safe, otherwise null
 */
export function safeImageSrc(value) {
  return isSafeImageSrc(value) ? normalise(value) : null;
}

/**
 * Why a URL was rejected, for a message shown in place of the image.
 *
 * Deliberately non-specific about the payload: the person reading a maintenance report is a
 * biomedical engineer, not an analyst, and echoing an attacker-supplied string back into the
 * document is the habit this whole module exists to break.
 *
 * @param {unknown} value the rejected URL
 * @returns {string} a short human-readable reason
 */
export function describeUnsafeImageSrc(value) {
  if (typeof value !== "string" || !normalise(value)) return "no signature was attached";

  const lower = normalise(value).toLowerCase();
  for (const scheme of KNOWN_DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) return "the attached signature is not an image";
  }
  if (lower.startsWith("data:")) return "the attached signature is not a supported image format";
  return "the attached signature could not be verified as an image";
}

export { ALLOWED_DATA_MEDIA_TYPES };
