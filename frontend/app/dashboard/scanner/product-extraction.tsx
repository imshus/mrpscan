import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react-native';

import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { MOCK_EXTRACTION_FIELDS } from '@/constants/scannerData';

function StatusIcon({ status }: { status: 'matched' | 'pending' | 'missing' }) {
  if (status === 'matched') return <CheckCircle2 size={18} color="#34A853" />;
  if (status === 'pending') return <Circle size={18} color="#B8860B" />;
  return <AlertCircle size={18} color="#A81F17" />;
}

export default function ProductExtractionScreen() {
  const router = useRouter();

  return (
    <ScanScreenWrapper
      title="Product Extraction"
      footer={
        <PrimaryGreenButton
          title="Map Extracted Data"
          onPress={() => router.push('/dashboard/scanner/data-mapping')}
        />
      }
    >
      <Text className="mb-6 text-sm text-text-secondary">
        OCR extracted the following fields from the jewellery tag.
      </Text>

      {MOCK_EXTRACTION_FIELDS.map((field) => (
        <View
          key={field.id}
          className="mb-3 flex-row items-center rounded-2xl border border-border bg-white p-4"
        >
          <StatusIcon status={field.status} />
          <View className="ml-3 flex-1">
            <Text className="text-xs text-text-muted">{field.label}</Text>
            <Text className="text-sm font-semibold text-text-primary">
              {field.value || '—'}
            </Text>
          </View>
          <View
            className={`rounded-full px-2 py-0.5 ${
              field.status === 'matched'
                ? 'bg-success-bg'
                : field.status === 'pending'
                  ? 'bg-accent-gold/20'
                  : 'bg-danger-bg'
            }`}
          >
            <Text
              className={`text-[10px] font-semibold capitalize ${
                field.status === 'matched'
                  ? 'text-success-text'
                  : field.status === 'pending'
                    ? 'text-text-primary'
                    : 'text-danger-text'
              }`}
            >
              {field.status}
            </Text>
          </View>
        </View>
      ))}
    </ScanScreenWrapper>
  );
}
