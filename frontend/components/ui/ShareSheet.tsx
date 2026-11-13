import { useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { smsShareUrl, whatsappShareUrls } from '@/utils/employeeCredentials';

const ICON_SIZE = 50;
const COPIED_LABEL = 'Copied!';
const COPIED_MS = 1200;

interface ShareSheetProps {
  visible: boolean;
  /** The text every option sends: the app's, the clipboard's, the composer's. */
  message: string;
  onClose: () => void;
}

/** Mockup `.share-opt-whatsapp`: the WhatsApp mark in white on #25D366. */
function WhatsAppGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M17.6 6.32A8.86 8.86 0 0 0 12.02 3.6c-4.9 0-8.9 4-8.9 8.9 0 1.57.42 3.1 1.2 4.44L3 21l4.18-1.3a8.9 8.9 0 0 0 4.83 1.4h.01c4.9 0 8.9-4 8.9-8.9a8.84 8.84 0 0 0-2.32-6.28ZM12.02 19.4a7.4 7.4 0 0 1-3.77-1.03l-.27-.16-2.8.87.86-2.72-.18-.28a7.4 7.4 0 0 1-1.14-3.98c0-4.1 3.34-7.44 7.44-7.44 1.99 0 3.85.78 5.26 2.18a7.4 7.4 0 0 1 2.18 5.26c0 4.1-3.34 7.44-7.44 7.44Z"
        fill="#fff"
      />
      <Path
        d="M15.9 13.85c-.22-.11-1.3-.64-1.5-.72-.2-.07-.35-.11-.5.11-.14.22-.57.72-.7.87-.13.14-.26.16-.48.05-.22-.11-.94-.35-1.79-1.1-.66-.59-1.1-1.32-1.24-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.4.11-.13.14-.22.22-.37.07-.15.04-.28-.02-.4-.07-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.42c-.15 0-.39.05-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.81 3.36.53.23.95.37 1.27.47.53.17 1.02.14 1.4.09.43-.06 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.05-.1-.2-.15-.42-.26Z"
        fill="#fff"
      />
    </Svg>
  );
}

/** Mockup `.share-opt-instagram`: the camera mark on Instagram's 135° gradient. */
function InstagramBadge() {
  const gradientId = `ig${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 50 50" accessible={false}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f9ce34" />
          <Stop offset="0.5" stopColor="#ee2a7b" />
          <Stop offset="1" stopColor="#6228d7" />
        </LinearGradient>
      </Defs>
      <Circle cx={25} cy={25} r={25} fill={`url(#${gradientId})`} />
      {/* The 24-unit glyph, drawn at 20px in the middle of the 50px badge. */}
      <Rect x={17.5} y={17.5} width={15} height={15} rx={4.17} stroke="#fff" strokeWidth={1.5} fill="none" />
      <Circle cx={25} cy={25} r={3.33} stroke="#fff" strokeWidth={1.5} fill="none" />
      <Circle cx={29.33} cy={20.67} r={0.92} fill="#fff" />
    </Svg>
  );
}

function MessageGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d="M4 5h16v10H8l-4 4V5Z" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function CopyGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d="M9 9h9v9H9V9Z" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
      <Path
        d="M6 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * "Share via", the mockup's bottom sheet (#shareSheetBackdrop): a handle,
 * the title, four round options — WhatsApp, Instagram, Message, Copy Link —
 * and Cancel. Under the grid, "More options" opens the phone's own share
 * sheet so every other app is one tap away without breaking the 4-up row.
 *
 * Plain styles throughout: under NativeWind a Pressable style function loses
 * its background.
 */
export function ShareSheet({ visible, message, onClose }: ShareSheetProps) {
  const [copiedOption, setCopiedOption] = useState<'instagram' | 'copy' | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const slide = useRef(new Animated.Value(24)).current;
  // Read by the delayed steps: a Cancel during the "Copied!" beat means the
  // shop changed its mind, so nothing opens after it.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    if (visible) {
      // A fresh opening owes nothing to the last one's pending steps.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      slide.setValue(24);
      Animated.timing(slide, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.2, 0.8, 0.25, 1),
        useNativeDriver: true,
      }).start();
    } else {
      setCopiedOption(null);
    }
  }, [visible, slide]);

  // Nothing fires into an unmounted sheet.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const openWhatsApp = async () => {
    const urls = whatsappShareUrls(message);
    onClose();
    try {
      await Linking.openURL(urls.app);
    } catch {
      // No WhatsApp app: the web link opens it in the browser instead.
      try {
        await Linking.openURL(urls.web);
      } catch {
        // Nothing can open it; the sheet is already closed.
      }
    }
  };

  const openMessages = async () => {
    onClose();
    try {
      await Linking.openURL(smsShareUrl(message, Platform.OS));
    } catch {
      // No SMS app on this device.
    }
  };

  // Instagram has no way to take text from another app, so the message goes
  // to the clipboard first and Instagram opens to paste it in a chat.
  const openInstagram = async () => {
    try {
      await Clipboard.setStringAsync(message);
    } catch {
      // Opening Instagram still helps; the shop can copy it again.
    }
    setCopiedOption('instagram');
    later(() => {
      if (!visibleRef.current) return;
      onClose();
      Linking.openURL('instagram://app').catch(() => {
        // Not installed: the text is on the clipboard for wherever it goes.
      });
    }, 600);
  };

  const copyMessage = async () => {
    try {
      await Clipboard.setStringAsync(message);
    } catch {
      return;
    }
    setCopiedOption('copy');
    later(() => {
      setCopiedOption(null);
      if (visibleRef.current) onClose();
    }, COPIED_MS);
  };

  // The system sheet, for every app not in the row. The sheet closes first:
  // iOS will not present a share sheet over a modal that is going away.
  const openMore = () => {
    onClose();
    later(() => {
      Share.share({ message }).catch(() => {
        // Dismissed or unavailable.
      });
    }, 300);
  };

  const options = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: (
        <View style={[styles.optIcon, styles.optWhatsApp]}>
          <WhatsAppGlyph />
        </View>
      ),
      onPress: () => void openWhatsApp(),
    },
    {
      key: 'instagram',
      label: copiedOption === 'instagram' ? COPIED_LABEL : 'Instagram',
      icon: (
        <View style={styles.optIcon}>
          <InstagramBadge />
        </View>
      ),
      onPress: () => void openInstagram(),
    },
    {
      key: 'sms',
      label: 'Message',
      icon: (
        <View style={[styles.optIcon, styles.optSms]}>
          <MessageGlyph />
        </View>
      ),
      onPress: () => void openMessages(),
    },
    {
      key: 'copy',
      label: copiedOption === 'copy' ? COPIED_LABEL : 'Copy Link',
      icon: (
        <View style={[styles.optIcon, styles.optCopy]}>
          <CopyGlyph />
        </View>
      ),
      onPress: () => void copyMessage(),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* A tap on the dimmed area closes, as the mockup's backdrop does. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close share options" />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slide }] },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>SHARE VIA</Text>

          <View style={styles.grid}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.75}
                onPress={option.onPress}
                style={styles.opt}
                accessibilityRole="button"
                accessibilityLabel={`Share via ${option.label}`}
              >
                {option.icon}
                <Text style={styles.optLabel} numberOfLines={1}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={openMore}
            style={styles.moreBtn}
            accessibilityRole="button"
          >
            <Text style={styles.moreText}>More options</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // .share-sheet-backdrop: rgba(21,18,13,0.55), sheet pinned to the bottom.
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21,18,13,0.55)',
  },
  // .share-sheet: panel, 22px top corners, 10/20/24 padding, centred column.
  sheet: {
    width: '100%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  // .share-sheet-title: 0.8rem, 800, text-dim, uppercase, 0.04em.
  title: {
    alignSelf: 'flex-start',
    fontSize: 12.8,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  // .share-sheet-grid: four equal columns, 10 gap, 18 below.
  grid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  opt: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  optIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optWhatsApp: { backgroundColor: '#25D366' },
  optSms: { backgroundColor: Colors.brandDeep },
  optCopy: { backgroundColor: Colors.textMuted },
  // .share-opt label: 0.68rem, 700, text.
  optLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  moreBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  moreText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  // .share-sheet-cancel: full width, 48 tall, pill, bg-alt with a border.
  cancelBtn: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13.8,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
