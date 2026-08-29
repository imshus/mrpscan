export type PurityMetal = 'gold' | 'silver';

export interface PurityItem {
  id: string;
  label: string;
  value: string;
  metal: PurityMetal;
}

export const DEFAULT_PURITY_ITEMS: PurityItem[] = [
  { id: '24k', label: '24K Gold', value: '99.60%', metal: 'gold' },
  { id: '22k', label: '22K Gold', value: '91.60%', metal: 'gold' },
  { id: '18k', label: '18K Gold', value: '75.00%', metal: 'gold' },
  { id: '14k', label: '14K Gold', value: '58.50%', metal: 'gold' },
  { id: 'silver', label: 'Silver', value: '99.99%', metal: 'silver' },
];
