import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Records the Pratham AI call through Android's voice-communication path, so
 * the platform's echo canceller runs.
 *
 * react-native-audio-api opens its Oboe streams without an input preset,
 * which records raw: the microphone hears the agent coming out of the
 * loudspeaker and the agent answers itself. Asking for
 * InputPreset::VoiceCommunication on the input, and Usage::VoiceCommunication
 * on the output, puts both streams in the session Android applies echo
 * cancellation, noise suppression and gain control to — the same treatment a
 * phone call gets. Exclusive/MMAP streams bypass that pipeline, so both
 * streams move to Shared.
 *
 * The library has no setting for this, so its sources are patched in place.
 * Each edit is skipped when it is already there, and the build fails loudly if
 * the code it expects has changed (a library upgrade), rather than silently
 * building an app that echoes.
 */
const EDITS = [
  {
    file: join('android', 'src', 'main', 'cpp', 'audioapi', 'android', 'core', 'AndroidAudioRecorder.cpp'),
    find: `  builder.setSharingMode(oboe::SharingMode::Exclusive)
      ->setDirection(oboe::Direction::Input)
      ->setFormat(oboe::AudioFormat::Float)
      ->setFormatConversionAllowed(true)
      ->setPerformanceMode(oboe::PerformanceMode::None)`,
    replace: `  builder.setSharingMode(oboe::SharingMode::Shared)
      ->setDirection(oboe::Direction::Input)
      ->setFormat(oboe::AudioFormat::Float)
      ->setFormatConversionAllowed(true)
      ->setInputPreset(oboe::InputPreset::VoiceCommunication)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)`,
    marker: 'setInputPreset(oboe::InputPreset::VoiceCommunication)',
  },
  {
    file: join('android', 'src', 'main', 'java', 'com', 'swmansion', 'audioapi', 'AudioAPIModule.kt'),
    find: `  override fun setAudioSessionActivity(
    enabled: Boolean,
    promise: Promise?,
  ) {
    promise?.resolve(true)
  }`,
    replace: `  override fun setAudioSessionActivity(
    enabled: Boolean,
    promise: Promise?,
  ) {
    // A voice-communication call goes to the earpiece by default, which is
    // where the tag scanner's agent was ending up: held to the ear, on the
    // call mic. Speakerphone is the same session — the platform's echo
    // canceller keeps running — routed to the loudspeaker and the main mic.
    try {
      val context = reactContext.get()?.applicationContext
      val manager =
        context?.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
      if (manager != null) {
        if (enabled) {
          manager.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            manager.availableCommunicationDevices
              .firstOrNull { it.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
              ?.let { manager.setCommunicationDevice(it) }
          } else {
            @Suppress("DEPRECATION")
            manager.isSpeakerphoneOn = true
          }
        } else {
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            manager.clearCommunicationDevice()
          } else {
            @Suppress("DEPRECATION")
            manager.isSpeakerphoneOn = false
          }
          manager.mode = android.media.AudioManager.MODE_NORMAL
        }
      }
    } catch (e: Exception) {
      // The route is a preference, not a requirement: the call still runs.
    }
    promise?.resolve(true)
  }`,
    marker: 'MODE_IN_COMMUNICATION',
  },
  {
    file: join('android', 'src', 'main', 'cpp', 'audioapi', 'android', 'core', 'AudioPlayer.cpp'),
    find: `  builder.setSharingMode(SharingMode::Exclusive)
      ->setFormat(AudioFormat::Float)
      ->setFormatConversionAllowed(true)
      ->setPerformanceMode(PerformanceMode::None)`,
    replace: `  builder.setSharingMode(SharingMode::Shared)
      ->setFormat(AudioFormat::Float)
      ->setFormatConversionAllowed(true)
      ->setUsage(Usage::VoiceCommunication)
      ->setContentType(ContentType::Speech)
      ->setPerformanceMode(PerformanceMode::LowLatency)`,
    marker: 'setUsage(Usage::VoiceCommunication)',
  },
];

export function patchAudioApi(projectRoot) {
  const libraryRoot = join(projectRoot, 'node_modules', 'react-native-audio-api');
  if (!existsSync(libraryRoot)) return;

  for (const edit of EDITS) {
    const path = join(libraryRoot, edit.file);
    if (!existsSync(path)) {
      throw new Error(`react-native-audio-api: ${edit.file} is missing; the echo-cancellation patch cannot be applied.`);
    }
    const source = readFileSync(path, 'utf8');
    if (source.includes(edit.marker)) continue;
    if (!source.includes(edit.find)) {
      throw new Error(
        `react-native-audio-api: the stream setup in ${edit.file} is not what the echo-cancellation patch expects. ` +
          'Re-check scripts/patch-audio-api.mjs against the installed version.',
      );
    }
    writeFileSync(path, source.replace(edit.find, edit.replace));
    console.log(`Patched ${edit.file} for voice-communication audio`);
  }
}
