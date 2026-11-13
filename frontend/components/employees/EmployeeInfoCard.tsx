import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PenLine, SquarePen } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

interface DetailRow {
  label: string;
  value: string;
}

interface EmployeeInfoCardProps {
  title: string;
  rows?: DetailRow[];
  /** One labelled value with its own edit button, as the MPIN Manager row. */
  actionLabel?: string;
  actionValue?: string;
  /** The round pencil beside `actionValue` (mockup `.bp-edit-btn`). */
  onActionEdit?: () => void;
  actionEditLabel?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}

export function EmployeeInfoCard({
  title,
  rows,
  actionLabel,
  actionValue,
  onActionEdit,
  actionEditLabel,
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

      {actionLabel ? (
        <View style={[styles.row, styles.actionRow]}>
          <Text style={styles.label}>{actionLabel}</Text>
          <View style={styles.action}>
            <Text style={styles.actionValue}>{actionValue || '—'}</Text>
            {onActionEdit ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onActionEdit}
                hitSlop={8}
                style={styles.editBtn}
                accessibilityRole="button"
                accessibilityLabel={actionEditLabel ?? `Edit ${actionLabel}`}
              >
                <PenLine size={14} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>
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
  actionRow: {
    alignItems: 'center',
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
  // .bp-row-action: the value and its pencil, 10 apart.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  // .bp-edit-btn: 28px round, bg-alt, text-dim icon.
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
