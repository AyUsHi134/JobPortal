import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * has passed with no further changes — used for the free-text search/
 * location inputs so typing feels responsive locally while avoiding a
 * backend request on every keystroke (this phase's explicit instruction:
 * "avoid firing unnecessary requests on every keystroke... prefer a
 * small controlled debounce").
 *
 * A standard ~10-line React hook pattern, not a new dependency. Not
 * covered by the plain-Node deterministic test suite (it inherently
 * needs a real React render/timer cycle to exercise, and no React
 * test-rendering library is installed — see PHASE_2C_REPORT.md §10 for
 * why that's a disclosed, deliberate limitation rather than an
 * oversight); the logic it feeds into (applyFilterChange, once a
 * debounced value settles) is fully covered.
 */
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
