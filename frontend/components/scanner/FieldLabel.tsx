import { Text } from 'react-native';

interface FieldLabelProps {
  label: string;
  required?: boolean;
}

export function FieldLabel({ label, required = false }: FieldLabelProps) {
  return (
    <Text className="mb-1.5 text-[12px] font-semibold text-text-label">
      {label}
      {required ? <Text className="text-danger-text">*</Text> : null}
    </Text>
  );
}
