import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Spacing } from '@/constants/theme';

const SECTIONS: { key: string; title: string; route: string }[] = [
  { key: 'scans', title: 'Tag scan history', route: '/dashboard/history/scans' },
  { key: 'wishlist', title: 'Wishlist history', route: '/dashboard/history/wishlist' },
  { key: 'checkouts', title: 'Checkout history', route: '/dashboard/history/checkouts' },
];

/**
 * History (mockup #screenHistoryCart), from Settings: one card of three rows
 * — the tags scanned at the counter, what went on the wishlist, and the carts
 * billed. Each row opens its list on a page of its own (app/dashboard/history/),
 * where a scan or a wishlist add opens the tag's details and a checkout its
 * cart. The owner sees the shop's; an employee their own (the server scopes
 * all three).
 *
 * The lists used to open in place under their rows; on a page each can run
 * past the 30 the card had room for, a page at a time.
 */
export default function HistoryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="History" />

        <View style={styles.card}>
          {SECTIONS.map(({ key, title, route }, index) => (
            <Pressable
              key={key}
              onPress={() => router.push(route as Href)}
              style={[styles.head, index > 0 && styles.tileDivider]}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <Text style={styles.headText}>{title}</Text>
              <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2.2} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // .hc-card: panel, 1px border, radius 18, a soft drop shadow.
  card: {
    marginHorizontal: Spacing.screenHorizontal,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 1,
  },
  // .hc-tile: a hairline between rows, none above the first.
  tileDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // .hc-head: 14/16, 0.88rem bold, the chevron dim at the end.
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
