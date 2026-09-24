import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface SettingsDropdownProps {
  /** What the button itself says, e.g. "Choose Bullion". */
  title: string;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}

/**
 * A button that opens its choices beneath it. The button carries the
 * question; everything else — the options and which of them are chosen —
 * lives inside the panel.
 *
 * The panel is part of the page rather than a floating overlay: an overlay
 * has to be positioned in window coordinates, which lands in the wrong place
 * once the screen has scrolled, and it cannot scroll with the page.
 */
export function SettingsDropdown({ title, open, onPress, children }: SettingsDropdownProps) {
  return (
    <View style={styles.field}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.trigger, open && styles.triggerOpen]}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
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

/**
 * One line in an open dropdown. Memoised: a tap on one row re-renders that
 * row alone, not every row in the list, which is what made a tick lag.
 */
function DropdownOptionBase({
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
            {/* Always drawn, shown or hidden: creating the tick's vector on
                each tap put it on screen a frame after the box turned gold,
                which read as a blink. */}
            <Check
              size={13}
              color={Colors.white}
              strokeWidth={3}
              style={{ opacity: selected ? 1 : 0 }}
            />
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

export const DropdownOption = memo(DropdownOptionBase);

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  panel: {
    borderWidth: 1,
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
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brandDeep,
    borderColor: Colors.textPrimary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.textPrimary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.brandDeep,
  },
});
