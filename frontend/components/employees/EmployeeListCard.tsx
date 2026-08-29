import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { Employee } from '@/types/employee';

interface EmployeeListCardProps {
  employee: Employee;
  onPress: () => void;
}

export function EmployeeListCard({ employee, onPress }: EmployeeListCardProps) {
  const nameParts = employee.fullName.trim().split(/\s+/);
  const initial = nameParts.length > 1
    ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
    : employee.fullName.charAt(0).toUpperCase();
  const badgeText = employee.email || employee.phone || 'No Contact';

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{employee.fullName}</Text>
        <Text style={styles.role}>{employee.designation}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText} numberOfLines={1}>{badgeText}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.metalGoldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.metalGold,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  role: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.metalGold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 120,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
});
