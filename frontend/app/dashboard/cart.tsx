import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, BOTTOM_NAV_HEIGHT, getBottomNavBottom } from '@/components/dashboard/BottomNav';
import { GradientView } from '@/components/ui/GradientView';
import { PageHeader } from '@/components/ui/PageHeader';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { CART_INVOICE_SOURCE } from '@/hooks/useCartInvoice';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { apiFetchCheckout } from '@/utils/cartApi';
import {
  cartGrandTotal,
  formatCartPrice,
  isBillablePiece,
  MAX_CART_PIECES,
  resolveCart,
  type CheckoutDetail,
} from '@/utils/cartInvoice';
import { friendlyServerMessage } from '@/utils/serverMessages';
import { currentScopeGeneration } from '@/utils/userScopedStorage';

/** The floating footer card: 48 button + 9 padding each side + its border. */
const FOOTER_HEIGHT = 48 + 18 + 2;
/** Gap between the footer card and the nav pill under it. */
const FOOTER_GAP = 8;

interface CartRowProps {
  index: number;
  name: string;
  code: string;
  price: string;
  /** Why the piece cannot be billed, under its code. */
  problem?: string | null;
  /** Opens the piece; a row without it (a past cart) has no chevron. */
  onPress?: () => void;
}

/** .cart-row: number, bold name over its muted code, the price, a chevron. */
function CartRow({ index, name, code, price, problem, onPress }: CartRowProps) {
  const content = (
    <>
      <Text style={styles.num}>{index + 1}.</Text>
      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {code ? (
          <Text style={styles.code} numberOfLines={1}>
            {code}
          </Text>
        ) : null}
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>
      <Text style={styles.mrp}>{price}</Text>
      {onPress ? (
        <View style={styles.chev}>
          <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
        </View>
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    // Plain style object: NativeWind drops the function form on Pressable.
    <Pressable
      onPress={onPress}
      style={styles.row}
      android_ripple={{ color: Colors.backgroundAlt }}
      accessibilityRole="button"
      accessibilityLabel={`${name}${code ? ` ${code}` : ''}, ${price}`}
    >
      {content}
    </Pressable>
  );
}

type CheckoutState =
  | { status: 'loading' }
  | { status: 'ready'; detail: CheckoutDetail }
  | { status: 'error'; message: string };

/**
 * Add to cart (mockup #screenCart): the tags ticked in Wishlist, each with
 * its MRP, their Grand Total, and Generate Invoice — one invoice for all of
 * them, through the same customer details -> preview -> generate screens a
 * single scan uses.
 *
 * Opened from Settings -> History -> Checkout history (param `invoiceId`) it
 * shows that past cart instead, read-only: the pieces its invoice billed and
 * the invoice's grand total, from GET /history/checkouts/:id. There is no
 * Generate there, and no View invoice: the app has no screen that reopens a
 * saved invoice.
 */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const invoiceId = typeof params.invoiceId === 'string' ? params.invoiceId.trim() : '';
  const readOnly = invoiceId !== '';

  const [navHeight, setNavHeight] = useState(BOTTOM_NAV_HEIGHT);
  const footerBottom = getBottomNavBottom(insets.bottom) + navHeight + FOOTER_GAP;

  // ---- Live cart: the Wishlist's ticked items, priced as the wishlist shows them.
  const itemIds = useCartStore((state) => state.itemIds);
  const startCheckout = useCartStore((state) => state.startCheckout);
  const wishlistItems = useWishlistStore((state) => state.items);
  const { pieces, missing } = useMemo(
    () => resolveCart(itemIds, wishlistItems),
    [itemIds, wishlistItems],
  );
  const grandTotal = useMemo(() => cartGrandTotal(pieces), [pieces]);

  // ---- Past cart: fetched once per id, again on Try again.
  const [checkout, setCheckout] = useState<CheckoutState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!readOnly) return;
    let cancelled = false;
    const generation = currentScopeGeneration();
    setCheckout({ status: 'loading' });
    apiFetchCheckout(invoiceId)
      .then((detail) => {
        // Another account signed in while it loaded: its cart is not this one's.
        if (cancelled || generation !== currentScopeGeneration()) return;
        setCheckout(
          detail
            ? { status: 'ready', detail }
            : { status: 'error', message: 'This cart could not be found.' },
        );
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== currentScopeGeneration()) return;
        setCheckout({
          status: 'error',
          message: friendlyServerMessage(error, 'Could not load this cart.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly, invoiceId, attempt]);

  const handleOpenPiece = (id: string) => {
    router.push({
      pathname: '/dashboard/scanner/scan-results',
      params: { fromWishlist: '1', wishlistId: id, from: 'cart' },
    } as Href);
  };

  const handleGenerate = () => {
    if (pieces.length === 0) return;
    // The server bills at most this many on one invoice, and would refuse
    // the whole cart only once the customer's details are filled in.
    if (pieces.length > MAX_CART_PIECES) {
      Alert.alert(
        'Too many tags',
        `One invoice can bill up to ${MAX_CART_PIECES} tags; this cart has ${pieces.length}. Go back to Wishlist and add fewer to the cart.`,
      );
      return;
    }
    // A piece without its saved breakdown is named, not billed at a guess:
    // the invoice either bills every tag in the cart or none.
    const blocked = pieces.filter((piece) => !isBillablePiece(piece));
    if (blocked.length > 0) {
      Alert.alert(
        blocked.length === 1 ? 'A tag cannot be billed' : `${blocked.length} tags cannot be billed`,
        `${blocked
          .map((piece) => `${piece.name}${piece.tagCode ? ` (${piece.tagCode})` : ''}: ${piece.problem}`)
          .join('\n\n')}\n\nGo back to Wishlist and add the cart again without ${
          blocked.length === 1 ? 'it' : 'them'
        }.`,
      );
      return;
    }
    // The invoice screens bill exactly these, as they are now.
    startCheckout(pieces.filter(isBillablePiece));
    router.push({
      pathname: '/dashboard/scanner/invoice-preview',
      params: { source: CART_INVOICE_SOURCE },
    } as Href);
  };

  const detail = readOnly && checkout.status === 'ready' ? checkout.detail : null;
  const subtitle = detail?.invoiceNumber
    ? [`Invoice ${detail.invoiceNumber}`, detail.customerName].filter(Boolean).join(' · ')
    : 'Check out';
  const showFooter = !readOnly && pieces.length > 0;

  const renderCard = (
    count: number,
    rows: ReactNode,
    total: string,
    totalNote?: string,
  ) => (
    <View style={styles.card}>
      <Text style={styles.cardHead}>Selected tags · {count}</Text>
      <View>{rows}</View>
      <View style={styles.total}>
        <View>
          <Text style={styles.totalLabel}>Grand Total</Text>
          {totalNote ? <Text style={styles.totalNote}>{totalNote}</Text> : null}
        </View>
        <Text style={styles.totalValue}>{total}</Text>
      </View>
    </View>
  );

  const renderLive = () => {
    if (pieces.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyHint}>Tick tags in Wishlist and tap Add to cart.</Text>
        </View>
      );
    }
    return (
      <>
        {renderCard(
          pieces.length,
          pieces.map((piece, index) => (
            <CartRow
              key={piece.id}
              index={index}
              name={piece.name}
              code={piece.tagCode}
              price={formatCartPrice(piece.mrp)}
              problem={piece.problem}
              onPress={() => handleOpenPiece(piece.id)}
            />
          )),
          formatCartPrice(grandTotal),
        )}
        {missing > 0 ? (
          <Text style={styles.note}>
            {missing === 1
              ? '1 tag has been removed from the wishlist since and is not in this cart.'
              : `${missing} tags have been removed from the wishlist since and are not in this cart.`}
          </Text>
        ) : null}
      </>
    );
  };

  const renderPast = () => {
    if (checkout.status === 'loading') {
      return (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }
    if (checkout.status === 'error') {
      return (
        <View style={styles.statusWrap}>
          <Text style={styles.errorText}>{checkout.message}</Text>
          <Pressable onPress={() => setAttempt((n) => n + 1)} hitSlop={8}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    const past = checkout.detail;
    const rows =
      past.pieces.length > 0 ? (
        past.pieces.map((piece, index) => (
          <CartRow
            key={`${index}-${piece.tagCode}`}
            index={index}
            name={piece.itemName || 'Tag'}
            code={piece.tagCode}
            price={formatCartPrice(piece.mrp)}
          />
        ))
      ) : (
        <Text style={styles.noPieces}>
          {/* Checkout history lists every invoice: one billed straight from a
              scan result counts one piece and keeps no cart. */}
          {past.pieceCount === 1
            ? 'This invoice billed one scanned tag straight from its result, not a cart.'
            : 'This invoice was made before the app kept the tags it billed.'}
        </Text>
      );
    return renderCard(
      past.pieces.length || past.pieceCount || 0,
      rows,
      formatCartPrice(past.grandTotal),
      // The invoice's own total, which adds GST to the tags' MRPs.
      'Invoice total, with GST',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerBottom + (showFooter ? FOOTER_HEIGHT : 0) + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Add to cart" subtitle={subtitle} />
        <View style={styles.body}>{readOnly ? renderPast() : renderLive()}</View>
      </ScrollView>

      {showFooter ? (
        // .cart-footer: a card floating just above the nav, the button full width.
        <View style={[styles.footer, { bottom: footerBottom }]}>
          <Pressable
            onPress={handleGenerate}
            accessibilityRole="button"
            accessibilityLabel="Generate Invoice"
          >
            <GradientView colors={Gradients.brand} forceGradient borderRadius={999} style={styles.generateBtn}>
              <Text style={styles.generateText}>Generate Invoice</Text>
            </GradientView>
          </Pressable>
        </View>
      ) : null}

      <BottomNav onHeightChange={setNavHeight} />
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
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: Spacing.screenHorizontal,
  },
  // .cart-card: panel, 1px border, radius 18, a soft drop shadow.
  card: {
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
  // .bp-card-head: bg-alt strip, 0.66rem uppercase, 9/16.
  cardHead: {
    backgroundColor: Colors.backgroundAlt,
    color: Colors.textMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  // .cart-row: 14/16, hairline under every row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  num: {
    minWidth: 18,
    fontSize: 13.8,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    fontSize: 13.8,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  code: {
    fontSize: 10.9,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  problem: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: Colors.dangerText,
  },
  mrp: {
    fontSize: 13.8,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  chev: {
    flexShrink: 0,
  },
  // .cart-total: bg-alt footer row, label left, the total large on the right.
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 15,
    paddingBottom: 17,
    paddingHorizontal: 16,
    backgroundColor: Colors.backgroundAlt,
  },
  totalLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  totalNote: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  totalValue: {
    fontSize: 22.4,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  noPieces: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 12.5,
    color: Colors.textMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  note: {
    marginTop: Spacing.md,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  statusWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandDeep,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandDeep,
    textDecorationLine: 'underline',
  },
  // .cart-footer: #fffdf9 card, radius 24, 9 padding, the nav's shadow.
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 9,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  generateBtn: {
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
