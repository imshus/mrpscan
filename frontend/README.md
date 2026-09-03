# Pratham frontend

Expo Router application for Android and the web.

## Install and run

```powershell
npm install
npm start
```

The frontend reads `EXPO_PUBLIC_API_URL` and the other Expo public variables from `.env`.

## Production web build

```powershell
npm run build
```

This runs TypeScript validation and exports the static site to `dist/web`.

## Local Android APK

The local builder requires Java 21 and these Android SDK packages:

- Android SDK Platform 36
- Android SDK Build-Tools 36.0.0
- NDK (Side by side) 27.1.12297006

Install them from Android Studio's SDK Manager, or on Windows run the checked-in setup command
(it downloads Google's official command-line tools, verifies their checksum, and presents/accepts
the required Android SDK licenses):

```powershell
npm run setup:android
```

Then build the APK:

```powershell
npm run build:apk
```

The command synchronizes the generated Android project, builds the release variant, and copies a
versioned ARM64 APK and SHA-256 checksum to `dist/android`. ARM64 covers current physical Android
phones and avoids Windows' native-build path limit for legacy 32-bit targets. Override the target
when needed, for example `$env:REACT_NATIVE_ARCHITECTURES='arm64-v8a,x86_64'` before running the
build. When `credentials/upload.keystore` exists (git-ignored; keep it backed up), local APKs and
`npm run build:aab` bundles are both signed with that Play upload key, so a phone can update between
a sideloaded build and the Play build. Without it the APK falls back to Expo's debug keystore. The EAS
`production` profile is the alternative when that Expo account is available.
