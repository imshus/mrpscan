import { useCallback, useEffect } from 'react';

import { FormFieldGrid, FormFieldGridItem } from '@/components/scanner/FormFieldGrid';
import { FormInput } from '@/components/scanner/FormInput';
import { FormSection } from '@/components/scanner/FormSection';
import { QualityField } from '@/components/scanner/QualityField';
import { RateField } from '@/components/scanner/RateField';
import { useStoneRateFetch } from '@/hooks/useStoneRateFetch';
import { buildQuality } from '@/utils/qualityUtils';

export interface ColorstoneSectionValues {
  weight: string;
  color: string;
  clarity: string;
  quality: string;
  rate: string;
}

interface ColorstoneSectionProps {
  title?: string;
  values: ColorstoneSectionValues;
  onChange: (values: Partial<ColorstoneSectionValues>) => void;
  onRateErrorChange?: (hasError: boolean) => void;
  disabled?: boolean;
}

export function ColorstoneSection({
  title = 'Colorstone Details',
  values,
  onChange,
  onRateErrorChange,
  disabled = false,
}: ColorstoneSectionProps) {
  const hasColorClarity = Boolean(values.color.trim() && values.clarity.trim());
  const quality = buildQuality(values.color, values.clarity);

  const handleRateFetched = useCallback(
    (fetchedRate: string) => {
      onChange({ rate: fetchedRate });
    },
    [onChange],
  );

  const { isFetching, rateNotFound } = useStoneRateFetch({
    type: 'colorstone',
    color: values.color,
    clarity: values.clarity,
    enabled: hasColorClarity && !disabled,
    onRateFetched: handleRateFetched,
  });

  useEffect(() => {
    onRateErrorChange?.(rateNotFound);
  }, [rateNotFound, onRateErrorChange]);

  const handleColorChange = (color: string) => {
    onChange({ color, quality: buildQuality(color, values.clarity) });
  };

  const handleClarityChange = (clarity: string) => {
    onChange({ clarity, quality: buildQuality(values.color, clarity) });
  };

  const inputsDisabled = disabled || isFetching;

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
              placeholder="e.g. 4.26"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <FormInput
              label="CS Color"
              value={values.color}
              onChangeText={handleColorChange}
              editable={!inputsDisabled}
              placeholder="e.g. Red"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <FormFieldGridItem>
            <FormInput
              label="CS Clarity"
              value={values.clarity}
              onChangeText={handleClarityChange}
              editable={!inputsDisabled}
              placeholder="e.g. VVS"
              containerClassName="mb-2.5"
            />
          </FormFieldGridItem>
          <QualityField label="CS Quality" value={quality} />
        </FormFieldGrid>
        <RateField label="CS Rate (₹/ct)" value={values.rate} isFetching={isFetching} />
      </FormSection>

    </>
  );
}
