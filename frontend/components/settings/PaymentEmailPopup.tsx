import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mail } from 'lucide-react-native';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';
import { Colors, Radius } from '@/constants/theme';

/** The same rule the server applies: one address, a dot in its domain. */
const EMAIL_PATTERN = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

interface PaymentEmailPopupProps {
  /** Open while true. */
  visible: boolean;
  /** The address saved from the last payment, offered again. */
  initialEmail: string;
  /** What the shop is about to pay for, for the button: "Pay ₹14,160". */
  actionLabel: string;
  onCancel: () => void;
  onContinue: (email: string) => void;
}

/**
 * Asks for an email between tapping Purchase / Recharge and the Razorpay
 * sheet. The address is kept on the shop and handed to Razorpay, which
 * sends its payment receipt there. Styled as the app's other popups: the
 * cross in the corner closes it, and closing it pays nothing.
 */
export function PaymentEmailPopup({
  visible,
  initialEmail,
  actionLabel,
  onCancel,
  onContinue,
}: PaymentEmailPopupProps) {
  const [email, setEmail] = useState(initialEmail);
  const [showError, setShowError] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!visible) return;
    setEmail(initialEmail);
    setShowError(false);
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [visible, initialEmail, opacity, scale]);

  if (!visible) return null;

  const trimmed = email.trim();
  const valid = EMAIL_PATTERN.test(trimmed);

  const submit = () => {
    if (!valid) {
      setShowError(true);
      return;
    }
    onContinue(trimmed);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <PopupCloseButton onPress={onCancel} style={styles.close} />
          <View style={styles.iconWrap}>
            <Mail size={22} color={Colors.brandDeep} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Email for your receipt</Text>
          <Text style={styles.message}>The payment receipt is sent to this email.</Text>
          <View style={[styles.field, showError && !valid && styles.fieldError]}>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (showError) setShowError(false);
              }}
              placeholder="you@example.com"
              placeholderTextColor={Colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.input}
              accessibilityLabel="Email address"
            />
          </View>
          {showError && !valid ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              Please enter a valid email address.
            </Text>
          ) : null}
          <Pressable
            onPress={submit}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: '#15120D',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBE9E7',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  field: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    height: 46,
  },
  fieldError: { borderColor: Colors.brandDeep },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: -4,
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
  },
  actionPressed: { opacity: 0.85 },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
