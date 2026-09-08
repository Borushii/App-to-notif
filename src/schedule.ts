import type { Reminder } from './types';

export const MINUTES_PER_DAY = 24 * 60;

/** Index = `Date#getDay()` : 0 = dimanche. */
export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DAY_LONG = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];
/** Ordre d'affichage : la semaine française commence le lundi. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Intervalles proposés dans l'éditeur, en minutes. */
export const INTERVAL_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 12 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

export function clampToDay(minutes: number): number {
  const m = Math.round(minutes) % MINUTES_PER_DAY;
  return m < 0 ? m + MINUTES_PER_DAY : m;
}

/** `495` -> `"08:15"`. */
export function formatClock(minutes: number): string {
  const m = clampToDay(minutes);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** `90` -> `"1 h 30"`. */
export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${pad(rest)}`;
}

/**
 * Durée de la plage horaire. Une fin antérieure au début décrit une plage
 * de nuit (22:00 -> 06:00) ; une fin égale au début décrit 24 h.
 */
export function windowDurationMinutes(startMinutes: number, endMinutes: number): number {
  const start = clampToDay(startMinutes);
  const end = clampToDay(endMinutes);
  if (end > start) return end - start;
  if (end === start) return MINUTES_PER_DAY;
  return MINUTES_PER_DAY - start + end;
}

export function isOvernightWindow(startMinutes: number, endMinutes: number): boolean {
  return clampToDay(endMinutes) <= clampToDay(startMinutes);
}

/**
 * Heures de déclenchement (en minutes depuis minuit) d'un rappel sur une
 * journée : le début de la plage, puis un cran tous les `intervalMinutes`
 * jusqu'à la fin incluse.
 */
export function occurrenceMinutes(
  startMinutes: number,
  endMinutes: number,
  intervalMinutes: number
): number[] {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < MIN_INTERVAL_MINUTES) return [];
  const step = Math.round(intervalMinutes);
  const duration = windowDurationMinutes(startMinutes, endMinutes);
  const seen = new Set<number>();
  const slots: number[] = [];
  for (let offset = 0; offset <= duration; offset += step) {
    const at = clampToDay(startMinutes + offset);
    if (seen.has(at)) continue;
    seen.add(at);
    slots.push(at);
  }
  return slots;
}

/** Jours actifs, une liste vide valant « tous les jours ». */
export function activeDays(reminder: Pick<Reminder, 'days'>): number[] {
  const days = reminder.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const unique = Array.from(new Set(days));
  return unique.length ? unique.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

export function occurrencesPerDay(reminder: Reminder): number {
  return occurrenceMinutes(reminder.startMinutes, reminder.endMinutes, reminder.intervalMinutes)
    .length;
}

/**
 * Nombre de notifications système réservées par ce rappel. Sur 7 jours actifs
 * on planifie un déclencheur quotidien par créneau ; sinon un déclencheur
 * hebdomadaire par créneau et par jour.
 */
export function plannedSlotCount(reminder: Reminder): number {
  const perDay = occurrencesPerDay(reminder);
  const days = activeDays(reminder);
  return days.length >= 7 ? perDay : perDay * days.length;
}

export function totalPlannedSlots(reminders: Reminder[]): number {
  return reminders
    .filter((r) => r.enabled)
    .reduce((total, r) => total + plannedSlotCount(r), 0);
}

/** Prochaine sonnerie d'un rappel actif, ou `null` s'il n'y en a pas. */
export function nextOccurrence(reminder: Reminder, from: Date = new Date()): Date | null {
  if (!reminder.enabled) return null;
  const slots = occurrenceMinutes(
    reminder.startMinutes,
    reminder.endMinutes,
    reminder.intervalMinutes
  ).sort((a, b) => a - b);
  if (!slots.length) return null;

  const days = new Set(activeDays(reminder));
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const day = new Date(from);
    day.setDate(day.getDate() + dayOffset);
    if (!days.has(day.getDay())) continue;
    for (const slot of slots) {
      const at = new Date(day);
      at.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
      if (at.getTime() > from.getTime()) return at;
    }
  }
  return null;
}

export function formatNextOccurrence(at: Date, from: Date = new Date()): string {
  const clock = formatClock(at.getHours() * 60 + at.getMinutes());
  const minutes = Math.round((at.getTime() - from.getTime()) / 60_000);
  if (minutes <= 0) return 'maintenant';
  if (minutes < 60) return `dans ${minutes} min`;

  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (at.toDateString() === from.toDateString()) return `aujourd'hui à ${clock}`;
  if (at.toDateString() === tomorrow.toDateString()) return `demain à ${clock}`;
  return `${DAY_LONG[at.getDay()]} à ${clock}`;
}

export function describeDays(days: number[]): string {
  const active = activeDays({ days });
  if (active.length === 7) return 'Tous les jours';
  const key = active.join(',');
  if (key === '1,2,3,4,5') return 'En semaine';
  if (key === '0,6') return 'Le week-end';
  return DAY_ORDER.filter((d) => active.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(', ');
}

export function describeSchedule(reminder: Reminder): string {
  const window = `${formatClock(reminder.startMinutes)} – ${formatClock(reminder.endMinutes)}`;
  return `Toutes les ${formatInterval(reminder.intervalMinutes)} · ${window}`;
}

export function createReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nouveau rappel',
    body: '',
    intervalMinutes: 30,
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    days: [1, 2, 3, 4, 5],
    enabled: true,
    createdAt: Date.now(),
    ...overrides,
  };
}
