import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

interface MatrixCheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  variant?: 'default' | 'dark';
  showDivider?: boolean;
}

export function MatrixCheckboxRow({
  label,
  checked,
  onToggle,
  variant = 'default',
  showDivider = true,
}: MatrixCheckboxRowProps) {
  const isDark = variant === 'dark';

  return (
    <>
      <Pressable onPress={onToggle} style={styles.row}>
        <Text style={[styles.label, isDark && styles.labelDark]}>{label}</Text>
        <View
          style={[
            styles.checkbox,
            checked && !isDark && styles.checkboxChecked,
            isDark && styles.checkboxDark,
            isDark && checked && styles.checkboxDarkChecked,
          ]}
        >
          {checked ? (
            <Check size={13} color={isDark ? Colors.metalGold : Colors.white} strokeWidth={3} />
          ) : null}
        </View>
      </Pressable>
      {showDivider ? (
        <View style={[styles.divider, isDark && styles.dividerDark]} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  labelDark: {
    color: Colors.white,
    fontWeight: '500',
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
  checkboxDark: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  checkboxDarkChecked: {
    borderColor: Colors.metalGold,
    backgroundColor: 'transparent',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
