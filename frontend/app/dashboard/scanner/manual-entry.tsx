import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import { ColorstoneSection } from '@/components/scanner/ColorstoneSection';
import { DiamondSection } from '@/components/scanner/DiamondSection';
import { FormInput } from '@/components/scanner/FormInput';
import { FormSection } from '@/components/scanner/FormSection';

import { JewelleryTypeSelector } from '@/components/scanner/JewelleryTypeSelector';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { ScannerInput } from '@/components/scanner/ScannerInput';
import { ScannerPreview } from '@/components/scanner/ScannerPreview';
import { ToastNotification } from '@/components/scanner/ToastNotification';
import { useScannerStore } from '@/store/scannerStore';
import type { ScanItemData } from '@/types/scanner';
import { parseScannerTag } from '@/utils/scannerTagParser';


export default function ManualEntryScreen() {
  const router = useRouter();
  const scanData = useScannerStore((s) => s.scanData);
  const selectedType = useScannerStore((s) => s.selectedType);
  const updateScanData = useScannerStore((s) => s.updateScanData);

  const [scannerInput, setScannerInput] = useState('');
  const [parsedTag, setParsedTag] = useState(parseScannerTag(''));
  const [diamondRateError, setDiamondRateError] = useState(false);
  const [colorstoneRateError, setColorstoneRateError] = useState(false);
  const [showLabourValidation, setShowLabourValidation] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const handleScannerInput = useCallback(
    (text: string) => {
      setScannerInput(text);
      const parsed = parseScannerTag(text);
      setParsedTag(parsed);

      if (!parsed) return;

      if (parsed.stoneType === 'diamond') {
        updateScanData({ diamondWeight: parsed.weight, diamondRate: parsed.rate });
        setToast({ visible: true, message: 'Diamond tag parsed successfully' });
      } else {
        updateScanData({ colorstoneWeight: parsed.weight, colorstoneRate: parsed.rate });
        setToast({ visible: true, message: 'Colorstone tag parsed successfully' });
      }
    },
    [updateScanData],
  );

  const hasRateError = diamondRateError || colorstoneRateError;
  const canContinue = !hasRateError;

  const handleContinue = () => {
    if (!canContinue) return;
    router.push('/dashboard/scanner/formula-flow');
  };

  const handleDiamondChange = (values: Partial<ScanItemData>) => {
    updateScanData(values);
  };

  return (
    <ScanScreenWrapper
      title="Manual Entry"
      footer={
        <PrimaryGreenButton
          title="Continue to Formula"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      <View className="mb-6">
        <JewelleryTypeSelector variant="chips" />
      </View>

      <FormSection title="Scanner Tag">
        <ScannerInput value={scannerInput} onChangeText={handleScannerInput} />
        <ScannerPreview parsed={parsedTag} rawInput={scannerInput} />
      </FormSection>

      <FormSection title="Item Identity">
        <FormInput
          label="SKU / Tracking Code"
          value={scanData.sku}
          placeholder="e.g. G-1002"
          onChangeText={(sku) => updateScanData({ sku })}
        />
        <View className="mb-3">
          <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-label">
            Item Category
          </Text>
          <View className="h-11 flex-row items-center justify-between rounded-input border border-border bg-[#F4ECDC] px-3.5">
            <Text className="text-base text-text-primary">{scanData.category}</Text>
            <ChevronDown size={20} color="#857A63" />
          </View>
        </View>
      </FormSection>

      <FormSection title="Weight & Purity">
        <View className="flex-row flex-wrap justify-between">
          <View className="w-[48%]">
            <FormInput
              label="Gross Wt (g)"
              value={scanData.grossWt}
              onChangeText={(grossWt) => updateScanData({ grossWt })}
            />
          </View>
          <View className="w-[48%]">
            <FormInput
              label="Net Wt (g)"
              value={scanData.netWt}
              onChangeText={(netWt) => updateScanData({ netWt })}
            />
          </View>
          <View className="w-[48%]">
            <FormInput
              label="Pure Wt"
              value={scanData.pureWt}
              onChangeText={(pureWt) => updateScanData({ pureWt })}
            />
          </View>
          <View className="w-[48%]">
            <FormInput
              label="Tunch (%)"
              value={scanData.tunch}
              onChangeText={(tunch) => updateScanData({ tunch })}
            />
          </View>
        </View>
      </FormSection>

      {selectedType === 'Diamond' ? (
        <DiamondSection
          values={{
            weight: scanData.diamondWeight,
            shape: scanData.diamondShape,
            color: scanData.diamondColor,
            clarity: scanData.diamondClarity,
            quality: scanData.diamondQuality,
            rate: scanData.diamondRate,
            packetCode: scanData.packetCode,
          }}
          onChange={(values) =>
            handleDiamondChange({
              ...(values.weight !== undefined ? { diamondWeight: values.weight } : {}),
              ...(values.shape !== undefined ? { diamondShape: values.shape } : {}),
              ...(values.color !== undefined ? { diamondColor: values.color } : {}),
              ...(values.clarity !== undefined ? { diamondClarity: values.clarity } : {}),
              ...(values.quality !== undefined ? { diamondQuality: values.quality } : {}),
              ...(values.rate !== undefined ? { diamondRate: values.rate } : {}),
              ...(values.packetCode !== undefined ? { packetCode: values.packetCode } : {}),
            })
          }
          onRateErrorChange={setDiamondRateError}
        />
      ) : null}

      <ColorstoneSection
        values={{
          weight: scanData.colorstoneWeight,
          color: scanData.colorstoneColor,
          clarity: scanData.colorstoneClarity,
          quality: scanData.colorstoneQuality,
          rate: scanData.colorstoneRate,
        }}
        onChange={(values) =>
          updateScanData({
            ...(values.weight !== undefined ? { colorstoneWeight: values.weight } : {}),
            ...(values.color !== undefined ? { colorstoneColor: values.color } : {}),
            ...(values.clarity !== undefined ? { colorstoneClarity: values.clarity } : {}),
            ...(values.quality !== undefined ? { colorstoneQuality: values.quality } : {}),
            ...(values.rate !== undefined ? { colorstoneRate: values.rate } : {}),
          })
        }
        onRateErrorChange={setColorstoneRateError}
      />


      {hasRateError ? (
        <Text className="mb-4 text-center text-xs text-danger-text">
          Resolve rate errors before continuing.
        </Text>
      ) : null}

      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type="success"
        onDismiss={() => setToast({ visible: false, message: '' })}
      />
    </ScanScreenWrapper>
  );
}
