import { StyleSheet, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface EmployeeSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function EmployeeSearchBar({ value, onChangeText }: EmployeeSearchBarProps) {
  return (
    <View style={styles.wrap}>
      <Search size={16} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search Employee"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
      <SlidersHorizontal size={16} color={Colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    minHeight: 46,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
});
