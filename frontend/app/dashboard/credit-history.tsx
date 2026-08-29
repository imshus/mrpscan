import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, ChevronRight, Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import type { CreditTransactionPage } from '@/types/subscription';
import { fetchCreditTransactions } from '@/utils/subscriptionApi';

function currency(value: number): string {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function isCreditType(type: string): boolean {
  return !/SCAN_DEDUCTION|CREDIT_REMOVE|TRIAL_EXPIRY_RESET/i.test(type);
}

function normalizeTitle(type: string): string {
  const formatted = type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  if (formatted === 'Trial Credit') return 'Trial Credits Granted';
  if (formatted === 'Scan Deduction') return 'OCR Scan Charge';
  return formatted;
}

function friendlyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return 'Today';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function emptyPage(page = 1): CreditTransactionPage {
  return {
    records: [],
    page,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
}

export default function CreditHistoryScreen() {
  const router = useRouter();
  const allowed = useRequireSettingsAccess('subscription');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageData, setPageData] = useState<CreditTransactionPage>(emptyPage(1));
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  const loadPage = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await fetchCreditTransactions(page, 10);
      setPageData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load credit history.';
      Alert.alert('Credit History', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPage(1);
    }, [loadPage]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const goToPage = async (page: number) => {
    if (page < 1 || busy) return;
    setBusy(true);
    try {
      const data = await fetchCreditTransactions(page, 10);
      setPageData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load credit history.';
      Alert.alert('Credit History', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Credit History</Text>
            <Text style={styles.headerSubtitle}>All wallet credit movements</Text>
          </View>
        </View>

        {!allowed ? null : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.textPrimary} />
          </View>
        ) : (
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHead}>
              <Wallet size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Wallet Transactions</Text>
            </View>

            {pageData.records.length === 0 ? (
              <Text style={styles.emptyText}>No credit transactions found.</Text>
            ) : (
              pageData.records.map((item) => (
                <View key={`${item.id}-${item.createdAt}`} style={styles.row}>
                  <View style={styles.rowHead}>
                    <View>
                      <Text style={styles.rowType}>{normalizeTitle(item.type)}</Text>
                      <Text style={styles.rowDesc}>{item.note || 'Wallet transaction completed'}</Text>
                    </View>
                    <Text style={[styles.rowAmount, isCreditType(item.type) ? styles.amountCredit : styles.amountDebit]}>
                      {isCreditType(item.type) ? '+' : '-'} {currency(item.amount)}
                    </Text>
                  </View>

                  <View style={styles.rowMetaStrip}>
                    <Text style={styles.rowMeta}>{friendlyDate(item.createdAt)}</Text>
                    <View style={styles.statusPill}>
                      <CheckCircle2 size={12} color={Colors.successText} />
                      <Text style={styles.statusText}>Completed</Text>
                    </View>
                  </View>

                  <View style={styles.balanceStrip}>
                    <Text style={styles.balanceMeta}>Before {currency(item.balanceBefore)}</Text>
                    <Text style={styles.balanceMeta}>After {currency(item.balanceAfter)}</Text>
                  </View>
                </View>
              ))
            )}

            <View style={styles.paginationRow}>
              <Pressable
                disabled={!pageData.hasPrevPage || busy}
                onPress={() => void goToPage(pageData.page - 1)}
                style={[styles.paginationBtn, (!pageData.hasPrevPage || busy) && styles.paginationBtnDisabled]}
              >
                <ChevronLeft size={14} color={Colors.textPrimary} />
                <Text style={styles.paginationBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.paginationMeta}>Page {pageData.page} of {pageData.totalPages}</Text>
              <Pressable
                disabled={!pageData.hasNextPage || busy}
                onPress={() => void goToPage(pageData.page + 1)}
                style={[styles.paginationBtn, (!pageData.hasNextPage || busy) && styles.paginationBtnDisabled]}
              >
                <Text style={styles.paginationBtnText}>Next</Text>
                <ChevronRight size={14} color={Colors.textPrimary} />
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { paddingBottom: 110 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  card: {
    marginHorizontal: Spacing.screenHorizontal,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  row: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FBF7F0',
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowType: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowDesc: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  amountCredit: {
    color: Colors.successText,
  },
  amountDebit: {
    color: Colors.dangerText,
  },
  rowMetaStrip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.badge,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    color: Colors.successText,
    fontWeight: '700',
  },
  balanceStrip: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  balanceMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  paginationRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  paginationBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 9,
    backgroundColor: Colors.white,
  },
  paginationBtnDisabled: {
    opacity: 0.4,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paginationMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
