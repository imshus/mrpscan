import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import type { StoneAmountRow } from '@/utils/scanPriceCalculation';

const STONE_TYPE_LABELS: Record<StoneAmountRow['stoneType'], string> = {
  diamond: 'Diamond',
  colorstone: 'Colorstone',
};

interface StoneTypeResultSectionProps {
  row: StoneAmountRow;
}

export function StoneTypeResultSection({ row }: StoneTypeResultSectionProps) {
  const stoneLabel = STONE_TYPE_LABELS[row.stoneType];

  return (
    <MetalTile
      title={row.displayTitle}
      tone={row.stoneType === 'diamond' ? 'diamond' : 'plain'}
    >
      <FinRow label={`${stoneLabel} Rate`} value={row.rate} />
      <FinRow label={`${stoneLabel} Quality`} value={row.quality} />
      <FinRow label={`${stoneLabel} Wt`} value={row.weight} />
      <FinRow label={`${stoneLabel} Amount`} value={row.amountDisplay} amount />
    </MetalTile>
  );
}

interface StoneTypeSequenceProps {
  rows: StoneAmountRow[];
}

export function StoneTypeSequence({ rows }: StoneTypeSequenceProps) {
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <StoneTypeResultSection key={`stone-result-${row.sequenceIndex}`} row={row} />
      ))}
    </>
  );
}
