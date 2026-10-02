// app.json holds the app's configuration; this only lets a build choose the
// Android package through ANDROID_PACKAGE. The Play Store bundle and the test
// APKs both use app.json's com.amitaashitsolution since 3 Oct 2026, so a Play
// install and a sideloaded test APK are the same app: signed with different
// keys, one has to be uninstalled before the other installs.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE || config.android.package,
  },
});
