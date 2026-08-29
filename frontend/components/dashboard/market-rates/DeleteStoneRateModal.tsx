import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

const DELETE_RED = '#A81F17';

interface DeleteStoneRateModalProps {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}

export function DeleteStoneRateModal({
  visible,
  title,
  subtitle,
  onClose,
  onConfirm,
  confirming = false,
}: DeleteStoneRateModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onClose} disabled={confirming} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} disabled={confirming} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>{confirming ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: DELETE_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
