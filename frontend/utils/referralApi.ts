import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

export interface ReferralOverview {
  referralCode: string;
  inviteReward: number;
  purchaseReward: number;
  invitedCount: number;
  purchasedCount: number;
  inviteCredits: number;
  purchaseCredits: number;
  totalCredits: number;
}

function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** This person's referral code and what their referrals have earned. */
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
    inviteReward: toCount(data.inviteReward) || 50,
    purchaseReward: toCount(data.purchaseReward) || 500,
    invitedCount: toCount(data.invitedCount),
    purchasedCount: toCount(data.purchasedCount),
    inviteCredits: toCount(data.inviteCredits),
    purchaseCredits: toCount(data.purchaseCredits),
    totalCredits: toCount(data.totalCredits),
  };
}
