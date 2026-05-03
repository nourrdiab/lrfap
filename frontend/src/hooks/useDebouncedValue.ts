import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has been stable for `delayMs`. Use for
 * search inputs so the filtered list doesn't re-compute on every
 * keystroke when the underlying set is non-trivial.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
