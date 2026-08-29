/**
 * Mock/static scan data is opt-in only.
 * Set EXPO_PUBLIC_USE_MOCK_SCAN=true in frontend/.env for offline demo.
 * Otherwise all scan screens call the real backend + Gemini APIs.
 */
export function isDemoScanMode(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_SCAN === 'true';
}
