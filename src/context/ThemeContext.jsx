import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Theme preference, resolved theme, and the difference between the two.
 *
 * The provider used to store a single `"light" | "dark"` string and treat the presence of that key
 * as proof the user had chosen a theme. It also wrote that key from the effect that paints the
 * `dark` class, and that effect runs on mount - so a first visit resolved `prefers-color-scheme`,
 * painted it, and stored it. From the second page load onwards the provider believed the visitor had
 * made a choice they had never made, and stopped following their system theme for good.
 *
 * The fix is to store the *preference*, which has three states, rather than the *resolved theme*,
 * which has two:
 *
 *   - `"system"` (the default, and what an absent or unreadable key means) - follow
 *     `prefers-color-scheme`, live, for as long as the user has not chosen otherwise.
 *   - `"light"` / `"dark"` - the user chose this, so honour it and ignore the OS.
 *
 * Only an explicit choice writes to storage. Painting never does.
 */

/** localStorage key holding the preference. Unchanged, so an existing choice survives this change. */
export const THEME_STORAGE_KEY = "theme";

/** Preference meaning "follow the operating system", and the default for a visitor who has not chosen. */
export const SYSTEM = "system";

/** The three values the preference may take. */
export const THEME_PREFERENCES = Object.freeze([SYSTEM, "light", "dark"]);

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Reads the stored preference.
 *
 * Anything unrecognised - a value from an older build, a partially written entry, a key someone set
 * by hand - resolves to `SYSTEM` rather than being trusted. `localStorage` access itself throws when
 * site data is blocked by browser policy, and this runs inside the provider's render, so it is
 * guarded: an unreadable store means "no preference", not a blank page.
 *
 * @returns {string} one of {@link THEME_PREFERENCES}
 */
export function readStoredPreference() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(raw) ? raw : SYSTEM;
  } catch (error) {
    return SYSTEM;
  }
}

/**
 * Persists an explicit choice, or clears the key when the choice is "follow the system".
 *
 * Storing `"system"` as a literal would work, but an absent key already means exactly that and
 * removing it keeps a visitor who reverts to the system theme indistinguishable from one who never
 * chose - which is the state the provider is meant to be able to recognise.
 *
 * @param {string} preference one of {@link THEME_PREFERENCES}
 * @returns {boolean} whether the write succeeded
 */
export function writeStoredPreference(preference) {
  try {
    if (preference === SYSTEM) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
    return true;
  } catch (error) {
    // A preference that cannot be persisted still applies for this tab. Failing the toggle because
    // storage is full or blocked would be worse than forgetting it on the next load.
    return false;
  }
}

/** Whether the OS currently asks for a dark UI. False wherever `matchMedia` is missing or throws. */
export function systemPrefersDark() {
  try {
    return !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
  } catch (error) {
    return false;
  }
}

/**
 * The theme to paint, given a preference and the current system setting.
 *
 * @param {string} preference one of {@link THEME_PREFERENCES}
 * @param {boolean} prefersDark whether the OS currently asks for dark
 * @returns {"light"|"dark"}
 */
export function resolveTheme(preference, prefersDark) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return prefersDark ? "dark" : "light";
}

/**
 * Context default, so `useTheme()` outside a provider returns a usable object rather than
 * `undefined`. Both consumers destructure the result (`const { theme, toggleTheme } = useTheme()`),
 * which is a TypeError against `undefined` - a missing provider should degrade the control, not take
 * the page down.
 */
const FALLBACK = Object.freeze({
  theme: "light",
  preference: SYSTEM,
  isSystem: true,
  setPreference: () => {},
  toggleTheme: () => {},
  followSystem: () => {},
});

const ThemeContext = createContext(FALLBACK);

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  const theme = resolveTheme(preference, prefersDark);

  // Paint only. This effect deliberately writes nothing: it runs on mount, and a write here is what
  // turned "no preference yet" into "the user chose light" on every visitor's first page load.
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Track the OS setting unconditionally. Whether it is *used* is resolveTheme's decision, so the
  // system theme stays current underneath an explicit choice and takes effect the moment the user
  // reverts to "follow system" - no reload needed.
  useEffect(() => {
    if (!window.matchMedia) {
      return undefined;
    }

    let query;
    try {
      query = window.matchMedia(DARK_QUERY);
    } catch (error) {
      return undefined;
    }

    const handleChange = (event) => setPrefersDark(event.matches);

    // Safari below 14 exposes only the deprecated addListener/removeListener pair.
    if (query.addEventListener) {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    }
    if (query.addListener) {
      query.addListener(handleChange);
      return () => query.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const setPreference = useCallback((next) => {
    const value = THEME_PREFERENCES.includes(next) ? next : SYSTEM;
    writeStoredPreference(value);
    setPreferenceState(value);
    // Re-read the OS setting on the way in: it may have changed while an explicit preference was
    // masking it, and reverting to "system" should land on the current one rather than the last one
    // observed before the choice was made.
    setPrefersDark(systemPrefersDark());
  }, []);

  /** Flips to the opposite of what is currently *painted*, which makes it an explicit choice. */
  const toggleTheme = useCallback(() => {
    setPreference(resolveTheme(preference, prefersDark) === "dark" ? "light" : "dark");
  }, [preference, prefersDark, setPreference]);

  /** Discards an explicit choice and follows the OS again. */
  const followSystem = useCallback(() => setPreference(SYSTEM), [setPreference]);

  const value = useMemo(
    () => ({
      /** The theme actually painted: "light" or "dark". */
      theme,
      /** What the user asked for: "system", "light" or "dark". */
      preference,
      /** Whether the theme is currently being taken from the OS. */
      isSystem: preference === SYSTEM,
      setPreference,
      toggleTheme,
      followSystem,
    }),
    [theme, preference, setPreference, toggleTheme, followSystem]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
