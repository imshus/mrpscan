import { Alert, Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const MOCK_SCAN_IMAGE_URI = 'mock://local-scan-image';

// Matches the backend's OCR_MAX_EDGE_PX default (1800): the model never sees
// more pixels than this, and staying at/below it lets a baked JPEG hit the
// backend passthrough branch instead of a second sharp resize + re-encode.
const MAX_EDGE_PX = 1800;
const TARGET_MAX_BYTES = 900 * 1024;
const HARD_WARN_BYTES = 4 * 1024 * 1024;
// Above this size, converge in a single pass: start at the step-down loop's
// floor quality (0.6+0.1) instead of 0.8 then looping. Edge is MAX_EDGE_PX
// for every pass now that the cap equals the backend's.
const SINGLE_PASS_BYTES = 2.5 * 1024 * 1024;
const SINGLE_PASS_QUALITY = 0.7;
const SINGLE_PASS_MAX_EDGE_PX = MAX_EDGE_PX;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export interface PreparedUploadImage {
  uri: string;
  fileName: string;
  mimeType: string;
  originalUri: string;
  originalSizeBytes: number;
  processedSizeBytes: number;
  width: number;
  height: number;
  compressed: boolean;
  convertedFromHeic: boolean;
  /** Number of manipulateAsync (decode + encode) passes it took to produce `uri`. */
  passes: number;
}

function extractExtension(uri: string): string {
  return (uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
}

function inferMimeType(uri: string): string {
  return MIME_BY_EXTENSION[extractExtension(uri)] ?? 'image/jpeg';
}

function makeUploadFilename(prefix: 'front' | 'back' | 'scan', mimeType: string): string {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `${prefix}-${Date.now()}.${ext}`;
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

function shouldProcessImage(
  mimeType: string,
  width: number,
  height: number,
  sizeBytes: number,
): { process: boolean; quality: number; maxEdge: number } {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif';
  const oversizedByPixels = width > MAX_EDGE_PX || height > MAX_EDGE_PX;
  const oversizedByBytes = sizeBytes > TARGET_MAX_BYTES;
  const singlePass = sizeBytes > SINGLE_PASS_BYTES;
  const quality = singlePass
    ? SINGLE_PASS_QUALITY
    : sizeBytes > HARD_WARN_BYTES
      ? 0.7
      : 0.8;
  const maxEdge = singlePass ? SINGLE_PASS_MAX_EDGE_PX : MAX_EDGE_PX;

  return {
    process: isHeic || oversizedByPixels || oversizedByBytes,
    quality,
    maxEdge,
  };
}

async function processImageForUpload(
  sourceUri: string,
  sizeBytes: number,
  width: number,
  height: number,
  mimeType: string,
): Promise<PreparedUploadImage> {
  const { process, quality, maxEdge: firstPassMaxEdge } = shouldProcessImage(
    mimeType,
    width,
    height,
    sizeBytes,
  );

  let passes = 0;

  if (!process) {
    // Re-encode once (no resize) to bake EXIF orientation so images never reach the AI sideways.
    passes += 1;
    const baked = await ImageManipulator.manipulateAsync(sourceUri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    });
    const bakedInfo = await FileSystem.getInfoAsync(baked.uri);
    const bakedSizeBytes =
      bakedInfo.exists && typeof bakedInfo.size === 'number' ? bakedInfo.size : sizeBytes;

    return {
      uri: baked.uri,
      fileName: makeUploadFilename('scan', 'image/jpeg'),
      mimeType: 'image/jpeg',
      originalUri: sourceUri,
      originalSizeBytes: sizeBytes,
      processedSizeBytes: bakedSizeBytes,
      width: baked.width ?? width,
      height: baked.height ?? height,
      compressed: false,
      convertedFromHeic: false,
      passes,
    };
  }

  const resizeAction =
    width > firstPassMaxEdge || height > firstPassMaxEdge
      ? [{ resize: width >= height ? { width: firstPassMaxEdge } : { height: firstPassMaxEdge } }]
      : [];

  let compressQuality = quality;
  let maxEdge = Math.min(firstPassMaxEdge, Math.max(width, height) || firstPassMaxEdge);
  const buildResizeAction = () => {
    if (width <= 0 || height <= 0) {
      return resizeAction;
    }
    return width >= height ? [{ resize: { width: maxEdge } }] : [{ resize: { height: maxEdge } }];
  };

  passes += 1;
  let manipulated = await ImageManipulator.manipulateAsync(sourceUri, buildResizeAction(), {
    compress: compressQuality,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: false,
  });

  let processedInfo = await FileSystem.getInfoAsync(manipulated.uri);
  let processedSizeBytes =
    processedInfo.exists && typeof processedInfo.size === 'number' ? processedInfo.size : sizeBytes;

  // Later passes re-encode the resized intermediate instead of the full-res source.
  const buildIntermediateResizeAction = () => {
    const currentWidth = manipulated.width ?? width;
    const currentHeight = manipulated.height ?? height;
    if (currentWidth <= 0 || currentHeight <= 0) {
      return [];
    }
    return currentWidth >= currentHeight
      ? [{ resize: { width: maxEdge } }]
      : [{ resize: { height: maxEdge } }];
  };

  // Keep upload comfortably below common reverse-proxy body limits.
  while (processedSizeBytes > TARGET_MAX_BYTES && compressQuality > 0.6) {
    compressQuality = Math.max(0.6, compressQuality - 0.1);
    passes += 1;
    manipulated = await ImageManipulator.manipulateAsync(manipulated.uri, [], {
      compress: compressQuality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    });
    processedInfo = await FileSystem.getInfoAsync(manipulated.uri);
    processedSizeBytes =
      processedInfo.exists && typeof processedInfo.size === 'number' ? processedInfo.size : processedSizeBytes;
  }

  while (processedSizeBytes > TARGET_MAX_BYTES && maxEdge > MAX_EDGE_PX) {
    maxEdge = Math.max(MAX_EDGE_PX, Math.floor(maxEdge * 0.85));
    passes += 1;
    manipulated = await ImageManipulator.manipulateAsync(manipulated.uri, buildIntermediateResizeAction(), {
      compress: compressQuality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    });
    processedInfo = await FileSystem.getInfoAsync(manipulated.uri);
    processedSizeBytes =
      processedInfo.exists && typeof processedInfo.size === 'number' ? processedInfo.size : processedSizeBytes;
  }

  return {
    uri: manipulated.uri,
    fileName: makeUploadFilename('scan', 'image/jpeg'),
    mimeType: 'image/jpeg',
    originalUri: sourceUri,
    originalSizeBytes: sizeBytes,
    processedSizeBytes,
    width: manipulated.width ?? width,
    height: manipulated.height ?? height,
    compressed: true,
    convertedFromHeic: mimeType === 'image/heic' || mimeType === 'image/heif',
    passes,
  };
}

async function buildPreparedImage(uri: string): Promise<PreparedUploadImage> {
  const startedAt = Date.now();
  if (uri.startsWith('mock://')) {
    return {
      uri,
      fileName: makeUploadFilename('scan', 'image/jpeg'),
      mimeType: 'image/jpeg',
      originalUri: uri,
      originalSizeBytes: 0,
      processedSizeBytes: 0,
      width: 0,
      height: 0,
      compressed: false,
      convertedFromHeic: false,
      passes: 0,
    };
  }

  const extension = extractExtension(uri);
  const destination = `${FileSystem.cacheDirectory}scan-${Date.now()}.${extension}`;
  const localUri = uri.startsWith('file://') ? uri : destination;
  if (!uri.startsWith('file://')) {
    await FileSystem.copyAsync({ from: uri, to: destination });
  }

  const [info, { width, height }] = await Promise.all([
    FileSystem.getInfoAsync(localUri),
    getImageDimensions(localUri),
  ]);
  const sizeBytes = info.exists && typeof info.size === 'number' ? info.size : 0;
  const mimeType = inferMimeType(localUri);

  const prepared = await processImageForUpload(localUri, sizeBytes, width, height, mimeType);

  console.info('[UPLOAD_PREPARED_IMAGE]', {
    originalUri: prepared.originalUri,
    uploadUri: prepared.uri,
    mimeType: prepared.mimeType,
    width: prepared.width,
    height: prepared.height,
    originalSizeBytes: prepared.originalSizeBytes,
    processedSizeBytes: prepared.processedSizeBytes,
    compressed: prepared.compressed,
    convertedFromHeic: prepared.convertedFromHeic,
    ms: Date.now() - startedAt,
    passes: prepared.passes,
  });

  return prepared;
}

const prewarmedPreparations = new Map<string, Promise<PreparedUploadImage>>();

/** Starts preparing an image early (e.g. while the capture preview is open) so upload reuses it. */
export function prewarmImagePreparation(uri: string): void {
  if (prewarmedPreparations.has(uri)) {
    return;
  }
  const promise = buildPreparedImage(uri);
  prewarmedPreparations.set(uri, promise);
  // Swallow prewarm failures; upload retries on demand.
  promise.catch(() => {
    prewarmedPreparations.delete(uri);
  });
}

/** Drops a prewarmed preparation (e.g. when its captured image is deleted or retaken). */
export function invalidatePrewarmedImagePreparation(uri: string): void {
  prewarmedPreparations.delete(uri);
}

export async function prepareImageForUpload(uri: string): Promise<PreparedUploadImage> {
  const prewarmed = prewarmedPreparations.get(uri);
  if (prewarmed) {
    try {
      return await prewarmed;
    } catch {
      // Fall back to a fresh on-demand preparation below.
      prewarmedPreparations.delete(uri);
    }
  }
  return buildPreparedImage(uri);
}

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) {
    return true;
  }

  Alert.alert(
    'Photo Access Required',
    'Please allow access to your photos to upload a jewellery tag image.',
  );
  return false;
}

async function ensureCameraPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.granted) {
    return true;
  }

  Alert.alert(
    'Camera Access Required',
    'Please allow camera access to scan jewellery tags, or upload a photo from your device.',
  );
  return false;
}

const GALLERY_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1, // == RawImageExporter on Android: byte copy, no re-encode. Do NOT lower.
  allowsEditing: false,
  exif: false, // was true; never read, costs an ExifInterface pass per pick
  base64: false,
  allowsMultipleSelection: false,
  selectionLimit: 1,
};

export async function pickImageFromGallery(): Promise<string | null> {
  const startedAt = Date.now();
  let result: ImagePicker.ImagePickerResult;
  try {
    // The system photo picker needs no storage permission, so skip the per-tap
    // permission round trip / prompt and only fall back to it if the launch fails.
    result = await ImagePicker.launchImageLibraryAsync(GALLERY_PICKER_OPTIONS);
  } catch {
    // Old devices without a photo picker may still need the storage permission: ask once and retry.
    const allowed = await ensureMediaLibraryPermission();
    if (!allowed) {
      return null;
    }
    result = await ImagePicker.launchImageLibraryAsync(GALLERY_PICKER_OPTIONS);
  }

  console.info('[GALLERY_PICK]', {
    canceled: result.canceled,
    ms: Date.now() - startedAt,
    bytes: result.assets?.[0]?.fileSize ?? null,
    width: result.assets?.[0]?.width ?? null,
    height: result.assets?.[0]?.height ?? null,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

/** Opens the device camera via image picker (fallback when live preview is unavailable). */
export async function captureWithDeviceCamera(): Promise<string | null> {
  const allowed = await ensureCameraPermission();
  if (!allowed) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
    exif: false, // never read; orientation is baked during upload preparation
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

/** Fallback capture for web or when the live camera preview is not ready. */
export async function captureScanImageFallback(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return pickImageFromGallery();
  }

  try {
    return await captureWithDeviceCamera();
  } catch {
    return pickImageFromGallery();
  }
}
