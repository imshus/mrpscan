export const DIAMOND_SHAPE_LABELS: Record<string, string> = {
  RD: 'Round Diamond',
  RB: 'Round Brilliant',
  PR: 'Princess',
  EM: 'Emerald',
  OV: 'Oval',
  MQ: 'Marquise',
  PS: 'Pear',
  AS: 'Asscher',
  CU: 'Cushion',
  BG: 'Baguette',
  PC: 'Princess',
  HT: 'Heart',
  RA: 'Radiant',
  TR: 'Trillion',
};

export function formatDiamondShapeLabel(shape: string): string {
  const trimmed = shape.trim();
  if (!trimmed) return '';
  const code = trimmed.toUpperCase();
  return DIAMOND_SHAPE_LABELS[code] ?? trimmed;
}
