import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { goldRatesApi } from '@/store/goldRatesApi';

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
