import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { checkAppStoreUpdate } from '@/utils/appStore';
import { notifyUpdateAvailable } from '@/utils/localNotifications';
import { checkPlayUpdate } from '@/utils/playStore';

/**
 * "New version available" even while MRPscan is closed (owner, 25 Nov 2026).
 * The phone wakes the app now and then (every six hours at the soonest; the
 * system picks the moment, iOS often overnight), asks the App Store or Google
 * Play whether a newer version is out, and posts the same once-per-version
 * notification the in-app popup sends. No push server is involved.
 *
 * The task is defined when this file loads, so app/_layout.tsx imports it at
 * the top: a background launch must find the task before anything else runs.
 */
const UPDATE_TASK = 'mrpscan-update-check';
const EVERY_MINUTES = 6 * 60;

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(UPDATE_TASK, async () => {
      try {
        // Never ask for permission from the background; only post when given.
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) return BackgroundTask.BackgroundTaskResult.Success;
        const found = Platform.OS === 'ios' ? await checkAppStoreUpdate() : await checkPlayUpdate();
        if (found) await notifyUpdateAvailable(found.storeVersion);
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch (error) {
    console.warn('Update check task unavailable:', error);
  }
}

/** Asks the phone to run the check from now on; once is enough, it repeats. */
export async function registerUpdateBackgroundCheck(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(UPDATE_TASK)) return;
    await BackgroundTask.registerTaskAsync(UPDATE_TASK, { minimumInterval: EVERY_MINUTES });
  } catch (error) {
    console.warn('Could not schedule the update check:', error);
  }
}
