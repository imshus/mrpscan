import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

interface ToastNotificationProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TYPE_STYLES: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: 'bg-success-bg', text: 'text-success' },
  error: { bg: 'bg-danger-bg', text: 'text-danger-text' },
  info: { bg: 'bg-primary', text: 'text-white' },
};

export function ToastNotification({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastNotificationProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss, opacity]);

  if (!visible) return null;

  const styles = TYPE_STYLES[type];

  return (
    <Animated.View
      style={{ opacity }}
      className="absolute bottom-24 left-4 right-4 z-50"
    >
      <Pressable
        onPress={onDismiss}
        className={`rounded-button px-4 py-3 shadow-lg ${styles.bg}`}
      >
        <Text className={`text-center text-sm font-medium ${styles.text}`}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}
