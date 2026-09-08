import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeDays,
  describeDays,
  formatClock,
  formatInterval,
  nextOccurrence,
  occurrenceMinutes,
  plannedSlotCount,
  windowDurationMinutes,
} from '../src/schedule.ts';
import type { Reminder } from '../src/types.ts';

const base: Reminder = {
  id: 'test',
  title: 'Boire de l’eau',
  body: '',
  intervalMinutes: 30,
  startMinutes: 8 * 60,
  endMinutes: 20 * 60,
  days: [0, 1, 2, 3, 4, 5, 6],
  enabled: true,
  createdAt: 0,
};

test('formatClock rend une heure sur 24 h', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(8 * 60 + 5), '08:05');
  assert.equal(formatClock(23 * 60 + 59), '23:59');
  assert.equal(formatClock(24 * 60 + 30), '00:30');
  assert.equal(formatClock(-30), '23:30');
});

test('formatInterval passe en heures au-delà de 60 min', () => {
  assert.equal(formatInterval(30), '30 min');
  assert.equal(formatInterval(60), '1 h');
  assert.equal(formatInterval(90), '1 h 30');
  assert.equal(formatInterval(125), '2 h 05');
});

test('windowDurationMinutes gère les plages de jour, de nuit et de 24 h', () => {
  assert.equal(windowDurationMinutes(8 * 60, 20 * 60), 12 * 60);
  assert.equal(windowDurationMinutes(22 * 60, 6 * 60), 8 * 60);
  assert.equal(windowDurationMinutes(9 * 60, 9 * 60), 24 * 60);
});

test('occurrenceMinutes couvre la plage, bornes incluses', () => {
  const slots = occurrenceMinutes(8 * 60, 10 * 60, 30);
  assert.deepEqual(slots.map(formatClock), ['08:00', '08:30', '09:00', '09:30', '10:00']);
});

test('occurrenceMinutes passe minuit sur une plage de nuit', () => {
  const slots = occurrenceMinutes(23 * 60, 60, 30);
  assert.deepEqual(slots.map(formatClock), ['23:00', '23:30', '00:00', '00:30', '01:00']);
});

test('occurrenceMinutes ne répète pas le créneau sur une plage de 24 h', () => {
  const slots = occurrenceMinutes(0, 0, 30);
  assert.equal(slots.length, 48);
  assert.equal(new Set(slots).size, 48);
});

test("occurrenceMinutes garde un seul créneau si l'intervalle dépasse la plage", () => {
  assert.deepEqual(occurrenceMinutes(8 * 60, 9 * 60, 120).map(formatClock), ['08:00']);
});

test('occurrenceMinutes rejette un intervalle invalide', () => {
  assert.deepEqual(occurrenceMinutes(8 * 60, 20 * 60, 0), []);
  assert.deepEqual(occurrenceMinutes(8 * 60, 20 * 60, Number.NaN), []);
});

test('activeDays traite une liste vide comme « tous les jours »', () => {
  assert.deepEqual(activeDays({ days: [] }), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(activeDays({ days: [5, 1, 1] }), [1, 5]);
});

test('plannedSlotCount compte un déclencheur quotidien par créneau sur 7 jours', () => {
  // 08:00 -> 20:00 toutes les 30 min = 25 créneaux.
  assert.equal(plannedSlotCount(base), 25);
});

test('plannedSlotCount multiplie par jour quand la semaine est partielle', () => {
  assert.equal(plannedSlotCount({ ...base, days: [1, 3] }), 50);
});

test('nextOccurrence trouve le créneau suivant dans la journée', () => {
  const from = new Date(2026, 0, 5, 9, 15, 0); // lundi
  const next = nextOccurrence(base, from);
  assert.ok(next);
  assert.equal(next.getDate(), 5);
  assert.equal(formatClock(next.getHours() * 60 + next.getMinutes()), '09:30');
});

test('nextOccurrence saute au prochain jour actif', () => {
  const from = new Date(2026, 0, 5, 21, 0, 0); // lundi, après la plage
  const next = nextOccurrence({ ...base, days: [3] }, from);
  assert.ok(next);
  assert.equal(next.getDay(), 3);
  assert.equal(formatClock(next.getHours() * 60 + next.getMinutes()), '08:00');
});

test('nextOccurrence ignore un rappel en pause', () => {
  assert.equal(nextOccurrence({ ...base, enabled: false }, new Date()), null);
});

test('describeDays résume les combinaisons courantes', () => {
  assert.equal(describeDays([0, 1, 2, 3, 4, 5, 6]), 'Tous les jours');
  assert.equal(describeDays([1, 2, 3, 4, 5]), 'En semaine');
  assert.equal(describeDays([0, 6]), 'Le week-end');
  assert.equal(describeDays([1, 3, 5]), 'Lun, Mer, Ven');
});
