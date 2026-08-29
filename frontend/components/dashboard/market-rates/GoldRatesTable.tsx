import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff, Pencil, TrendingUp } from 'lucide-react-native';

import type { GoldRate } from '@/types/rates';
import { formatKaratLabel } from '@/utils/goldRateUtils';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface GoldRatesTableProps {
  rates: GoldRate[];
  onEdit: (rate: GoldRate) => void;
  onIncreaseBy?: (rate: GoldRate) => void;
  onToggleVisibility?: (rate: GoldRate) => void;
  visibilityAction?: 'hide' | 'restore';
  showHeader?: boolean;
  showEditAction?: boolean;
}

function TableHeader() {
  return (
    <View style={styles.headerRow}>
      <Text numberOfLines={1} style={[styles.headerCell, styles.karatCol]}>
        Karat
      </Text>
      <Text numberOfLines={1} style={[styles.headerCell, styles.purityCol]}>
        Purity %
      </Text>
      <Text numberOfLines={1} style={[styles.headerCell, styles.actionsCol, styles.actionsHeader]}>
        Actions
      </Text>
    </View>
  );
}

export function GoldRatesTable({
  rates,
  onEdit,
  onIncreaseBy: _onIncreaseBy,
  onToggleVisibility,
  visibilityAction = 'hide',
  showHeader = true,
  showEditAction = true,
}: GoldRatesTableProps) {
  if (rates.length === 0) {
    return null;
  }

  const VisibilityIcon = visibilityAction === 'hide' ? Eye : EyeOff;

  return (
    <View style={styles.table}>
      {showHeader ? <TableHeader /> : null}
      {rates.map((rate, index) => (
        <View
          key={rate.id ?? rate.carat}
          style={[styles.dataRow, index < rates.length - 1 && styles.rowBorder]}
        >
          <Text numberOfLines={1} style={[styles.cell, styles.karatCol, styles.karatText]}>
            {formatKaratLabel(rate.carat)}
          </Text>
          <View style={[styles.purityCol, styles.purityWrap]}>
            <Text numberOfLines={1} style={[styles.cell, styles.purityText]}>
              {rate.purity.toFixed(1)}
            </Text>
            {showEditAction ? (
              <Pressable
                onPress={() => onEdit(rate)}
                style={({ pressed }) => [
                  styles.inlineEditBtn,
                  pressed && styles.inlineEditBtnPressed,
                ]}
                accessibilityLabel="Edit gold karat"
                accessibilityHint="Opens edit form for this karat"
                hitSlop={6}
              >
                <Pencil size={14} color="#A81F17" />
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.actionsCol, styles.actionsWrap]}>
            {onToggleVisibility ? (
              <Pressable
                onPress={() => onToggleVisibility(rate)}
                style={({ pressed }) => [
                  styles.actionIconBtn,
                  styles.actionIconBtnGhost,
                  pressed && styles.actionIconBtnGhostPressed,
                ]}
                accessibilityLabel={
                  visibilityAction === 'hide' ? 'Hide gold karat' : 'Restore gold karat'
                }
                accessibilityHint={
                  visibilityAction === 'hide'
                    ? 'Moves this karat to hidden rates'
                    : 'Moves this karat back to visible rates'
                }
                android_ripple={{ color: 'rgba(27,48,34,0.12)', borderless: false }}
                hitSlop={8}
              >
                <VisibilityIcon size={15} color="#A81F17" />
              </Pressable>
            ) : null}
            {/* <Pressable onPress={() => onIncreaseBy(rate)} style={styles.actionBtnOutline}>
              <Text style={styles.actionTextOutline}>Increase By</Text>
            </Pressable> */}
          </View>
        </View>
      ))}
    </View>
  );
}

interface McxLiveBannerProps {
  mcxLiveRate: number;
}

export function McxLiveBanner({ mcxLiveRate }: McxLiveBannerProps) {
  return (
    <View style={styles.mcxBanner}>
      <View style={styles.mcxIconWrap}>
        <TrendingUp size={18} color="#B8860B" />
      </View>
      <View style={styles.mcxTextWrap}>
        <Text style={styles.mcxLabel}>MCX Live Rate (24K Gold)</Text>
        <Text style={styles.mcxValue}>
          ₹{mcxLiveRate.toLocaleString('en-IN')} per 10gm
        </Text>
      </View>
    </View>
  );
}

interface GoldEditModalFieldsProps {
  karatLabel: string;
  purity: string;
  purityError: string | null;
  onPurityChange: (value: string) => void;
}

export function GoldEditModalFields({
  karatLabel,
  purity,
  purityError,
  onPurityChange,
}: GoldEditModalFieldsProps) {
  return (
    <View>
      <Text style={styles.modalMeta}>Karat: {karatLabel}</Text>
      <Text style={styles.fieldLabel}>Purity (%)</Text>
      <TextInput
        value={purity}
        onChangeText={onPurityChange}
        keyboardType="decimal-pad"
        placeholder="91.6"
        placeholderTextColor={Colors.placeholder}
        style={[styles.input, purityError ? styles.inputError : null]}
      />
      {purityError ? <Text style={styles.errorText}>{purityError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F4ECDC',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  cell: { fontSize: 14, color: Colors.textPrimary, flexShrink: 1 },
  karatCol: { flex: 0.9 },
  purityCol: { flex: 0.8 },
  actionsCol: { flex: 0.6, alignItems: 'flex-end' },
  actionsHeader: { textAlign: 'right' },
  karatText: { fontWeight: '700' },
  purityWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  purityText: { fontWeight: '600' },
  actionsWrap: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  inlineEditBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF7F0',
  },
  inlineEditBtnPressed: {
    backgroundColor: '#EFEFEF',
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnPrimary: {
    backgroundColor: '#A81F17',
  },
  actionIconBtnPrimaryPressed: {
    opacity: 0.85,
  },
  actionIconBtnGhost: {
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconBtnGhostPressed: {
    backgroundColor: '#EDEDED',
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: '#A81F17',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionTextOutline: { color: '#A81F17', fontSize: 11, fontWeight: '600' },
  mcxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A81F17',
    borderRadius: Radius.input,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  mcxIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mcxTextWrap: { flex: 1 },
  mcxLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  mcxValue: { fontSize: 20, fontWeight: '700', color: Colors.white },
  modalMeta: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  currentRate: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: Colors.textMuted,
  },
  inputError: { borderColor: '#D9291F' },
  errorText: { fontSize: 12, color: '#D9291F', marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingVertical: 10,
  },
  typeBtnActive: { borderColor: '#A81F17', backgroundColor: '#F4ECDC' },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeBtnTextActive: { color: '#A81F17' },
});
