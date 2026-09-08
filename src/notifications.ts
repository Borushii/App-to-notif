import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { activeDays, formatInterval, occurrenceMinutes } from './schedule';
import type { PermissionState, Reminder } from './types';

export const ANDROID_CHANNEL_ID = 'reminders';

/**
 * iOS ne garde que 64 notifications planifiées par application et supprime
 * silencieusement les suivantes. On garde une marge sous cette limite.
 */
export const IOS_PENDING_LIMIT = 64;
export const SLOT_BUDGET = 60;
/** Un seul rappel ne peut pas monopoliser tout le budget. */
export const MAX_SLOTS_PER_REMINDER = 48;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Rappels',
    description: 'Notifications récurrentes programmées dans l’application.',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestPermissions(): Promise<PermissionState> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return current.status as PermissionState;

  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return asked.status as PermissionState;
}

function contentFor(reminder: Reminder): Notifications.NotificationContentInput {
  return {
    title: reminder.title.trim() || 'Rappel',
    body:
      reminder.body.trim() ||
      `Rappel toutes les ${formatInterval(reminder.intervalMinutes)}.`,
    sound: 'default',
    data: { reminderId: reminder.id },
  };
}

async function cancelForReminder(reminderId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { reminderId?: string } | undefined)?.reminderId === reminderId)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Replanifie un rappel : un déclencheur système par créneau de la plage
 * horaire. Sur 7 jours actifs on utilise un déclencheur quotidien, sinon un
 * déclencheur hebdomadaire par jour sélectionné.
 *
 * Renvoie le nombre de notifications réellement planifiées.
 */
export async function syncReminder(reminder: Reminder): Promise<number> {
  await cancelForReminder(reminder.id);
  if (!reminder.enabled) return 0;

  const slots = occurrenceMinutes(
    reminder.startMinutes,
    reminder.endMinutes,
    reminder.intervalMinutes
  );
  if (!slots.length) return 0;

  const days = activeDays(reminder);
  const everyDay = days.length >= 7;
  const content = contentFor(reminder);
  let scheduled = 0;

  for (const slot of slots) {
    const hour = Math.floor(slot / 60);
    const minute = slot % 60;

    if (everyDay) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: ANDROID_CHANNEL_ID,
          hour,
          minute,
        },
      });
      scheduled += 1;
      continue;
    }

    for (const day of days) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: ANDROID_CHANNEL_ID,
          // `weekday` va de 1 (dimanche) à 7, là où `Date#getDay()` part de 0.
          weekday: day + 1,
          hour,
          minute,
        },
      });
      scheduled += 1;
    }
  }

  return scheduled;
}

/**
 * Les appels sont sérialisés : deux enregistrements rapprochés ne doivent pas
 * annuler et replanifier la même file en parallèle.
 */
let syncQueue: Promise<unknown> = Promise.resolve();

/** Remet la file système en accord avec la liste de rappels enregistrée. */
export function syncAllReminders(reminders: Reminder[]): Promise<number> {
  const next = syncQueue.then(
    () => runSync(reminders),
    () => runSync(reminders)
  );
  syncQueue = next.catch(() => undefined);
  return next;
}

async function runSync(reminders: Reminder[]): Promise<number> {
  await ensureAndroidChannel();

  const knownIds = new Set(reminders.map((r) => r.id));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => {
        const id = (n.content.data as { reminderId?: string } | undefined)?.reminderId;
        return !id || !knownIds.has(id);
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );

  let total = 0;
  for (const reminder of reminders) {
    total += await syncReminder(reminder);
  }
  return total;
}

export async function cancelReminder(reminderId: string): Promise<void> {
  await cancelForReminder(reminderId);
}

export async function countScheduled(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** Notification de contrôle, pour vérifier que tout est bien autorisé. */
export async function sendTestNotification(): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test de notification',
      body: 'Si vous voyez ceci, les rappels fonctionneront.',
      sound: 'default',
      data: { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      channelId: ANDROID_CHANNEL_ID,
      seconds: 5,
      repeats: false,
    },
  });
}
