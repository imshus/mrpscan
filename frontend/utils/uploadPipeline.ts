import { isDemoScanMode } from '@/constants/scanMode';
import { uploadBackImage, uploadFrontImage } from '@/utils/scanApi';
import type { CreateScanResponse, ImageUploadResponse } from '@/types/scanner';

/**
 * Background upload pipeline for the scan flow.
 *
 * Correctness guarantees (a cached upload is ONLY reused when ALL hold):
 *  1. Same scanId — the entry is keyed by the scan session it uploaded to.
 *  2. Same imageUri — a retaken/changed image never matches a cached entry.
 *  3. The upload succeeded — failed entries are flagged and never reused;
 *     the caller falls back to a fresh prepare + upload.
 * The cache is cleared on every scan-session reset (focus reset, ReScan).
 * The bytes uploaded are identical to the on-demand path — this changes
 * WHEN the upload happens, never WHAT is uploaded.
 */

type ScanSide = 'front' | 'back';

interface BackgroundUploadEntry {
  imageUri: string;
  promise: Promise<ImageUploadResponse>;
  failed: boolean;
}

const backgroundUploads = new Map<string, BackgroundUploadEntry>();

function backgroundUploadKey(scanId: string, side: ScanSide): string {
  return `${scanId}|${side}`;
}

/**
 * Starts uploading a confirmed side image in the background while the user
 * continues through the capture flow. Chains the prewarmed createScan promise
 * so the scanId always matches the one startScanOperation will use.
 * Idempotent: a healthy in-flight/settled upload for the same scanId + side +
 * imageUri is never restarted.
 * Never rejects; on any failure processing retries the upload on demand.
 */
export function startBackgroundSideUpload(
  sessionPromise: Promise<CreateScanResponse>,
  side: ScanSide,
  imageUri: string,
): void {
  if (isDemoScanMode()) {
    return;
  }

  void sessionPromise
    .then((session) => {
      const key = backgroundUploadKey(session.scanId, side);
      const existing = backgroundUploads.get(key);
      if (existing && existing.imageUri === imageUri && !existing.failed) {
        return;
      }
      const uploadImage = side === 'front' ? uploadFrontImage : uploadBackImage;
      const entry: BackgroundUploadEntry = {
        imageUri,
        failed: false,
        promise: uploadImage(session.scanId, imageUri),
      };
      backgroundUploads.set(key, entry);
      entry.promise.catch(() => {
        entry.failed = true;
      });
    })
    .catch(() => {
      // Session prewarm failed — nothing cached; processing creates/uploads on demand.
    });
}

/** Convenience wrapper for the front side (see startBackgroundSideUpload). */
export function startBackgroundFrontUpload(
  sessionPromise: Promise<CreateScanResponse>,
  imageUri: string,
): void {
  startBackgroundSideUpload(sessionPromise, 'front', imageUri);
}

/**
 * Returns the in-flight/settled background upload for this exact
 * scanId + side + imageUri, or null (mismatch or failed → caller uploads fresh).
 */
export function getBackgroundSideUpload(
  scanId: string,
  side: ScanSide,
  imageUri: string,
): Promise<ImageUploadResponse> | null {
  const entry = backgroundUploads.get(backgroundUploadKey(scanId, side));
  if (!entry || entry.imageUri !== imageUri || entry.failed) {
    return null;
  }
  return entry.promise;
}

/** Drops all background uploads (e.g. when the scan session resets). */
export function invalidateBackgroundUploads(): void {
  backgroundUploads.clear();
}
