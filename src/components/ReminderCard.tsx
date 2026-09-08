import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  describeDays,
  describeSchedule,
  formatNextOccurrence,
  nextOccurrence,
  occurrencesPerDay,
} from '../schedule';
import { colors, radius, spacing } from '../theme';
import type { Reminder } from '../types';

type ReminderCardProps = {
  reminder: Reminder;
  now: Date;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
};

export function ReminderCard({ reminder, now, onPress, onToggle }: ReminderCardProps) {
  const upcoming = nextOccurrence(reminder, now);
  const perDay = occurrencesPerDay(reminder);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, !reminder.enabled && styles.dimmed]} numberOfLines={1}>
          {reminder.title.trim() || 'Rappel'}
        </Text>
        <Switch
          value={reminder.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          thumbColor={reminder.enabled ? colors.accent : colors.textFaint}
        />
      </View>

      <Text style={[styles.schedule, !reminder.enabled && styles.dimmed]}>
        {describeSchedule(reminder)}
      </Text>

      <View style={styles.footer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{describeDays(reminder.days)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {perDay} notif{perDay > 1 ? 's' : ''} / jour
          </Text>
        </View>
      </View>

      <Text style={styles.next}>
        {reminder.enabled
          ? upcoming
            ? `Prochain rappel ${formatNextOccurrence(upcoming, now)}`
            : 'Aucune sonnerie planifiée'
          : 'En pause'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.75,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  schedule: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  dimmed: {
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  next: {
    color: colors.textFaint,
    fontSize: 13,
  },
});
