import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { Employee } from '@/types/employee';

/** The role line's violet, from the mockup; the theme carries no purple. */
const ROLE_VIOLET = '#6D5BD0';

interface EmployeeListCardProps {
  employee: Employee;
  onPress: () => void;
  /** Opens this employee's permissions; omitted for an employee's own card. */
  onSetPermission?: () => void;
}

export function EmployeeListCard({ employee, onPress, onSetPermission }: EmployeeListCardProps) {
  const nameParts = employee.fullName.trim().split(/\s+/);
  const initial = nameParts.length > 1
    ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
    : employee.fullName.charAt(0).toUpperCase();

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {employee.fullName}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {employee.designation}
        </Text>
      </View>
      {onSetPermission ? (
        <Pressable onPress={onSetPermission} hitSlop={6} style={styles.permissionBtn}>
          <Text style={styles.permissionText}>Set Permission</Text>
        </Pressable>
      ) : null}
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
  // Mockup: initials on a circle.
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
    color: ROLE_VIOLET,
    marginTop: 2,
  },
  permissionBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.metalGoldBorder,
    backgroundColor: Colors.metalGoldBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.metalGold,
  },
});
