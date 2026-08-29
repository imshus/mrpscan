import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

const DELETE_RED = '#A81F17';

interface DeleteEmployeeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteEmployeeModal({ visible, onClose, onConfirm }: DeleteEmployeeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>

          <Text style={styles.title}>Are you sure do you want to delete Employee?</Text>
          <Text style={styles.subtitle}>It will permanently delete employee details.</Text>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete</Text>
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
  modal: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 22,
    paddingRight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: DELETE_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
