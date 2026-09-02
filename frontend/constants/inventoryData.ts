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
