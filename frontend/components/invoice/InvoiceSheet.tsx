import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceLineItemRow } from '@/utils/invoiceCalculation';

/**
 * The tax invoice rendered natively, mirroring the printed PDF format:
 * GSTIN / Original Copy strip, TAX INVOICE heading, meta grid, Billed To,
 * the items table, totals with the IGST-vs-CGST/SGST split, amount in
 * words, terms and the signature block.
 *
 * This is a PREVIEW of what the server will generate — the authoritative
 * document is still the PDF produced on Download.
 */

export interface InvoiceSheetData {
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupply: string;
  reverseCharge: string;
  /** Consignment block, as on the printed invoice. */
  grRrNumber?: string;
  transport?: string;
  vehicleNumber?: string;
  station?: string;
  customerName: string;
  customerAddress: string;
  customerGstinOrPan: string;
  /** Shipped-to falls back to the billed-to party when not supplied. */
  shippedToName?: string;
  shippedToAddress?: string;
  shippedToGstinOrPan?: string;
  /** Government e-invoice reference; the band hides when irn is blank. */
  irn?: string;
  ackNumber?: string;
  ackDate?: string;
  /** Metal weight in grams, printed beside the grand total. */
  totalUnits?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  lineItems: InvoiceLineItemRow[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  amountInWords: string;
  terms: string[];
}

function inr(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  const [whole, decimals] = Math.abs(amount).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  let rest = whole.slice(0, -3);
  let grouped = '';
  while (rest.length > 2) {
    grouped = ',' + rest.slice(-2) + grouped;
    rest = rest.slice(0, -2);
  }
  grouped = rest + grouped;
  const digits = grouped ? grouped + ',' + last3 : last3;
  return (amount < 0 ? '-' : '') + digits + '.' + decimals;
}

/** First two digits of a GSTIN, or the bracketed code in "State (09)". */
function stateCode(gstinOrPlace: string): string {
  const gstin = gstinOrPlace.trim().slice(0, 2);
  if (/^\d{2}$/.test(gstin)) return gstin;
  return gstinOrPlace.match(/\((\d{2})\)/)?.[1] ?? '';
}

const HSN_JEWELLERY = '71131913';

export function InvoiceSheet({ data }: { data: InvoiceSheetData }) {
  const supplierState = stateCode(data.companyGstin);
  const customerState =
    stateCode(data.customerGstinOrPan) || stateCode(data.placeOfSupply);
  const isIntraState = Boolean(supplierState) && supplierState === customerState;
  const halfRate = Math.round((data.gstRate / 2) * 100) / 100;
  const halfAmount = Math.round((data.gstAmount / 2) * 100) / 100;

  const roundedTotal = Math.round(data.grandTotal);
  const printedTax = isIntraState ? halfAmount * 2 : data.gstAmount;
  const roundedOff =
    Math.round((roundedTotal - (data.subtotal + printedTax)) * 100) / 100;

  return (
    <View style={styles.sheet}>
      {/* GSTIN | Original Copy */}
      <View style={styles.topRow}>
        <Text style={styles.topText}>GSTIN: {data.companyGstin || '—'}</Text>
        <Text style={styles.topText}>Original Copy</Text>
      </View>

      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.taxLabel}>TAX INVOICE</Text>
        <Text style={styles.companyName}>{data.companyName}</Text>
        {data.companyAddress ? (
          <Text style={styles.companyAddress}>{data.companyAddress}</Text>
        ) : null}
      </View>

      {/* Meta grid */}
      <View style={styles.metaRow}>
        <View style={[styles.metaCol, styles.metaColDivider]}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Invoice No.</Text>
            <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Dated</Text>
            <Text style={styles.metaValue}>{data.invoiceDate}</Text>
          </View>
        </View>
        <View style={styles.metaCol}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Place of Supply</Text>
            <Text style={styles.metaValue}>{data.placeOfSupply || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Reverse Charge</Text>
            <Text style={styles.metaValue}>{data.reverseCharge}</Text>
          </View>
        </View>
      </View>

      {/* Consignment */}
      <View style={styles.metaRow}>
        <View style={[styles.metaCol, styles.metaColDivider]}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>GR/RR No.</Text>
            <Text style={styles.metaValue}>{data.grRrNumber || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Transport</Text>
            <Text style={styles.metaValue}>{data.transport || '—'}</Text>
          </View>
        </View>
        <View style={styles.metaCol}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Vehicle No.</Text>
            <Text style={styles.metaValue}>{data.vehicleNumber || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Station</Text>
            <Text style={styles.metaValue}>{data.station || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Billed To | Shipped To */}
      <View style={styles.partyRow}>
        <View style={[styles.partyCol, styles.metaColDivider]}>
          <Text style={styles.blockLabel}>Billed To</Text>
          <Text style={styles.billedName}>{data.customerName || '—'}</Text>
          {data.customerAddress ? (
            <Text style={styles.billedLine}>{data.customerAddress}</Text>
          ) : null}
          <Text style={styles.billedLine}>
            GSTIN/Pan: {data.customerGstinOrPan || '—'}
          </Text>
        </View>
        <View style={styles.partyCol}>
          <Text style={styles.blockLabel}>Shipped To</Text>
          <Text style={styles.billedName}>
            {data.shippedToName || data.customerName || '—'}
          </Text>
          {data.shippedToAddress || data.customerAddress ? (
            <Text style={styles.billedLine}>
              {data.shippedToAddress || data.customerAddress}
            </Text>
          ) : null}
          <Text style={styles.billedLine}>
            GSTIN/Pan: {data.shippedToGstinOrPan || data.customerGstinOrPan || '—'}
          </Text>
        </View>
      </View>

      {/* e-Invoice reference */}
      {data.irn ? (
        <View style={styles.irnBand}>
          <Text style={styles.irnText}>IRN : {data.irn}</Text>
          <Text style={styles.irnText}>
            Ack.No. : {data.ackNumber || '—'}     Ack.Date : {data.ackDate || '—'}
          </Text>
        </View>
      ) : null}

      {/* Items table */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colSn]}>S.N.</Text>
        <Text style={[styles.th, styles.colDesc]}>Description of Goods</Text>
        <Text style={[styles.th, styles.colHsn]}>HSN/SAC</Text>
        <Text style={[styles.th, styles.colQty]}>Qty. Unit</Text>
        <Text style={[styles.th, styles.colPrice, styles.right]}>Price</Text>
        <Text style={[styles.th, styles.colAmount, styles.right]}>Amount (₹)</Text>
      </View>
      {data.lineItems.map((row, index) => (
        <View key={row.key} style={styles.tableRow}>
          <Text style={[styles.td, styles.colSn]}>{index + 1}.</Text>
          <Text style={[styles.td, styles.colDesc]}>
            {row.description}
            {row.note ? `\n${row.note}` : ''}
          </Text>
          <Text style={[styles.td, styles.colHsn]}>{HSN_JEWELLERY}</Text>
          <Text style={[styles.td, styles.colQty]}>
            {row.qty > 0 ? `${row.qty.toFixed(3)} ${row.qtyUnit}`.trim() : '—'}
          </Text>
          <Text style={[styles.td, styles.colPrice, styles.right]}>
            {row.price > 0 ? inr(row.price) : '—'}
          </Text>
          <Text style={[styles.td, styles.colAmount, styles.right]}>
            {inr(row.amount)}
          </Text>
        </View>
      ))}

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsKey}>Subtotal</Text>
          <Text style={styles.totalsValue}>₹ {inr(data.subtotal)}</Text>
        </View>
        {isIntraState ? (
          <>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Add: CGST @ {halfRate.toFixed(2)}%</Text>
              <Text style={styles.totalsValue}>{inr(halfAmount)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Add: SGST @ {halfRate.toFixed(2)}%</Text>
              <Text style={styles.totalsValue}>{inr(halfAmount)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Add: IGST @ {data.gstRate.toFixed(2)}%</Text>
            <Text style={styles.totalsValue}>{inr(data.gstAmount)}</Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsKey}>
            Add: Rounded Off ({roundedOff >= 0 ? '+' : '-'})
          </Text>
          <Text style={styles.totalsValue}>{inr(Math.abs(roundedOff))}</Text>
        </View>
        <View style={[styles.totalsRow, styles.grandRow]}>
          <Text style={styles.grandKey}>Grand Total</Text>
          {data.totalUnits ? (
            <Text style={styles.unitsText}>{data.totalUnits} Units</Text>
          ) : null}
          <Text style={styles.grandValue}>₹ {inr(roundedTotal)}</Text>
        </View>
      </View>

      {/* Amount in words */}
      <Text style={styles.words}>{data.amountInWords}</Text>

      {/* Bank details */}
      {data.bankName ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Bank Details</Text>
          <Text style={styles.billedLine}>
            {data.bankName}
            {data.bankBranch ? `, ${data.bankBranch}` : ''}
          </Text>
          <Text style={styles.billedLine}>
            A/C No. {data.bankAccountNumber || '—'} · IFSC: {data.bankIfsc || '—'}
          </Text>
        </View>
      ) : null}

      {/* Terms */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>Terms &amp; Conditions</Text>
        {data.terms.map((term, index) => (
          <Text key={term} style={styles.billedLine}>
            {index + 1}. {term}
          </Text>
        ))}
      </View>

      {/* Signatures */}
      <View style={styles.signRow}>
        <View style={styles.signCol}>
          <Text style={styles.eoe}>E. &amp; O.E.</Text>
          <Text style={styles.signLabel}>Receiver&apos;s Signature</Text>
        </View>
        <View style={styles.signColRight}>
          <Text style={styles.signFor}>for {data.companyName}</Text>
          <Text style={styles.signLabel}>Authorised Signatory</Text>
        </View>
      </View>
    </View>
  );
}

const BORDER = '#000';

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  topText: { fontSize: 10, fontWeight: '700', color: '#000' },
  brand: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  taxLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#333',
  },
  companyName: { fontSize: 17, fontWeight: '800', color: '#000' },
  companyAddress: { fontSize: 9.5, color: '#333', textAlign: 'center', lineHeight: 13 },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER },
  partyRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER },
  partyCol: { flex: 1, gap: 2, paddingHorizontal: 10, paddingVertical: 8 },
  irnBand: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  irnText: { fontSize: 8, color: '#222' },
  unitsText: { fontSize: 10.5, color: '#222' },
  signCol: { flex: 1, gap: 2 },
  signColRight: { flex: 1, alignItems: 'flex-end', gap: 2 },
  eoe: { fontSize: 8, color: '#333' },
  metaCol: { flex: 1, gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  metaColDivider: { borderRightWidth: 1, borderColor: BORDER },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  metaKey: { fontSize: 9.5, color: '#333' },
  metaValue: { fontSize: 9.5, fontWeight: '700', color: '#000', flexShrink: 1, textAlign: 'right' },
  block: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  blockLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#000',
    marginBottom: 2,
  },
  billedName: { fontSize: 12.5, fontWeight: '800', color: '#000' },
  billedLine: { fontSize: 10, color: '#222', lineHeight: 14 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F4EFE3',
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#333' },
  th: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#000',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#333',
  },
  td: {
    fontSize: 8.5,
    color: '#000',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#333',
    lineHeight: 12,
  },
  right: { textAlign: 'right' },
  colSn: { width: '7%' },
  colDesc: { width: '30%' },
  colHsn: { width: '17%' },
  colQty: { width: '16%' },
  colPrice: { width: '15%' },
  colAmount: { width: '15%', borderRightWidth: 0 },
  totals: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsKey: { fontSize: 10.5, color: '#222' },
  totalsValue: { fontSize: 10.5, fontWeight: '700', color: '#000' },
  grandRow: { marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderColor: BORDER },
  grandKey: { fontSize: 12, fontWeight: '800', color: '#000' },
  grandValue: { fontSize: 12, fontWeight: '800', color: '#000' },
  words: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingTop: 26,
    paddingBottom: 10,
  },
  signFor: { fontSize: 10, fontWeight: '700', color: '#000' },
  signLabel: { fontSize: 10, color: '#333' },
});
