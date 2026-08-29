import { Pressable, Text, View } from 'react-native';

interface TabSwitcherProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabSwitcher({ tabs, activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <View className="mb-5 flex-row rounded-xl bg-tabInactive p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={`flex-1 items-center justify-center rounded-lg px-2 py-2.5 ${isActive ? 'bg-white' : ''}`}
            style={
              isActive
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    elevation: 2,
                  }
                : undefined
            }
          >
            <Text
              className={`text-center text-xs font-medium ${isActive ? 'text-text-primary' : 'text-text-muted'}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
