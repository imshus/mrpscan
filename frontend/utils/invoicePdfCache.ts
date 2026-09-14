import * as FileSystem from 'expo-file-system/legacy';

import { registerScopeResetCallback } from '@/utils/userScopedStorage';

/** Rendered invoices share one name pattern, so an account change can find them. */
export function invoicePdfFileName(invoiceNumber: string): string {
  return `Invoice-${String(invoiceNumber).replace(/[^\w.-]+/g, '-')}.pdf`;
}

/**
 * Deletes every rendered invoice from the app cache. A PDF carries the
 * customer's name, address and GSTIN, so it leaves with the account that
 * billed it rather than staying on a shared phone for the next person.
 */
export async function purgeInvoicePdfs(): Promise<void> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) return;
  try {
    const names = await FileSystem.readDirectoryAsync(directory);
    await Promise.all(
      names
        .filter((name) => name.startsWith('Invoice-') && name.endsWith('.pdf'))
        .map((name) => FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true })),
    );
  } catch (error) {
    console.warn('[Invoice] Could not clear the rendered invoices', error);
  }
}

registerScopeResetCallback(() => {
  void purgeInvoicePdfs();
});
