import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'bikebinder-insurance-renewal';

// Allow notifications to appear even while BikeBinder is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const INSURANCE_REMINDER_OPTIONS = [30, 14, 7, 0];

// Interpret dates as local calendar days and use UTC midnight only for day counts,
// avoiding DST off-by-one errors.
export function parseInsuranceDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function insuranceDaysRemaining(iso, today = new Date()) {
  const parsed = parseInsuranceDate(iso);
  if (!parsed) return null;
  const dateUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dateUtc - todayUtc) / 86400000);
}

export function insuranceWarningText(iso, today = new Date()) {
  const days = insuranceDaysRemaining(iso, today);
  if (days === null) return null;
  if (days < 0) return 'Insurance expired ' + Math.abs(days) + ' day' + (days === -1 ? '' : 's') + ' ago';
  if (days === 0) return 'Insurance expires TODAY';
  if (days <= 30) return 'Insurance expires in ' + days + ' day' + (days === 1 ? '' : 's');
  return null;
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Insurance renewal reminders',
      importance: Notifications.AndroidImportance.HIGH,
      description: 'Reminders to renew motorcycle insurance before the date on your card',
    });
  }
}

export async function cancelInsuranceReminder(identifier) {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function scheduleInsuranceReminder(bike, expiryDate, leadDays) {
  if (!expiryDate || leadDays === 0) return { id: null, permissionGranted: true };
  const expiry = parseInsuranceDate(expiryDate);
  if (!expiry) throw new Error('Enter a valid expiration date in YYYY-MM-DD format.');
  const daysLeft = insuranceDaysRemaining(expiryDate);
  if (daysLeft < 0) return { id: null, permissionGranted: true };

  await ensureChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return { id: null, permissionGranted: false };

  const reminderAt = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate(), 9, 0, 0);
  reminderAt.setDate(reminderAt.getDate() - leadDays);
  if (reminderAt.getTime() <= Date.now()) {
    // The selected advance-warning date has already passed. Send a one-time
    // catch-up reminder soon instead of silently never notifying.
    reminderAt.setTime(Date.now() + 60 * 1000);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'BikeBinder: insurance renewal',
      body: (bike.make + ' ' + bike.model).trim() + ' insurance expires ' + expiryDate + '. Check your current digital insurance card.',
      data: { bikeId: bike.id, section: 'Insurance' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
      channelId: CHANNEL_ID,
    },
  });
  return { id, permissionGranted: true };
}
