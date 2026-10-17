import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { useGoldRateTicker } from '@/hooks/useGoldRateTicker';

/** The rate last picked, kept for the next scan in this session. */
let rememberedKey: string | null = null;

/**
 * The shop's gold rates on the review card, in a dropdown between the back
 * and rescan buttons (the owner's choice over a scrolling strip): the box
 * shows one rate, the list holds them all — MCX, Retail, RTGS and every
 * karat's Retail and RTGS per 10 g, the figures Home shows, whatever
 * Dashboard Settings has switched on. The same anchored list as the card's
 * Gold Rate and Weight Used.
 */
export function GoldRateDropdown() {
  const rates = useGoldRateTicker();
  const [selected, setSelected] = useState<string | null>(rememberedKey);

  const options = useMemo(
    () =>
      rates.map((rate) => ({
        value: rate.key,
        label: `${rate.label}  ₹${rate.value.toLocaleString('en-IN')}`,
      })),
    [rates],
  );

  if (options.length === 0) return <View style={styles.box} />;

  // The remembered rate when it is still on the list, else the first.
  const value = selected && options.some((o) => o.value === selected) ? selected : options[0].value;

  return (
    <View style={styles.box}>
      <SearchableSelectDropdown
        compact
        anchored
        // The whole list at once (13 rates at most), rather than six and a scroll.
        maxVisibleRows={options.length}
        value={value}
        options={options}
        onChange={(key) => {
          rememberedKey = key;
          setSelected(key);
        }}
        containerClassName="w-full"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 0,
  },
});
