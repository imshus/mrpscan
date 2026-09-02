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
 *
 * Every entry owns an AbortController. Because the backend's saveImage is
 * last-write-wins per scanId+side, an upload for an image that has been
 * superseded (reframed/cropped, deleted, retaken, session reset) is ABORTED —
 * not merely forgotten — so its bytes can never land after the replacement.
 */

type ScanSide = 'front' | 'back';

interface BackgroundUploadEntry {
  imageUri: string;
  promise: Promise<ImageUploadResponse>;
  failed: boolean;
  controller: AbortController;
}

const backgroundUploads = new Map<string, BackgroundUploadEntry>();

/**
 * Uploads registered before their scan session has resolved. They have no Map
 * entry yet, so this is how a Delete or reset can still cancel them.
 */
const pendingControllers = new Set<AbortController>();

function backgroundUploadKey(scanId: string, side: ScanSide): string {
  return `${scanId}|${side}`;
}

/**
 * Starts uploading a confirmed side image in the background while the user
 * continues through the capture flow. Chains the prewarmed createScan promise
 * so the scanId always matches the one startScanOperation will use.
 * Idempotent: a healthy in-flight/settled upload for the same scanId + side +
 * imageUri is never restarted.
 * A different imageUri for the same scanId + side ABORTS the previous upload
 * before the new one is started, so the stale image can never overwrite the
 * new one on the server.
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

  // The controller exists before the session resolves. Until it does there is
  // no Map entry, so a Delete in that window used to abort nothing and the
  // discarded photo still went up once POST /scans returned. Anything pending
  // is aborted by invalidateBackgroundUploads along with the live entries.
  const controller = new AbortController();
  pendingControllers.add(controller);

  void sessionPromise
    .then((session) => {
      pendingControllers.delete(controller);
      if (controller.signal.aborted) {
        return;
      }
      const key = backgroundUploadKey(session.scanId, side);
      const existing = backgroundUploads.get(key);
      if (existing && existing.imageUri === imageUri && !existing.failed) {
        return;
      }
      if (existing && existing.imageUri !== imageUri) {
        // Superseded image: cancel it synchronously, BEFORE the replacement
        // upload is created, so the two requests never overlap on the wire.
        existing.controller.abort();
      }
      const uploadImage = side === 'front' ? uploadFrontImage : uploadBackImage;
      const entry: BackgroundUploadEntry = {
        imageUri,
        failed: false,
        controller,
        promise: uploadImage(session.scanId, imageUri, controller.signal),
      };
      backgroundUploads.set(key, entry);
      entry.promise.catch(() => {
        entry.failed = true;
      });
    })
    .catch(() => {
      // Session prewarm failed — nothing cached; processing creates/uploads on demand.
      pendingControllers.delete(controller);
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

/**
 * Aborts every in-flight background upload and drops all entries (e.g. when a
 * previewed capture is deleted or the scan session resets). Aborting a
 * settled upload is a no-op.
 */
export function invalidateBackgroundUploads(): void {
  for (const controller of pendingControllers) {
    controller.abort();
  }
  pendingControllers.clear();
  for (const entry of backgroundUploads.values()) {
    entry.controller.abort();
  }
  backgroundUploads.clear();
}
