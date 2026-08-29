import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { MOCK_MAPPED_FIELDS } from '@/constants/scannerData';

export default function DataMappingScreen() {
  const router = useRouter();

  return (
    <ScanScreenWrapper
      title="Scan Data Mapping"
      footer={
        <View className="gap-3">
          <PrimaryGreenButton
            title="Execute Formula"
            onPress={() => router.push('/dashboard/scanner/formula-flow')}
          />
        </View>
      }
    >
      <Text className="mb-6 text-sm text-text-secondary">
        Map extracted OCR values to formula input fields.
      </Text>

      <View className="mb-3 flex-row border-b border-border pb-2">
        <Text className="flex-1 text-xs font-bold uppercase text-text-muted">Source</Text>
        <Text className="flex-1 text-xs font-bold uppercase text-text-muted">Target Field</Text>
        <Text className="w-12 text-right text-xs font-bold uppercase text-text-muted">Conf.</Text>
      </View>

      {MOCK_MAPPED_FIELDS.map((field) => (
        <View
          key={field.id}
          className="mb-3 rounded-2xl border border-border bg-white p-4"
        >
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-xs text-text-muted">{field.label}</Text>
              <Text className="text-sm font-semibold text-text-primary">{field.sourceValue}</Text>
            </View>
            <Text className="mx-2 text-text-muted">→</Text>
            <View className="flex-1">
              <Text className="text-xs text-text-muted">Target</Text>
              <Text className="text-sm font-medium text-primary">{field.targetField}</Text>
            </View>
            <View
              className={`w-12 items-center rounded-full px-1 py-0.5 ${
                field.confidence >= 90
                  ? 'bg-success-bg'
                  : field.confidence >= 80
                    ? 'bg-accent-gold/20'
                    : 'bg-danger-bg'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  field.confidence >= 90
                    ? 'text-success-text'
                    : field.confidence >= 80
                      ? 'text-text-primary'
                      : 'text-danger-text'
                }`}
              >
                {field.confidence}%
              </Text>
            </View>
          </View>
        </View>
      ))}

      <View className="mt-2 rounded-2xl bg-surface-muted p-4">
        <Text className="text-xs font-semibold uppercase text-text-muted">Manual Override</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Missing or low-confidence fields can be corrected in{' '}
          <Text
            className="font-semibold text-accent-gold underline"
            onPress={() => router.push('/dashboard/scanner/manual-entry')}
          >
            Manual Entry
          </Text>
        </Text>
      </View>
    </ScanScreenWrapper>
  );
}
