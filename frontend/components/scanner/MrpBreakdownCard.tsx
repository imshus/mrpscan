import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';

interface MrpBreakdownCardProps {
  goldAmount: string;
  diamondAmount?: string;
  colorstoneAmount?: string;
  labourAmount: string;
  /** Present when the piece carries wastage; it is part of the Final MRP. */
  wastageAmount?: string;
  otherChargesTotal?: string;
  ultimateMrp: string;
}

export function MrpBreakdownCard({
  goldAmount,
  diamondAmount,
  colorstoneAmount,
  labourAmount,
  wastageAmount,
  otherChargesTotal,
  ultimateMrp,
}: MrpBreakdownCardProps) {
  return (
    <MetalTile title="MRP Breakdown" tone="plain">
      <FinRow label="Gold Amount" value={goldAmount} />
      {diamondAmount ? <FinRow label="Diamond Amount" value={diamondAmount} /> : null}
      {colorstoneAmount ? <FinRow label="Colorstone Amount" value={colorstoneAmount} /> : null}
      <FinRow label="Labour Amount" value={labourAmount} />
      {wastageAmount ? <FinRow label="Wastage Amount" value={wastageAmount} /> : null}
      {otherChargesTotal ? <FinRow label="Other Charges Total" value={otherChargesTotal} /> : null}
      <FinRow label="Final MRP" value={ultimateMrp} amount />
    </MetalTile>
  );
}
