import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { DeleteInventoryModal } from '@/components/inventory/DeleteInventoryModal';
import { InventoryCard } from '@/components/inventory/InventoryCard';
import { InventoryEmptyState } from '@/components/inventory/InventoryEmptyState';
import { InventoryFab } from '@/components/inventory/InventoryFab';
import { InventoryScreenHeader } from '@/components/inventory/InventoryScreenHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useInventoryStore } from '@/store/inventoryStore';

export default function InventoryScreen() {
  const router = useRouter();
  const files = useInventoryStore((s) => s.files);
  const removeFile = useInventoryStore((s) => s.removeFile);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const isEmpty = files.length === 0;

  const goToBulkUpload = () => {
    router.push('/dashboard/inventory/bulk-upload' as Href);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      removeFile(deleteTargetId);
    }
    setDeleteTargetId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <InventoryScreenHeader />

      {isEmpty ? (
        <InventoryEmptyState onBulkUpload={goToBulkUpload} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {files.map((file) => (
            <InventoryCard
              key={file.id}
              item={file}
              onDelete={() => setDeleteTargetId(file.id)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.fabWrap}>
        <InventoryFab
          onPress={goToBulkUpload}
          variant={deleteTargetId ? 'muted' : 'primary'}
        />
      </View>

      <BottomNav activeRoute="home" />

      <DeleteInventoryModal
        visible={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  fabWrap: {
    position: 'absolute',
    right: Spacing.screenHorizontal,
    bottom: 100,
  },
});
