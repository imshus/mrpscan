import { DUMMY } from '@/constants/dummyData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function verifyGst(gstNumber: string): Promise<{ success: boolean; businessName?: string; error?: string }> {
  await delay(1200);
  const normalized = gstNumber.trim().toUpperCase();
  if (normalized === DUMMY.gstNumber.toUpperCase() || normalized.length >= 14) {
    return { success: true, businessName: DUMMY.businessName };
  }
  return { success: false, error: 'GST verification failed. Please check the number.' };
}

export async function sendOtp(_target: string, _type: 'phone' | 'email'): Promise<{ success: boolean }> {
  await delay(1000);
  return { success: true };
}

export async function verifyOtp(otp: string): Promise<{ success: boolean; error?: string }> {
  await delay(1000);
  if (otp === DUMMY.otp || otp.length === 6) {
    return { success: true };
  }
  return { success: false, error: 'Invalid OTP. Please try again.' };
}

export async function loginWithCredentials(
  identifier: string,
  password: string,
  method: 'email' | 'phone'
): Promise<{ success: boolean; error?: string }> {
  await delay(1200);
  const normalizedEmail = identifier.trim().toLowerCase();
  const normalizedPhone = identifier.replace(/\D/g, '');

  if (method === 'email') {
    if (normalizedEmail === DUMMY.email && password === DUMMY.password) {
      return { success: true };
    }
  } else if (normalizedPhone === DUMMY.phone && password === DUMMY.password) {
    return { success: true };
  }

  if (password.length >= 8) {
    return { success: true };
  }

  return { success: false, error: 'Invalid credentials. Please try again.' };
}

export async function registerAccount(_data: {
  gstNumber: string;
  businessName: string;
  phone: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  await delay(1500);
  return { success: true };
}

export async function resetPassword(_phone: string): Promise<{ success: boolean }> {
  await delay(1000);
  return { success: true };
}
