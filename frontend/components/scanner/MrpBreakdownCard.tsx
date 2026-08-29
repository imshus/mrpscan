import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';

interface MrpBreakdownCardProps {
  goldAmount: string;
  diamondAmount?: string;
  colorstoneAmount?: string;
  labourAmount: string;
  otherChargesTotal?: string;
  ultimateMrp: string;
}

export function MrpBreakdownCard({
  goldAmount,
  diamondAmount,
  colorstoneAmount,
  labourAmount,
  otherChargesTotal,
  ultimateMrp,
}: MrpBreakdownCardProps) {
  return (
    <MetalTile title="MRP Breakdown" tone="plain">
      <FinRow label="Gold Amount" value={goldAmount} />
      {diamondAmount ? <FinRow label="Diamond Amount" value={diamondAmount} /> : null}
      {colorstoneAmount ? <FinRow label="Colorstone Amount" value={colorstoneAmount} /> : null}
      <FinRow label="Labour Amount" value={labourAmount} />
      {otherChargesTotal ? <FinRow label="Other Charges Total" value={otherChargesTotal} /> : null}
      <FinRow label="Final MRP" value={ultimateMrp} amount />
    </MetalTile>
  );
}
