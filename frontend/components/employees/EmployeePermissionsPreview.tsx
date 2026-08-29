import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, SquarePen } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

const ACCENT_GOLD = '#B8860B';

interface EmployeePermissionsPreviewProps {
  onEdit: () => void;
}

export function EmployeePermissionsPreview({ onEdit }: EmployeePermissionsPreviewProps) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onEdit} style={styles.permissionsHeader}>
        <Text style={styles.permissionsTitle}>Employee Permissions</Text>
        <SquarePen size={16} color={Colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  permissionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

});
