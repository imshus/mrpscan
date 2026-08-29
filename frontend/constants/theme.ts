import { Platform } from 'react-native';

/**
 * MRPscan brand theme — cream/red palette from design-mockup/styles.css.
 * Legacy keys (primary, accent, …) are kept but remapped so untouched
 * screens pick up the new brand automatically.
 */
export const Colors = {
  primary: '#D9291F',
  primaryDark: '#A81F17',
  primaryButton: '#D9291F',
  primaryNav: '#A81F17',
  accent: '#A81F17',
  accentGold: '#B8860B',
  accentLink: '#A81F17',
  background: '#FBF7F0',
  backgroundAlt: '#F4ECDC',
  white: '#FFFFFF',
  border: '#E9DDC4',
  borderLight: '#E9DDC4',
  textPrimary: '#15120D',
  textSecondary: '#857A63',
  textMuted: '#857A63',
  placeholder: '#B8AC8F',
  textLabel: '#857A63',
  inputBg: '#FFFFFF',
  successBg: '#E7F4EC',
  successText: '#1A8A4A',
  dangerBg: '#FBE5E3',
  dangerText: '#A81F17',
  tabInactive: '#F4ECDC',

  // Brand red ramp (mockup --gold / --gold-light / --gold-deep)
  brand: '#D9291F',
  brandLight: '#E85A4F',
  brandDeep: '#A81F17',
  glow: 'rgba(217, 41, 31, 0.25)',

  // Metal gold accents (gold tiles / checkboxes / employee avatars)
  metalGold: '#B8860B',
  metalGoldBg: '#FBF3DD',
  metalGoldBorder: '#ECD9A0',

  // Diamond blue accents
  diamond: '#2F6FB0',
  diamondBg: '#EAF3FB',
  diamondBorder: '#BCDCF4',

  // Metallic champagne gradient stops (rate cards / time tile)
  metallic1: '#F5EFE0',
  metallic2: '#DDD0B0',
  metallic3: '#C2B28C',

  // Trial tile terracotta gradient stops
  trial1: '#E0897C',
  trial2: '#C25F4E',
  trial3: '#A8483A',

  // Scanner dark surfaces
  scannerBg: '#0B0906',
} as const;

/** Gradient presets matching the mockup's CSS linear-gradients. */
export const Gradients = {
  /** linear-gradient(135deg, --gold-light, --gold-deep) — primary buttons, price pills */
  brand: [Colors.brandLight, Colors.brandDeep] as string[],
  /** linear-gradient(155deg, metallic-1..3) — MCX card, time tile, rate badges */
  metallic: [Colors.metallic1, Colors.metallic2, Colors.metallic3] as string[],
  /** linear-gradient(150deg, trial gradient) — trial tile, profile banner */
  trial: [Colors.trial1, Colors.trial2, Colors.trial3] as string[],
} as const;

/** Serif display face approximating the mockup's Playfair Display. */
export const Fonts = {
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: "Georgia, 'Playfair Display', serif",
  }) as string,
} as const;

/** Consistent spacing scale used across StyleSheet and layout helpers. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenHorizontal: 20,
  cardPadding: 20,
  screenBottom: 120,
  sectionGap: 16,
  listGap: 12,
  inputHeight: 50,
  buttonHeight: 52,
  inputPaddingX: 16,
} as const;

export const Radius = {
  input: 14,
  button: 999,
  card: 22,
  badge: 12,
  marketCard: 14,
  tile: 16,
} as const;
