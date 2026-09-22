import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface AddBullionRowProps {
  /** Saves the typed name. Returns an error message to show, or null. */
  onAdd: (name: string) => Promise<string | null>;
  /** The name field has opened or taken focus: the list scrolls it into view. */
  onOpen?: () => void;
}

/**
 * The last row of the bullion list: "+ Add Bullion", which becomes a name
 * field with its own Save while a name is being typed.
 *
 * A house added here follows no vendor — the rate is the shop's own RTGS and
 * Cash change — so the confirmation says as much rather than leaving someone
 * to wonder where its price comes from.
 */
export function AddBullionRow({ onAdd, onOpen }: AddBullionRowProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setName('');
    setError(null);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter the name of the bullion house.');
      return;
    }
    setSaving(true);
    try {
      const failure = await onAdd(trimmed);
      if (failure) {
        setError(failure);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          setOpen(true);
          onOpen?.();
        }}
        style={styles.addRow}
        accessibilityRole="button"
      >
        <Plus size={15} color={Colors.brandDeep} strokeWidth={2.4} />
        <Text style={styles.addText}>Add Bullion</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.formRow}>
      <View style={styles.inputWrap}>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error) setError(null);
          }}
          autoFocus
          onFocus={onOpen}
          autoCapitalize="words"
          maxLength={40}
          accessibilityLabel="Bullion house name"
          style={[styles.input, error ? styles.inputError : null]}
          onSubmitEditing={() => void save()}
          returnKeyType="done"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        onPress={() => void save()}
        disabled={saving}
        accessibilityRole="button"
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
      <Pressable onPress={close} hitSlop={6} accessibilityRole="button" style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addText: { fontSize: 14, fontWeight: '700', color: Colors.brandDeep },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrap: { flex: 1 },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputError: { borderColor: '#D9291F' },
  error: { fontSize: 11.5, color: '#D9291F', marginTop: 4 },
  saveBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: Radius.button,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  cancelBtn: { height: 42, justifyContent: 'center', paddingHorizontal: 4 },
  cancelText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
});
