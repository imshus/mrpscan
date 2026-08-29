import { Text, View } from 'react-native';

import type { InvoiceLineItem } from '@/types/scanner';

interface InvoiceReceiptProps {
  items: InvoiceLineItem[];
}

export function InvoiceReceipt({ items }: InvoiceReceiptProps) {
  return (
    <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <Text className="text-center text-lg font-bold text-text-primary">PRATHAM INTL.</Text>
      <Text className="text-center text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Wholesale Jewelry Engine
      </Text>
      <Text className="mt-3 text-center text-[11px] leading-4 text-text-muted">
        123, Jewelers Street, Mumbai, MH - 400001{'\n'}
        GSTIN: 27AABCP1234F1Z5{'\n'}
        Email: contact@prathamintl.com | Ph: +91 98765 43210
      </Text>

      <View className="my-4 flex-row justify-between border-y border-dashed border-border py-3">
        <Text className="text-xs text-text-secondary">Date: 21-MAY-24</Text>
        <Text className="text-xs font-semibold text-text-primary">INV: #PR-2024-002</Text>
      </View>

      <Text className="mb-2 text-[11px] font-bold uppercase text-text-muted">
        Item Specifications
      </Text>
      {[
        ['Gross Wt.', '42.500 g'],
        ['Net Wt.', '38.200 g'],
        ['Pure Wt.', '34.991 g'],
        ['Tunch', '91.6% (22kt)'],
      ].map(([label, value]) => (
        <View key={label} className="mb-1 flex-row justify-between">
          <Text className="text-xs text-text-secondary">{label}</Text>
          <Text className="text-xs font-medium text-text-primary">{value}</Text>
        </View>
      ))}

      <View className="my-4 border-t border-border pt-3">
        <Text className="mb-1 text-[11px] font-bold uppercase text-text-muted">
          Embedded Diamond
        </Text>
        <Text className="text-xs text-text-secondary">VVS1 / F (1.20 ct) @ ₹9,500/ct</Text>
      </View>

      <View className="mb-2 flex-row border-b border-border pb-2">
        <Text className="flex-1 text-xs font-bold text-text-primary">Description</Text>
        <Text className="w-24 text-right text-xs font-bold text-text-primary">Amount (₹)</Text>
      </View>

      {items.map((item) => (
        <View key={item.description} className="mb-2 flex-row">
          <Text className="flex-1 text-xs text-text-secondary">{item.description}</Text>
          <Text className="w-24 text-right text-xs font-medium text-text-primary">
            {item.amount.toLocaleString('en-IN')}
          </Text>
        </View>
      ))}

      <View className="mt-3 flex-row border-t border-border pt-3">
        <Text className="flex-1 text-sm font-bold text-text-primary">Total</Text>
        <Text className="text-sm font-bold text-text-primary">₹1,84,500</Text>
      </View>
    </View>
  );
}
