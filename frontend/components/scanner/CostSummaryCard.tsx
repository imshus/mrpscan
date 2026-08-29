import { Pressable, Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';

interface CostRowProps {
  label: string;
  value: string;
  bold?: boolean;
  onEdit?: () => void;
}

function CostRow({ label, value, bold = false, onEdit }: CostRowProps) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3.5 ${
        bold ? '' : 'border-b border-border'
      }`}
    >
      <Text className={`text-sm ${bold ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text className={`text-sm ${bold ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>
          {value}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Pencil size={12} color="#857A63" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface CostSummaryCardProps {
  wastage: string;
  labour: string;
  otherCharges: string;
  total: string;
}

export function CostSummaryCard({
  wastage,
  labour,
  otherCharges,
  total,
}: CostSummaryCardProps) {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-white">
      <CostRow label="Wastage" value={wastage} onEdit={() => {}} />
      <CostRow label="Labour" value={labour} onEdit={() => {}} />
      <CostRow label="Other Charges" value={otherCharges} onEdit={() => {}} />
      <CostRow label="Total" value={total} bold />
    </View>
  );
}
