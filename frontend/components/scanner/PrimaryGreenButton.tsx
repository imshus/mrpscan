import { Pressable, Text } from 'react-native';

interface PrimaryGreenButtonProps {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function PrimaryGreenButton({ title, onPress, icon, disabled = false }: PrimaryGreenButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-button bg-primary py-3.5 ${
        disabled ? 'opacity-60' : 'active:opacity-90'
      }`}
    >
      {icon}
      <Text className="text-sm font-semibold text-white">{title}</Text>
    </Pressable>
  );
}
