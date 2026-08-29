import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export function BackgroundPattern() {
  return (
    <View className="absolute right-0 top-0 overflow-hidden" style={{ width: 140, height: 140 }}>
      <Svg width={140} height={140} viewBox="0 0 140 140">
        <Rect x={78} y={10} width={32} height={32} stroke="#E9DDC4" strokeWidth={1} fill="none" opacity={0.55} />
        <Rect x={52} y={28} width={40} height={40} stroke="#E9DDC4" strokeWidth={1} fill="none" opacity={0.45} />
        <Rect x={88} y={46} width={36} height={36} stroke="#E9DDC4" strokeWidth={1} fill="none" opacity={0.38} />
        <Rect x={62} y={64} width={28} height={28} stroke="#E9DDC4" strokeWidth={1} fill="none" opacity={0.32} />
        <Rect x={96} y={78} width={24} height={24} stroke="#E9DDC4" strokeWidth={1} fill="none" opacity={0.28} />
      </Svg>
    </View>
  );
}
