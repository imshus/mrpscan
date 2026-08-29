import { useCallback, useEffect } from 'react';

import { FormFieldGrid, FormFieldGridItem } from '@/components/scanner/FormFieldGrid';
import { FormInput } from '@/components/scanner/FormInput';
import { FormSection } from '@/components/scanner/FormSection';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { QualityField } from '@/components/scanner/QualityField';
import { RateField } from '@/components/scanner/RateField';
import { DIAMOND_SHAPE_OPTIONS, type StoneSelectOption } from '@/constants/stoneRateOptions';
import { useStoneRateFetch } from '@/hooks/useStoneRateFetch';
import { buildQuality } from '@/utils/qualityUtils';

export interface DiamondSectionValues {
  weight: string;
  shape: string;
  color: string;
  clarity: string;
  quality: string;
  rate: string;
  packetCode?: string;
}

interface DiamondSectionProps {
  title?: string;
  values: DiamondSectionValues;
  onChange: (values: Partial<DiamondSectionValues>) => void;
  onRateErrorChange?: (hasError: boolean) => void;
  disabled?: boolean;
  shapeOptions?: readonly StoneSelectOption[];
}

export function DiamondSection({
  title = 'Diamond Details',
  values,
  onChange,
  onRateErrorChange,
  disabled = false,
  shapeOptions,
}: DiamondSectionProps) {
  const hasLookupCriteria = Boolean(
    values.packetCode?.trim() || values.shape.trim() || values.color.trim() || values.clarity.trim(),
  );
  const quality = buildQuality(values.color, values.clarity);

  const handleRateFetched = useCallback(
    (fetchedRate: string) => {
      onChange({ rate: fetchedRate });
    },
    [onChange],
  );

  const { isFetching, rateNotFound } = useStoneRateFetch({
    type: 'diamond',
    color: values.color,
    clarity: values.clarity,
    shape: values.shape,
    packetCode: values.packetCode,
    enabled: hasLookupCriteria && !disabled,
    onRateFetched: handleRateFetched,
  });

  const handleColorChange = (color: string) => {
    onChange({ color, quality: buildQuality(color, values.clarity) });
  };

  const handleClarityChange = (clarity: string) => {
    onChange({ clarity, quality: buildQuality(values.color, clarity) });
  };

  useEffect(() => {
    onRateErrorChange?.(rateNotFound);
  }, [rateNotFound, onRateErrorChange]);

  const inputsDisabled = disabled || isFetching;
  const dropdownOptions = (() => {
    const rawOptions = [
      { value: '', label: 'None' },
      ...(shapeOptions ?? DIAMOND_SHAPE_OPTIONS).map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
      })),
    ];
    const seen = new Set<string>();
    return rawOptions.filter((option) => {
      const normalized = option.value.trim().toLowerCase();
      const key = normalized === 'none' ? '' : normalized;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  return (
    <>
      <FormSection title={title} variant="card">
        <FormFieldGrid>
          <FormFieldGridItem>
            <FormInput
              label="Weight (CT)"
              value={values.weight}
              onChangeText={(weight) => onChange({ weight })}
              editable={!inputsDisabled}
              placeholder="e.g. 0.46"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <SearchableSelectDropdown
              label="Diamond Shape"
              value={values.shape}
              options={dropdownOptions}
              onChange={(shape) => onChange({ shape })}
              placeholder="None"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <FormInput
              label="Diamond Color"
              value={values.color}
              onChangeText={handleColorChange}
              editable={!inputsDisabled}
              placeholder="e.g. IJ"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <FormInput
              label="Diamond Clarity"
              value={values.clarity}
              onChangeText={handleClarityChange}
              editable={!inputsDisabled}
              placeholder="e.g. VVS1"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <FormInput
              label="Packet Code"
              value={values.packetCode ?? ''}
              onChangeText={(packetCode) => onChange({ packetCode })}
              editable={!inputsDisabled}
              placeholder="e.g. PKT-123"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <QualityField label="Diamond Quality" value={quality} />
        </FormFieldGrid>
        <RateField label="Diamond Rate (₹/ct)" value={values.rate} isFetching={isFetching} />
      </FormSection>

    </>
  );
}
