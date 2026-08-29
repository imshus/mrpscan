import { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { WishlistCard } from '@/components/wishlist/WishlistCard';
import { WishlistScreenHeader } from '@/components/wishlist/WishlistScreenHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useWishlistStore } from '@/store/wishlistStore';

export default function WishlistScreen() {
  const router = useRouter();
  const items = useWishlistStore((s) => s.items);
  const isLoading = useWishlistStore((s) => s.isLoading);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const clearAll = useWishlistStore((s) => s.clearAll);
  const syncFromApi = useWishlistStore((s) => s.syncFromApi);

  // Fetch latest from backend each time the screen mounts
  useEffect(() => {
    syncFromApi();
  }, [syncFromApi]);

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeItem(id);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to delete item.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleClearWishlist = () => {
    if (items.length === 0) return;

    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all items from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAll();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to clear wishlist.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleOpenItem = (id: string) => {
    router.push({
      pathname: '/dashboard/scanner/scan-results',
      params: { fromWishlist: '1', wishlistId: id },
    } as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <WishlistScreenHeader onClearWishlist={handleClearWishlist} />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading wishlist…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyHint}>
            Scan jewellery and tap Add to Wishlist on the results screen.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onPress={() => handleOpenItem(item.id)}
              onDelete={() => handleDeleteItem(item.id)}
            />
          ))}
        </ScrollView>
      )}

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
    paddingTop: Spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

