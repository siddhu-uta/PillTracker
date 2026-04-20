/**
 * Integration: Notifications + Medications data layer
 *
 * Tests that scheduling, cancelling, and snoozing notifications
 * interact correctly with the medications data layer — verifying
 * the full flow from medication data → notification scheduling.
 */
import * as Notifications from 'expo-notifications';
import {
  scheduleMedNotification,
  cancelMedNotifications,
  cancelAllNotifications,
  snoozeMedNotification,
  requestNotificationPermissions,
} from '../../utils/notifications';

// Notification mocks are set up globally in jest.setup.js
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel   = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockCancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
const mockRequest  = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetPerms = Notifications.getPermissionsAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('Notifications Integration — Permission + scheduling', () => {
  it('requests permission and returns granted status', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequest.mockResolvedValueOnce({ status: 'granted' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('returns false when permission is denied', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequest.mockResolvedValueOnce({ status: 'denied' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });

  it('skips request prompt when already granted', async () => {
    mockGetPerms.mockResolvedValueOnce({ status: 'granted' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Notifications Integration — Schedule for medication', () => {
  // scheduleMedNotification(medName, dosage, times, sound, soundOption, snoozeEnabled)
  it('schedules one notification per dose time', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');

    const ids = await scheduleMedNotification('Aspirin', '100mg', ['8:00 AM', '8:00 PM'], false);

    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(ids).toHaveLength(2);
  });

  it('notification content includes medication name and dosage', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');

    await scheduleMedNotification('Aspirin', '100mg', ['8:00 AM'], false);

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.body).toMatch(/Aspirin/);
    expect(call.content.body).toMatch(/100mg/);
  });

  it('schedules at the correct hour and minute for AM time', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');

    await scheduleMedNotification('Aspirin', '100mg', ['9:30 AM'], false);

    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.hour).toBe(9);
    expect(trigger.minute).toBe(30);
  });

  it('converts PM times correctly (e.g. 8:00 PM → hour 20)', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');

    await scheduleMedNotification('Aspirin', '100mg', ['8:00 PM'], false);

    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.hour).toBe(20);
    expect(trigger.minute).toBe(0);
  });

  it('12:00 PM maps to hour 12 (noon)', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');
    await scheduleMedNotification('Aspirin', '100mg', ['12:00 PM'], false);
    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.hour).toBe(12);
  });

  it('12:00 AM maps to hour 0 (midnight)', async () => {
    mockSchedule.mockResolvedValue('notif-id-1');
    await scheduleMedNotification('Aspirin', '100mg', ['12:00 AM'], false);
    const trigger = mockSchedule.mock.calls[0][0].trigger;
    expect(trigger.hour).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Notifications Integration — Cancel and snooze', () => {
  it('cancels all notification IDs for a medication', async () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    await cancelMedNotifications(ids);

    expect(mockCancel).toHaveBeenCalledTimes(3);
    ids.forEach(id => {
      expect(mockCancel).toHaveBeenCalledWith(id);
    });
  });

  it('cancels nothing when notification list is empty', async () => {
    await cancelMedNotifications([]);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancelAllNotifications calls cancelAllScheduledNotificationsAsync', async () => {
    await cancelAllNotifications();
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });

  it('snooze schedules a new notification 5 minutes from now', async () => {
    mockSchedule.mockResolvedValueOnce('snooze-id');

    const newId = await snoozeMedNotification('Aspirin', '100mg');

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const trigger = mockSchedule.mock.calls[0][0].trigger;
    // Snooze uses TIME_INTERVAL trigger with seconds
    expect(trigger.seconds).toBe(300);
    expect(newId).toBe('snooze-id');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Notifications Integration — Multiple medications', () => {
  it('schedules notifications for multiple medications independently', async () => {
    mockSchedule.mockResolvedValue('some-id');

    await scheduleMedNotification('Aspirin',    '100mg', ['8:00 AM'],            false);
    await scheduleMedNotification('Metformin',  '500mg', ['8:00 AM', '8:00 PM'], false);
    await scheduleMedNotification('Lisinopril', '10mg',  ['9:00 AM'],            false);

    // 1 + 2 + 1 = 4 total notifications scheduled
    expect(mockSchedule).toHaveBeenCalledTimes(4);
  });
});
