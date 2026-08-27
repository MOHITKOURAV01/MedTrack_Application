/**
 * PreventiveMaintenanceDemoRules.js - Demo rules repository and local storage manager.
 */

import { MISS, readJson, writeJson } from '../../utils/safeLocalStorage';

export const DEFAULT_DEMO_RULES = [
  {
    id: 101,
    name: 'ICU Monitor Quarterly Calibration',
    description: 'Automated 90-day calibration cycle for all patient monitoring systems in ICU.',
    ruleScope: 'EQUIPMENT_CATEGORY',
    equipmentCategory: 'MONITORING',
    priority: 'High',
    frequency: 'QUARTERLY',
    customIntervalDays: null,
    maintenanceType: 'Calibration',
    slaWarningDays: 5,
    slaBreachDays: 2,
    leadTimeDays: 14,
    active: true,
  },
  {
    id: 102,
    name: 'Ventilator Bi-Weekly Filter Inspection',
    description: '14-day inspection and HEPA filter check for respiratory equipment.',
    ruleScope: 'EQUIPMENT_CATEGORY',
    equipmentCategory: 'RESPIRATORY',
    priority: 'Critical',
    frequency: 'CUSTOM',
    customIntervalDays: 14,
    maintenanceType: 'Preventive',
    slaWarningDays: 3,
    slaBreachDays: 1,
    leadTimeDays: 5,
    active: true,
  },
  {
    id: 103,
    name: 'MRI Scanner Monthly Coolant Check',
    description: 'Helium pressure level verification and compressor cooling check.',
    ruleScope: 'EQUIPMENT_CATEGORY',
    equipmentCategory: 'IMAGING',
    priority: 'High',
    frequency: 'MONTHLY',
    customIntervalDays: null,
    maintenanceType: 'Preventive',
    slaWarningDays: 7,
    slaBreachDays: 3,
    leadTimeDays: 10,
    active: true,
  },
  {
    id: 104,
    name: 'GE Healthcare Annual Overhaul',
    description: 'Manufacturer mandated 365-day full system overhaul for GE medical devices.',
    ruleScope: 'MANUFACTURER_INTERVAL',
    manufacturer: 'GE Healthcare',
    priority: 'Normal',
    frequency: 'YEARLY',
    customIntervalDays: null,
    maintenanceType: 'Inspection',
    slaWarningDays: 14,
    slaBreachDays: 5,
    leadTimeDays: 30,
    active: true,
  },
];

/** Storage key holding the locally edited rule set. */
export const RULES_STORAGE_KEY = 'medtrack_maintenance_rules';

/**
 * Reads the locally stored rules, seeding the defaults only when nothing usable is stored.
 *
 * An empty array is a stored value, not a miss. `saveLocalRules([])` is what the console writes
 * after the user deletes their last rule, and the previous `parsed.length > 0` test could not tell
 * that apart from a key that had never been written - so the defaults were written back over the
 * deletion and reappeared on the next load.
 *
 * Neither the read nor the seeding write can throw at the caller. This runs from a mount effect, and
 * the previous version guarded the read and then seeded through a bare `localStorage.setItem` on the
 * next line, so a store blocked by browser policy threw straight into React's render phase.
 *
 * @returns {Array} the stored rules, or {@link DEFAULT_DEMO_RULES}
 */
export const getLocalRules = () => {
  const stored = readJson(RULES_STORAGE_KEY, { validate: Array.isArray });
  if (stored !== MISS) {
    return stored;
  }
  writeJson(RULES_STORAGE_KEY, DEFAULT_DEMO_RULES);
  return DEFAULT_DEMO_RULES;
};

/**
 * Persists the rule set, including an empty one.
 *
 * @param {Array} rules
 * @returns {boolean} whether the write succeeded
 */
export const saveLocalRules = (rules) => writeJson(RULES_STORAGE_KEY, rules);
