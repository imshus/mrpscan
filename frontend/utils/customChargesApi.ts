import { ApiError, apiRequest } from './apiClient';
import { DEFAULT_CHARGE_OPTIONS } from '@/constants/otherCharges';

export interface ChargeNamesResponse {
  defaultCharges: string[];
  customCharges: string[];
  allCharges: string[];
}

export interface CreateCustomChargePayload {
  name: string;
}

export interface CustomChargeData {
  id: number;
  name: string;
}

/**
 * Fetch all charge names (default + custom) for the business
 */
export async function fetchChargeNames(): Promise<ChargeNamesResponse> {
  try {
    const response = await apiRequest<{ success: boolean; data: ChargeNamesResponse }>(
      '/settings/charge-names',
      { method: 'GET' }
    );

    if (!response.success) {
      throw new Error('Failed to fetch charge names');
    }

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        defaultCharges: [...DEFAULT_CHARGE_OPTIONS],
        customCharges: [],
        allCharges: [...DEFAULT_CHARGE_OPTIONS],
      };
    }
    throw error;
  }
}

/**
 * Create a new custom charge name
 */
export async function createCustomCharge(
  payload: CreateCustomChargePayload
): Promise<CustomChargeData> {
  const response = await apiRequest<{
    success: boolean;
    data: CustomChargeData;
    message: string;
  }>('/settings/charge-names', {
    method: 'POST',
    body: { name: payload.name },
  });
  
  if (!response.success) {
    throw new Error(response.message || 'Failed to create custom charge');
  }
  
  return response.data;
}

/**
 * Delete a custom charge
 */
export async function deleteCustomCharge(id: number): Promise<void> {
  const response = await apiRequest<{ success: boolean; message: string }>(
    `/settings/charge-names/${id}`,
    { method: 'DELETE' }
  );
  
  if (!response.success) {
    throw new Error(response.message || 'Failed to delete custom charge');
  }
}
