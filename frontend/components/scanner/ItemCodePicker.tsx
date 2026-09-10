import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useItemCatalogue } from '@/utils/itemCatalogue';
import type { ItemCode } from '@/utils/itemCodeApi';

interface ItemCodePickerProps {
  visible: boolean;
  /** The code on the card now; its line is highlighted. */
  value: string;
  onSelect: (item: ItemCode) => void;
  onClose: () => void;
}

/**
 * Bottom sheet listing every item code saved under Masters → Item Code, so a
 * scanned piece can be given a catalogue code (and with it, its name) when
 * the tag printed none or printed one the reader missed.
 */
export function ItemCodePicker({ visible, value, onSelect, onClose }: ItemCodePickerProps) {
  const { items, loading } = useItemCatalogue();
  const [search, setSearch] = useState('');
  const { height } = useWindowDimensions();
  const current = value.trim().toUpperCase();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
    );
  }, [items, search]);

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { maxHeight: height * 0.72 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Item Code</Text>
          <Text style={styles.subtitle}>Saved under Settings → Masters → Item Code</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search code or item name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.search}
          />
          {loading && items.length === 0 ? (
            <View style={styles.state}>
              <ActivityIndicator color={Colors.brandDeep} />
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.stateText}>
              {items.length ? 'No item code matches your search.' : 'No item codes saved yet.'}
            </Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const selected = item.code.toUpperCase() === current;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      close();
                    }}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <Text style={styles.rowCode}>{item.code}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.description || '—'}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  search: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundAlt,
    marginBottom: 8,
  },
  state: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  stateText: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  row: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    gap: 2,
  },
  rowSelected: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
  },
  rowCode: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rowName: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
