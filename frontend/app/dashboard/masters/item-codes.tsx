import { useCallback, useRef, useState } from 'react';
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
import { Trash2 } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deleteItemCode, fetchItemCodes, saveItemCode } from '@/utils/itemCodeApi';

/** One editable line of the sheet; unsaved rows have no id yet. */
interface RowState {
  key: string;
  id: string | null;
  name: string;
  code: string;
  /** Edited since its last save; blur, + Add and leaving the screen flush it. */
  dirty?: boolean;
}

let rowKeySeed = 0;
const nextRowKey = () => `row-${rowKeySeed++}`;

const emptyRow = (): RowState => ({ key: nextRowKey(), id: null, name: '', code: '' });

export default function ItemCodesScreen() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Rows mid-save, so a slow request cannot double-fire from two blurs.
  const savingKeys = useRef(new Set<string>());
  // The cleanup that saves on leaving the screen reads through this ref,
  // because the closure it was created in holds stale rows.
  const rowsRef = useRef<RowState[]>([]);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await fetchItemCodes();
      const loaded = items.map((item) => ({
        key: nextRowKey(),
        id: item.id,
        name: item.description,
        code: item.code,
      }));
      // The sheet always ends with a blank line to type into, like the mockup.
      setRows([...loaded, emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  /** Saves a line once its fields are left; an empty code means "not yet". */
  const persistRow = useCallback(async (row: RowState, quiet = false) => {
    const code = row.code.trim();
    if (!code || savingKeys.current.has(row.key)) return;
    if (row.id && !row.dirty) return;
    savingKeys.current.add(row.key);
    try {
      const saved = await saveItemCode({
        id: row.id ?? undefined,
        code,
        description: row.name.trim(),
      });
      if (saved) {
        updateRow(row.key, { id: saved.id, code: saved.code, name: saved.description, dirty: false });
      }
    } catch (err) {
      if (!quiet) {
        Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not save this item code.');
      }
    } finally {
      savingKeys.current.delete(row.key);
    }
  }, []);

  /** Saves every edited line — + Add and leaving the screen both call this. */
  const flushDirtyRows = useCallback(
    (quiet = false) => {
      for (const row of rowsRef.current) {
        if (row.code.trim() && (row.dirty || !row.id)) void persistRow(row, quiet);
      }
    },
    [persistRow],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      // Navigating away must not lose a line whose field never blurred.
      return () => flushDirtyRows(true);
    }, [load, flushDirtyRows]),
  );

  const handleBlur = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (row) void persistRow(row);
  };

  const handleDelete = (row: RowState) => {
    if (!row.id) {
      setRows((current) => {
        const next = current.filter((r) => r.key !== row.key);
        return next.length ? next : [emptyRow()];
      });
      return;
    }
    Alert.alert('Delete item code', `Remove ${row.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItemCode(row.id as string);
              setRows((current) => {
                const next = current.filter((r) => r.key !== row.key);
                return next.length ? next : [emptyRow()];
              });
            } catch (err) {
              Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not delete this item code.');
            }
          })();
        },
      },
    ]);
  };

  const handleAdd = () => {
    flushDirtyRows();
    setRows((current) => [...current, emptyRow()]);
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Item Code" subtitle="Settings → Masters → Item Code" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.brandDeep} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <View style={styles.sheetCard}>
                {rows.map((row, index) => (
                  <View key={row.key} style={[styles.row, index > 0 && styles.rowDivider]}>
                    <Text style={styles.rowIndex}>{index + 1}.</Text>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>ITEM NAME</Text>
                      <TextInput
                        value={row.name}
                        onChangeText={(text) => updateRow(row.key, { name: text, dirty: true })}
                        onEndEditing={() => handleBlur(row.key)}
                        placeholder="––––––––––––"
                        placeholderTextColor={Colors.placeholder}
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>ITEM CODE</Text>
                      <TextInput
                        value={row.code}
                        onChangeText={(text) => updateRow(row.key, { code: text.toUpperCase(), dirty: true })}
                        onEndEditing={() => handleBlur(row.key)}
                        placeholder="––––––––––––"
                        placeholderTextColor={Colors.placeholder}
                        autoCapitalize="characters"
                        maxLength={40}
                        style={styles.fieldInput}
                      />
                    </View>
                    <Pressable onPress={() => handleDelete(row)} hitSlop={8} style={styles.trashBtn}>
                      <Trash2 size={15} color={Colors.brandDeep} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </>
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
  sheetCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowIndex: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
    paddingTop: 14,
    width: 20,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  fieldInput: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderStyle: 'dashed',
  },
  trashBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    paddingVertical: 12,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
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
});
