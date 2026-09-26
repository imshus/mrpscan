import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

interface PopupCloseButtonProps {
  onPress: () => void;
  /** The cross's colour: dark on light popups, cream on the dark toasts. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The cross that closes a popup. No popup in the app closes itself any more,
 * at the shop's asking: each one stays until this is tapped.
 */
export function PopupCloseButton({ onPress, color = Colors.textSecondary, style }: PopupCloseButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <X size={18} color={color} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
