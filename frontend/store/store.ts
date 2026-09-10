import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { goldRatesApi } from '@/store/goldRatesApi';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

export const store = configureStore({
  reducer: {
    [goldRatesApi.reducerPath]: goldRatesApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(goldRatesApi.middleware),
});

setupListeners(store.dispatch);

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/**
 * Gold rates and gold tax settings are served per user, and this cache holds
 * them for the whole process — five minutes past the last screen that asked,
 * and across a sign-out. Dropping it on an account change is the only way the
 * next account paints its own rates; it needs a dispatch, so it is registered
 * here rather than in goldRatesApi.
 */
registerScopeResetCallback(() => {
  store.dispatch(goldRatesApi.util.resetApiState());
});
