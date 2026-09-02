import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CloudUpload, Download, Mail, MessageCircle, Printer } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

export type InvoiceAction = 'whatsapp' | 'drive' | 'download' | 'email' | 'print';

interface Props {
  busy: InvoiceAction | null;
  onPress: (action: InvoiceAction) => void;
}

const ACTIONS: { key: InvoiceAction; label: string; Icon: typeof Download; color: string }[] = [
  { key: 'whatsapp', label: 'Share on WhatsApp', Icon: MessageCircle, color: '#1FA855' },
  { key: 'drive', label: 'Save to Google Drive', Icon: CloudUpload, color: Colors.textPrimary },
  { key: 'download', label: 'Download PDF', Icon: Download, color: Colors.textPrimary },
  { key: 'email', label: 'Send by email', Icon: Mail, color: Colors.textPrimary },
  { key: 'print', label: 'Print', Icon: Printer, color: Colors.textPrimary },
];

/** Five 40x40 round buttons; hitSlop 6 makes every target at least 52x52. */
export function InvoiceQuickActions({ busy, onPress }: Props) {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ key, label, Icon, color }) => (
        <Pressable
          key={key}
          onPress={() => onPress(key)}
          disabled={busy !== null}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.btnPressed,
            busy !== null && busy !== key && styles.btnDim,
          ]}
        >
          {busy === key ? (
            <ActivityIndicator size={16} color={color} />
          ) : (
            <Icon size={20} color={color} strokeWidth={2} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnPressed: { backgroundColor: Colors.border },
  btnDim: { opacity: 0.5 },
});
