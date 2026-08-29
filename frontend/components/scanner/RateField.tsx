import { View } from 'react-native';

import { FormFieldGridItem } from '@/components/scanner/FormFieldGrid';
import { FormInput } from '@/components/scanner/FormInput';
import { Loader } from '@/components/scanner/Loader';

interface RateFieldProps {
  label: string;
  value: string;
  isFetching?: boolean;
}

export function RateField({ label, value, isFetching = false }: RateFieldProps) {
  return (
    <FormFieldGridItem fullWidth>
      <FormInput
        label={label}
        value={isFetching ? '' : value}
        editable={false}
        placeholder={isFetching ? '' : 'Auto-filled'}
        containerClassName="mb-2.5"
      />
      {isFetching ? (
        <View className="-mt-1 mb-1">
          <Loader message="Fetching rate..." />
        </View>
      ) : null}
    </FormFieldGridItem>
  );
}
