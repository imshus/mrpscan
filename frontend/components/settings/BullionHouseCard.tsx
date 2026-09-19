import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatBhaw, type BhawVendor } from '@/utils/bhawApi';

interface BullionHouseCardProps {
  name: string;
  vendor: BhawVendor | null;
  selected: boolean;
  onSelect: () => void;
}

/** The time a house last published, as it prints on the card: "3:52:12 pm". */
function updatedAtLabel(updatedAt: string): string {
  if (!updatedAt) return '';
  const when = new Date(updatedAt);
  if (Number.isNaN(when.getTime())) return '';
  return when
    .toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .toLowerCase();
}

const rupees = (value: number | null): string =>
  value === null ? '—' : value.toLocaleString('en-IN');

/**
 * One bullion house, as its own board.
 *
 * A jeweller already reads these numbers off the house's site every morning,
 * so the card prints what they print — the products down one side, the sell
 * price down the other, and the badla bhaw underneath — rather than asking
 * them to trust a name in a list. A house that has not published yet shows
 * dashes, which is the honest answer and also the reason not to pick it.
 */
export function BullionHouseCard({ name, vendor, selected, onSelect }: BullionHouseCardProps) {
  const updated = updatedAtLabel(vendor?.updatedAt ?? '');

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.name}>{name}</Text>
          {updated ? <Text style={styles.updated}>Updated {updated}</Text> : null}
        </View>
        <View style={[styles.tick, selected && styles.tickOn]}>
          {selected ? <Check size={13} color={Colors.white} strokeWidth={3} /> : null}
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={styles.tableHeadText}>PRODUCT</Text>
        <Text style={styles.tableHeadText}>SELL</Text>
      </View>

      {vendor && vendor.rows.length > 0 ? (
        vendor.rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={styles.rowValue}>{rupees(row.sell)}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noBoard}>No rates published yet.</Text>
      )}

      <View style={styles.bhawWrap}>
        <Text style={styles.bhawTitle}>BADLA BHAW</Text>
        <View style={styles.bhawRow}>
          <View style={styles.bhawCell}>
            <Text style={styles.bhawLabel}>Cash</Text>
            <Text style={styles.bhawValue}>{formatBhaw(vendor?.cashBhaw)}</Text>
          </View>
          <View style={styles.bhawCell}>
            <Text style={styles.bhawLabel}>RTGS</Text>
            <Text style={styles.bhawValue}>{formatBhaw(vendor?.rtgsBhaw)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: Spacing.md,
  },
  cardSelected: { borderColor: Colors.accentGold, borderWidth: 1.5 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headText: { flex: 1 },
  name: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  updated: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: Colors.accentGold, borderColor: Colors.accentGold },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
    marginTop: 14,
  },
  tableHeadText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 8,
  },
  rowLabel: { flex: 1, fontSize: 12.5, color: Colors.textSecondary },
  rowValue: { fontSize: 13.5, fontWeight: '800', color: Colors.accentGold },
  noBoard: { fontSize: 12, color: Colors.textMuted, paddingVertical: 12 },
  bhawWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
    paddingTop: 10,
    marginTop: 4,
  },
  bhawTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  bhawRow: { flexDirection: 'row', gap: 28, marginTop: 6 },
  bhawCell: { minWidth: 70 },
  bhawLabel: { fontSize: 10.5, color: Colors.textMuted },
  bhawValue: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 1 },
});
