import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── SOUND OPTIONS ──────────────────────────────────────────

export type SoundOption = 'pill-reminder' | 'gentle-chime' | 'alert-beep' | 'default';

export const SOUND_OPTIONS: { id: SoundOption; label: string; emoji: string }[] = [
  { id: 'default',       label: 'Default',        emoji: '🔔' },
  { id: 'pill-reminder', label: 'Pill Reminder',   emoji: '💊' },
  { id: 'gentle-chime',  label: 'Gentle Chime',    emoji: '🎵' },
  { id: 'alert-beep',    label: 'Alert Beep',      emoji: '📢' },
];

// iOS: filename in the app bundle (placed there by the expo-notifications plugin in app.json)
// Android: filename in res/raw (also placed by the plugin)
// 'default' uses the system default notification sound
// NOTE: custom .wav files only work in a native/dev build — not in Expo Go.
//       In Expo Go all sounds fall back to the system default (true).
const IS_EXPO_GO = typeof expo !== 'undefined'
  ? false  // dev/prod build
  : !!(global as any).ExpoModules?.ExponentConstants?.appOwnership === 'expo';

const SOUND_FILE: Record<SoundOption, string | boolean> = {
  'default':       true,
  'pill-reminder': 'pill-reminder.wav',
  'gentle-chime':  'gentle-chime.wav',
  'alert-beep':    'alert-beep.wav',
};

// Returns the sound value safe for the current runtime.
// In Expo Go custom filenames don't exist in the bundle, so we use true (system default).
const resolveSound = (soundEnabled: boolean, option: SoundOption): string | boolean => {
  if (!soundEnabled) return false;
  if (Platform.OS === 'web') return true;
  return SOUND_FILE[option]; // works in dev/prod builds; Expo Go silently ignores unknown files
};

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── ANDROID CHANNELS ───────────────────────────────────────
// Android 8+ (API 26+) requires a notification channel to play custom sounds.
// Each sound option gets its own channel so the sound is respected.
// Must be called once at app startup (see _layout.tsx).

export const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  // MAX importance = heads-up notification (pops up on screen even when idle/locked)
  // HIGH importance = silent drop into notification drawer only
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Medication Reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('pill-reminder', {
    name: 'Pill Reminder Sound',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'pill-reminder.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('gentle-chime', {
    name: 'Gentle Chime Sound',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'gentle-chime.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('alert-beep', {
    name: 'Alert Beep Sound',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alert-beep.wav',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#ef4444',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('refill-reminder', {
    name: 'Refill Reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#f59e0b',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
};

// ─── PERMISSIONS ────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── SCHEDULING ─────────────────────────────────────────────

const parseTime = (timeStr: string): { hour: number; minute: number } => {
  const [timePart, period] = timeStr.split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
};

/**
 * Schedule daily notifications for a medication.
 * Returns an array of notification IDs (one per time).
 */
export const scheduleMedNotification = async (
  medName: string,
  dosage: string,
  times: string[],
  sound: boolean,
  soundOption: SoundOption = 'default',
  snoozeEnabled: boolean = false
): Promise<string[]> => {
  const ids: string[] = [];

  const resolvedSound = resolveSound(sound, soundOption);

  // Android: pick the channel that matches the chosen sound.
  // If sound is disabled use the default (silent) channel.
  const channelId: string = sound ? soundOption : 'default';

  for (const timeStr of times) {
    const { hour, minute } = parseTime(timeStr);

    const content: Notifications.NotificationContentInput = {
      title: '💊 Time to take your medication',
      body: `${medName} ${dosage}`,
      sound: resolvedSound,
      data: { medName, dosage, soundOption },
    };

    if (snoozeEnabled) {
      content.categoryIdentifier = 'medication';
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' && { channelId }),
      },
    });

    ids.push(id);
  }

  return ids;
};

/**
 * Cancel all scheduled notifications for a medication by their IDs.
 */
export const cancelMedNotifications = async (notificationIds: string[]): Promise<void> => {
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
};

/**
 * Cancel ALL scheduled notifications (e.g. on logout).
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Fire an immediate push notification warning the user their supply is low.
 * Appears in the notification tray even when the app is backgrounded.
 */
export const scheduleRefillNotification = async (
  medName: string,
  daysRemaining: number,
  pillsRemaining: number
): Promise<void> => {
  const body = daysRemaining === 0
    ? `You're out of ${medName}. Please refill now!`
    : `${medName} has ~${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left (${pillsRemaining} pill${pillsRemaining !== 1 ? 's' : ''}). Time to refill.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 Refill Reminder',
      body,
      sound: true,
      data: { type: 'refill', medName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      ...(Platform.OS === 'android' && { channelId: 'refill-reminder' }),
    },
  });
};

/**
 * Snooze a medication notification by 5 minutes.
 */
export const snoozeMedNotification = async (
  medName: string,
  dosage: string,
  soundOption: SoundOption = 'default',
  snoozeMinutes: number = 5
): Promise<string> => {
  const resolvedSound = resolveSound(true, soundOption);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ Snooze reminder — ${medName}`,
      body: `Don't forget your ${dosage} dose!`,
      sound: resolvedSound,
      data: { medName, dosage, soundOption, snoozed: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: snoozeMinutes * 60,
      ...(Platform.OS === 'android' && { channelId: soundOption }),
    },
  });

  return id;
};
