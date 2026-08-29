export type LoginMethod = 'password' | 'otp';

export interface RegistrationData {
  businessId: string;
  gstNumber: string;
  businessName: string;
  businessType: string;
  phone: string;
  address: string;
  password: string;
  // Collected on the mockup "Get started" signup form.
  fullName?: string;
  companyName?: string;
  userId?: string;
}

export interface BusinessLoginResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginCredentials {
  phone: string;
  password: string;
  rememberMe: boolean;
}

export interface OtpState {
  phoneOtp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface MarketItem {
  id: string;
  title: string;
  changePercent: number;
  basePrice: number;
  totalPrice: number;
}
