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
import { Colors } from '@/constants/theme';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useAuthStore } from '@/store/authStore';
import type { GoldRate } from '@/types/rates';
import type { ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import {
  GST_RATE_OPTIONS,
  buildGoldLineItemRow,
  buildOtherChargeLineItemRows,
  buildStoneLineItemRows,
  computeGrandTotal,
  computeGstAmount,
  computeInvoiceSubtotal,
  formatInvoiceDateTime,
  prepareDisplayGoldRates,
  resolveInvoiceNumber,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { amountInWords } from '@/utils/numberToWords';
import { fetchGoldRates } from '@/utils/ratesApi';
import { apiFetchNextInvoiceNumber } from '@/utils/invoiceApi';
import { formatIndianCurrency } from '@/utils/scanPriceCalculation';
import { buildDisplayStoneBlocks } from '@/utils/stoneSequenceUtils';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';

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
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizePhoneInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, 10);
}

function sanitizeGstinInput(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15);
}

export function InvoiceGenerationBilling({
  scanData,
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

  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [mcxLiveRate, setMcxLiveRate] = useState(0);
  const [mcxFinalRate, setMcxFinalRate] = useState(0);
  const [supremeRtgsChange, setSupremeRtgsChange] = useState(0);
  const [supremeCashChange, setSupremeCashChange] = useState(0);
  const [rtgsChange, setRtgsChange] = useState(0);
  const [cashChange, setCashChange] = useState(0);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [invoiceDateTime] = useState(() => formatInvoiceDateTime());
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState<string>('Loading next number...');

  const [touched, setTouched] = useState({
    phone: false,
    email: false,
    name: false,
    address: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      setRatesLoading(true);
      try {
        const response = await fetchGoldRates();
        if (cancelled) return;
        setGoldRates(response.rates);
        setMcxLiveRate(response.mcxLiveRate);
        const mcxChangeBy =
          response.taxSettings?.mcxChangeBy ??
          resolveMcxChangeValue(response.taxSettings?.mcxChange);
        setMcxFinalRate(
          response.taxSettings?.mcxFinalRate ??
          response.mcxLiveRate + mcxChangeBy,
        );
        const supremeRtgsBase =
          response.supremeChanges?.supremeRtgs ??
          response.mcxLiveRate + (response.supremeChanges?.rtgsChange ?? 0);
        const supremeCashBase =
          response.supremeChanges?.supremeCash ??
          response.mcxLiveRate + (response.supremeChanges?.cashChange ?? 0);
        setSupremeRtgsChange(supremeRtgsBase - response.mcxLiveRate);
        setSupremeCashChange(supremeCashBase - response.mcxLiveRate);
        setRtgsChange(response.taxSettings?.rtgsChangeBy ?? 0);
        setCashChange(response.taxSettings?.cashChangeBy ?? 0);
      } catch {
        if (!cancelled) {
          setGoldRates([]);
          setMcxLiveRate(0);
          setMcxFinalRate(0);
          setSupremeRtgsChange(0);
          setSupremeCashChange(0);
          setRtgsChange(0);
          setCashChange(0);
        }
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

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  const invoiceNumber = previewInvoiceNumber;

  const stoneEntries = useMemo(() => {
    const blocks = buildDisplayStoneBlocks(diamonds, colorstones);
    return blocks.map((block) => block.entry);
  }, [diamonds, colorstones]);

  const lineItemRows = useMemo(() => {
    const { displayRates, activeBaseRate } = prepareDisplayGoldRates(
      goldRates,
      mcxLiveRate,
      supremeRtgsChange + rtgsChange,
      supremeCashChange + cashChange,
      scanData.calculationRate || 'rtgs',
      mcxFinalRate,
    );
    const goldRow = buildGoldLineItemRow({
      scanData,
      goldRates: displayRates,
      activeBaseRate,
      selectedKarat,
    });
    const stoneRows = buildStoneLineItemRows(stoneEntries);
    const otherChargeRows = buildOtherChargeLineItemRows(
      scanData.otherChargesItems || [],
      scanData.otherChargesRemarks,
    );
    return [goldRow, ...stoneRows, ...otherChargeRows].filter(row => row.price > 0 && row.qty > 0);
  }, [
    goldRates,
    mcxLiveRate,
    mcxFinalRate,
    supremeRtgsChange,
    supremeCashChange,
    rtgsChange,
    cashChange,
    scanData,
    selectedKarat,
    stoneEntries,
    scanData.otherChargesItems,
  ]);

  const subtotal = useMemo(() => computeInvoiceSubtotal(lineItemRows), [lineItemRows]);
  const gstAmount = useMemo(() => computeGstAmount(subtotal, gstRate), [subtotal, gstRate]);
  const grandTotal = useMemo(
    () => computeGrandTotal(subtotal, gstAmount),
    [subtotal, gstAmount],
  );
  const grandTotalWords = useMemo(() => amountInWords(grandTotal), [grandTotal]);

  const phoneError =
    touched.phone && customer.customerPhone.length > 0 && customer.customerPhone.length !== 10
      ? 'Phone must be exactly 10 digits'
      : undefined;
  const emailError =
    touched.email && customer.customerEmail.length > 0 && !EMAIL_PATTERN.test(customer.customerEmail)
      ? 'Enter a valid email address'
      : undefined;
  const nameError =
    touched.name && !customer.customerName.trim() ? 'Customer name is required' : undefined;
  const addressError =
    touched.address && !customer.customerAddress.trim()
      ? 'Customer address is required'
      : undefined;

  const companyName = formatProfileValue(profile.businessName, 'Your Business');

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <View className="items-center bg-primary px-5 pb-5 pt-6">
        <View className="mb-2 rounded-full bg-accent-gold/20 px-3 py-1">
          <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-accent-gold">
            Tax Invoice
          </Text>
        </View>
        <Text className="text-center text-xl font-bold text-white">{companyName}</Text>
        <Text className="mt-1 text-center text-xs leading-5 text-white/70">
          {formatProfileValue(profile.address, 'Company address not set')}
        </Text>
        <Text className="mt-1 text-center text-xs text-white/60">
          GSTIN: {formatProfileValue(profile.gstNumber, 'Not set')}
        </Text>
      </View>

      <View className="h-1 bg-accent-gold" />

      <View className="gap-4 p-4">
        <View className={isWideLayout ? 'flex-row gap-3' : 'gap-3'}>
          <View className={`rounded-xl border border-border bg-surface-muted p-4 ${isWideLayout ? 'flex-1' : 'w-full'}`}>
            <SectionHeader title="Company Profile" icon={<Building2 size={14} color="#A81F17" />} />
            <ReadOnlyRow label="Company Name" value={formatProfileValue(profile.businessName, '—')} />
            <ReadOnlyRow
              label="Company Address"
              value={formatProfileValue(profile.address, '—')}
              multiline
            />
            <ReadOnlyRow label="GSTIN Number" value={formatProfileValue(profile.gstNumber, '—')} />
          </View>
        </View>

        <View className="rounded-xl border border-border bg-white p-4">
          <SectionHeader title="Customer Details" icon={<UserRound size={14} color="#A81F17" />} />

          {readOnly ? (
            <View className={isWideLayout ? 'flex-row flex-wrap gap-3' : ''}>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ReadOnlyRow label="Customer Name" value={customer.customerName || '—'} />
                <ReadOnlyRow label="Customer Phone" value={customer.customerPhone || '—'} />
              </View>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ReadOnlyRow
                  label="Customer Address"
                  value={customer.customerAddress || '—'}
                  multiline
                />
                <ReadOnlyRow label="Customer Email" value={customer.customerEmail || '—'} />
                <ReadOnlyRow label="GSTIN Number" value={customer.customerGstin || '—'} />
              </View>
            </View>
          ) : (
            <View className={isWideLayout ? 'flex-row flex-wrap gap-1' : ''}>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ValidatedInput
                  label="Customer Name"
                  value={customer.customerName}
                  onChangeText={(text) => {
                    updateCustomer({ customerName: text });
                    setTouched((current) => ({ ...current, name: true }));
                  }}
                  placeholder="Enter customer name"
                  required
                  error={nameError}
                />
                <ValidatedInput
                  label="Customer Phone"
                  value={customer.customerPhone}
                  onChangeText={(text) => {
                    updateCustomer({ customerPhone: sanitizePhoneInput(text) });
                    setTouched((current) => ({ ...current, phone: true }));
                  }}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  error={phoneError}
                />
              </View>
              <View className={isWideLayout ? 'w-[48%]' : 'w-full'}>
                <ValidatedInput
                  label="Customer Address"
                  value={customer.customerAddress}
                  onChangeText={(text) => {
                    updateCustomer({ customerAddress: text });
                    setTouched((current) => ({ ...current, address: true }));
                  }}
                  placeholder="Enter full address"
                  required
                  error={addressError}
                />
                <ValidatedInput
                  label="Customer Email"
                  value={customer.customerEmail}
                  onChangeText={(text) => {
                    updateCustomer({ customerEmail: text.trim() });
                    setTouched((current) => ({ ...current, email: true }));
                  }}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={emailError}
                />
                <ValidatedInput
                  label="GSTIN Number"
                  value={customer.customerGstin}
                  onChangeText={(text) => updateCustomer({ customerGstin: sanitizeGstinInput(text) })}
                  placeholder="Optional GSTIN"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          )}
        </View>

        <FormSection title="Supply Details" variant="card">
          <View className={isWideLayout ? 'flex-row gap-3' : 'gap-1'}>
            {readOnly ? (
              <>
                <View className={isWideLayout ? 'flex-1' : 'w-full'}>
                  <ReadOnlyRow label="Place of Supply" value={placeOfSupply || '—'} />
                </View>
                <View className={isWideLayout ? 'flex-1' : 'w-full'}>
                  <ReadOnlyRow label="Transport" value={transport || '—'} />
                </View>
              </>
            ) : (
              <>
                <InvoiceSelectDropdown
                  label="Place of Supply"
                  value={placeOfSupply}
                  options={PLACE_OF_SUPPLY_OPTIONS}
                  onChange={setPlaceOfSupply}
                  placeholder="Select state"
                  containerClassName={isWideLayout ? 'flex-1' : 'w-full'}
                />
                <InvoiceSelectDropdown
                  label="Transport"
                  value={transport}
                  options={TRANSPORT_OPTIONS}
                  onChange={setTransport}
                  placeholder="Select transport mode"
                  containerClassName={isWideLayout ? 'flex-1' : 'w-full'}
                />
              </>
            )}
          </View>
        </FormSection>

        <FormSection title="Line Items Billing Grid">
          {ratesLoading ? (
            <View className="items-center rounded-xl border border-border bg-surface-muted py-8">
              <ActivityIndicator size="small" color="#A81F17" />
              <Text className="mt-2 text-xs text-text-secondary">Loading gold rates...</Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-xl border border-border">
              <LineItemsTable rows={lineItemRows} />
            </View>
          )}
        </FormSection>

        <View className={isWideLayout ? 'flex-row items-start justify-between gap-4' : 'gap-4'}>
          <View className={`rounded-xl border border-dashed border-accent-gold/50 bg-accent-gold/10 p-4 ${isWideLayout ? 'flex-1' : 'w-full'}`}>
            <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Amount in Words
            </Text>
            <Text className="text-sm font-medium leading-6 text-text-primary">{grandTotalWords}</Text>
          </View>

          <View className={`${isWideLayout ? 'w-[300px]' : 'w-full'}`}>
            {!readOnly ? (
              <View className="mb-3 rounded-xl border border-border bg-white p-4">
                <GstRatePills value={gstRate} onChange={setGstRate} />
              </View>
            ) : null}

            <View className="overflow-hidden rounded-2xl bg-primary">
              <View className="px-4 py-3">
                <SummaryRow label="Subtotal" value={formatIndianCurrency(subtotal)} />
                {readOnly ? <SummaryRow label="GST Rate (%)" value={`${gstRate}%`} /> : null}
                <SummaryRow label="GST Amount" value={formatIndianCurrency(gstAmount)} isLast />
              </View>
              <View className="border-t border-white/20 bg-primary-dark px-4 py-3">
                <SummaryRow label="Grand Total" value={formatIndianCurrency(grandTotal)} emphasized />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
