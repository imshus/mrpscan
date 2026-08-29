import { Text, View } from 'react-native';

export function OrSeparator() {
  return (
    <View className="my-4 w-full flex-row items-center">
      <View className="h-px flex-1 bg-border" />
      <Text className="mx-4 text-sm text-text-muted">Or</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
