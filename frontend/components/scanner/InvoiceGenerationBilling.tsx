import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Building2, FileText, UserRound } from 'lucide-react-native';

import { FieldLabel } from '@/components/scanner/FieldLabel';
import { FormSection } from '@/components/scanner/FormSection';
import { InvoiceSelectDropdown } from '@/components/scanner/InvoiceSelectDropdown';
import { PLACE_OF_SUPPLY_OPTIONS, TRANSPORT_OPTIONS } from '@/constants/invoiceData';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useAuthStore } from '@/store/authStore';

import type { ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import {
  GST_RATE_OPTIONS,
  formatInvoiceDateTime,
  resolveInvoiceNumber,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { fetchGoldRates } from '@/utils/ratesApi';
import { apiFetchNextInvoiceNumber } from '@/utils/invoiceApi';
import { formatIndianCurrency } from '@/utils/scanPriceCalculation';



interface InvoiceGenerationBillingProps {
  scanData: ScanItemData;
  structuredData?: StructuredScanData;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  scanId?: string | null;
  readOnly?: boolean;
}

function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">{icon}</View>
      <Text className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{title}</Text>
    </View>
  );
}

function ReadOnlyRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View className="mb-3 border-b border-border/60 pb-3 last:mb-0 last:border-b-0 last:pb-0">
      <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-label">
        {label}
      </Text>
      <Text
        className="text-sm leading-5 text-text-primary"
        numberOfLines={multiline ? undefined : 2}
      >
        {value}
      </Text>
    </View>
  );
}

function ValidatedInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
  /** Hard cap on typed characters, e.g. a 10-digit mobile number. */
  maxLength?: number;
}) {
  return (
    <View className="mb-3">
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        placeholderTextColor={Colors.placeholder}
        className={`h-11 rounded-input border px-3.5 text-sm text-text-primary ${
          error ? 'border-danger-text bg-danger-bg' : 'border-border bg-surface-input'
        }`}
      />
      {error ? <Text className="mt-1 text-xs text-danger-text">{error}</Text> : null}
    </View>
  );
}

function MetadataPill({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 rounded-input border border-border bg-white px-3.5 py-3">
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-label">
        {label}
      </Text>
      <Text className="text-sm font-semibold text-text-primary">{value}</Text>
    </View>
  );
}

function LineItemsTable({ rows }: { rows: InvoiceLineItemRow[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: 560 }}>
        <View className="flex-row border-b border-border bg-primary/5 px-4 py-3">
          <Text className="w-[148px] text-[10px] font-bold uppercase text-text-label">Description</Text>
          <Text className="w-[108px] text-[10px] font-bold uppercase text-text-label">Note</Text>
          <Text className="w-[72px] text-right text-[10px] font-bold uppercase text-text-label">Qty</Text>
          <Text className="w-[88px] text-right text-[10px] font-bold uppercase text-text-label">Price</Text>
          <Text className="w-[96px] text-right text-[10px] font-bold uppercase text-text-label">Amount</Text>
        </View>

        {rows.map((row, index) => {
          const qtyDisplay = row.qty > 0 ? `${row.qty} ${row.qtyUnit}` : '—';
          const priceDisplay = row.price > 0 ? formatIndianCurrency(row.price) : '—';
          const amountDisplay = row.amount > 0 ? formatIndianCurrency(row.amount) : '—';
          const isGold = row.key === 'gold-base-metal';

          return (
            <View
              key={row.key}
              className={`flex-row px-4 py-3.5 ${
                index < rows.length - 1 ? 'border-b border-border' : ''
              } ${isGold ? 'bg-accent-gold/10' : 'bg-white'}`}
            >
              <Text className="w-[148px] pr-2 text-xs font-medium leading-4 text-text-primary">
                {row.description}
              </Text>
              <Text className="w-[108px] pr-2 text-xs leading-4 text-text-secondary">{row.note}</Text>
              <Text className="w-[72px] text-right text-xs text-text-primary">{qtyDisplay}</Text>
              <Text className="w-[88px] text-right text-xs text-text-primary">{priceDisplay}</Text>
              <Text className="w-[96px] text-right text-xs font-semibold text-text-primary">
                {amountDisplay}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  isLast = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row items-center justify-between py-2.5 ${emphasized || isLast ? '' : 'border-b border-white/15'}`}>
      <Text className={`text-sm ${emphasized ? 'font-bold text-white' : 'text-white/75'}`}>
        {label}
      </Text>
      <Text className={`text-sm ${emphasized ? 'text-lg font-bold text-white' : 'font-medium text-white'}`}>
        {value}
      </Text>
    </View>
  );
}

function GstRatePills({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange: (rate: (typeof GST_RATE_OPTIONS)[number]) => void;
  readOnly?: boolean;
}) {
  return (
    <View>
      <Text className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-label">
        GST Rate (%)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {GST_RATE_OPTIONS.map((rate) => {
          const selected = rate === value;
          return (
            <Pressable
              key={rate}
              disabled={readOnly}
              onPress={() => onChange(rate)}
              className={`rounded-full border px-3.5 py-2 ${
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-surface-input'
              } ${readOnly && !selected ? 'opacity-40' : ''}`}
            >
              <Text
                className={`text-xs font-semibold ${selected ? 'text-white' : 'text-text-secondary'}`}
              >
                {rate}%
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}


/**
 * Strips emoji and other pictographs from a customer name.
 *
 * The name is printed on a tax invoice and stored against the sale, so it has
 * to be text a document can carry. Letters of any script, digits, spaces and
 * ordinary punctuation are kept.
 */
function sanitizeNameInput(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '')
    // Zero-width joiners and variation selectors are what glue emoji together;
    // removing the pictographs alone would leave them behind. Escaped rather
    // than written literally, so they are visible in the source.
    .replace(/[‍️︎]/g, '')
    .replace(/\s{2,}/g, ' ');
}

function sanitizePhoneInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, 10);
}

function sanitizeGstinInput(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15);
}

export function InvoiceGenerationBilling({
  scanData,
  structuredData,
  diamonds,
  colorstones,
  scanId = null,
  readOnly = false,
}: InvoiceGenerationBillingProps) {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 720;

  const registration = useAuthStore((state) => state.registration);
  const profile = getBusinessProfile(registration);

  const customer = useInvoiceStore((state) => state.customer);
  const placeOfSupply = useInvoiceStore((state) => state.placeOfSupply);
  const transport = useInvoiceStore((state) => state.transport);
  const gstRate = useInvoiceStore((state) => state.gstRate);
  const updateCustomer = useInvoiceStore((state) => state.updateCustomer);
  const setPlaceOfSupply = useInvoiceStore((state) => state.setPlaceOfSupply);
  const setTransport = useInvoiceStore((state) => state.setTransport);
  const setGstRate = useInvoiceStore((state) => state.setGstRate);

  const [ratesLoading, setRatesLoading] = useState(true);
  const [invoiceDateTime] = useState(() => formatInvoiceDateTime());
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState<string>('Loading next number...');

  const [touched, setTouched] = useState({
    phone: false,
    name: false,
    address: false,
  });

  useEffect(() => {
    let cancelled = false;

    // The figures come from the shared computation now; this call only tells
    // the screen whether the rate service is reachable at all.
    async function loadRates() {
      setRatesLoading(true);
      try {
        await fetchGoldRates();
      } catch {
        // A failed fetch leaves the totals at zero, which the screen already
        // renders as "rates not ready".
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    }

    void loadRates();

    async function loadNextInvoiceNumber() {
      try {
        const nextNumber = await apiFetchNextInvoiceNumber();
        if (cancelled) return;
        if (nextNumber) {
          setPreviewInvoiceNumber(nextNumber);
        } else {
          setPreviewInvoiceNumber(resolveInvoiceNumber(scanId, scanData.sku));
        }
      } catch (err) {
        if (!cancelled) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setPreviewInvoiceNumber(`Error: ${errMsg.slice(0, 30)}`);
        }
      }
    }
    void loadNextInvoiceNumber();

    return () => {
      cancelled = true;
    };
  }, []);

  const invoiceNumber = previewInvoiceNumber;

  // Figures come from the shared invoice computation, which reads the same
  // backend MRP breakdown the scanner preview screen shows. This table used to
  // price gold on its own and omit labour entirely, so it disagreed with both
  // the preview and the generated PDF.
  const {
    lineItemRows: allLineItemRows,
    subtotal,
    gstAmount,
    grandTotal,
    grandTotalWords,
  } = useInvoiceComputation();

  const lineItemRows = useMemo(
    () => allLineItemRows.filter((row) => row.price > 0 && row.qty > 0),
    [allLineItemRows],
  );

  const phoneError =
    touched.phone && !customer.customerPhone.trim()
      ? 'Customer phone is required'
      : touched.phone && customer.customerPhone.length !== 10
        ? 'Phone must be exactly 10 digits'
        : undefined;
  const nameError =
    touched.name && !customer.customerName.trim() ? 'Customer name is required' : undefined;
  // Only name and phone are compulsory; address, GSTIN and PAN are optional.
  const addressError = undefined;

  const companyName = formatProfileValue(profile.businessName, 'Your Business');

  return (
    <View className="gap-4">
      {/* One card: a tan strip naming the section, then the fields on white. */}
      <View className="overflow-hidden rounded-2xl border border-border bg-white">
        <View className="border-b border-border bg-surface-muted px-4 py-2.5">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Customer Details
          </Text>
        </View>
        <View className="p-4">

          {readOnly ? (
            <View className={isWideLayout ? 'flex-row flex-wrap gap-3' : ''}>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ReadOnlyRow label="Customer Name" value={customer.customerName || '—'} />
                <ReadOnlyRow label="Mobile Number" value={customer.customerPhone || '—'} />
              </View>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ReadOnlyRow
                  label="Address"
                  value={customer.customerAddress || '—'}
                  multiline
                />
                <ReadOnlyRow label="GST No." value={customer.customerGstin || '—'} />
                <ReadOnlyRow label="PAN" value={customer.customerPan || '—'} />
              </View>
            </View>
          ) : (
            <View className={isWideLayout ? 'flex-row flex-wrap gap-1' : ''}>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ValidatedInput
                  label="Customer Name"
                  value={customer.customerName}
                  onChangeText={(text) => {
                    updateCustomer({ customerName: sanitizeNameInput(text) });
                    setTouched((current) => ({ ...current, name: true }));
                  }}
                  placeholder="Customer name"
                  required
                  error={nameError}
                />
                <ValidatedInput
                  label="Mobile Number"
                  value={customer.customerPhone}
                  onChangeText={(text) => {
                    updateCustomer({ customerPhone: sanitizePhoneInput(text) });
                    setTouched((current) => ({ ...current, phone: true }));
                  }}
                  placeholder="Mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  required
                  error={phoneError}
                />
              </View>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ValidatedInput
                  label="Address"
                  value={customer.customerAddress}
                  onChangeText={(text) => {
                    updateCustomer({ customerAddress: text });
                    setTouched((current) => ({ ...current, address: true }));
                  }}
                  placeholder="Shop no., Area, City, State, Pincode"
                  error={addressError}
                />
                <ValidatedInput
                  label="GST No."
                  value={customer.customerGstin}
                  onChangeText={(text) => updateCustomer({ customerGstin: sanitizeGstinInput(text) })}
                  placeholder="GST number"
                  autoCapitalize="characters"
                />
                <ValidatedInput
                  label="PAN"
                  value={customer.customerPan}
                  onChangeText={(text) =>
                    updateCustomer({ customerPan: text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })
                  }
                  placeholder="PAN"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
