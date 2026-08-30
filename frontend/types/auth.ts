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
  /**
   * Set when a later step (GST confirm) fails for a reason the Get started
   * form owns - e.g. the phone number is already registered. The signup
   * screen shows it against that field and then clears it.
   */
  phoneError?: string;
  /** Same mechanism as phoneError, for the User ID field. */
  userIdError?: string;
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
