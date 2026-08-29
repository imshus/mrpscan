import { create } from 'zustand';

import type { GstRateOption } from '@/utils/invoiceCalculation';

export interface InvoiceCustomerForm {
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
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
};

export const useInvoiceStore = create<InvoiceState>((set) => ({
  customer: { ...DEFAULT_CUSTOMER },
  placeOfSupply: '',
  transport: '',
  gstRate: 18,
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
      gstRate: 18,
    }),
}));
