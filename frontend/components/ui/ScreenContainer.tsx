import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from './BackgroundPattern';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}

export function ScreenContainer({ children, scrollable = false, className = '' }: ScreenContainerProps) {
  const content = scrollable ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );

  return (
    <SafeAreaView className={`flex-1 bg-surface-muted ${className}`} edges={['top', 'bottom']}>
      <BackgroundPattern />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
