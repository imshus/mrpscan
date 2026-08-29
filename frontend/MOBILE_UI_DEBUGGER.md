# Mobile UI Debugger

This is a fully local Android UI-development loop. It does not call an AI API or any cloud debugging service.

The custom debug APK loads JavaScript from the local Metro server. Once it is installed, React Native Fast Refresh applies source edits directly on the connected phone without rebuilding the APK for every spacing, color, typography, or icon change. It includes this app's native camera, payment, and SMS modules, so Expo Go is not used.

## First-time setup

1. Enable **Developer options → USB debugging** on the Android phone.
2. Connect the phone by USB and accept the debugging authorization prompt.
3. Check the connection:

   ```powershell
   npm run ui:debug:doctor
   ```

4. Build and install the reusable debugger APK:

   ```powershell
   npm run ui:debug:build
   npm run ui:debug:install
   ```

5. Start the live UI session and keep its terminal open:

   ```powershell
   npm run ui:debug:start
   ```

Metro runs on localhost port `8081`, and the script creates the required ADB reverse connection automatically. Saving a React Native source file triggers Fast Refresh on the phone.

## Inspect-and-correct loop

Capture the current phone screen and the app's recent local logs together:

```powershell
npm run ui:debug:inspect
```

The inspection bundle is written under `dist/ui-debug/screenshots/` and `dist/ui-debug/logs/`. The screen can then be inspected locally, followed by a source edit. The connected app refreshes automatically.

To capture only the current phone screen:

```powershell
npm run ui:debug:screenshot
```

To capture only the recent app logs:

```powershell
npm run ui:debug:logs
```

If Fast Refresh does not pick up a change, relaunch the app while keeping Metro running:

```powershell
npm run ui:debug:reload
```

## Multiple connected devices

Pass the ADB serial directly to the script:

```powershell
node scripts/mobile-ui-debugger.mjs start --serial DEVICE_ID
node scripts/mobile-ui-debugger.mjs screenshot --serial DEVICE_ID
```

## Output

- Debugger APK: `dist/ui-debug/pratham-ui-debugger-arm64-v8a.apk`
- APK checksum: `dist/ui-debug/pratham-ui-debugger-arm64-v8a.apk.sha256`
- Device screenshots: `dist/ui-debug/screenshots/`
- Device logs: `dist/ui-debug/logs/`

The debugger APK is an ARM64 development build and requires Metro to be running. UI source edits are loaded through Fast Refresh; Android does not binary-patch an APK for each layout edit. Run `npm run build:apk` and install the normal release APK after the design is finalized for standalone use.
