import { JewelleryTypeSelector } from '@/components/scanner/JewelleryTypeSelector';

interface JewelleryTypeChipsProps {
  variant?: 'scanner' | 'form';
}

/** @deprecated Use JewelleryTypeSelector directly */
export function JewelleryTypeChips({ variant = 'scanner' }: JewelleryTypeChipsProps) {
  return <JewelleryTypeSelector variant={variant === 'form' ? 'chips' : 'chips'} />;
}
