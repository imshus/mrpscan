import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, History } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import type { PaymentHistoryPage } from '@/types/subscription';
import { fetchPaymentHistory } from '@/utils/subscriptionApi';

function currency(value: number): string {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function emptyPage(page = 1): PaymentHistoryPage {
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

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const allowed = useRequireSettingsAccess('subscription');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageData, setPageData] = useState<PaymentHistoryPage>(emptyPage(1));

  const loadPage = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await fetchPaymentHistory(page, 10);
      setPageData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load payment history.';
      Alert.alert('Payment History', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPage(1);
    }, [loadPage]),
  );

  const goToPage = async (page: number) => {
    if (page < 1 || busy) return;
    setBusy(true);
    try {
      const data = await fetchPaymentHistory(page, 10);
      setPageData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load payment history.';
      Alert.alert('Payment History', message);
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
            <Text style={styles.headerTitle}>Payment History</Text>
            <Text style={styles.headerSubtitle}>All organization payments</Text>
          </View>
        </View>

        {!allowed ? null : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.textPrimary} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <History size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Transactions</Text>
            </View>

            {pageData.records.length === 0 ? (
              <Text style={styles.emptyText}>No payment records found.</Text>
            ) : (
              pageData.records.map((item) => (
                <View key={`${item.orderId}-${item.createdAt}`} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowType}>{item.paymentType.replace(/_/g, ' ')}</Text>
                    <Text style={styles.rowAmount}>{currency(item.amount)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>Status: {item.status}</Text>
                  <Text style={styles.rowMeta}>Order: {item.orderId}</Text>
                  <Text style={styles.rowMeta}>Payment: {item.paymentId || '-'}</Text>
                  <Text style={styles.rowMeta}>Invoice: {item.invoiceNumber || '-'}</Text>
                </View>
              ))
            )}

            <View style={styles.paginationRow}>
              <Pressable
                disabled={!pageData.hasPrevPage || busy}
                onPress={() => void goToPage(pageData.page - 1)}
                style={[styles.paginationBtn, (!pageData.hasPrevPage || busy) && styles.paginationBtnDisabled]}
              >
                <Text style={styles.paginationBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.paginationMeta}>Page {pageData.page} / {pageData.totalPages}</Text>
              <Pressable
                disabled={!pageData.hasNextPage || busy}
                onPress={() => void goToPage(pageData.page + 1)}
                style={[styles.paginationBtn, (!pageData.hasNextPage || busy) && styles.paginationBtnDisabled]}
              >
                <Text style={styles.paginationBtnText}>Next</Text>
              </Pressable>
            </View>
          </View>
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
    paddingTop: 8,
    paddingBottom: 10,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
    padding: 10,
    marginTop: 8,
    backgroundColor: '#FBF7F0',
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowType: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  paginationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  paginationBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  paginationBtnDisabled: {
    opacity: 0.45,
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
