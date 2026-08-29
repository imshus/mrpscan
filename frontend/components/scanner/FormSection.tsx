import { Text, View } from 'react-native';

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'card';
  /** Tinted tile treatments from the design mockup (gold / diamond tiles). */
  tone?: 'default' | 'gold' | 'diamond';
}

const TONE_STYLES: Record<NonNullable<FormSectionProps['tone']>, { card: string; title: string }> = {
  default: { card: 'border-border bg-surface-muted', title: 'text-text-muted' },
  gold: { card: 'border-metal-goldBorder bg-metal-goldBg', title: 'text-metal-gold' },
  diamond: { card: 'border-diamond-border bg-diamond-bg', title: 'text-diamond' },
};

export function FormSection({ title, children, variant = 'default', tone = 'default' }: FormSectionProps) {
  const isCard = variant === 'card';
  const hasTitle = Boolean(title?.trim());
  const toneStyle = TONE_STYLES[tone];

  return (
    <View
      className={
        isCard
          ? `mb-4 rounded-2xl border ${toneStyle.card} px-3.5 ${
              hasTitle ? 'pb-1 pt-3.5' : 'py-3.5'
            }`
          : 'mb-5'
      }
    >
      {hasTitle ? (
        <Text
          className={`text-[12px] font-extrabold ${toneStyle.title} ${
            isCard ? 'mb-2.5' : 'mb-3'
          }`}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
