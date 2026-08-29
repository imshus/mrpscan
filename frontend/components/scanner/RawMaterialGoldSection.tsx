import { StyleSheet, Text, View } from 'react-native';

import { DataGridSection } from '@/components/scanner/DataGridSection';
import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { Colors } from '@/constants/theme';
import {
  KARAT_DROPDOWN_OPTIONS,
  type FinalTabPricingResult,
} from '@/utils/scanPriceCalculation';

interface RawMaterialGoldSectionProps {
  badge: string;
  pricing: FinalTabPricingResult;
  onKaratChange?: (karat: string) => void;
}

export function RawMaterialGoldSection({
  badge,
  pricing,
  onKaratChange,
}: RawMaterialGoldSectionProps) {
  const purityNote =
    pricing.puritySource === 'labourOverride'
      ? `${pricing.effectivePurityPercent} (custom purity)`
      : pricing.puritySource === 'tunchOverride'
        ? `${pricing.effectivePurityPercent} (admin override)`
        : `${pricing.effectivePurityPercent}`;

  return (
    <DataGridSection
      title="Raw Material"
      badge={badge}
      items={[
        { label: 'Gross Wt.', value: pricing.grossWtDisplay },
        { label: 'Net Wt.', value: pricing.netWtDisplay },
        {
          label: 'Tunch Purity',
          value: pricing.selectedKarat,
          showDropdown: true,
        },
        {
          label: 'Pure Wt.',
          value: `${pricing.pureWtDisplay} (${purityNote})`,
        },
      ]}
    />
  );
}

export function RawMaterialGoldSectionInteractive({
  badge,
  pricing,
  onKaratChange,
}: RawMaterialGoldSectionProps) {
  const purityNote =
    pricing.puritySource === 'labourOverride'
      ? `${pricing.effectivePurityPercent} (custom purity)`
      : pricing.puritySource === 'tunchOverride'
        ? `${pricing.effectivePurityPercent} (admin override)`
        : `${pricing.effectivePurityPercent} from backend`;

  return (
    <MetalTile title="Gold" tone="gold">
      <FinRow label="Gross / Net Wt" value={`${pricing.grossWtDisplay} / ${pricing.netWtDisplay}`} />
      {onKaratChange ? (
        <View style={styles.karatRow}>
          <Text style={styles.karatLabel}>Tunch Purity</Text>
          <SearchableSelectDropdown compact
            value={pricing.selectedKarat}
            options={KARAT_DROPDOWN_OPTIONS.map((option) => ({ value: option, label: option }))}
            onChange={onKaratChange}
            placeholder="Select karat"
            containerClassName="flex-1"
          />
        </View>
      ) : (
        <FinRow label="Tunch Purity" value={pricing.selectedKarat} />
      )}
      <Text style={styles.purityNote}>{purityNote}</Text>
      <FinRow label="Pure Wt" value={pricing.pureWtDisplay} />
      <FinRow label="Gold Amount" value={pricing.goldBasePriceDisplay} amount />
    </MetalTile>
  );
}

const styles = StyleSheet.create({
  karatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  karatLabel: {
    fontSize: 12.8,
    color: Colors.textMuted,
  },
  purityNote: {
    fontSize: 10,
    color: Colors.textMuted,
    paddingBottom: 4,
  },
});
