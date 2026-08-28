import { useEffect, useRef } from "react";

/**
 * The four modifiers a descriptor may name, and the spellings people reach for.
 *
 * The aliases matter because of how the parser used to fail. Anything before the final `+` that was
 * not one of the four canonical names was simply not looked at:
 *
 *   const parts = descriptor.toLowerCase().split("+");
 *   const key = parts.pop();
 *   const wantsCtrl = parts.includes("ctrl");   // "cmd" is not "ctrl", so: false
 *
 * so `"cmd+k"` asked for *no* modifiers and the key `k`. It did not fail to fire - it fired on a
 * bare `k`. And because the typing guard was `!descriptor.includes("+")`, a descriptor containing a
 * `+` was treated as a command combo and exempted from that guard, so the mistyped shortcut fired
 * while the user was typing the letter k into a search box.
 */
const MODIFIER_ALIASES = {
  ctrl: "ctrl",
  control: "ctrl",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  win: "meta",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
};

/** The modifiers that make a shortcut a command rather than a character the user is typing. */
const COMMAND_MODIFIERS = ["ctrl", "meta", "alt"];

const warned = new Set();

function warnOnce(descriptor, message) {
  if (warned.has(descriptor)) return;
  warned.add(descriptor);
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`useKeyboardShortcuts: ${message} (in "${descriptor}")`);
  }
}

/**
 * Parses a shortcut descriptor into its modifiers and key.
 *
 * @param {string} descriptor e.g. "ctrl+k", "meta+shift+?", "escape"
 * @returns {{key: string, modifiers: string[]}|null} null when a segment is not a known modifier
 */
export function parseShortcut(descriptor) {
  if (typeof descriptor !== "string" || descriptor.trim() === "") return null;

  const segments = descriptor.toLowerCase().split("+");

  // "ctrl++" asks for the plus key. Splitting it gives ["ctrl", "", ""] - the key itself became a
  // separator - so an empty final segment means the key is "+", and the empty segment it left
  // behind is not a modifier the loop below should try to read.
  let key = segments.pop();
  if (key === "" || key === undefined) {
    key = "+";
    if (segments[segments.length - 1] === "") segments.pop();
  }

  const modifiers = [];
  for (const segment of segments) {
    const canonical = MODIFIER_ALIASES[segment.trim()];
    if (!canonical) {
      // Refusing to match is the point. Guessing that an unrecognised segment meant "no modifier"
      // is what turned "cmd+k" into a bare "k".
      warnOnce(descriptor, `"${segment}" is not a modifier; the shortcut is ignored`);
      return null;
    }
    if (!modifiers.includes(canonical)) modifiers.push(canonical);
  }

  return { key, modifiers };
}

/**
 * Whether the key in a descriptor is one that cannot be typed without Shift on a common layout.
 *
 * `?`, `:`, `+`, `~` and friends are Shift+something everywhere. Requiring `shiftKey === false` for
 * them, as an exact-match comparison does, makes them unmatchable: pressing `?` sets `shiftKey`,
 * and the descriptor `"?"` insisted it be clear. The JSDoc offered `"meta+shift+?"` and `"?"` as
 * examples of supported descriptors, and neither could ever have fired.
 *
 * Letters and digits are excluded because Shift genuinely distinguishes them: `"a"` and `"shift+a"`
 * are different shortcuts, and `event.key` is `"a"` or `"A"` accordingly.
 */
function keyImpliesShift(key) {
  return key.length === 1 && !/[a-z0-9]/.test(key);
}

/**
 * Whether the given keydown event matches a shortcut descriptor.
 *
 * Supported modifiers: ctrl, meta, alt, shift (any combination, in any order), plus the usual
 * aliases - cmd/command/super/win for meta, control for ctrl, option/opt for alt. The final segment
 * is the key itself, matched case-insensitively against `event.key` ("escape", "enter",
 * "arrowdown", "?" ...).
 *
 * A descriptor naming a modifier this does not recognise matches nothing, rather than quietly
 * becoming a shortcut the caller did not ask for.
 *
 * @param {KeyboardEvent} event
 * @param {string} descriptor
 * @returns {boolean}
 */
export function matchesShortcut(event, descriptor) {
  const parsed = parseShortcut(descriptor);
  if (!parsed || !event) return false;

  const eventKey = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (eventKey === "" || eventKey !== parsed.key) return false;

  const { modifiers } = parsed;
  if (event.ctrlKey !== modifiers.includes("ctrl")) return false;
  if (event.metaKey !== modifiers.includes("meta")) return false;
  if (event.altKey !== modifiers.includes("alt")) return false;

  if (modifiers.includes("shift")) {
    return event.shiftKey === true;
  }

  // The descriptor did not ask for Shift. For a key that cannot be produced without it, the actual
  // shift state carries no intent and is not compared.
  return keyImpliesShift(parsed.key) ? true : event.shiftKey === false;
}

/** Whether the event's target is somewhere the user is entering text. */
function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

  // A custom combobox or editor built out of divs still owns the keystroke.
  const role = typeof target.getAttribute === "function" ? target.getAttribute("role") : null;
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

/**
 * Registers global keydown shortcuts. Pass a map of descriptor -> handler, e.g.
 * `{ "ctrl+k": openPalette }`.
 *
 * Handlers live in a ref so the latest closures are used without re-subscribing the window listener
 * on every render.
 *
 * Shortcuts without a command modifier (ctrl, meta or alt) are ignored while the user is typing in
 * an input, textarea, select or contentEditable, so they never hijack normal typing. Shift alone is
 * not a command modifier - `"shift+f"` is a capital F, which is a thing people type.
 *
 * Auto-repeat is ignored by default. Holding a shortcut down produces a keydown every few
 * milliseconds, and the two shortcuts this application registers both *toggle* the command palette:
 * held down, it opened and closed dozens of times a second. Pass `{ allowRepeat: true }` for a
 * shortcut that should repeat, such as an arrow-key nudge.
 *
 * @param {Object<string, Function>} shortcuts descriptor -> handler
 * @param {{allowRepeat?: boolean}} [options]
 */
export default function useKeyboardShortcuts(shortcuts, options = {}) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handler = (event) => {
      const { allowRepeat = false } = optionsRef.current || {};
      if (event.repeat && !allowRepeat) return;

      const typing = isTypingTarget(event.target);

      Object.entries(shortcutsRef.current || {}).forEach(([descriptor, callback]) => {
        if (typeof callback !== "function") return;

        const parsed = parseShortcut(descriptor);
        if (!parsed || !matchesShortcut(event, descriptor)) return;

        const isCommand = parsed.modifiers.some((m) => COMMAND_MODIFIERS.includes(m));
        if (typing && !isCommand) return;

        event.preventDefault();

        // One handler that throws must not stop the rest of the map from running, and must not
        // escape as an uncaught error from a window listener.
        try {
          callback(event);
        } catch (error) {
          console.error(`useKeyboardShortcuts: handler for "${descriptor}" threw`, error);
        }
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}
