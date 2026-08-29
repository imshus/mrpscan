import { Text } from 'react-native';

interface FieldLabelProps {
  label: string;
  required?: boolean;
}

export function FieldLabel({ label, required = false }: FieldLabelProps) {
  return (
    <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-label">
      {label}
      {required ? <Text className="text-danger-text">*</Text> : null}
    </Text>
  );
}
