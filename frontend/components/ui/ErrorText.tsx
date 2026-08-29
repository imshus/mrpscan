import { Text } from 'react-native';

interface ErrorTextProps {
  message?: string | null;
}

export function ErrorText({ message }: ErrorTextProps) {
  if (!message) return null;
  return <Text className="mt-1.5 text-xs text-danger-text">{message}</Text>;
}
