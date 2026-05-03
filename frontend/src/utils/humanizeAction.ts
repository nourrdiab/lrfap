/**
 * SNAKE_CASE / dot.cased action strings → sentence-cased label.
 * e.g. "USER_LOGIN" → "User login", "program.ranking_submitted" → "Program ranking submitted".
 * Preserves the raw string when it's already human-readable (no separators).
 */
export function humanizeAction(action: string): string {
  if (!action) return '—';
  const words = action
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (words.length === 0) return action;
  const first = words[0];
  const rest = words.slice(1);
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
