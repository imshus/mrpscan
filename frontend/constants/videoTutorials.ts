export interface VideoTutorial {
  id: string;
  /** Shown as the row's heading and as the player screen's title. */
  title: string;
  /** One line under the title, saying what the video covers. */
  summary: string;
  /** mm:ss, for the thumbnail corner. */
  duration: string;
  /**
   * What expo-video plays: a bundled asset (require, a number at runtime) or
   * a URL. Typed here rather than imported from expo-video so this list stays
   * a plain data file.
   */
  source: number | string | { uri: string };
}

/**
 * The tutorials behind Settings -> Video Tutorial.
 *
 * The file ships inside the app rather than streaming: at 18 MB it costs less
 * than the infrastructure would, it plays with no signal — which is the point
 * in a shop with thin reception — and nothing can 404 it later. The owner's
 * 1080p60 original was 84 MB; it is re-encoded to 720p30 for phones, which no
 * one watching on a handset can tell apart.
 *
 * To serve it from a URL instead, swap `source` for `{ uri: '...' }` and
 * delete the asset: the player screen takes either without change.
 *
 * Demo 2 was dropped on the owner's word (26 Nov 2026) rather than shown as
 * pending; add a second entry here when its video exists and the screen picks
 * it up with no other change.
 */
export const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: 'demo-1',
    title: 'Demo 1',
    summary: 'MRPscan Tutorial Video',
    duration: '6:12',
    source: require('@/assets/videos/demo-1.mp4'),
  },
];

export function findVideoTutorial(id: string | undefined): VideoTutorial | undefined {
  return VIDEO_TUTORIALS.find((item) => item.id === id);
}
