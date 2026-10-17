import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { WishlistCard } from '@/components/wishlist/WishlistCard';
import { WishlistScreenHeader } from '@/components/wishlist/WishlistScreenHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { selectionInListOrder } from '@/utils/cartInvoice';

export default function WishlistScreen() {
  const router = useRouter();
  const items = useWishlistStore((s) => s.items);
  const isLoading = useWishlistStore((s) => s.isLoading);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const clearAll = useWishlistStore((s) => s.clearAll);
  const syncFromApi = useWishlistStore((s) => s.syncFromApi);
  const setCartItems = useCartStore((s) => s.setItems);

  // The items ticked for the cart. Read against the list as it stands, so a
  // tick on an item deleted or synced away since simply drops out.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selectedIds = useMemo(() => selectionInListOrder(items, selected), [items, selected]);

  // Fetch latest from backend each time the screen mounts
  useEffect(() => {
    syncFromApi();
  }, [syncFromApi]);

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Add to cart: the ticked items, in the wishlist's order, become the cart,
  // and the ticks clear (mockup wlCartBtn).
  const handleAddToCart = () => {
    if (selectedIds.length === 0) return;
    setCartItems(selectedIds);
    setSelected(new Set());
    router.push('/dashboard/cart' as Href);
  };

  // Deletes straight away: a wishlist entry is cheap to re-add, so a
  // confirmation on every bin tap cost more than the mistake it prevented.
  const handleDeleteItem = async (id: string) => {
    try {
      await removeItem(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete item.';
      Alert.alert('Error', msg);
    }
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
      <WishlistScreenHeader
        onClearWishlist={handleClearWishlist}
        selectedCount={selectedIds.length}
        onAddToCart={handleAddToCart}
      />

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
              selected={selected.has(item.id)}
              onToggleSelect={() => toggleSelected(item.id)}
            />
          ))}
        </ScrollView>
      )}

      <BottomNav />
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

