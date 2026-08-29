/** Auto-generates quality string: Color + " " + Clarity */
export function buildQuality(color: string, clarity: string): string {
  const trimmedColor = color.trim();
  const trimmedClarity = clarity.trim();
  if (!trimmedColor && !trimmedClarity) return '';
  if (!trimmedColor) return trimmedClarity;
  if (!trimmedClarity) return trimmedColor;
  return `${trimmedColor} ${trimmedClarity}`;
}
