import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SquarePen } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface DetailRow {
  label: string;
  value: string;
}

interface EmployeeInfoCardProps {
  title: string;
  rows?: DetailRow[];
  actionLabel?: string;
  actionValue?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}

export function EmployeeInfoCard({
  title,
  rows,
  actionLabel,
  actionValue,
  onEdit,
  children,
}: EmployeeInfoCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <SquarePen size={16} color={Colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {rows?.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}

      {actionLabel && actionValue ? (
        <View style={styles.row}>
          <Text style={styles.label}>{actionLabel}</Text>
          <Text style={styles.value}>{actionValue}</Text>
        </View>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 16,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
});
