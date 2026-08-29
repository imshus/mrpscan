import { ActivityIndicator, Text, View } from 'react-native';

interface LoaderProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export function Loader({ message, size = 'small', color = '#A81F17' }: LoaderProps) {
  return (
    <View className="flex-row items-center gap-2 py-1">
      <ActivityIndicator size={size} color={color} />
      {message ? (
        <Text className="text-sm text-text-secondary">{message}</Text>
      ) : null}
    </View>
  );
}
