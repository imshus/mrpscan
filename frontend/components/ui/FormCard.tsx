import { Text, View } from 'react-native';

interface FormCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({ title, description, children, className = '' }: FormCardProps) {
  return (
    <View
      className={`mt-4 rounded-t-card bg-white px-5 pb-8 pt-6 ${className}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      {title ? (
        <Text className="text-xl font-bold leading-7 text-text-primary">{title}</Text>
      ) : null}
      {description ? (
        <Text className={`text-sm leading-5 text-text-secondary ${title ? 'mt-1.5' : ''}`}>
          {description}
        </Text>
      ) : null}
      <View className={title || description ? 'mt-5' : ''}>{children}</View>
    </View>
  );
}
