import { isDemoScanMode } from '@/constants/scanMode';
import {
  ApiError,
  apiRequest,
  isRequestAbortedError,
  REQUEST_ABORTED_MESSAGE,
} from '@/utils/apiClient';
import { flattenStructuredData, unwrapApiData } from '@/utils/apiResponse';
import * as mockScanApi from '@/utils/mockScanApi';
import { prepareImageForUpload, type PreparedUploadImage } from '@/utils/imagePicker';
import type {
  AnalyzeScanResponse,
  ClarificationResponse,
  CreateScanResponse,
  ImageUploadResponse,
  ReviewResponse,
  SubmitClarificationRequest,
  SubmitClarificationResponse,
  SubmitReviewResponse,
  StructuredScanData,
  CalculateMrpResponse,
} from '@/types/scanner';
import type { JewelleryType, ScanMode } from '@/types/scanner';
import { toApiJewelleryType, toApiScanType } from '@/utils/scanMappers';

const UPLOAD_TIMEOUT_MS = 45 * 1000;
const UPLOAD_RETRY_DELAYS_MS = [900];

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UploadImageOptions {
  /**
   * Ask the server to start the model call as soon as this image lands,
   * while the user is still looking at the preview. Billing stays on the
   * analyze request, so an abandoned preview is never charged.
   */
  speculate?: boolean;
}

function buildImageFormData(
  prepared: PreparedUploadImage,
  extraFields?: Record<string, string>,
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields ?? {})) {
    formData.append(key, value);
  }
  formData.append('image', {
    uri: prepared.uri,
    type: prepared.mimeType,
    name: prepared.fileName,
  } as unknown as Blob);
  return formData;
}

function shouldRetryUpload(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status == null) return true;
  return error.status >= 500 || error.status === 408 || error.status === 429;
}

async function uploadWithRetry(
  path: string,
  prepared: PreparedUploadImage,
  signal?: AbortSignal,
  extraFields?: Record<string, string>,
): Promise<ImageUploadResponse> {
  const startedAt = Date.now();
  let attempt = 0;

  while (attempt <= UPLOAD_RETRY_DELAYS_MS.length) {
    try {
      // Aborted while preparing (or between retries): never put the request on
      // the wire, so a superseded image can never reach the server late.
      if (signal?.aborted) {
        throw new ApiError(REQUEST_ABORTED_MESSAGE);
      }
      console.info('[UPLOAD_HTTP_START]', {
        path,
        attempt: attempt + 1,
        timeoutMs: UPLOAD_TIMEOUT_MS,
        bytes: prepared.processedSizeBytes,
      });
      const response = await apiRequest<ImageUploadResponse>(path, {
        method: 'POST',
        body: buildImageFormData(prepared, extraFields),
        timeoutMs: UPLOAD_TIMEOUT_MS,
        signal,
      });

      const durationMs = Date.now() - startedAt;
      console.info('[UPLOAD_HTTP_SUCCESS]', {
        path,
        attempt: attempt + 1,
        durationMs,
        mimeType: prepared.mimeType,
        bytes: prepared.processedSizeBytes,
        width: prepared.width,
        height: prepared.height,
      });
      return unwrapImageUploadResponse(response);
    } catch (error) {
      const aborted = isRequestAbortedError(error);
      const canRetry =
        !aborted && shouldRetryUpload(error) && attempt < UPLOAD_RETRY_DELAYS_MS.length;
      console.warn('[UPLOAD_HTTP_FAILED]', {
        path,
        attempt: attempt + 1,
        canRetry,
        aborted,
        timeoutMs: UPLOAD_TIMEOUT_MS,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!canRetry) {
        throw error;
      }
      await sleep(UPLOAD_RETRY_DELAYS_MS[attempt]);
      attempt += 1;
    }
  }

  throw new ApiError('Upload failed after retries');
}

type WrappedCreateScanResponse = {
  success?: boolean;
  data?: CreateScanResponse;
  scanId?: string;
  status?: CreateScanResponse['status'];
};

function unwrapCreateScanResponse(response: WrappedCreateScanResponse): CreateScanResponse {
  const unwrapped = unwrapApiData(response);
  if (unwrapped.scanId) {
    return {
      scanId: unwrapped.scanId,
      status: unwrapped.status ?? 'WAITING_FOR_SCAN',
    };
  }
  throw new Error('Invalid scan session response from server');
}

function unwrapImageUploadResponse(
  response: ImageUploadResponse & { data?: ImageUploadResponse },
): ImageUploadResponse {
  const unwrapped = unwrapApiData(response);
  if (unwrapped.status) {
    return { status: unwrapped.status };
  }
  throw new Error('Invalid image upload response from server');
}

function normalizeAnalyzeResponse(raw: AnalyzeScanResponse): AnalyzeScanResponse {
  const unwrapped = unwrapApiData(raw);
  return {
    scanId: unwrapped.scanId,
    status: unwrapped.status,
    structuredData: flattenStructuredData(unwrapped.structuredData),
    unknownFields: unwrapped.unknownFields ?? [],
    billing: unwrapped.billing,
  };
}

function normalizeReviewResponse(raw: ReviewResponse): ReviewResponse {
  const unwrapped = unwrapApiData(raw);
  return {
    scanId: unwrapped.scanId,
    status: unwrapped.status,
    structuredData: flattenStructuredData(unwrapped.structuredData),
  };
}

export async function createScan(
  jewelleryType: JewelleryType,
  scanType: ScanMode,
): Promise<CreateScanResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockCreateScan(jewelleryType, scanType);
  }

  const response = await apiRequest<WrappedCreateScanResponse>('/scans', {
    method: 'POST',
    body: {
      jewelleryType: toApiJewelleryType(jewelleryType),
      scanType: toApiScanType(scanType),
    },
  });
  return unwrapCreateScanResponse(response);
}

export async function uploadFrontImage(
  scanId: string,
  imageUri: string,
  signal?: AbortSignal,
  options?: UploadImageOptions,
): Promise<ImageUploadResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockUploadFrontImage(scanId);
  }

  console.info('[IMAGE_PREPARATION_START]', {
    scanId,
    side: 'front',
    timestamp: Date.now(),
  });
  const prepared = await prepareImageForUpload(imageUri);
  console.info('[BACKEND_REQUEST_SENT]', {
    scanId,
    side: 'front',
    endpoint: `/scans/${scanId}/front-image`,
    timestamp: Date.now(),
  });
  prepared.fileName = prepared.fileName.replace(/^scan-/, 'front-');
  return uploadWithRetry(
    `/scans/${scanId}/front-image`,
    prepared,
    signal,
    options?.speculate ? { speculate: '1' } : undefined,
  );
}

export async function uploadBackImage(
  scanId: string,
  imageUri: string,
  signal?: AbortSignal,
  options?: UploadImageOptions,
): Promise<ImageUploadResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockUploadBackImage(scanId);
  }

  console.info('[IMAGE_PREPARATION_START]', {
    scanId,
    side: 'back',
    timestamp: Date.now(),
  });
  const prepared = await prepareImageForUpload(imageUri);
  console.info('[BACKEND_REQUEST_SENT]', {
    scanId,
    side: 'back',
    endpoint: `/scans/${scanId}/back-image`,
    timestamp: Date.now(),
  });
  prepared.fileName = prepared.fileName.replace(/^scan-/, 'back-');
  return uploadWithRetry(
    `/scans/${scanId}/back-image`,
    prepared,
    signal,
    options?.speculate ? { speculate: '1' } : undefined,
  );
}

export async function completeDemoCapture(
  scanId: string,
  hasBackImage: boolean,
): Promise<void> {
  await mockScanApi.mockCompleteDemoCapture(scanId, { hasBackImage });
}

export async function analyzeScan(scanId: string): Promise<AnalyzeScanResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockAnalyzeScan(scanId);
  }

  console.info('[BACKEND_REQUEST_SENT]', {
    scanId,
    endpoint: `/scans/${scanId}/analyze`,
    timestamp: Date.now(),
  });
  const response = await apiRequest<AnalyzeScanResponse>(`/scans/${scanId}/analyze`, {
    method: 'POST',
    body: null,
    timeoutMs: 90000,
  });
  return normalizeAnalyzeResponse(response);
}

export async function getClarification(scanId: string): Promise<ClarificationResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockGetClarification(scanId);
  }

  const response = await apiRequest<ClarificationResponse>(`/scans/${scanId}/clarification`);
  return unwrapApiData(response);
}

export async function submitClarification(
  scanId: string,
  payload: SubmitClarificationRequest,
): Promise<SubmitClarificationResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockSubmitClarification(scanId, payload.confirmedMappings);
  }

  return apiRequest<SubmitClarificationResponse>(`/scans/${scanId}/clarification`, {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });
}

export async function getReview(scanId: string): Promise<ReviewResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockGetReview(scanId);
  }

  const response = await apiRequest<ReviewResponse>(`/scans/${scanId}/review`);
  return normalizeReviewResponse(response);
}

export async function submitReview(
  scanId: string,
  structuredData: StructuredScanData,
): Promise<SubmitReviewResponse> {
  if (isDemoScanMode()) {
    return mockScanApi.mockSubmitReview(scanId, structuredData);
  }

  return apiRequest<SubmitReviewResponse>(`/scans/${scanId}/review`, {
    method: 'POST',
    body: structuredData,
  });
}

export async function calculateScanMrp(
  scanId: string,
  payload: any,
): Promise<CalculateMrpResponse> {
  if (isDemoScanMode()) {
    // Return dummy data in demo mode
    return {
      breakdown: {
        diamondAmount: 0,
        colorstoneAmount: 0,
        pureWeight: 0,
        goldRateApplied: 0,
        goldAmount: 0,
        labourAmount: 0,
        otherCharges: 0,
        labourChargeType: 'NONE',
      },
      finalMRP: 0,
    };
  }

  const res = await apiRequest<{ data: CalculateMrpResponse }>(`/scans/${scanId}/calculate`, {
    method: 'POST',
    body: payload,
  });
  
  return res.data;
}
