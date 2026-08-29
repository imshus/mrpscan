import type { RegistrationData } from '@/types/auth';

export interface BusinessProfile {
  businessName: string;
  gstNumber: string;
  businessType: string;
  phone: string;
  address: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  businessName: '',
  gstNumber: '',
  businessType: '',
  phone: '',
  address: '',
};

function buildProfile(registration: Partial<RegistrationData>): BusinessProfile {
  return {
    businessName: registration.businessName ?? '',
    gstNumber: registration.gstNumber ?? '',
    businessType: registration.businessType ?? '',
    phone: registration.phone ?? '',
    address: registration.address ?? '',
  };
}

export function getBusinessProfile(registration: Partial<RegistrationData>): BusinessProfile {
  const profile = buildProfile(registration);
  const hasData = Object.values(profile).some((value) => value.trim().length > 0);
  return hasData ? profile : EMPTY_PROFILE;
}

export function formatProfileValue(value: string, fallback = 'Not set'): string {
  return value.trim() || fallback;
}
