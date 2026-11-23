const { withAndroidManifest } = require('expo/config-plugins');

// Play infers required hardware from the manifest: android.hardware.wifi from
// ACCESS_WIFI_STATE (expo-network) and android.hardware.screen.portrait from
// the portrait-locked activity. Inferred features count as required and block
// installs on devices without them (Play Console, Nov 2026), so they are
// declared here as optional. The app works on mobile data and the portrait
// lock is a layout choice, not a hardware need.
const OPTIONAL_FEATURES = ['android.hardware.wifi', 'android.hardware.screen.portrait'];

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((item) => item.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return mod;
  });
};
