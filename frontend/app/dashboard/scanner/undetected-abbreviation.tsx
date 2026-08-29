import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ClarificationFieldRow } from '@/components/scanner/ClarificationFieldRow';
import { ItemSelectedBadge } from '@/components/scanner/ItemSelectedBadge';
import { ScreenBackHeader } from '@/components/scanner/ScreenBackHeader';
import { isDemoScanMode } from '@/constants/scanMode';
import { useScannerStore } from '@/store/scannerStore';
import { ApiError } from '@/utils/apiClient';
import { getDemoClarificationFields } from '@/utils/mockScanApi';
import { getClarification, submitClarification } from '@/utils/scanApi';
import { applyJewelleryTypeToClarificationFields } from '@/utils/clarificationFields';
import { buildConfirmedMappings } from '@/utils/scanMappers';

const SCANNER_BG =
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80';

type FieldSelection = {
  mappedField: string;
  description?: string;
};

export default function UndetectedAbbreviationScreen() {
  const router = useRouter();
  const scanId = useScannerStore((s) => s.scanId);
  const selectedType = useScannerStore((s) => s.selectedType);
  const clarificationFields = useScannerStore((s) => s.clarificationFields);
  const setClarificationFields = useScannerStore((s) => s.setClarificationFields);
  const [selections, setSelections] = useState<Record<string, FieldSelection>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadClarification = useCallback(async () => {
    if (!scanId) {
      router.replace('/dashboard/scanner' as Href);
      return;
    }

    setLoading(true);
    try {
      const data = await getClarification(scanId);
      const fields = applyJewelleryTypeToClarificationFields(
        data.fieldsNeedingReview,
        selectedType,
      );
      setClarificationFields(fields);

      const initialSelections: Record<string, FieldSelection> = {};
      for (const field of fields) {
        initialSelections[field.abbreviation] = {
          mappedField: field.suggestedField,
        };
      }
      setSelections(initialSelections);
    } catch (error) {
      if (isDemoScanMode()) {
        const fields = getDemoClarificationFields(selectedType);
        setClarificationFields(fields);
        const fallbackSelections: Record<string, FieldSelection> = {};
        for (const field of fields) {
          fallbackSelections[field.abbreviation] = { mappedField: field.suggestedField };
        }
        setSelections(fallbackSelections);
        return;
      }
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to load clarification fields. Please try again.';
      Alert.alert('Clarification Error', message, [
        {
          text: 'Go Back',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/dashboard');
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [scanId, router, selectedType, setClarificationFields]);

  useEffect(() => {
    loadClarification();
  }, [loadClarification]);

  const handleMappedFieldChange = (abbreviation: string, mappedField: string) => {
    setSelections((prev) => ({
      ...prev,
      [abbreviation]: {
        ...prev[abbreviation],
        mappedField,
        description: mappedField === 'other' ? prev[abbreviation]?.description : undefined,
      },
    }));
  };

  const handleDescriptionChange = (abbreviation: string, description: string) => {
    setSelections((prev) => ({
      ...prev,
      [abbreviation]: {
        ...prev[abbreviation],
        description,
      },
    }));
  };

  const handleContinue = async () => {
    if (!scanId || clarificationFields.length === 0) return;

    setSubmitting(true);
    try {
      const confirmedMappings = buildConfirmedMappings(clarificationFields, selections);
      await submitClarification(scanId, { confirmedMappings });
      router.replace('/dashboard/scanner/review-results' as Href);
    } catch (error) {
      if (isDemoScanMode()) {
        router.replace('/dashboard/scanner/review-results' as Href);
        return;
      }
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to submit clarification. Please try again.';
      Alert.alert('Submission Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <ImageBackground source={{ uri: SCANNER_BG }} className="flex-1" resizeMode="cover">
        <View className="absolute inset-0 bg-black/50" />
        <SafeAreaView className="flex-1" edges={['top']}>
          <ScreenBackHeader iconColor="#857A63" />

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-6 pb-28 pt-4"
            showsVerticalScrollIndicator={false}
          >
            <View className="rounded-[20px] border-2 border-danger-text bg-white px-5 py-6 shadow-lg">
              <Text className="text-lg font-bold text-text-primary">Undetected Abbreviations</Text>
              <Text className="mt-2 mb-4 text-sm leading-5 text-text-secondary">
                Map each abbreviation to the correct field before continuing.
              </Text>

              {loading ? (
                <ActivityIndicator size="large" color="#D9291F" />
              ) : (
                clarificationFields.map((field) => (
                  <ClarificationFieldRow
                    key={field.abbreviation}
                    field={field}
                    mappedField={
                      selections[field.abbreviation]?.mappedField ?? field.suggestedField
                    }
                    description={selections[field.abbreviation]?.description}
                    onMappedFieldChange={(mappedField) =>
                      handleMappedFieldChange(field.abbreviation, mappedField)
                    }
                    onDescriptionChange={(description) =>
                      handleDescriptionChange(field.abbreviation, description)
                    }
                  />
                ))
              )}

              <Pressable
                onPress={handleContinue}
                disabled={loading || submitting || clarificationFields.length === 0}
                className="mt-2 items-center rounded-button bg-primary py-3.5 active:opacity-90 disabled:opacity-60"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Continue</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>

      <BottomNav activeRoute="scanner" scanButtonVariant="gold" />
    </View>
  );
}
