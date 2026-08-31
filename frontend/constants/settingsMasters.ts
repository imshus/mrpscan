export type MasterRatesCategory = 'gold' | 'diamond' | 'colorstone' | 'labour';

export interface MasterNavItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export const MASTER_RATES_ITEMS: MasterNavItem[] = [
  {
    id: 'rates-gold',
    title: 'Gold',
    subtitle: '',
    route: '/dashboard/market-rates?tab=gold',
  },
  {
    id: 'rates-diamond',
    title: 'Diamond',
    subtitle: '',
    route: '/dashboard/market-rates?tab=diamond',
  },
  {
    id: 'rates-colorstone',
    title: 'Colorstone',
    subtitle: '',
    route: '/dashboard/market-rates?tab=colorstone',
  },
  {
    id: 'rates-labour',
    title: 'Labour Charges',
    subtitle: '',
    route: '/dashboard/market-rates?tab=labour',
  },
];
