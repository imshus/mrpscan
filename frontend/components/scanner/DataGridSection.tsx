import { Pressable, Text, View } from 'react-native';
import { ChevronDown, Pencil } from 'lucide-react-native';

interface DataGridCellProps {
  label: string;
  value: string;
  showDropdown?: boolean;
  onEdit?: () => void;
}

function DataGridCell({ label, value, showDropdown, onEdit }: DataGridCellProps) {
  return (
    <View className="flex-1 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-text-muted">{label}</Text>
        {showDropdown ? (
          <ChevronDown size={14} color="#857A63" />
        ) : onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Pencil size={12} color="#857A63" />
          </Pressable>
        ) : null}
      </View>
      <Text className="mt-1.5 text-sm text-text-secondary">{value}</Text>
    </View>
  );
}

interface DataGridSectionProps {
  title: string;
  badge: string;
  items: [DataGridCellProps, DataGridCellProps, DataGridCellProps, DataGridCellProps];
}

export function DataGridSection({ title, badge, items }: DataGridSectionProps) {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-white">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Text className="text-sm font-bold uppercase text-text-primary">{title}</Text>
        <View className="rounded-full bg-primary px-3 py-1">
          <Text className="text-xs font-semibold text-white">{badge}</Text>
        </View>
      </View>

      <View className="flex-row border-b border-border">
        <View className="flex-1 border-r border-border">
          <DataGridCell {...items[0]} />
        </View>
        <View className="flex-1">
          <DataGridCell {...items[1]} />
        </View>
      </View>
      <View className="flex-row">
        <View className="flex-1 border-r border-border">
          <DataGridCell {...items[2]} />
        </View>
        <View className="flex-1">
          <DataGridCell {...items[3]} />
        </View>
      </View>
    </View>
  );
}
