import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ReduxProvider } from '@/components/ReduxProvider';
import { AnimatedSplash } from '@/components/splash/AnimatedSplash';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePurityStore } from '@/store/purityStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { resetIfNewBuild } from '@/utils/appBuildReset';

export { ErrorBoundary } from 'expo-router';

const NON_FATAL_KEEP_AWAKE_MESSAGE = 'Unable to activate keep awake';

function isNonFatalKeepAwakeError(reason: unknown): boolean {
  try {
    const msg =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : String(reason);
    return msg.includes(NON_FATAL_KEEP_AWAKE_MESSAGE);
  } catch {
    return false;
  }
}

function installKeepAwakeErrorSuppressor() {
  const globalState = globalThis as typeof globalThis & {
    __keepAwakeErrorSuppressorInstalled?: boolean;
    onunhandledrejection?: ((event: { reason?: unknown; preventDefault?: () => void }) => void) | null;
  };

  if (globalState.__keepAwakeErrorSuppressorInstalled) {
    return;
  }

  globalState.__keepAwakeErrorSuppressorInstalled = true;
  LogBox.ignoreLogs([NON_FATAL_KEEP_AWAKE_MESSAGE]);

  const originalConsoleError = console.error;
  console.error = (...args: Parameters<typeof console.error>) => {
    if (args.some(isNonFatalKeepAwakeError)) {
      return;
    }
    originalConsoleError(...args);
  };

  const previousUnhandledRejection = globalState.onunhandledrejection;
  globalState.onunhandledrejection = (event) => {
    if (isNonFatalKeepAwakeError(event?.reason)) {
      event?.preventDefault?.();
      return;
    }
    previousUnhandledRejection?.(event);
  };
}

installKeepAwakeErrorSuppressor();

SplashScreen.preventAutoHideAsync();

// The mockup's layout metrics assume unscaled type — cap OS font scaling so
// tiles and cards keep the design proportions on every device.
interface TextWithDefaults {
  defaultProps?: { maxFontSizeMultiplier?: number };
}
(Text as unknown as TextWithDefaults).defaultProps = {
  ...(Text as unknown as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.1,
};
(TextInput as unknown as TextWithDefaults).defaultProps = {
  ...(TextInput as unknown as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.1,
};

// Auth routing deliberately lives in the route layouts (app/index.tsx,
// dashboard/_layout.tsx, login|register/_layout.tsx) as declarative
// <Redirect> elements. Driving it imperatively from here raced the
// navigator's mount and threw "Attempted to navigate before mounting the
// Root Layout component" on cold start.

export default function RootLayout() {
  // SpaceMono is only referenced by unused template components, so the app
  // renders immediately and lets the font finish loading in the background —
  // blocking the first frame on it only prolonged the native splash.
  const [, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Scan-reveal opening (ported from design-mockup): the splash overlay plays
  // above the app, then the content slides up into view as the splash fades.
  const [splashVisible, setSplashVisible] = useState(true);
  const contentIn = useSharedValue(0);

  // No screen may read a persisted store until the build check has run — a new
  // APK must start with the previous install's cached data already gone.
  const [storageReady, setStorageReady] = useState(false);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentIn.value,
    transform: [{ translateY: (1 - contentIn.value) * 28 }],
  }));

  const revealContent = () => {
    contentIn.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.16, 0.84, 0.44, 1),
    });
  };

  // Globally catch unhandled promise rejections so the app doesn't crash
  // on known non-fatal platform/module errors (e.g. "Unable to activate keep awake").
  useEffect(() => {
    const nodeHandler = (reason: any) => {
      if (isNonFatalKeepAwakeError(reason)) return;
      // eslint-disable-next-line no-console
      console.warn('Unhandled promise rejection:', reason);
    };

    // Node/react-native style
    try {
      // @ts-ignore - process may not exist in some environments
      if (typeof process !== 'undefined' && process && typeof process.on === 'function') {
        // @ts-ignore
        process.on('unhandledRejection', nodeHandler);
      }
    } catch (e) {
      // ignore
    }

    // Browser/web style
    const browserHandler = (event: any) => {
      const reason = event?.reason ?? event;
      if (isNonFatalKeepAwakeError(reason)) {
        event?.preventDefault?.();
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('Unhandled promise rejection (window):', reason);
    };

    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        // @ts-ignore
        window.addEventListener('unhandledrejection', browserHandler);
      }
    } catch {
      // ignore
    }

    return () => {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process && typeof process.off === 'function') {
          // @ts-ignore
          process.off('unhandledRejection', nodeHandler);
        }
      } catch {
        // ignore
      }

      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          // @ts-ignore
          window.removeEventListener('unhandledrejection', browserHandler);
        }
      } catch {
        // ignore
      }
    };
  }, []);

  // Installing a new APK keeps the old install's AsyncStorage, so every
  // persisted store is wiped here before the navigator mounts.
  //
  // Clearing storage alone is not enough: zustand's persist middleware starts
  // hydrating each store as soon as its module is imported, so a store can
  // already hold the previous build's data in memory by the time this runs.
  // Every store is therefore rehydrated *after* the wipe — with the keys gone,
  // rehydrate() resets each one to its code defaults (empty inventory, empty
  // employees, empty wishlist, signed out, standard purities). The navigator
  // stays unmounted until this finishes, so no screen can read a store
  // mid-wipe.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const wiped = await resetIfNewBuild();
        if (wiped) {
          // Deleting the storage keys is not enough: every store hydrated at
          // import time, and zustand's merge is {...current, ...persisted}, so
          // rehydrating against an absent key keeps the state already in
          // memory. Each store is reset to its own initial state instead.
          useAuthStore.setState(useAuthStore.getInitialState(), true);
          useEmployeeStore.setState(useEmployeeStore.getInitialState(), true);
          useInventoryStore.setState(useInventoryStore.getInitialState(), true);
          usePurityStore.setState(usePurityStore.getInitialState(), true);
          useWishlistStore.setState(useWishlistStore.getInitialState(), true);
          await Promise.all([
            useAuthStore.persist.rehydrate(),
            useEmployeeStore.persist.rehydrate(),
            useInventoryStore.persist.rehydrate(),
            usePurityStore.persist.rehydrate(),
            useWishlistStore.persist.rehydrate(),
          ]);
        }
      } catch (error) {
        // Startup must never be blocked by a storage failure.
        console.warn('Build reset failed:', error);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontError) {
      // A missing optional font must never block or crash startup.
      console.warn('Font load failed:', fontError);
    }
  }, [fontError]);

  // Hand off from the native splash to the JS scan-reveal overlay on the very
  // first frame — the AnimatedSplash renders the same cream immediately, so
  // there is no gap.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ReduxProvider>
      <StatusBar style="dark" />
      <View style={styles.appRoot}>
        {storageReady && (
          <Animated.View style={[styles.appRoot, contentStyle]}>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="register" />
              <Stack.Screen name="login" />
              <Stack.Screen name="dashboard" />
            </Stack>
          </Animated.View>
        )}
        {splashVisible && (
          <AnimatedSplash onReveal={revealContent} onFinish={() => setSplashVisible(false)} />
        )}
      </View>
    </ReduxProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    // Painted here too, so the moment before the navigator mounts (while the
    // build check runs) shows the splash's cream, never a white flash.
    backgroundColor: Colors.background,
  },
});
