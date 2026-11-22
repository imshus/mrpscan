import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The app's own notifications, scheduled on the phone (no push server):
 *
 *  - a reminder about MRPscan every 12 hours, each picked at random from the
 *    ten below, never the same one twice in a row (the shop's ask);
 *  - "New version available" beside the in-app update popup, once per new
 *    version.
 *
 * The words name what the app does and never a price, a purchase or a
 * store: the iPhone app sells nothing (utils/platformCommerce.ts).
 */
const TIP_MESSAGES: { title: string; body: string }[] = [
  { title: 'Scan a tag in seconds', body: 'Point MRPscan at any jewellery tag and get the MRP instantly.' },
  { title: 'Live gold rates', body: 'Check today’s 24K, RTGS and Retail rates from your bullion house on MRPscan.' },
  { title: 'Invoice in one tap', body: 'Turn a scanned piece into a GST invoice for your customer straight from MRPscan.' },
  { title: 'Your labour and wastage, applied', body: 'MRPscan prices every piece with your own labour and wastage codes.' },
  { title: 'Both sides of the tag', body: 'Scan the front and the back of a tag together for the most accurate MRP.' },
  { title: 'Ask the 24/7 assistant', body: 'Stuck on something? Tap 24/7 in MRPscan and ask the voice assistant.' },
  { title: 'Several pieces, one invoice', body: 'Add pieces to the cart in MRPscan and bill them on a single invoice.' },
  { title: 'Every scan saved', body: 'Find any earlier scan and its details in History on MRPscan.' },
  { title: 'Your whole team', body: 'Add your staff in MRPscan’s Employee Manager so everyone scans for the shop.' },
  { title: 'Upload from the gallery', body: 'Have a photo of a tag? Upload it in MRPscan and get the MRP the same way.' },
];

const TIP_INTERVAL_SECONDS = 12 * 60 * 60;
/** Two weeks ahead; each app open schedules them again from then. */
const TIPS_AHEAD = 28;
const TIP_ID_PREFIX = 'mrpscan-tip-';
const UPDATE_NOTIFIED_KEY = 'mrpscan-update-notified-version';

let initialised: Promise<boolean> | null = null;

/** Show notifications while the app is open too, and ask for permission once. */
function ensureReady(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  if (!initialised) {
    initialised = (async () => {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'MRPscan',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        return (await Notifications.requestPermissionsAsync()).granted;
      } catch (error) {
        console.warn('Notifications unavailable:', error);
        return false;
      }
    })();
  }
  return initialised;
}

/** The ten in a random order, with no message twice in a row across the whole run. */
function pickTips(count: number): { title: string; body: string }[] {
  const picked: { title: string; body: string }[] = [];
  let last = -1;
  for (let i = 0; i < count; i += 1) {
    let index = Math.floor(Math.random() * TIP_MESSAGES.length);
    if (index === last) index = (index + 1) % TIP_MESSAGES.length;
    picked.push(TIP_MESSAGES[index]);
    last = index;
  }
  return picked;
}

/**
 * (Re)schedules the 12-hourly MRPscan reminders from now: the earlier batch
 * is cancelled first, so opening the app never stacks two sets.
 */
export async function scheduleTipReminders(): Promise<void> {
  if (!(await ensureReady())) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(TIP_ID_PREFIX))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    const tips = pickTips(TIPS_AHEAD);
    for (let i = 0; i < tips.length; i += 1) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${TIP_ID_PREFIX}${i}`,
        content: { title: tips[i].title, body: tips[i].body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: TIP_INTERVAL_SECONDS * (i + 1),
          repeats: false,
        },
      });
    }
  } catch (error) {
    console.warn('Could not schedule MRPscan reminders:', error);
  }
}

/** "New version available" as a notification too, once for each new version. */
export async function notifyUpdateAvailable(storeVersion: string): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(UPDATE_NOTIFIED_KEY)) === storeVersion) return;
    if (!(await ensureReady())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New version available',
        body: 'A new version of MRPscan is ready. Update now to get the latest features and fixes.',
      },
      trigger: null,
    });
    await AsyncStorage.setItem(UPDATE_NOTIFIED_KEY, storeVersion);
  } catch (error) {
    console.warn('Could not show the update notification:', error);
  }
}
