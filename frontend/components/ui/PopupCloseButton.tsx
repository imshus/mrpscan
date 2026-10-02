import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

interface PopupCloseButtonProps {
  onPress: () => void;
  /** The cross's colour: dark on light popups, cream on the dark toasts. */
  color?: string;
  /** Where the cross sits, e.g. absolute in the popup's top-right corner. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The cross that closes a popup. No popup in the app closes itself any more,
 * at the shop's asking: each one stays until this is tapped.
 *
 * The caller's placement goes on a plain wrapper, not on the Pressable: the
 * Pressable's pressed-state style function lost it under NativeWind, and the
 * cross fell into the card's centred column instead of its corner.
 */
export function PopupCloseButton({ onPress, color = Colors.textSecondary, style }: PopupCloseButtonProps) {
  return (
    <View style={style}>
      <Pressable
        onPress={onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => (pressed ? [styles.button, styles.pressed] : styles.button)}
      >
        <X size={18} color={color} strokeWidth={2.4} />
      </Pressable>
    </View>
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
