import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mail, PhoneCall, X } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';

interface ContactUsSheetProps {
  visible: boolean;
  email: string;
  phone: string;
  onClose: () => void;
  onEmail: () => void;
  onCall: () => void;
}

/**
 * The two ways to reach MRPscan, as a sheet over the Settings screen:
 * write an email, or ring the customer care line. An option whose contact
 * point has not been configured says so rather than sitting there inert.
 */
export function ContactUsSheet({ visible, email, phone, onClose, onEmail, onCall }: ContactUsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Contact us</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={Colors.textMuted} />
            </Pressable>
          </View>

          <Option
            icon={<Mail size={18} color={Colors.diamond} />}
            iconBg={Colors.diamondBg}
            title="Email us"
            detail={email || 'Not set up yet'}
            enabled={Boolean(email)}
            onPress={onEmail}
          />
          <Option
            icon={<PhoneCall size={18} color={Colors.metalGold} />}
            iconBg={Colors.metalGoldBg}
            title="Talk to an agent now"
            detail={phone ? `Customer care · ${phone}` : 'Not set up yet'}
            enabled={Boolean(phone)}
            onPress={onCall}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface OptionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  detail: string;
  enabled: boolean;
  onPress: () => void;
}

function Option({ icon, iconBg, title, detail, enabled, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      style={[styles.option, !enabled && styles.optionDisabled]}
    >
      <View style={[styles.optionIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl + Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  optionDetail: {
    marginTop: 1,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
