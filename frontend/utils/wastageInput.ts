/**
 * What the Wastage % box keeps of a keystroke: digits and one decimal point,
 * at most 100 (the server refuses more, and the whole card loses its price).
 * Null refuses the keystroke and the box keeps what it had.
 */
export function cleanWastagePercent(text: string): string | null {
  const next = text.replace(/[^0-9.]/g, '');
  if ((next.match(/\./g) ?? []).length > 1) return null;
  if (Number.parseFloat(next) > 100) return null;
  return next;
}
