import type { InvoiceLineItemRow } from '@/utils/moneyMath';

/**
 * The Estimated Invoice: the MRP Breakdown, built from the very lines the GST
 * invoice bills, grouped by what they are. So the figures on screen, in the
 * downloaded PDF and in the WhatsApp text are the same, and add up to the
 * invoice's subtotal, for one scan or a whole cart (a cart's lines carry a
 * "piece-<n>-" prefix, which the grouping ignores).
 */
export interface EstimateBreakdown {
  gold: number;
  diamond: number;
  colorstone: number;
  labour: number;
  wastage: number;
  otherCharges: number;
  /** Final MRP: every line, so it is the invoice's subtotal. */
  total: number;
}

export function estimateBreakdown(rows: readonly InvoiceLineItemRow[]): EstimateBreakdown {
  const out: EstimateBreakdown = {
    gold: 0, diamond: 0, colorstone: 0, labour: 0, wastage: 0, otherCharges: 0, total: 0,
  };
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    const key = row.key.replace(/^piece-\d+-/, '');
    if (key === 'gold-base-metal') out.gold += amount;
    else if (key.startsWith('stone-diamond')) out.diamond += amount;
    else if (key.startsWith('stone-')) out.colorstone += amount;
    else if (key === 'labour-charge') out.labour += amount;
    else if (key === 'wastage') out.wastage += amount;
    else out.otherCharges += amount;
    out.total += amount;
  }
  return out;
}

/** "₹44,438", Indian grouping, whole rupees. */
export function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** The rows shown, in the card's order; a zero line is left out except Gold and Labour. */
export function estimateRows(b: EstimateBreakdown): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [{ label: 'Gold Amount', value: rupees(b.gold) }];
  if (b.diamond > 0) rows.push({ label: 'Diamond Amount', value: rupees(b.diamond) });
  if (b.colorstone > 0) rows.push({ label: 'Colorstone Amount', value: rupees(b.colorstone) });
  rows.push({ label: 'Labour Amount', value: rupees(b.labour) });
  if (b.wastage > 0) rows.push({ label: 'Wastage Amount', value: rupees(b.wastage) });
  if (b.otherCharges > 0) rows.push({ label: 'Other Charges Total', value: rupees(b.otherCharges) });
  return rows;
}

/** The breakdown as plain text, for WhatsApp and email. */
export function estimateText(b: EstimateBreakdown, title: string): string {
  return [
    `MRP Breakdown — ${title}`,
    ...estimateRows(b).map((row) => `${row.label}: ${row.value}`),
    `Final MRP: ${rupees(b.total)}`,
  ].join('\n');
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** A one-page PDF of the same card: the shop, the piece, the rows, the Final MRP. */
export function estimateHtml(b: EstimateBreakdown, opts: { title: string; shopName?: string; date?: Date }): string {
  const date = (opts.date ?? new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const rows = estimateRows(b)
    .map((row) => `<tr><td>${esc(row.label)}</td><td class="v">${esc(row.value)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#1f1a14;margin:48px}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#7a6f63;font-size:13px;margin-bottom:28px}
    .card{border:1px solid #eadfcc;border-radius:16px;padding:22px 24px;max-width:460px}
    .card h2{font-size:17px;margin:0 0 14px} table{width:100%;border-collapse:collapse;font-size:15px}
    td{padding:7px 0;color:#6b5f52} td.v{text-align:right;color:#1f1a14;font-weight:700}
    tr.total td{padding-top:16px;font-size:16px} tr.total td.v{font-size:24px;font-weight:800}
    .note{color:#7a6f63;font-size:12px;margin-top:18px}
  </style></head><body>
    <h1>Estimated Invoice</h1>
    <div class="sub">${esc(opts.shopName ? `${opts.shopName} · ` : '')}${esc(opts.title)} · ${esc(date)}</div>
    <div class="card"><h2>MRP Breakdown</h2><table>${rows}
      <tr class="total"><td>Final MRP</td><td class="v">${esc(rupees(b.total))}</td></tr></table></div>
    <div class="note">An estimate, not a tax invoice.</div>
  </body></html>`;
}
