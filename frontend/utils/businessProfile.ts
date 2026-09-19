import type { RegistrationData } from '@/types/auth';

export interface BusinessProfile {
  businessName: string;
  gstNumber: string;
  businessType: string;
  phone: string;
  address: string;
  /** The account holder's own name, as given at signup. */
  fullName: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  businessName: '',
  gstNumber: '',
  businessType: '',
  phone: '',
  address: '',
  fullName: '',
};

function buildProfile(registration: Partial<RegistrationData>): BusinessProfile {
  return {
    businessName: registration.businessName ?? '',
    gstNumber: registration.gstNumber ?? '',
    businessType: registration.businessType ?? '',
    phone: registration.phone ?? '',
    address: registration.address ?? '',
    fullName: registration.fullName ?? '',
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

/** Words that stay as they are: a shop is "ABC Jewellers", not "Abc". */
const KEEP_AS_TYPED = /^(?:[A-Z]&[A-Z]|[A-Z]{1,4}|(?:PVT|LTD|LLP|OPC|HUF|INC|CO)\.?)$/;

/**
 * A GST-registered name, cased as a name.
 *
 * The registry returns the legal name in capitals — "PRATHAM INTERNATIONAL
 * PRIVATE LIMITED" — which shouts wherever it is shown. Only fully capitalised
 * words are touched, so a shop that registered in mixed case keeps exactly
 * what it typed, and initialisms short enough to be one ("JMD", "SKG") stay
 * capital rather than becoming "Jmd".
 */
export function toTitleCase(value: string): string {
  const text = value.trim();
  if (!text) return text;

  return text
    .split(/\s+/)
    .map((word) => {
      if (word !== word.toUpperCase()) return word;
      if (KEEP_AS_TYPED.test(word)) return word;
      return word
        .split('-')
        .map((part) =>
          part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part,
        )
        .join('-');
    })
    .join(' ');
}
