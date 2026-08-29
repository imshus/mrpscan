import { View } from 'react-native';

interface FormFieldGridProps {
  children: React.ReactNode;
}

export function FormFieldGrid({ children }: FormFieldGridProps) {
  return <View className="flex-row flex-wrap gap-x-3 gap-y-0">{children}</View>;
}

interface FormFieldGridItemProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function FormFieldGridItem({ children, fullWidth = false }: FormFieldGridItemProps) {
  return <View className={fullWidth ? 'w-full' : 'w-[47.5%]'}>{children}</View>;
}
