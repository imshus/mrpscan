import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

export interface ReferralOverview {
  referralCode: string;
  creditsPerReferral: number;
  invitedCount: number;
  rewardedCount: number;
  pendingCount: number;
  creditsEarned: number;
}

function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** The business's referral code and how its referrals are doing. */
export async function fetchReferralOverview(): Promise<ReferralOverview> {
  const response = await apiRequest<Record<string, unknown>>('/subscription/referral', {
    method: 'GET',
  });
  const data = unwrapApiData(response) as Record<string, unknown>;

  const referralCode = typeof data.referralCode === 'string' ? data.referralCode.trim() : '';
  if (!referralCode) {
    throw new Error('Referral code missing in response.');
  }

  return {
    referralCode,
    creditsPerReferral: toCount(data.creditsPerReferral) || 100,
    invitedCount: toCount(data.invitedCount),
    rewardedCount: toCount(data.rewardedCount),
    pendingCount: toCount(data.pendingCount),
    creditsEarned: toCount(data.creditsEarned),
  };
}
