import { apiRequest } from '@/utils/apiClient';
import type { MatrixKey } from '@/constants/dashboardMatrices';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export async function fetchDashboardMatrices(): Promise<Record<MatrixKey, boolean> | null> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<MatrixKey, boolean>>>('/settings/matrices', { method: 'GET' });
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch dashboard matrices', error);
    return null;
  }
}

export async function updateDashboardMatrices(values: Record<MatrixKey, boolean>): Promise<Record<MatrixKey, boolean> | null> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<MatrixKey, boolean>>>('/settings/matrices', {
      method: 'POST',
      body: { values },
    });
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to update dashboard matrices', error);
    throw error;
  }
}
