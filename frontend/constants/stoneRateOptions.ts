export const DIAMOND_COLOR_OPTIONS = [
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'EF',
  'FG',
  'GH',
  'HI',
  'IJ',
] as const;

export const STONE_CLARITY_OPTIONS = ['SI', 'VS', 'VS1', 'VVS', 'VVS1'] as const;

export const COLORSTONE_COLOR_OPTIONS = ['Red', 'Blue', 'Green', 'Pink'] as const;

export const DIAMOND_SHAPE_OPTIONS = [
  { value: 'Rd', label: 'Round (Rd)' },
  { value: 'Mq', label: 'Marquise (Mq)' },
  { value: 'Pr', label: 'Pear (Pr)' },
  { value: 'Em', label: 'Emerald (Em)' },
  { value: 'Bg', label: 'Baguette (Bg)' },
  { value: 'Pc', label: 'Princess (Pc)' },
  { value: 'Ov', label: 'Oval (Ov)' },
  { value: 'Cu', label: 'Cushion (Cu)' },
  { value: 'Ht', label: 'Heart (Ht)' },
  { value: 'Ra', label: 'Radiant (Ra)' },
  { value: 'As', label: 'Asscher (As)' },
  { value: 'Tr', label: 'Trillion (Tr)' },
] as const;

export type DiamondColorOption = (typeof DIAMOND_COLOR_OPTIONS)[number];
export type StoneClarityOption = (typeof STONE_CLARITY_OPTIONS)[number];
export type ColorstoneColorOption = (typeof COLORSTONE_COLOR_OPTIONS)[number];
export type DiamondShapeOption = (typeof DIAMOND_SHAPE_OPTIONS)[number]['value'];

export type StoneSelectOption = {
  value: string;
  label?: string;
};

export type StoneRateKind = 'diamond' | 'colorstone';

export function getColorOptionsForStoneType(type: StoneRateKind): readonly string[] {
  return type === 'diamond' ? DIAMOND_COLOR_OPTIONS : COLORSTONE_COLOR_OPTIONS;
}
