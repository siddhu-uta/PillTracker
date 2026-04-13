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

// Maps sound IDs to the filename used by expo-notifications
// On iOS/Android the file must be in the app bundle; on web sound: true uses browser default
const SOUND_FILE: Record<SoundOption, string | boolean> = {
  'default':       true,
  'pill-reminder': 'pill-reminder.wav',
  'gentle-chime':  'gentle-chime.wav',
  'alert-beep':    'alert-beep.wav',
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

// ─── PERMISSIONS ────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    // Web notifications use the browser Notification API
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

// Parse a time string like "8:00 AM" or "8:00 PM" into { hour, minute }
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

  // On web, expo-notifications doesn't support custom sound files
  const resolvedSound: string | boolean =
    Platform.OS === 'web' ? sound : (sound ? SOUND_FILE[soundOption] : false);

  for (const timeStr of times) {
    const { hour, minute } = parseTime(timeStr);

    const content: Notifications.NotificationContentInput = {
      title: '💊 Time to take your medication',
      body: `${medName} ${dosage}`,
      sound: resolvedSound,
      data: { medName, dosage, soundOption },
    };

    // Only attach category (snooze button) if snooze is enabled
    if (snoozeEnabled) {
      content.categoryIdentifier = 'medication';
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
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
 * Snooze a medication notification by 5 minutes.
 * Schedules a one-time notification 5 minutes from now.
 * Returns the new notification ID.
 */
export const snoozeMedNotification = async (
  medName: string,
  dosage: string,
  soundOption: SoundOption = 'default',
  snoozeMinutes: number = 5
): Promise<string> => {
  const resolvedSound: string | boolean =
    Platform.OS === 'web' ? true : SOUND_FILE[soundOption];

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
    },
  });

  return id;
};
