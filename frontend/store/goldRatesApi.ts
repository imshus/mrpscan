import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import type {
  GoldRate,
  GoldRatesResponse,
  TaxSettings,
  UpdateGoldRatePayload,
  UpdateGoldRateVisibilityPayload,
  UpdateGoldTaxSettingsPayload,
} from '@/types/rates';
import {
  fetchGoldRates,
  updateGoldRate as apiUpdateGoldRate,
  updateGoldRateVisibility as apiUpdateGoldRateVisibility,
  updateGoldTaxSettings as apiUpdateGoldTaxSettings,
} from '@/utils/ratesApi';

export const goldRatesApi = createApi({
  reducerPath: 'goldRatesApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['GoldRates'],
  refetchOnFocus: true,
  refetchOnReconnect: true,
  keepUnusedDataFor: 300,
  endpoints: (builder) => ({
    getGoldRates: builder.query<GoldRatesResponse, void>({
      async queryFn() {
        try {
          const data = await fetchGoldRates();
          return { data };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error instanceof Error ? error.message : 'Failed to fetch gold rates',
            },
          };
        }
      },
      providesTags: ['GoldRates'],
    }),
    updateGoldRate: builder.mutation<GoldRate, UpdateGoldRatePayload>({
      async queryFn(payload) {
        try {
          const data = await apiUpdateGoldRate(payload);
          return { data };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error instanceof Error ? error.message : 'Failed to update gold rate',
            },
          };
        }
      },
      invalidatesTags: ['GoldRates'],
    }),
    updateGoldRateVisibility: builder.mutation<GoldRate, UpdateGoldRateVisibilityPayload>({
      async queryFn(payload) {
        try {
          const data = await apiUpdateGoldRateVisibility(payload);
          return { data };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error instanceof Error ? error.message : 'Failed to update gold visibility',
            },
          };
        }
      },
      invalidatesTags: ['GoldRates'],
    }),
    updateGoldTaxSettings: builder.mutation<TaxSettings, UpdateGoldTaxSettingsPayload>({
      async queryFn(payload) {
        try {
          const data = await apiUpdateGoldTaxSettings(payload);
          return { data };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: error instanceof Error ? error.message : 'Failed to update gold settings',
            },
          };
        }
      },
      invalidatesTags: ['GoldRates'],
    }),
  }),
});

export const {
  useGetGoldRatesQuery,
  useUpdateGoldRateMutation,
  useUpdateGoldRateVisibilityMutation,
  useUpdateGoldTaxSettingsMutation,
} = goldRatesApi;
