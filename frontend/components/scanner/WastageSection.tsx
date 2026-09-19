import { MetalGrid, MetalTile, MetalValueBox } from '@/components/scanner/ReviewCardKit';

interface WastageSectionProps {
  /** The item code the wastage is kept against, as the server matched it. */
  code?: string;
  percent?: number;
  amountDisplay?: string;
}

/**
 * The wastage tile (mockup `.wastage-tile`).
 *
 * Wastage is the metal the making consumes, charged as gold: a percentage of
 * the net weight at the 24K rate. The percentage is the item's, kept against
 * its code in Masters, so nothing here is editable — changing it for one scan
 * would put a price on the bill that the shop's own master does not agree
 * with. An item with no wastage against it has no tile at all rather than a
 * row of zeroes, which would read as "this piece has no wastage" when what it
 * means is "nobody has set one".
 */
export function WastageSection({ code, percent, amountDisplay }: WastageSectionProps) {
  if (!percent || percent <= 0) return null;

  return (
    <MetalTile title="Wastage" tone="wastage">
      <MetalGrid>
        <MetalValueBox label="Wastage Code" value={code || '—'} />
        <MetalValueBox label="Wastage %" value={`${percent}%`} />
        <MetalValueBox label="Wastage Amount" value={amountDisplay || '—'} amount fullWidth />
      </MetalGrid>
    </MetalTile>
  );
}
