import AsyncStorage from '@react-native-async-storage/async-storage';

import { clampToDay, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from './schedule';
import type { Reminder } from './types';

const STORAGE_KEY = 'app-to-notif/reminders/v1';

function normalize(raw: unknown): Reminder | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id) return null;

  const interval = Number(value.intervalMinutes);
  if (!Number.isFinite(interval)) return null;

  const days = Array.isArray(value.days)
    ? Array.from(
        new Set(
          value.days
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        )
      ).sort((a, b) => a - b)
    : [];

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : 'Rappel',
    body: typeof value.body === 'string' ? value.body : '',
    intervalMinutes: Math.min(
      MAX_INTERVAL_MINUTES,
      Math.max(MIN_INTERVAL_MINUTES, Math.round(interval))
    ),
    startMinutes: clampToDay(Number(value.startMinutes) || 0),
    endMinutes: clampToDay(Number(value.endMinutes) || 0),
    days,
    enabled: value.enabled !== false,
    createdAt: Number(value.createdAt) || Date.now(),
  };
}

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((r): r is Reminder => r !== null)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}
