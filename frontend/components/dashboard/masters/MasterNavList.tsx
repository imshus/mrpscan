import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import type { MasterNavItem } from '@/constants/settingsMasters';
import { screenStyles } from '@/constants/screenLayout';
import { Colors } from '@/constants/theme';

interface MasterNavListProps {
  items: MasterNavItem[];
}

export function MasterNavList({ items }: MasterNavListProps) {
  const router = useRouter();

  return (
    <View style={screenStyles.list}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => router.push(item.route as Href)}
          style={screenStyles.listRow}
        >
          <View style={screenStyles.listRowText}>
            <Text style={screenStyles.listRowTitle}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={screenStyles.listRowSubtitle}>{item.subtitle}</Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}
