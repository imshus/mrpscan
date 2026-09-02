import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ArrowDownToLine, PrinterCheck } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export type InvoiceAction = 'whatsapp' | 'drive' | 'download' | 'email' | 'print';

interface Props {
  busy: InvoiceAction | null;
  onPress: (action: InvoiceAction) => void;
}

const ACTIONS: { key: InvoiceAction; label: string; color: string }[] = [
  { key: 'whatsapp', label: 'Share on WhatsApp', color: '#25D366' },
  { key: 'drive', label: 'Save to Google Drive', color: '#4285F4' },
  { key: 'download', label: 'Download PDF', color: Colors.brandDeep },
  { key: 'email', label: 'Send by email', color: '#EA4335' },
  { key: 'print', label: 'Print', color: Colors.brandDeep },
];

const ICON_SIZE = 22;

function WhatsAppIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" accessible={false}>
      <Path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.075-.792.372-.273.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.226 1.36.194 1.871.118.57-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 7.021 2.91 9.825 9.825 0 0 1 2.9 7.023c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
      />
    </Svg>
  );
}

function GoogleDriveIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M4.433 22.396l4-6.929H24l-4 6.929H4.433Z" />
      <Path fill="#00AC47" d="M7.999 15.467l-3.998 6.929L0 15.467 7.785 1.98l3.999 6.931-3.785 6.556Z" />
      <Path fill="#FFBA00" d="M23.783 15.092h-7.999L7.999 1.605h8.002l7.785 13.486h-.003Z" />
    </Svg>
  );
}

function GmailIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" accessible={false}>
      <Path
        fill="#EA4335"
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
      />
    </Svg>
  );
}

function ActionIcon({ action, color }: { action: InvoiceAction; color: string }) {
  if (action === 'whatsapp') return <WhatsAppIcon />;
  if (action === 'drive') return <GoogleDriveIcon />;
  if (action === 'email') return <GmailIcon />;
  if (action === 'download') return <ArrowDownToLine size={ICON_SIZE} color={color} strokeWidth={2.2} />;
  return <PrinterCheck size={ICON_SIZE} color={color} strokeWidth={2.2} />;
}

/**
 * Five round quick-share buttons, sitting on the title's line.
 *
 * 38dp is the ceiling here: the title measures about 90dp at 28px, which
 * leaves roughly 222dp for five tiles and their gaps. The size is real rather
 * than a smaller circle padded out with hitSlop — slop is clipped to the
 * parent, so it buys no height and neighbouring targets end up overlapping.
 */
export function InvoiceQuickActions({ busy, onPress }: Props) {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ key, label, color }) => (
        <Pressable
          key={key}
          onPress={() => onPress(key)}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.btnPressed,
            busy !== null && busy !== key && styles.btnDim,
          ]}
        >
          {busy === key ? (
            <ActivityIndicator size={20} color={color} />
          ) : (
            <ActionIcon action={key} color={color} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 6 },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnPressed: { backgroundColor: Colors.border },
  btnDim: { opacity: 0.5 },
});
