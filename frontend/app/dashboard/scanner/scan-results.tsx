import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CheckCircle, Heart } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import {
  CardFooter,
  CardHeader,
  FloatingCard,
  PillButton,
} from '@/components/scanner/ReviewCardKit';
import { PriceCard } from '@/components/scanner/PriceCard';
import { ScannerFinalTab } from '@/components/scanner/ScannerFinalTab';
import { MOCK_SCAN_RESULT } from '@/constants/scannerData';
import { isDemoScanMode } from '@/constants/scanMode';
import { Colors } from '@/constants/theme';
import { useFinalTabPricing } from '@/hooks/useFinalTabPricing';
import { useScannerStore } from '@/store/scannerStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { buildWishlistItem, buildTagCode } from '@/utils/wishlistUtils';
import { parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';

export default function ScanResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ fromWishlist?: string; wishlistId?: string }>();
  const scanData = useScannerStore((s) => s.scanData);
  const selectedType = useScannerStore((s) => s.selectedType);
  const structuredData = useScannerStore((s) => s.structuredData);
  const addWishlistItem = useWishlistStore((s) => s.addItem);
  const getWishlistItem = useWishlistStore((s) => s.getItemById);
  const isInWishlist = useWishlistStore((s) => s.isInWishlist);
  const demoResult = isDemoScanMode() ? MOCK_SCAN_RESULT : null;

  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [hasAdded, setHasAdded] = useState(false);

  const wishlistItem = params.wishlistId ? getWishlistItem(String(params.wishlistId)) : undefined;
  const isFromWishlist = params.fromWishlist === '1' && Boolean(wishlistItem);

  const activeScanData = isFromWishlist ? wishlistItem!.snapshot.scanData : scanData;
  const activeStructuredData = isFromWishlist
    ? wishlistItem!.snapshot.structuredData
    : structuredData;
  const activeSelectedType = isFromWishlist
    ? wishlistItem!.snapshot.selectedType
    : selectedType;

  const { diamonds, colorstones } = useMemo(() => {
    if (isFromWishlist && wishlistItem) {
      return {
        diamonds: wishlistItem.snapshot.diamonds,
        colorstones: wishlistItem.snapshot.colorstones,
      };
    }
    return parseStoneArraysFromStructuredData(structuredData, scanData);
  }, [isFromWishlist, wishlistItem, structuredData, scanData]);

  // Live pricing from the backend (same data the screen displays).
  // Passing it directly to buildWishlistItem ensures the badge = on-screen MRP.
  const selectedKarat = resolveScannedKarat(scanData.karat, scanData.tunch) || '14K';
  const livePricing = useFinalTabPricing({
    scanData: { ...scanData, karat: selectedKarat },
    structuredData,
    selectedType,
    selectedKarat,
  });
  const activePricing = isFromWishlist
    ? wishlistItem?.snapshot.pricing ?? livePricing
    : livePricing;

  const handleAddToWishlist = async () => {
    if (addingToWishlist) return;

    setAddingToWishlist(true);
    try {
      const item = buildWishlistItem({
        scanData,
        structuredData,
        selectedType,
        diamonds,
        colorstones,
        pricing: livePricing,           // ← correct backend MRP
        scanTimestamp: new Date().toISOString(),
      });
      await addWishlistItem(item);
      setHasAdded(true);
      Alert.alert('Wishlist', 'Item added to your wishlist.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add item. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setAddingToWishlist(false);
    }
  };

  const handleBack = () => {
    if (isFromWishlist) {
      router.push('/dashboard/wishlist' as Href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/dashboard' as Href);
  };

  const wishlistIcon = hasAdded ? (
    <CheckCircle size={18} color={Colors.brandDeep} />
  ) : addingToWishlist ? (
    <ActivityIndicator size={16} color={Colors.brandDeep} />
  ) : (
    <Heart size={18} color={Colors.brandDeep} />
  );

  return (
    <View className="flex-1 bg-surface-muted">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Mockup .rev-card-wrap — 52px top (44 status + 8) / 16 sides / 96 bottom (nav + gap). */}
        <View
          className="flex-1"
          style={{
            paddingTop: 8,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 76,
          }}
        >
          <FloatingCard>
            <CardHeader title="Scanner Result" onBack={handleBack}>
              <PriceCard
                label="MRP Rate Amount"
                amount={activePricing.ultimateMrpDisplay}
                style={styles.mrpCard}
              />
            </CardHeader>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <ScannerFinalTab
                scanData={activeScanData}
                structuredData={activeStructuredData}
                diamonds={diamonds}
                colorstones={colorstones}
                jewelleryType={activeSelectedType}
                pricing={activePricing}
                editable={false}
                gstNote={demoResult?.gstNote ?? 'MRP = Gold + Stones + Labour + Other Charges'}
              />
            </ScrollView>

            <CardFooter>
              <View style={styles.footerRow}>
                {!isFromWishlist ? (
                  <PillButton
                    variant="alt"
                    title={hasAdded ? 'Item Added' : addingToWishlist ? 'Adding...' : 'Add to Wishlist'}
                    onPress={handleAddToWishlist}
                    disabled={hasAdded || addingToWishlist}
                    icon={wishlistIcon}
                    style={styles.footerBtn}
                  />
                ) : null}
                <PillButton
                  variant="brand"
                  title="Generate Invoice"
                  onPress={() => router.push('/dashboard/scanner/invoice-preview')}
                  style={styles.footerBtn}
                />
              </View>
            </CardFooter>
          </FloatingCard>
        </View>
      </SafeAreaView>

      <BottomNav activeRoute="scanner" scanButtonVariant="green" />
    </View>
  );
}

const styles = StyleSheet.create({
  mrpCard: {
    marginBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
});
