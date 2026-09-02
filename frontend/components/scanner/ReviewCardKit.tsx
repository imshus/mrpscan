import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronDown, ChevronLeft } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Radius } from '@/constants/theme';

/**
 * Presentational primitives for the Scanner Review / Final Result screens,
 * matching design-mockup styles.css lines 1295-1461 (floating card system,
 * metal tiles, amount tiles, footer buttons). Used ONLY by the review/final
 * screen tree — do not import from other areas.
 */

/** Splits a "₹58,685" display string into rupee sign + number for styling. */
export function splitRupeeAmount(amount: string): { rupee: string; value: string } {
  if (amount.startsWith('₹')) {
    return { rupee: '₹', value: amount.slice(1).trim() };
  }
  return { rupee: '', value: amount };
}

/* ==================== .rev-floating-card ==================== */

export function FloatingCard({ children }: { children: ReactNode }) {
  return <View style={styles.floatingCard}>{children}</View>;
}

/* ==================== .rev-sticky-head / .rev-sticky-top ==================== */

interface CardHeaderProps {
  /** Optional: omitted on screens that show only the amount card. */
  title?: string;
  onBack?: () => void;
  /** Optional control rendered at the right end of the title row. */
  accessory?: ReactNode;
  /** Rendered below the title row (the MRP amount card). */
  children?: ReactNode;
}

export function CardHeader({ title, onBack, accessory, children }: CardHeaderProps) {
  return (
    <View style={styles.stickyHead}>
      <View style={styles.stickyTop}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={styles.backBtn}
          >
            <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {title ? <Text style={styles.stickyTitle}>{title}</Text> : null}
        {/* Pushed to the trailing edge so it sits top-right whether or not
            this header carries a title. */}
        {accessory ? <View style={styles.headAccessory}>{accessory}</View> : null}
      </View>
      {children}
    </View>
  );
}

/* ==================== .rev-sticky-foot ==================== */

export function CardFooter({ children }: { children: ReactNode }) {
  return <View style={styles.stickyFoot}>{children}</View>;
}

/* ==================== .rev-outer-btn variants ==================== */

interface PillButtonProps {
  title: string;
  onPress?: () => void;
  /** rescan = full-width h52 bg-alt · alt = bg-alt/gold-deep · brand = red gradient */
  variant: 'rescan' | 'alt' | 'brand';
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Taller pill with bigger type, for a screen's primary action. */
  large?: boolean;
}

export function PillButton({ title, onPress, variant, disabled, icon, style, large }: PillButtonProps) {
  const label = (
    <Text
      style={[
        styles.pillText,
        variant === 'rescan' && styles.pillTextRescan,
        variant === 'alt' && styles.pillTextAlt,
        variant === 'brand' && styles.pillTextBrand,
        large && styles.pillTextLarge,
      ]}
    >
      {title}
    </Text>
  );

  if (variant === 'brand') {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={[style, disabled && styles.pillDisabled]}
      >
        <GradientView colors={Gradients.brand} borderRadius={Radius.button}>
          <View style={[styles.pillInner, large && styles.pillInnerLarge]}>
            {icon}
            {label}
          </View>
        </GradientView>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.pillInner,
        large && styles.pillInnerLarge,
        styles.pillAltBg,
        variant === 'rescan' && styles.pillRescan,
        style,
        disabled && styles.pillDisabled,
      ]}
    >
      {icon}
      {label}
    </Pressable>
  );
}

/* ==================== .metal-tile / .gold-tile / .diamond-tile / .labour-tile ==================== */

export type MetalTileTone = 'gold' | 'diamond' | 'plain';

interface MetalTileProps {
  title?: string;
  tone?: MetalTileTone;
  children: ReactNode;
}

const TILE_TONES: Record<MetalTileTone, { bg: string; border: string; title: string }> = {
  gold: { bg: Colors.metalGoldBg, border: Colors.metalGoldBorder, title: Colors.metalGold },
  diamond: { bg: Colors.diamondBg, border: Colors.diamondBorder, title: Colors.diamond },
  plain: { bg: Colors.white, border: Colors.border, title: Colors.textPrimary },
};

export function MetalTile({ title, tone = 'plain', children }: MetalTileProps) {
  const toneStyle = TILE_TONES[tone];
  return (
    <View style={[styles.metalTile, { backgroundColor: toneStyle.bg, borderColor: toneStyle.border }]}>
      {title ? <Text style={[styles.metalTileTitle, { color: toneStyle.title }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

/* ==================== .metal-grid / .metal-field ==================== */

export function MetalGrid({ children }: { children: ReactNode }) {
  return <View style={styles.metalGrid}>{children}</View>;
}

interface MetalFieldSlotProps {
  label: string;
  fullWidth?: boolean;
  children: ReactNode;
}

/** A labelled cell in the 2-column metal grid; children render the control. */
export function MetalFieldSlot({ label, fullWidth = false, children }: MetalFieldSlotProps) {
  return (
    <View style={[styles.metalField, fullWidth && styles.metalFieldFull]}>
      <Text style={styles.metalFieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

interface MetalInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  /** .amount-field — bold 17.6/900 in a 42px box. */
  amount?: boolean;
  /** .input-icon prefix (e.g. ₹). */
  prefix?: string;
  fullWidth?: boolean;
  onFocus?: ComponentProps<typeof TextInput>['onFocus'];
  onBlur?: ComponentProps<typeof TextInput>['onBlur'];
}

export function MetalInput({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType,
  amount = false,
  prefix,
  fullWidth,
  onFocus,
  onBlur,
}: MetalInputProps) {
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={label}
      editable={editable}
      showSoftInputOnFocus={editable}
      selectTextOnFocus={editable}
      caretHidden={!editable}
      contextMenuHidden={!editable}
      keyboardType={keyboardType}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[
        prefix ? styles.inputIconInput : styles.metalInput,
        !prefix && amount && styles.metalInputAmount,
      ]}
    />
  );

  return (
    <MetalFieldSlot label={label} fullWidth={fullWidth}>
      {prefix ? (
        <View style={styles.inputIcon}>
          <Text style={styles.inputIconPrefix}>{prefix}</Text>
          {input}
        </View>
      ) : (
        input
      )}
    </MetalFieldSlot>
  );
}

interface MetalValueBoxProps {
  label: string;
  value: string;
  amount?: boolean;
  fullWidth?: boolean;
}

/** Read-only display styled like a .metal-field input. */
export function MetalValueBox({ label, value, amount = false, fullWidth }: MetalValueBoxProps) {
  return (
    <MetalFieldSlot label={label} fullWidth={fullWidth}>
      <View style={[styles.metalInputBox, amount && styles.metalInputBoxAmount]}>
        <Text
          style={[styles.metalInputBoxText, amount && styles.metalInputAmountText]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </MetalFieldSlot>
  );
}

interface MetalSelectTriggerProps {
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}

/** Select-look trigger (h38, radius 9, chevron 14) for inline dropdowns. */
export function MetalSelectTrigger({ value, onPress, disabled }: MetalSelectTriggerProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.metalInputBox, styles.selectTrigger]}
    >
      <Text style={styles.metalInputBoxText} numberOfLines={1}>
        {value}
      </Text>
      <ChevronDown size={14} color={Colors.textMuted} />
    </Pressable>
  );
}

interface InlineOptionListProps<T extends string> {
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

/** In-flow option list shown under a MetalSelectTrigger. */
export function InlineOptionList<T extends string>({
  options,
  selected,
  onSelect,
}: InlineOptionListProps<T>) {
  return (
    <View style={styles.optionList}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.optionItem, isSelected && styles.optionItemSelected]}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==================== .amount-tile ==================== */

interface AmountTileProps {
  label: string;
  /** Display string, e.g. "₹7,000". */
  value: string;
}

export function AmountTile({ label, value }: AmountTileProps) {
  const { rupee, value: number } = splitRupeeAmount(value);
  return (
    <View style={styles.amountTile}>
      <Text style={styles.amountTileLabel}>{label}</Text>
      <View style={styles.amountTileValue}>
        {rupee ? <Text style={styles.amountTileRupee}>{rupee}</Text> : null}
        <Text style={styles.amountTileNumber}>{number}</Text>
      </View>
    </View>
  );
}

/* ==================== .fin-row / .fin-note ==================== */

interface FinRowProps {
  label: string;
  value: string;
  /** .fin-row-amount — value at 17.6/900. */
  amount?: boolean;
}

export function FinRow({ label, value, amount = false }: FinRowProps) {
  return (
    <View style={styles.finRow}>
      <Text style={styles.finRowLabel}>{label}</Text>
      <Text style={[styles.finRowValue, amount && styles.finRowValueAmount]}>{value}</Text>
    </View>
  );
}

export function FinNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.finNote}>
      <Text style={styles.finNoteText}>{children}</Text>
    </View>
  );
}

/* ==================== styles (mockup px values) ==================== */

const styles = StyleSheet.create({
  floatingCard: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    // box-shadow: 0 18px 40px -18px rgba(21,18,13,0.22)
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 16,
  },
  stickyHead: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  stickyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headAccessory: { marginLeft: 'auto' },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stickyFoot: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  pillInnerLarge: {
    height: 58,
  },
  pillTextLarge: {
    fontSize: 16,
  },
  pillInner: {
    height: 46,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillAltBg: {
    backgroundColor: Colors.backgroundAlt,
  },
  pillRescan: {
    width: '100%',
    height: 52,
  },
  pillDisabled: {
    opacity: 0.55,
  },
  pillText: {
    fontSize: 13.8,
    fontWeight: '700',
  },
  pillTextRescan: {
    fontSize: 15.2,
    color: Colors.textPrimary,
  },
  pillTextAlt: {
    color: Colors.brandDeep,
  },
  pillTextBrand: {
    color: Colors.white,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  pressedSmall: {
    transform: [{ scale: 0.94 }],
  },
  metalTile: {
    borderRadius: Radius.tile,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  metalTileTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  metalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
  },
  metalField: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
  },
  metalFieldFull: {
    flexBasis: '100%',
  },
  metalFieldLabel: {
    fontSize: 10.6,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  metalInput: {
    width: '100%',
    minWidth: 0,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 9,
    paddingVertical: 0,
    fontSize: 12.8,
    color: Colors.textPrimary,
  },
  metalInputAmount: {
    fontSize: 17.6,
    fontWeight: '900',
    height: 42,
  },
  metalInputBox: {
    width: '100%',
    minWidth: 0,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 9,
    justifyContent: 'center',
  },
  metalInputBoxAmount: {
    height: 42,
  },
  metalInputBoxText: {
    fontSize: 12.8,
    color: Colors.textPrimary,
  },
  metalInputAmountText: {
    fontSize: 17.6,
    fontWeight: '900',
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  inputIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 9,
    gap: 4,
  },
  inputIconPrefix: {
    fontSize: 12.8,
    color: Colors.textMuted,
  },
  inputIconInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 12.8,
    color: Colors.textPrimary,
  },
  optionList: {
    marginTop: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  optionItem: {
    paddingHorizontal: 9,
    paddingVertical: 10,
    backgroundColor: Colors.white,
  },
  optionItemSelected: {
    backgroundColor: Colors.backgroundAlt,
  },
  optionText: {
    fontSize: 12.8,
    color: Colors.textPrimary,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  amountTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: Colors.backgroundAlt,
  },
  amountTileLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountTileValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  amountTileRupee: {
    fontSize: 13.6,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountTileNumber: {
    fontSize: 17.6,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  finRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  finRowLabel: {
    fontSize: 12.8,
    color: Colors.textMuted,
  },
  finRowValue: {
    fontSize: 12.8,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  finRowValueAmount: {
    fontSize: 17.6,
    fontWeight: '900',
  },
  finNote: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
  },
  finNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
});
