import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Play } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { VIDEO_TUTORIALS } from '@/constants/videoTutorials';

/**
 * Settings -> Video Tutorial: one row per demo, opening a player screen, the
 * way the bullion lists open their detail. The list is data (constants/
 * videoTutorials.ts), so another demo is one entry there and nothing here.
 */
export default function VideoTutorialScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Video Tutorial" subtitle="Watch how MRPscan works, step by step" />

      <ScrollView contentContainerStyle={screenStyles.scrollContent} showsVerticalScrollIndicator={false}>
        {VIDEO_TUTORIALS.length === 0 ? (
          <View style={screenStyles.emptyCard}>
            <Text style={screenStyles.emptyTitle}>No videos yet</Text>
            <Text style={screenStyles.emptyText}>Tutorials will appear here once they are added.</Text>
          </View>
        ) : (
          VIDEO_TUTORIALS.map((video) => (
            <Pressable
              key={video.id}
              accessibilityRole="button"
              accessibilityLabel={`Play ${video.title}`}
              onPress={() =>
                router.push({ pathname: '/dashboard/video-tutorial/[id]', params: { id: video.id } })
              }
              style={styles.row}
            >
              <View style={styles.thumb}>
                <Play size={16} color={Colors.white} fill={Colors.white} />
                <Text style={styles.duration}>{video.duration}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{video.title}</Text>
                <Text style={styles.rowSubtitle}>{video.summary}</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.listGap,
  },
  thumb: {
    width: 64,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2B2622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
