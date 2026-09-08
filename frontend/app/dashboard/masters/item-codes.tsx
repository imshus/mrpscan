import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pencil, Trash2 } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deleteItemCode, fetchItemCodes, saveItemCode, type ItemCode } from '@/utils/itemCodeApi';

export default function ItemCodesScreen() {
  const [items, setItems] = useState<ItemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setItems(await fetchItemCodes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const resetForm = () => {
    setCode('');
    setDescription('');
    setEditingId(null);
  };

  const handleSave = async () => {
    const trimmed = code.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await saveItemCode({ id: editingId ?? undefined, code: trimmed, description });
      resetForm();
      await load();
    } catch (err) {
      Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not save the item code.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ItemCode) => {
    setEditingId(item.id);
    setCode(item.code);
    setDescription(item.description);
  };

  const handleDelete = (item: ItemCode) => {
    Alert.alert('Delete item code', `Remove ${item.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItemCode(item.id);
              if (editingId === item.id) resetForm();
              await load();
            } catch (err) {
              Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not delete the item code.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Item Code" subtitle="Masters → Item Code" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>{editingId ? 'Edit item code' : 'New item code'}</Text>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="Item code"
              placeholderTextColor={Colors.placeholder}
              autoCapitalize="characters"
              maxLength={40}
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.placeholder}
              maxLength={200}
              style={styles.input}
            />
            <View style={styles.formActions}>
              {editingId ? (
                <TouchableOpacity activeOpacity={0.9} style={styles.cancelBtn} onPress={resetForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.saveBtn, (!code.trim() || saving) && styles.saveBtnDisabled]}
                disabled={!code.trim() || saving}
                onPress={() => void handleSave()}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? 'Save changes' : 'Add code'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.brandDeep} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>No item codes yet. Add the first one above.</Text>
          ) : (
            <View style={screenStyles.list}>
              {items.map((item) => (
                <View key={item.id} style={screenStyles.listRow}>
                  <View style={screenStyles.listRowText}>
                    <Text style={screenStyles.listRowTitle}>{item.code}</Text>
                    {item.description ? (
                      <Text style={screenStyles.listRowSubtitle}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => handleEdit(item)} hitSlop={8} style={styles.rowBtn}>
                    <Pencil size={16} color={Colors.brandDeep} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.rowBtn}>
                    <Trash2 size={16} color={Colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: 2,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  saveBtn: {
    minWidth: 120,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.input,
    backgroundColor: Colors.primaryButton,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  rowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.dangerText,
    textAlign: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
