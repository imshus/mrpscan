import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SquarePen, Trash2 } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { Employee } from '@/types/employee';

interface EmployeeProfileHeaderProps {
  employee: Employee;
  onEdit: () => void;
  onDelete: () => void;
}

export function EmployeeProfileHeader({ employee, onEdit, onDelete }: EmployeeProfileHeaderProps) {
  const nameParts = employee.fullName.trim().split(/\s+/);
  const initial = nameParts.length > 1
    ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
    : employee.fullName.charAt(0).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <Text style={styles.name}>{employee.fullName}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onEdit} hitSlop={8} style={styles.iconBtn}>
          <SquarePen size={16} color={Colors.textMuted} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={[styles.iconBtn, styles.iconBtnDanger]}>
          <Trash2 size={16} color={Colors.brandDeep} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.metalGoldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.metalGold,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    borderColor: 'rgba(217,41,31,0.25)',
    backgroundColor: 'rgba(217,41,31,0.08)',
  },
});
