import { Text, View } from 'react-native';
import { Check, Circle } from 'lucide-react-native';

interface Step {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <View className="gap-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === 'completed';
        const isActive = step.status === 'active';

        return (
          <View key={step.id} className="flex-row">
            <View className="mr-4 items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isCompleted
                    ? 'bg-success-bg'
                    : isActive
                      ? 'bg-accent-gold'
                      : 'bg-tabInactive'
                }`}
              >
                {isCompleted ? (
                  <Check size={16} color="#34A853" />
                ) : (
                  <Circle size={12} color={isActive ? '#FFFFFF' : '#857A63'} fill={isActive ? '#FFFFFF' : 'transparent'} />
                )}
              </View>
              {!isLast ? (
                <View
                  className={`my-1 w-0.5 flex-1 min-h-[24px] ${
                    isCompleted ? 'bg-success-text' : 'bg-border'
                  }`}
                />
              ) : null}
            </View>
            <View className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
              <Text
                className={`text-sm font-semibold ${
                  isActive || isCompleted ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {step.label}
              </Text>
              {isActive ? (
                <Text className="mt-1 text-xs text-accent-gold">In progress...</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
