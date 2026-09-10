import { create } from 'zustand';

import { registerScopeResetCallback } from '@/utils/userScopedStorage';

import type { GstRateOption } from '@/utils/invoiceCalculation';

export interface InvoiceCustomerForm {
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  customerPan: string;
}

interface InvoiceState {
  customer: InvoiceCustomerForm;
  placeOfSupply: string;
  transport: string;
  gstRate: GstRateOption;
  updateCustomer: (values: Partial<InvoiceCustomerForm>) => void;
  setPlaceOfSupply: (value: string) => void;
  setTransport: (value: string) => void;
  setGstRate: (value: GstRateOption) => void;
  resetInvoiceForm: () => void;
}

const DEFAULT_CUSTOMER: InvoiceCustomerForm = {
  customerName: '',
  customerAddress: '',
  customerPhone: '',
  customerEmail: '',
  customerGstin: '',
  customerPan: '',
};

export const useInvoiceStore = create<InvoiceState>((set) => ({
  customer: { ...DEFAULT_CUSTOMER },
  placeOfSupply: '',
  transport: '',
  gstRate: 3,
  updateCustomer: (values) =>
    set((state) => ({
      customer: { ...state.customer, ...values },
    })),
  setPlaceOfSupply: (value) => set({ placeOfSupply: value }),
  setTransport: (value) => set({ transport: value }),
  setGstRate: (value) => set({ gstRate: value }),
  resetInvoiceForm: () =>
    set({
      customer: { ...DEFAULT_CUSTOMER },
      placeOfSupply: '',
      transport: '',
      gstRate: 3,
    }),
}));

/**
 * The billing form belongs to the account that typed it: a customer's name,
 * address, phone, GSTIN and PAN, which the next invoice would be made out to
 * and emailed to.
 *
 * It lives in memory, so nothing on disk carries it over, but the app is not
 * restarted between accounts on a shared phone: what one person left behind
 * must not be waiting for the next.
 */
registerScopeResetCallback(() => {
  useInvoiceStore.getState().resetInvoiceForm();
});
