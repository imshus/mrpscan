import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface SettingsDropdownProps {
  /** Field label above the closed box. */
  label: string;
  /** What is chosen right now, shown on the closed box. */
  value: string;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}

/**
 * A dropdown field for a settings screen: the label above, the current choice
 * in a box, and the options in a panel that opens beneath it.
 *
 * The panel is part of the page rather than a floating overlay — an overlay
 * has to be positioned in window coordinates, which lands in the wrong place
 * on a scrolled screen, and it cannot scroll with the content behind it.
 */
export function SettingsDropdown({ label, value, open, onPress, children }: SettingsDropdownProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.trigger, open && styles.triggerOpen]}
      >
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        {open ? (
          <ChevronUp size={18} color={Colors.textMuted} strokeWidth={2.2} />
        ) : (
          <ChevronDown size={18} color={Colors.textMuted} strokeWidth={2.2} />
        )}
      </Pressable>
      {open ? <View style={styles.panel}>{children}</View> : null}
    </View>
  );
}

interface DropdownOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `single` marks the one choice; `multi` gives every option its own box. */
  mode?: 'single' | 'multi';
  showDivider?: boolean;
}

/** One line in an open dropdown. */
export function DropdownOption({
  label,
  selected,
  onPress,
  mode = 'single',
  showDivider = true,
}: DropdownOptionProps) {
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole={mode === 'multi' ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: selected }}
        style={styles.option}
      >
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        {mode === 'multi' ? (
          <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
            {selected ? <Check size={13} color={Colors.white} strokeWidth={3} /> : null}
          </View>
        ) : (
          <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
        )}
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.brandDeep,
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    backgroundColor: Colors.white,
  },
  triggerOpen: {
    // Joined to the panel below while it is open.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    borderColor: Colors.metalGoldBorder,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  panel: {
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: Colors.metalGoldBorder,
    borderBottomLeftRadius: Radius.tile,
    borderBottomRightRadius: Radius.tile,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  optionLabelSelected: {
    color: Colors.brandDeep,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.metalGold,
    borderColor: Colors.metalGold,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.metalGold,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.metalGold,
  },
});
