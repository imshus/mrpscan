import { useEffect, useState } from 'react';

import { fetchDevOtps } from '@/utils/authApi';

type DevOtpType = 'phone';

export function useDevOtp(
  businessId: string | undefined,
  type: DevOtpType,
  refreshKey = 0,
): string | null {
  const [otp, setOtp] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setOtp(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;

    const load = async () => {
      try {
        const result = await fetchDevOtps(businessId);
        const value = result[type];
        if (!cancelled && value) {
          setOtp(value);
          return true;
        }
      } catch {
        // Dev endpoint unavailable in production builds.
      }
      return false;
    };

    const poll = async () => {
      const found = await load();
      if (!found && attempts < maxAttempts && !cancelled) {
        attempts += 1;
        setTimeout(poll, 500);
      }
    };

    setOtp(null);
    poll();

    return () => {
      cancelled = true;
    };
  }, [businessId, type, refreshKey]);

  return otp;
}
