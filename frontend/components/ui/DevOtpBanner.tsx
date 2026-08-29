import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface DevOtpBannerProps {
  label: string;
  otp: string;
}

function formatOtpDigits(otp: string): string {
  return otp.replace(/\D/g, '').split('').join(' ');
}

export function DevOtpBanner({ label, otp }: DevOtpBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.otp}>{formatOtpDigits(otp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#F0D78C',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9A7B4F',
    marginBottom: 6,
  },
  otp: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 6,
  },
});
