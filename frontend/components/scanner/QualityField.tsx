import { View } from 'react-native';

import { FormFieldGridItem } from '@/components/scanner/FormFieldGrid';
import { FormInput } from '@/components/scanner/FormInput';

interface QualityFieldProps {
  label: string;
  value: string;
}

export function QualityField({ label, value }: QualityFieldProps) {
  return (
    <FormFieldGridItem>
      <FormInput
        label={label}
        value={value}
        editable={false}
        placeholder="Auto-generated"
        containerClassName="mb-2.5"
      />
    </FormFieldGridItem>
  );
}
