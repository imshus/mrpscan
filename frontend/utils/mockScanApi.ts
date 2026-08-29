import { MOCK_REVIEW_RESULTS } from '@/constants/scannerData';
import { waitForMockDelay } from '@/constants/api';
import {
  applyJewelleryTypeToClarificationFields,
  getAvailableFieldsForJewelleryType,
} from '@/utils/clarificationFields';
import type {
  AnalyzeScanResponse,
  ClarificationField,
  ClarificationResponse,
  ConfirmedMapping,
  CreateScanResponse,
  ImageUploadResponse,
  JewelleryType,
  ReviewResponse,
  ScanMode,
  StructuredScanData,
  SubmitClarificationResponse,
  SubmitReviewResponse,
} from '@/types/scanner';

interface MockScanSession {
  jewelleryType: JewelleryType;
  scanType: ScanMode;
  frontUploaded: boolean;
  backUploaded: boolean;
  clarificationResolved: boolean;
  structuredData: StructuredScanData;
}

const sessions = new Map<string, MockScanSession>();

export const DEMO_CLARIFICATION_FIELDS: ClarificationField[] = [
  {
    abbreviation: 'CSWt',
    detectedValue: '1.5',
    suggestedField: 'other',
    confidence: 48,
    availableFields: getAvailableFieldsForJewelleryType('Diamond'),
  },
];

export function getDemoClarificationFields(
  jewelleryType: JewelleryType,
): ClarificationField[] {
  return applyJewelleryTypeToClarificationFields(DEMO_CLARIFICATION_FIELDS, jewelleryType);
}

export const DEMO_STRUCTURED_DATA: StructuredScanData = {
  grossWeight: MOCK_REVIEW_RESULTS.grossWt || '42.500',
  netWeight: MOCK_REVIEW_RESULTS.netWt,
  purity: MOCK_REVIEW_RESULTS.tunch,
  diamondWeight: MOCK_REVIEW_RESULTS.diamondWeight,
  diamondPieces: MOCK_REVIEW_RESULTS.diamondPieces,
  diamondRate: MOCK_REVIEW_RESULTS.diamondRate,
  diamondQuality: MOCK_REVIEW_RESULTS.diamondQuality,
  labour: '5465',
  otherCharges: MOCK_REVIEW_RESULTS.otherChargesAmount,
  otherChargesRemarks: MOCK_REVIEW_RESULTS.otherChargesRemarks,
};

function defaultSession(
  jewelleryType: JewelleryType,
  scanType: ScanMode,
): MockScanSession {
  return {
    jewelleryType,
    scanType,
    frontUploaded: false,
    backUploaded: false,
    clarificationResolved: false,
    structuredData: { ...DEMO_STRUCTURED_DATA },
  };
}

function getOrCreateSession(
  scanId: string,
  jewelleryType: JewelleryType = 'Diamond',
  scanType: ScanMode = 'single',
): MockScanSession {
  const existing = sessions.get(scanId);
  if (existing) return existing;

  const session = defaultSession(jewelleryType, scanType);
  sessions.set(scanId, session);
  return session;
}

export function ensureDemoSession(
  scanId: string,
  jewelleryType: JewelleryType,
  scanType: ScanMode,
): void {
  if (!sessions.has(scanId)) {
    sessions.set(scanId, defaultSession(jewelleryType, scanType));
  }
}

export async function mockCreateScan(
  jewelleryType: JewelleryType,
  scanType: ScanMode,
): Promise<CreateScanResponse> {
  await waitForMockDelay(400);

  const scanId = `demo-${Date.now()}`;
  sessions.set(scanId, defaultSession(jewelleryType, scanType));

  return { scanId, status: 'WAITING_FOR_SCAN' };
}

export async function mockUploadFrontImage(scanId: string): Promise<ImageUploadResponse> {
  await waitForMockDelay(300);
  const session = getOrCreateSession(scanId);
  session.frontUploaded = true;
  return { status: 'FRONT_IMAGE_RECEIVED' };
}

export async function mockUploadBackImage(scanId: string): Promise<ImageUploadResponse> {
  await waitForMockDelay(300);
  const session = getOrCreateSession(scanId);
  session.backUploaded = true;
  return { status: 'BACK_IMAGE_RECEIVED' };
}

export async function mockAnalyzeScan(scanId: string): Promise<AnalyzeScanResponse> {
  await waitForMockDelay(1500);
  const session = getOrCreateSession(scanId);
  session.frontUploaded = true;

  return {
    scanId,
    status: 'READY_FOR_REVIEW',
    structuredData: { ...session.structuredData },
    unknownFields: session.clarificationResolved
      ? []
      : DEMO_CLARIFICATION_FIELDS.map((field) => ({
          abbreviation: field.abbreviation,
          detectedValue: field.detectedValue,
        })),
  };
}

export async function mockGetClarification(scanId: string): Promise<ClarificationResponse> {
  await waitForMockDelay(300);
  const session = getOrCreateSession(scanId);
  const fields = getDemoClarificationFields(session.jewelleryType);
  return {
    scanId,
    fieldsNeedingReview: fields,
  };
}

export async function mockSubmitClarification(
  scanId: string,
  confirmedMappings: ConfirmedMapping[],
): Promise<SubmitClarificationResponse> {
  await waitForMockDelay(400);
  const session = getOrCreateSession(scanId);
  session.clarificationResolved = true;

  for (const mapping of confirmedMappings) {
    if (mapping.mappedField !== 'other') {
      session.structuredData[mapping.mappedField] = mapping.description ?? mapping.abbreviation;
    }
  }

  return { status: 'READY_FOR_REVIEW' };
}

export async function mockGetReview(scanId: string): Promise<ReviewResponse> {
  await waitForMockDelay(300);
  const session = getOrCreateSession(scanId);
  return {
    scanId,
    status: 'READY_FOR_REVIEW',
    structuredData: { ...session.structuredData },
  };
}

export async function mockSubmitReview(
  scanId: string,
  structuredData: StructuredScanData,
): Promise<SubmitReviewResponse> {
  await waitForMockDelay(400);
  const session = getOrCreateSession(scanId);
  session.structuredData = { ...structuredData };
  return { status: 'APPROVED' };
}

/** Demo capture — marks images uploaded without camera or network. */
export async function mockCompleteDemoCapture(
  scanId: string,
  options: { hasBackImage: boolean },
): Promise<void> {
  await mockUploadFrontImage(scanId);
  if (options.hasBackImage) {
    await mockUploadBackImage(scanId);
  }
}
