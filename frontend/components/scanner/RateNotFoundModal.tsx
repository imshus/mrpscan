import { Modal, Pressable, Text, View } from 'react-native';

interface RateNotFoundModalProps {
  visible: boolean;
  quality: string;
  onCancel: () => void;
  onRefresh: () => void;
  onRetry: () => void;
}

export function RateNotFoundModal({
  visible,
  quality,
  onCancel,
  onRefresh,
  onRetry,
}: RateNotFoundModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-[20px] bg-white px-6 py-7 shadow-lg">
          <Text className="text-lg font-bold text-text-primary">Rate Not Found</Text>
          <Text className="mt-3 text-sm leading-5 text-text-secondary">
            No rate exists for quality &quot;{quality}&quot;.{'\n'}
            Please add this value in backend configuration.
          </Text>

          <View className="mt-6 flex-row gap-2">
            <Pressable
              onPress={onCancel}
              className="flex-1 items-center rounded-button border border-border bg-white py-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-text-secondary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onRefresh}
              className="flex-1 items-center rounded-button border border-primary bg-white py-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-primary">Refresh</Text>
            </Pressable>
            <Pressable
              onPress={onRetry}
              className="flex-1 items-center rounded-button bg-primary py-3 active:opacity-90"
            >
              <Text className="text-sm font-semibold text-white">Retry</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
