import React from 'react';
import { DollarSign, Tag, RotateCcw } from 'lucide-react';

/**
 * Default price presets configuration
 */
export const DEFAULT_PRICE_PRESETS = [
  { id: 'free', label: 'Free', min: 0, max: 0 },
  { id: 'under_25', label: 'Under $25', min: 0, max: 25 },
  { id: '25_to_50', label: '$25 – $50', min: 25, max: 50 },
  { id: '50_plus', label: '$50+', min: 50, max: 100 },
  { id: 'all', label: 'All Prices', min: 0, max: 100 },
];

/**
 * PriceFilterPresetGroup - Preset shortcuts for rapid dual-range filtering.
 * 
 * Two prop shapes are supported, and which one a caller uses decides how "active" is computed.
 *
 *  - `activePreset` / `onPresetSelect(preset)` - the preset object itself, in and out. This is
 *    the shape to prefer: it works for any preset list, including open-ended ranges.
 *  - `currentValue` / `onSelectPreset(min, max)` - the numeric pair, kept because
 *    `DualRangeSliderStudio` drives the group from a live slider and has no preset object to
 *    hand back.
 *
 * The numeric path used to decide activeness by comparing bounds, with a special case for the
 * literal id `'50_plus'` and another for the literal `100`. Both are properties of
 * DEFAULT_PRICE_PRESETS rather than of the component, so any other preset list - a caller's
 * `{ label: "$200+", min: 200, max: Infinity }`, say - matched neither branch and nothing was
 * ever highlighted. Matching is now structural: same min and same effective max.
 *
 * @param {Object} props
 * @param {Object} [props.activePreset] - The active preset object
 * @param {Function} [props.onPresetSelect] - Callback fired with the clicked preset: (preset) => void
 * @param {[number, number]} [props.currentValue] - Active [minVal, maxVal]
 * @param {Function} [props.onSelectPreset] - Callback fired with the clicked bounds: (min, max) => void
 * @param {Array} props.presets - Custom presets list
 * @param {number} props.maxBound - Global upper limit (default 100)
 * @param {string} props.className - Extra CSS classes
 */
export const PriceFilterPresetGroup = ({
  activePreset,
  onPresetSelect,
  currentValue,
  onSelectPreset,
  presets = DEFAULT_PRICE_PRESETS,
  maxBound = 100,
  className = '',
}) => {
  const [curMin, curMax] = currentValue || [];

  // A preset's effective upper bound.
  //
  // The topmost preset in a list is the open-ended one - it means "everything from min upwards" -
  // so it resolves to the caller's global limit rather than to the number written in the list.
  // That is what the old `preset.max === 100 ? maxBound : preset.max` was expressing, with 100
  // hard-coded because it happens to be the top of DEFAULT_PRICE_PRESETS. Reading the top off the
  // list that was actually passed gives the same answer for that list and a correct one for any
  // other, which the literal did not.
  const openEndedMax = presets.reduce((top, p) => (p.max > top ? p.max : top), -Infinity);
  const effectiveMax = (preset) => (preset.max === openEndedMax ? maxBound : preset.max);

  const isPresetActive = (preset) => {
    // The object shape wins when it is supplied. Identity first so a caller holding the exact
    // object gets an exact answer, then a structural compare for a caller that rebuilt it.
    if (activePreset) {
      if (activePreset === preset) return true;
      if (activePreset.id !== undefined && preset.id !== undefined) return activePreset.id === preset.id;
      return activePreset.min === preset.min && activePreset.max === preset.max;
    }

    if (currentValue) {
      return curMin === preset.min && curMax === effectiveMax(preset);
    }

    return false;
  };

  const handleSelect = (preset) => {
    if (onPresetSelect) onPresetSelect(preset);
    if (onSelectPreset) onSelectPreset(preset.min, effectiveMax(preset));
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
        <Tag className="w-3.5 h-3.5 text-indigo-500" /> Presets:
      </span>
      {presets.map((preset, index) => {
        const active = isPresetActive(preset);

        return (
          <button
            key={preset.id ?? `${preset.label}-${index}`}
            type="button"
            aria-pressed={active}
            onClick={() => handleSelect(preset)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 flex items-center gap-1 shadow-sm border ${
              active
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200 dark:shadow-none ring-2 ring-blue-300 dark:ring-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-750'
            }`}
          >
            {preset.id === 'free' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-0.5 inline-block" />
            ) : (
              <DollarSign className={`w-3 h-3 ${active ? 'text-white' : 'text-slate-400'}`} />
            )}
            {preset.label}
          </button>
        );
      })}
    </div>
  );
};

export default PriceFilterPresetGroup;
