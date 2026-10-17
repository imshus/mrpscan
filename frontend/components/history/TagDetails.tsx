import { StyleSheet, Text, View } from 'react-native';

import { FinRow, MetalGrid, MetalTile, MetalValueBox } from '@/components/scanner/ReviewCardKit';
import { Colors } from '@/constants/theme';
import type { TagDetailView } from '@/utils/historyDetails';

/** A value this long does not fit half a grid row on a phone; it takes the whole row. */
const LONG_VALUE = 18;

/**
 * A past tag, read-only, in the scanner review card's own tiles (Gold, each
 * diamond and colour stone, Labour Charge, Wastage, Other Charges) and its
 * MRP Breakdown. Only what was recorded is shown: utils/historyDetails has
 * already left out every missing field and every empty tile.
 */
export function TagDetails({ view }: { view: TagDetailView }) {
  const nothingRecorded = view.tiles.length === 0 && view.breakdown.length === 0;
  return (
    <View>
      <View style={styles.identity}>
        <Text style={styles.name}>{view.title}</Text>
        {view.tagCode ? <Text style={styles.tagCode}>{view.tagCode}</Text> : null}
        {view.when ? <Text style={styles.when}>{view.when}</Text> : null}
      </View>

      {nothingRecorded ? (
        <Text style={styles.nothing}>No details were recorded for this tag.</Text>
      ) : null}

      {view.tiles.map((tile) => (
        <MetalTile key={tile.key} title={tile.title} tone={tile.tone}>
          <MetalGrid>
            {tile.fields.map((field, index) => (
              <MetalValueBox
                key={`${field.label}-${index}`}
                label={field.label}
                value={field.value}
                amount={field.amount}
                // A tile's total sits on a row of its own, under its parts.
                fullWidth={field.amount || field.value.length > LONG_VALUE}
              />
            ))}
          </MetalGrid>
        </MetalTile>
      ))}

      {view.breakdown.length ? (
        <MetalTile title="MRP Breakdown" tone="plain">
          {view.breakdown.map((line) => (
            <FinRow key={line.label} label={line.label} value={line.value} amount={line.amount} />
          ))}
        </MetalTile>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    gap: 3,
    marginBottom: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tagCode: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  when: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  nothing: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginBottom: 12,
  },
});
