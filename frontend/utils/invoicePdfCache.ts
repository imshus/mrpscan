import * as FileSystem from 'expo-file-system/legacy';

import { registerScopeResetCallback } from '@/utils/userScopedStorage';

/** Rendered invoices share one name pattern, so an account change can find them. */
export function invoicePdfFileName(invoiceNumber: string): string {
  return `Invoice-${String(invoiceNumber).replace(/[^\w.-]+/g, '-')}.pdf`;
}

/** Files this app writes at the top of the cache directory for one account. */
function isAccountFile(name: string): boolean {
  return (name.startsWith('Invoice-') && name.endsWith('.pdf')) || name.startsWith('scan-');
}

/**
 * Where expo-print, expo-image-picker, expo-camera and expo-image-manipulator
 * put their output: the scratch PDF before it is renamed, and every tag
 * photograph — picked, taken, or resized — before it is uploaded.
 */
const SUBDIRECTORIES = ['Print', 'ImagePicker', 'Camera', 'ImageManipulator'];

async function deleteMatching(directory: string, matches: (name: string) => boolean): Promise<void> {
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) return;
  const names = await FileSystem.readDirectoryAsync(directory);
  await Promise.all(
    names
      .filter(matches)
      .map((name) => FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true })),
  );
}

/**
 * Deletes every file the previous account left in the app cache: rendered
 * invoices (the customer's name, address and GSTIN) and tag photographs.
 * They leave with the account that made them rather than staying on a
 * shared phone for the next person.
 */
export async function purgeAccountFiles(): Promise<void> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) return;
  try {
    await deleteMatching(directory, isAccountFile);
    await Promise.all(SUBDIRECTORIES.map((sub) => deleteMatching(`${directory}${sub}/`, () => true)));
  } catch (error) {
    console.warn('[Cache] Could not clear the previous account\'s files', error);
  }
}

/** @deprecated use purgeAccountFiles — kept for callers that name the old purge. */
export const purgeInvoicePdfs = purgeAccountFiles;

registerScopeResetCallback(() => {
  void purgeAccountFiles();
});
