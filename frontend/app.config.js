// app.json holds the app's configuration; this only lets a build choose the
// Android package through ANDROID_PACKAGE. The Play Store bundle is
// com.amitaashitsolutions (build-aab.mjs, and the EAS production profile in
// eas.json); the test APKs keep app.json's com.amitaashitsolution, so a Play
// install and a sideloaded test APK are separate apps.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE || config.android.package,
  },
});
