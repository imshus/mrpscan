import { MetalGrid, MetalInput, MetalTile, MetalValueBox } from '@/components/scanner/ReviewCardKit';

interface WastageSectionProps {
  /** The item code the wastage is kept against, as the server matched it. */
  code?: string;
  /** The percentage the server priced with — the item master's figure. */
  percent?: number;
  amountDisplay?: string;
  /**
   * On the review screen the percentage can be corrected for this one scan;
   * the box starts on the item's own figure and a typed value overrides it at
   * the server. The results view passes nothing here and stays read-only.
   */
  editable?: boolean;
  /** What the shop typed this scan; empty means the item's figure applies. */
  percentOverride?: string;
  onPercentChange?: (text: string) => void;
}

/**
 * The wastage tile (mockup `.wastage-tile`).
 *
 * Wastage is the metal the making consumes, charged as gold: a percentage of
 * the net weight at the 24K rate. The percentage lives on the item code in
 * Masters and fills in by itself when the tag matches one; the box takes a
 * correction for a piece that is an exception, and clearing it hands the
 * price back to the master's figure.
 *
 * On the read-only results view an item with no wastage set shows no tile at
 * all: a row of zeroes there would read as "this piece has no wastage" when
 * it means "nobody has set one".
 */
export function WastageSection({
  code,
  percent,
  amountDisplay,
  editable = false,
  percentOverride,
  onPercentChange,
}: WastageSectionProps) {
  if (!editable && (!percent || percent <= 0)) return null;

  const percentText =
    percentOverride !== undefined && percentOverride !== ''
      ? percentOverride
      : percent && percent > 0
        ? String(percent)
        : '';

  return (
    <MetalTile title="Wastage" tone="wastage">
      <MetalGrid>
        <MetalValueBox label="Wastage Code" value={code || '—'} />
        {editable ? (
          <MetalInput
            label="Wastage %"
            value={percentText}
            onChangeText={(text) => onPercentChange?.(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
        ) : (
          <MetalValueBox label="Wastage %" value={percent ? `${percent}%` : '—'} />
        )}
        <MetalValueBox label="Wastage Amount" value={amountDisplay || '—'} amount fullWidth />
      </MetalGrid>
    </MetalTile>
  );
}
