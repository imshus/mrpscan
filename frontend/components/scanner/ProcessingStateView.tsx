import { ActivityIndicator, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, ScanLine } from 'lucide-react-native';

import type { OcrProcessingState } from '@/types/scanner';

interface ProcessingStateViewProps {
  state: OcrProcessingState;
  errorMessage?: string;
}

export function ProcessingStateView({ state, errorMessage }: ProcessingStateViewProps) {
  if (state === 'scanning') {
    return (
      <View className="items-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-accent-gold/20">
          <ScanLine size={36} color="#B8860B" />
        </View>
        <Text className="text-lg font-bold text-white">Scanning Tag...</Text>
        <Text className="mt-2 text-center text-sm text-white/70">
          Align the jewellery tag within the frame
        </Text>
      </View>
    );
  }

  if (state === 'processing') {
    return (
      <View className="items-center px-8">
        <ActivityIndicator size="large" color="#B8860B" />
        <Text className="mt-6 text-lg font-bold text-white">AI Processing</Text>
        <Text className="mt-2 text-center text-sm text-white/70">
          Gemini Vision is extracting and mapping tag data...
        </Text>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View className="items-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 size={40} color="#34A853" />
        </View>
        <Text className="text-lg font-bold text-white">OCR Successful</Text>
        <Text className="mt-2 text-center text-sm text-white/70">
          All tag data extracted successfully
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center px-8">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-danger-bg">
        <AlertCircle size={40} color="#A81F17" />
      </View>
      <Text className="text-lg font-bold text-white">OCR Failed</Text>
      <Text className="mt-2 text-center text-sm text-white/70">
        {errorMessage ?? 'Unable to read tag. Try manual entry instead.'}
      </Text>
    </View>
  );
}
