// Local storage that cannot take the application down, and that can tell "empty" from "absent".
//
// This is the `localStorage` counterpart of `safeSessionStorage.js`, written for the same reason and
// with one addition.
//
// The reason: `localStorage` access throws. Not only `setItem` on a full quota - the whole object
// throws on first touch when site data is blocked by browser policy, and historically threw in
// Safari private browsing. Six modules in this codebase reach for it and five of them had hand-
// rolled their own `try`/`catch` around part of their access. `PreventiveMaintenanceDemoRules` and
// `ActivityCenterDemoEvents` guarded their read and then wrote to the same store on the very next
// line without a guard, so a blocked store threw out of a function called during a mount effect.
//
// The addition: `readJson` distinguishes a missing key from a stored empty value. Both of those
// modules used `Array.isArray(parsed) && parsed.length > 0` as their "did we find anything" test,
// which silently re-seeded the defaults over a list the user had deliberately emptied. An empty
// array is a value. Only an absent, unreadable or wrong-shaped entry is a miss.

/**
 * Whether `localStorage` can be used at all.
 *
 * The probe writes and removes a key rather than only reading one, because a store can be readable
 * and non-writable - Safari private browsing historically allowed `getItem` and threw on `setItem`.
 * A store we cannot write to is not one this module should report as available.
 */
function isAvailable() {
  try {
    const probe = "__medtrack_local_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}

const available = typeof window !== "undefined" && isAvailable();

/**
 * Sentinel returned by {@link readJson} when there is nothing usable stored.
 *
 * A distinct object rather than `null` or `undefined`, because both of those are values `JSON.parse`
 * can legitimately produce and callers need to seed defaults on a miss without also clobbering a
 * stored `null` or a stored `[]`.
 */
export const MISS = Symbol("medtrack.storage.miss");

/**
 * Reads and parses a JSON value.
 *
 * @param {string} key
 * @param {{validate?: (value: unknown) => boolean}} [options] `validate` rejects a parsed value
 *   whose shape is wrong - a stored object where the caller needs an array, say - and turns it into
 *   a miss so the caller seeds its defaults rather than handing the wrong type to its consumers
 * @returns {*|typeof MISS} the parsed value, or {@link MISS} when the key is absent, unparseable,
 *   rejected by `validate`, or storage is unavailable
 */
export function readJson(key, options = {}) {
  const { validate } = options;

  if (!available) {
    return MISS;
  }

  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch (error) {
    return MISS;
  }

  if (raw === null || raw === undefined) {
    return MISS;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // A corrupt entry is removed rather than left to fail the same way on every future load.
    console.warn(`Discarding unreadable localStorage entry "${key}". ${error.message}`);
    remove(key);
    return MISS;
  }

  if (validate && !validate(parsed)) {
    console.warn(`Discarding localStorage entry "${key}": unexpected shape.`);
    remove(key);
    return MISS;
  }

  return parsed;
}

/**
 * Reads a JSON value, falling back to `fallback` on a miss.
 *
 * The convenience form for callers that do not need to seed the store on a miss and therefore do not
 * need to tell a miss from a stored value.
 *
 * @param {string} key
 * @param {*} fallback
 * @param {{validate?: (value: unknown) => boolean}} [options]
 * @returns {*}
 */
export function readJsonOr(key, fallback, options = {}) {
  const value = readJson(key, options);
  return value === MISS ? fallback : value;
}

/**
 * Serialises and stores a value. Never throws.
 *
 * @param {string} key
 * @param {*} value
 * @returns {boolean} whether the write succeeded
 */
export function writeJson(key, value) {
  if (!available) {
    return false;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not persist localStorage entry "${key}". ${error.message}`);
    return false;
  }
}

/**
 * Reads a string value as-is, with no JSON parsing.
 *
 * @param {string} key
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function readString(key, fallback = null) {
  if (!available) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (error) {
    return fallback;
  }
}

/**
 * Removes a key, ignoring any failure.
 *
 * @param {string} key
 */
export function remove(key) {
  if (!available) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // Nothing useful to do; the caller is already on an error path.
  }
}

/** Exposed for tests, so the unavailable-storage branch can be asserted. */
export const storageAvailable = available;
