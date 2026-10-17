import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

import { HistoryListScreen } from '@/components/history/HistoryListScreen';
import { apiFetchScanHistoryPage } from '@/utils/historyApi';
import { scanPageRow, type HistoryPageRow } from '@/utils/historyFormat';

/**
 * Settings → History → Tag scan history: every tag scanned, from the moment
 * it was read, newest first; one priced shows its MRP. A tap opens the tag's
 * details.
 */
export default function ScanHistoryScreen() {
  const router = useRouter();
  const open = useCallback(
    (row: HistoryPageRow) =>
      router.push({
        pathname: '/dashboard/history/scans/[scanId]',
        params: { scanId: row.id },
      } as unknown as Href),
    [router],
  );

  return (
    <HistoryListScreen
      title="Tag scan history"
      fetchPage={apiFetchScanHistoryPage}
      toRow={scanPageRow}
      onOpen={open}
    />
  );
}
