import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, SquarePen, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import type { PurityItem } from '@/constants/purityData';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePurityStore } from '@/store/purityStore';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

const BUTTON_GREEN = '#A81F17';

interface PurityRowProps {
  item: PurityItem;
  onEdit: () => void;
  showDivider: boolean;
}

function PurityRow({ item, onEdit, showDivider }: PurityRowProps) {
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{item.label}</Text>
        <Text style={styles.rowValue}>{item.value}</Text>
        <Pressable onPress={onEdit} hitSlop={8} style={styles.editBtn}>
          <SquarePen size={16} color={Colors.textPrimary} />
        </Pressable>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

interface PurityCardProps {
  title: string;
  items: PurityItem[];
  onEdit: (item: PurityItem) => void;
}

function PurityCard({ title, items, onEdit }: PurityCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderText}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <PurityRow
          key={item.id}
          item={item}
          onEdit={() => onEdit(item)}
          showDivider={index < items.length - 1}
        />
      ))}
    </View>
  );
}

export default function PurityControlScreen() {
  const allowed = useRequireSettingsAccess('tunch');
  const router = useRouter();
  const items = usePurityStore((s) => s.items);
  const updateValue = usePurityStore((s) => s.updateValue);

  const [editingItem, setEditingItem] = useState<PurityItem | null>(null);
  const [draftValue, setDraftValue] = useState('');

  if (!allowed) return null;

  const goldItems = items.filter((item) => item.metal === 'gold');
  const silverItems = items.filter((item) => item.metal === 'silver');

  const openEdit = (item: PurityItem) => {
    setEditingItem(item);
    setDraftValue(item.value.replace('%', ''));
  };

  const handleSave = () => {
    if (!editingItem) return;
    const trimmed = draftValue.trim();
    const formatted = trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
    updateValue(editingItem.id, formatted);
    setEditingItem(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>
            Tunch (Purity){'\n'}Control
          </Text>
        </View>

        <PurityCard title="Gold" items={goldItems} onEdit={openEdit} />
        <PurityCard title="Silver" items={silverItems} onEdit={openEdit} />
      </ScrollView>

      <BottomNav activeRoute="home" />

      <Modal
        visible={editingItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Pressable onPress={() => setEditingItem(null)} hitSlop={8} style={styles.modalClose}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
            <Text style={styles.modalTitle}>Edit {editingItem?.label}</Text>
            <Text style={styles.modalLabel}>Purity Value (%)</Text>
            <TextInput
              value={draftValue}
              onChangeText={setDraftValue}
              keyboardType="decimal-pad"
              placeholder="Purity %"
              placeholderTextColor={Colors.placeholder}
              style={styles.modalInput}
            />
            <TouchableOpacity activeOpacity={0.9} onPress={handleSave} style={styles.modalSaveBtn}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 34,
  },
  card: {
    marginHorizontal: Spacing.screenHorizontal,
    marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: '#F4ECDC',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 64,
    textAlign: 'right',
  },
  editBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: 20,
  },
  modalClose: {
    alignSelf: 'flex-end',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  modalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  modalSaveBtn: {
    height: 48,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
