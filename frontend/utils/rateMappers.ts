import type { GoldRate, StoneRate } from '@/types/rates';
import type { MarketItem } from '@/types/auth';

const CARAT_ORDER = ['22Kt', '20Kt', '18Kt', '14Kt', '9Kt'];

function sortGoldRates(rates: GoldRate[]): GoldRate[] {
  return [...rates].sort((a, b) => {
    const aIndex = CARAT_ORDER.indexOf(a.carat);
    const bIndex = CARAT_ORDER.indexOf(b.carat);
    if (aIndex === -1 && bIndex === -1) return a.carat.localeCompare(b.carat);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function goldRatesToMarketItems(mcxLiveRate: number, rates: GoldRate[]): MarketItem[] {
  return sortGoldRates(rates).map((rate) => {
    const baseFromMcx = Math.round((mcxLiveRate * rate.purity) / 100);
    const basePrice = rate.baseRate ?? baseFromMcx;
    const totalPrice = rate.finalRate;
    let changePercent = 0;

    if (rate.increaseByType === 'PERCENTAGE' && rate.increaseByAmount != null) {
      changePercent = rate.increaseByAmount;
    } else if (basePrice > 0 && totalPrice !== basePrice) {
      changePercent = Number((((totalPrice - basePrice) / basePrice) * 100).toFixed(1));
    }

    return {
      id: rate.id ?? rate.carat,
      title: `Gold ( ${rate.carat} )`,
      changePercent,
      basePrice,
      totalPrice,
    };
  });
}

export function formatInr(value: number): string {
  return `₹ ${value.toLocaleString('en-IN')}`;
}

export function stoneRateLabel(rate: StoneRate): string {
  return `${rate.color} · ${rate.clarity}`;
}
