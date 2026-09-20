import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
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
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 10,
    marginBottom: 10,
  },
  // The followed house keeps the white fill and is marked by its border alone.
  // A warmer fill was tried and is wrong: against a cream page white already
  // reads as warm, and tinting it further closed the gap with the page instead
  // of opening one. The border is a muted tan rather than the brand's gold,
  // which at 1.5px around a whole card shouted louder than the tick.
  cardSelected: {
    borderColor: '#AF9B70',
    borderWidth: 1.5,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headText: { flex: 1 },
  name: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  updated: { fontSize: 10.5, color: Colors.textMuted, marginTop: 1 },
  tick: {
    width: 19,
    height: 19,
    borderRadius: 5,
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
    paddingBottom: 4,
    marginTop: 10,
  },
  tableHeadText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  rowValue: { fontSize: 15, fontWeight: '800', color: Colors.accentGold },
  noBoard: { fontSize: 10.5, color: Colors.textMuted, paddingVertical: 8 },
  bhawWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
    paddingTop: 7,
    marginTop: 2,
  },
  bhawTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  bhawRow: { flexDirection: 'row', gap: 22, marginTop: 3 },
  bhawCell: { minWidth: 58 },
  bhawLabel: { fontSize: 10, color: Colors.textMuted },
  bhawValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 0 },
});
