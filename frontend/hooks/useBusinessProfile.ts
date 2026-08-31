import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, type BusinessProfile } from '@/utils/businessProfile';
import { fetchBusinessProfile } from '@/utils/businessProfileApi';

export interface UseBusinessProfileResult extends BusinessProfile {
  /** True while the first fetch is in flight; the cached copy shows meanwhile. */
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * The business identity, read from the database and cached locally.
 *
 * Renders immediately from the copy stored at login so nothing flashes empty,
 * then refreshes from the server and writes the result back to the auth store,
 * so every other screen reading `registration` picks up the same values.
 */
export function useBusinessProfile(): UseBusinessProfileResult {
  const registration = useAuthStore((state) => state.registration);
  const updateRegistration = useAuthStore((state) => state.updateRegistration);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchBusinessProfile();
      if (!fresh) return;
      updateRegistration({
        businessId: fresh.businessId,
        businessName: fresh.businessName,
        gstNumber: fresh.gstNumber,
        businessType: fresh.businessType,
        address: fresh.address,
        // Only overwrite the cached phone/User ID when the server actually
        // knows them, so a partial response cannot blank the screen.
        ...(fresh.phone ? { phone: fresh.phone } : {}),
        ...(fresh.loginId ? { userId: fresh.loginId } : {}),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [updateRegistration]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...getBusinessProfile(registration), isRefreshing, refresh };
}
