import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FileSpreadsheet, Upload } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ExcelColumnPreview } from '@/components/inventory/ExcelColumnPreview';
import { InventoryScreenHeader } from '@/components/inventory/InventoryScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useInventoryStore } from '@/store/inventoryStore';
import type { InventoryFile } from '@/types/inventory';

const UPLOAD_BORDER = '#D4AF37';
const UPLOAD_BG = '#FBF8F2';
const BUTTON_GREEN = '#A81F17';

function formatUploadMeta() {
  const now = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return {
    timeLabel: `${hour12}:${minutes} ${ampm}`,
    dateLabel: `${months[now.getMonth()]}-${now.getDate()}-${now.getFullYear()}`,
    title: `Bulk_${now.getDate()}${months[now.getMonth()].slice(0, 3)}${String(now.getFullYear()).slice(2)}`,
  };
}

export default function BulkUploadScreen() {
  const router = useRouter();
  const addFile = useInventoryStore((s) => s.addFile);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleBrowse = () => {
    setSelectedFileName('inventory_stock.xlsx');
  };

  const handleUpload = async () => {
    if (!selectedFileName) {
      handleBrowse();
    }

    setUploading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const meta = formatUploadMeta();
      const newFile: InventoryFile = {
        id: `inv-${Date.now()}`,
        title: meta.title,
        itemCount: Math.floor(Math.random() * 80) + 40,
        timeLabel: meta.timeLabel,
        dateLabel: meta.dateLabel,
      };

      addFile(newFile);
      router.back();
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <InventoryScreenHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={handleBrowse} style={styles.uploadBox}>
          <View style={styles.uploadIconCircle}>
            <FileSpreadsheet size={28} color={Colors.textSecondary} strokeWidth={1.5} />
          </View>
          <Text style={styles.uploadTitle}>Upload Excel File</Text>
          <Text style={styles.uploadSubtitle}>
            Tap here to browse your device for the .xlsx file
          </Text>
          {selectedFileName ? (
            <Text style={styles.selectedFile}>{selectedFileName}</Text>
          ) : null}
        </Pressable>

        <Text style={styles.hint}>
          Please ensure your Excel file exactly matches the column order below.
        </Text>

        <ExcelColumnPreview />

        <TouchableOpacity
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.9}
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Upload size={18} color={Colors.white} />
              <Text style={styles.uploadBtnText}>Upload Stock</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <BottomNav activeRoute="home" />
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
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UPLOAD_BG,
    borderWidth: 1.5,
    borderColor: UPLOAD_BORDER,
    borderStyle: 'dashed',
    borderRadius: Radius.input,
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  selectedFile: {
    fontSize: 12,
    fontWeight: '600',
    color: UPLOAD_BORDER,
    marginTop: 12,
  },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    marginTop: 24,
  },
  uploadBtnDisabled: {
    opacity: 0.7,
  },
  uploadBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
