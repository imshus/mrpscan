import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';
import { Colors } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastNotificationProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onDismiss: () => void;
}

const TYPE_STYLES: Record<ToastType, { bg: string; text: string; cross: string }> = {
  success: { bg: 'bg-success-bg', text: 'text-success', cross: Colors.successText },
  error: { bg: 'bg-danger-bg', text: 'text-danger-text', cross: Colors.dangerText },
  info: { bg: 'bg-primary', text: 'text-white', cross: Colors.white },
};

/**
 * A toast along the bottom of the screen. It stays until it is closed, at
 * the shop's asking — the cross, or a tap on the toast — rather than
 * vanishing after three seconds.
 */
export function ToastNotification({
  visible,
  message,
  type = 'info',
  onDismiss,
}: ToastNotificationProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  // Fades in when it opens. Only `visible` drives it: callers pass a new
  // onDismiss on every render, which used to replay the fade each time.
  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  const styles = TYPE_STYLES[type];

  return (
    <Animated.View
      style={{ opacity }}
      className="absolute bottom-24 left-4 right-4 z-50"
    >
      <Pressable
        onPress={onDismiss}
        className={`flex-row items-center rounded-button py-2 pl-4 pr-2 shadow-lg ${styles.bg}`}
      >
        <Text className={`flex-1 text-center text-sm font-medium ${styles.text}`}>{message}</Text>
        <PopupCloseButton onPress={onDismiss} color={styles.cross} />
      </Pressable>
    </Animated.View>
  );
}
