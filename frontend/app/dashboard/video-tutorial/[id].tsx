import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findVideoTutorial } from '@/constants/videoTutorials';

/**
 * One tutorial, played in the app with the platform's own controls (play,
 * scrub, fullscreen). The file is bundled, so there is nothing to buffer and
 * no signal needed; a URL source would work here unchanged.
 */
export default function VideoTutorialPlayerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const video = findVideoTutorial(typeof id === 'string' ? id : undefined);

  const player = useVideoPlayer(video?.source ?? null, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
  });

  if (!video) {
    return (
      <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
        <BackgroundPattern />
        <PageHeader title="Video Tutorial" />
        <View style={screenStyles.emptyCard}>
          <Text style={screenStyles.emptyTitle}>Video not found</Text>
          <Text style={screenStyles.emptyText}>This tutorial is no longer in the app.</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title={video.title} />

      <View style={styles.body}>
        <VideoView
          player={player}
          style={styles.player}
          contentFit="contain"
          nativeControls
          // The tutorial is 16:9; fullscreen turns the phone sideways for it
          // and comes back to portrait, which the rest of the app is locked to.
          fullscreenOptions={{ enable: true, orientation: 'landscape' }}
        />
        <Text style={styles.title}>{video.summary}</Text>
        <Text style={styles.meta}>{video.duration}</Text>
      </View>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.sm,
  },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.input,
    backgroundColor: '#15120D',
    overflow: 'hidden',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
