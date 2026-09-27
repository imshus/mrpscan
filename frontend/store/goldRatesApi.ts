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
      // No invalidation: hiding a karat changes nothing but its own flag, and
      // the refetch this used to trigger recomputed live rates and reflowed
      // the whole table a beat after the row had already animated away — the
      // stutter on the Gold Karat Values screen. The cached row is patched in
      // place instead, and rolled back if the server says no.
      async onQueryStarted(payload, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          goldRatesApi.util.updateQueryData('getGoldRates', undefined, (draft) => {
            const row = draft.rates.find(
              (rate) => (payload.id && rate.id === payload.id) || rate.carat === payload.carat,
            );
            if (row) row.isHidden = payload.hidden;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
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
      // Gold Rate Settings to Home, at the moment of the save: the changes go
      // into the one cached response both screens read as the save starts,
      // so Home carries them before the server has even answered. Undone if
      // the server refuses; refetched from the server once it has taken them.
      async onQueryStarted(payload, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          goldRatesApi.util.updateQueryData('getGoldRates', undefined, (draft) => {
            const t = draft.taxSettings;
            if (!t) return;
            if (payload.mcxChange) {
              t.mcxChange = payload.mcxChange;
              t.mcxChangeBy =
                payload.mcxChange.operation === '-' ? -payload.mcxChange.amount : payload.mcxChange.amount;
            }
            if (payload.rtgsChangeBy !== undefined) t.rtgsChangeBy = payload.rtgsChangeBy;
            if (payload.cashChangeBy !== undefined) t.cashChangeBy = payload.cashChangeBy;
            if (payload.rtgsTaxPercent !== undefined) t.rtgsTaxPercent = payload.rtgsTaxPercent;
            if (payload.rtgsVariant !== undefined) t.rtgsVariant = payload.rtgsVariant;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
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
