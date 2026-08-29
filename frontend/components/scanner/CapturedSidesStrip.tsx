import { Image, Text, View } from 'react-native';
import { Camera, Check, ImageUp } from 'lucide-react-native';

export type CaptureSource = 'camera' | 'gallery';

interface SideCapture {
  uri: string;
  source: CaptureSource;
}

interface CapturedSidesStripProps {
  activeSide: 'front' | 'back';
  showBack?: boolean;
  front?: SideCapture | null;
  back?: SideCapture | null;
}

function sourceLabel(source: CaptureSource): string {
  return source === 'gallery' ? 'Uploaded' : 'Scanned';
}

function SideThumbnail({
  label,
  capture,
  isActive,
}: {
  label: string;
  capture?: SideCapture | null;
  isActive: boolean;
}) {
  const Icon = capture?.source === 'gallery' ? ImageUp : Camera;

  return (
    <View
      className={`flex-1 rounded-xl border p-2 ${
        isActive ? 'border-accent-gold bg-black/60' : 'border-white/30 bg-black/40'
      }`}
    >
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-white">{label}</Text>
        {capture ? (
          <View className="flex-row items-center gap-1">
            <Check size={12} color="#B8860B" />
            <Text className="text-[10px] text-accent-gold">{sourceLabel(capture.source)}</Text>
          </View>
        ) : (
          <Text className="text-[10px] text-white/60">{isActive ? 'In progress' : 'Pending'}</Text>
        )}
      </View>

      {capture ? (
        <Image source={{ uri: capture.uri }} className="h-16 w-full rounded-lg" resizeMode="cover" />
      ) : (
        <View className="h-16 items-center justify-center rounded-lg border border-dashed border-white/30 bg-black/30">
          <Icon size={18} color={isActive ? '#B8860B' : '#FFFFFF80'} />
        </View>
      )}
    </View>
  );
}

export function CapturedSidesStrip({
  activeSide,
  showBack = false,
  front,
  back,
}: CapturedSidesStripProps) {
  if (!front && !back) {
    return null;
  }

  return (
    <View className="mx-4 mt-2 rounded-2xl bg-black/50 p-3">
      <Text className="mb-2 text-center text-xs font-medium text-white/80">Captured Images</Text>
      <View className="flex-row gap-2">
        <SideThumbnail label="Front" capture={front} isActive={activeSide === 'front'} />
        {showBack ? (
          <SideThumbnail label="Back" capture={back} isActive={activeSide === 'back'} />
        ) : null}
      </View>
    </View>
  );
}
