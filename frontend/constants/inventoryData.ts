import type { InventoryFile } from '@/types/inventory';

export interface ExcelColumn {
  col: string;
  header: string;
}

export const EXCEL_COLUMNS: ExcelColumn[] = [
  { col: 'A', header: 'Sr No' },
  { col: 'B', header: 'Gross Wt' },
  { col: 'C', header: 'Pure Wt' },
  { col: 'D', header: 'Tunch' },
  { col: 'E', header: 'Stone Type' },
  { col: 'F', header: 'Stone Rate' },
  { col: 'G', header: 'Net Wt' },
  { col: 'H', header: 'Remarks' },
];

export const DEMO_INVENTORY_FILES: InventoryFile[] = [
  {
    id: 'inv-1',
    title: 'Bulk_07June26',
    itemCount: 115,
    timeLabel: '12:45 PM',
    dateLabel: 'June-12-2026',
  },
  {
    id: 'inv-2',
    title: 'Stock_Monday',
    itemCount: 84,
    timeLabel: '10:20 AM',
    dateLabel: 'June-10-2026',
  },
];
