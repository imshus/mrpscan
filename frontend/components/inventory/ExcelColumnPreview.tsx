import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EXCEL_COLUMNS } from '@/constants/inventoryData';
import { Colors, Radius } from '@/constants/theme';

const COL_WIDTH = 100;
const HEADER_BG = '#E8EEF4';

export function ExcelColumnPreview() {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.letterRow}>
            {EXCEL_COLUMNS.map((col) => (
              <View key={`letter-${col.col}`} style={styles.cell}>
                <Text style={styles.letterText}>{col.col}</Text>
              </View>
            ))}
          </View>
          <View style={styles.headerRow}>
            {EXCEL_COLUMNS.map((col) => (
              <View key={`header-${col.col}`} style={styles.cell}>
                <Text style={styles.headerText}>{col.header}</Text>
              </View>
            ))}
          </View>
          <View style={styles.emptyRow}>
            {EXCEL_COLUMNS.map((col) => (
              <View key={`empty-${col.col}`} style={styles.cell} />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.scrollHint}>
        <Text style={styles.scrollHintText}>← SCROLL HORIZONTALLY TO VIEW ALL COLUMNS →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    marginTop: 20,
  },
  letterRow: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  emptyRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    minHeight: 36,
  },
  cell: {
    width: COL_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scrollHint: {
    backgroundColor: '#F4ECDC',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  scrollHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
