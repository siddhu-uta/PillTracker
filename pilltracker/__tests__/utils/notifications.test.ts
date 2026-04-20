import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleMedNotification,
  cancelMedNotifications,
  cancelAllNotifications,
  snoozeMedNotification,
  scheduleRefillNotification,
  SOUND_OPTIONS,
} from '../../utils/notifications';

const mockGetPermissions  = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPerms    = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule        = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel          = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockCancelAll       = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// ─── SOUND_OPTIONS ─────────────────────────────────────────────────────────

describe('SOUND_OPTIONS', () => {
  it('has 4 options', () => {
    expect(SOUND_OPTIONS).toHaveLength(4);
  });

  it('always includes a default option', () => {
    expect(SOUND_OPTIONS.find(o => o.id === 'default')).toBeDefined();
  });

  it('each option has id, label, and emoji', () => {
    SOUND_OPTIONS.forEach(opt => {
      expect(opt.id).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.emoji).toBeTruthy();
    });
  });
});

// ─── requestNotificationPermissions ────────────────────────────────────────

describe('requestNotificationPermissions', () => {
  it('returns true when permission is already granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });
    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(mockRequestPerms).not.toHaveBeenCalled();
  });

  it('requests permission when not already granted and returns true on grant', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPerms.mockResolvedValueOnce({ status: 'granted' });
    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(mockRequestPerms).toHaveBeenCalledTimes(1);
  });

  it('returns false when permission is denied', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPerms.mockResolvedValueOnce({ status: 'denied' });
    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });
});

// ─── scheduleMedNotification ─────────────────────────────────────────────────

describe('scheduleMedNotification', () => {
  it('schedules one notification per time slot', async () => {
    mockSchedule.mockResolvedValue('notif-id');
    const ids = await scheduleMedNotification('Aspirin', '100mg', ['8:00 AM', '8:00 PM'], true, 'default', false);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(ids).toHaveLength(2);
  });

  it('schedules a single notification for one time slot', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');
    const ids = await scheduleMedNotification('Metformin', '500mg', ['9:00 AM'], true, 'default', false);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(ids).toEqual(['notif-id-1']);
  });

  it('returns empty array for empty times array', async () => {
    const ids = await scheduleMedNotification('Aspirin', '100mg', [], true, 'default', false);
    expect(ids).toHaveLength(0);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('attaches snooze category when snoozeEnabled is true', async () => {
    mockSchedule.mockResolvedValue('snooze-id');
    await scheduleMedNotification('Aspirin', '100mg', ['8:00 AM'], true, 'default', true);
    const callArgs = mockSchedule.mock.calls[0][0];
    expect(callArgs.content.categoryIdentifier).toBe('medication');
  });

  it('does not attach category when snoozeEnabled is false', async () => {
    mockSchedule.mockResolvedValue('no-snooze-id');
    await scheduleMedNotification('Aspirin', '100mg', ['8:00 AM'], true, 'default', false);
    const callArgs = mockSchedule.mock.calls[0][0];
    expect(callArgs.content.categoryIdentifier).toBeUndefined();
  });

  it('includes med name and dosage in notification body', async () => {
    mockSchedule.mockResolvedValue('body-id');
    await scheduleMedNotification('Warfarin', '5mg', ['10:00 AM'], true, 'default', false);
    const callArgs = mockSchedule.mock.calls[0][0];
    expect(callArgs.content.body).toContain('Warfarin');
    expect(callArgs.content.body).toContain('5mg');
  });
});

// ─── cancelMedNotifications ──────────────────────────────────────────────────

describe('cancelMedNotifications', () => {
  it('cancels each notification by ID', async () => {
    await cancelMedNotifications(['id-1', 'id-2', 'id-3']);
    expect(mockCancel).toHaveBeenCalledTimes(3);
    expect(mockCancel).toHaveBeenCalledWith('id-1');
    expect(mockCancel).toHaveBeenCalledWith('id-2');
    expect(mockCancel).toHaveBeenCalledWith('id-3');
  });

  it('does nothing for empty array', async () => {
    await cancelMedNotifications([]);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

// ─── cancelAllNotifications ──────────────────────────────────────────────────

describe('cancelAllNotifications', () => {
  it('calls cancelAllScheduledNotificationsAsync', async () => {
    await cancelAllNotifications();
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });
});

// ─── scheduleRefillNotification ─────────────────────────────────────────────

describe('scheduleRefillNotification', () => {
  it('schedules a notification and includes med name in body', async () => {
    mockSchedule.mockResolvedValue('refill-id');
    await scheduleRefillNotification('Aspirin', 3, 9);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const { title, body } = mockSchedule.mock.calls[0][0].content;
    expect(title).toContain('Refill');
    expect(body).toContain('Aspirin');
    expect(body).toContain('3');
  });

  it('uses out-of-pills message when daysRemaining is 0', async () => {
    mockSchedule.mockResolvedValue('out-id');
    await scheduleRefillNotification('Metformin', 0, 0);
    const body = mockSchedule.mock.calls[0][0].content.body;
    expect(body).toMatch(/out of/i);
  });

  it('fires after 2 seconds', async () => {
    mockSchedule.mockResolvedValue('timer-id');
    await scheduleRefillNotification('Lisinopril', 5, 15);
    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.seconds).toBe(2);
  });
});

// ─── snoozeMedNotification ───────────────────────────────────────────────────

describe('snoozeMedNotification', () => {
  it('schedules a time-interval notification', async () => {
    mockSchedule.mockResolvedValue('snooze-notif-id');
    const id = await snoozeMedNotification('Aspirin', '100mg', 'default', 5);
    expect(id).toBe('snooze-notif-id');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.seconds).toBe(300); // 5 * 60
  });

  it('marks the notification as snoozed in data', async () => {
    mockSchedule.mockResolvedValue('s-id');
    await snoozeMedNotification('Metformin', '500mg', 'default', 5);
    const data = mockSchedule.mock.calls[0][0].content.data;
    expect(data.snoozed).toBe(true);
  });

  it('includes the med name in the notification title', async () => {
    mockSchedule.mockResolvedValue('s-id');
    await snoozeMedNotification('Lisinopril', '10mg', 'default', 5);
    const title = mockSchedule.mock.calls[0][0].content.title;
    expect(title).toContain('Lisinopril');
  });
});
