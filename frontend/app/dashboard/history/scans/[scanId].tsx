import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { HistoryDetailScreen } from '@/components/history/HistoryDetailScreen';
import { apiFetchScanHistoryItem } from '@/utils/historyApi';
import { scanDetailView } from '@/utils/historyDetails';

/** Tag scan history → one tag: what was read off it and, once priced, how its MRP was made up. */
export default function ScanHistoryDetailScreen() {
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = typeof params.scanId === 'string' ? params.scanId : '';

  const load = useCallback(
    async (signal: AbortSignal) =>
      scanId ? scanDetailView(await apiFetchScanHistoryItem(scanId, signal)) : null,
    [scanId],
  );

  return <HistoryDetailScreen load={load} />;
}
