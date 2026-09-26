// app.json holds the app's configuration; this only lets a build choose the
// Android package. The Play Store bundle is com.mrpscan (build-aab.mjs sets
// ANDROID_PACKAGE); the test APKs installed on the shop's phone keep the
// package in app.json, so a store build never replaces them.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE || config.android.package,
  },
});
