import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_SLOTS_PER_REMINDER, SLOT_BUDGET } from '../notifications';
import {
  DAY_ORDER,
  DAY_SHORT,
  INTERVAL_PRESETS,
  MAX_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
  formatClock,
  formatInterval,
  isOvernightWindow,
  occurrencesPerDay,
  plannedSlotCount,
  windowDurationMinutes,
} from '../schedule';
import { colors, radius, spacing } from '../theme';
import type { Reminder } from '../types';
import { Chip } from './Chip';
import { TimeField } from './TimeField';

type ReminderEditorProps = {
  visible: boolean;
  reminder: Reminder;
  isNew: boolean;
  /** Créneaux déjà réservés par les autres rappels actifs. */
  otherSlots: number;
  onSave: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
  onCancel: () => void;
};

const STEP_MINUTES = 5;

export function ReminderEditor({
  visible,
  reminder,
  isNew,
  otherSlots,
  onSave,
  onDelete,
  onCancel,
}: ReminderEditorProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Reminder>(reminder);

  const patch = (changes: Partial<Reminder>) => setDraft((current) => ({ ...current, ...changes }));

  const toggleDay = (day: number) => {
    const active = draft.days.includes(day);
    const next = active ? draft.days.filter((d) => d !== day) : [...draft.days, day];
    // Au moins un jour doit rester sélectionné.
    patch({ days: next.length ? next.sort((a, b) => a - b) : draft.days });
  };

  const setInterval = (minutes: number) => {
    patch({
      intervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, minutes)),
    });
  };

  const perDay = useMemo(() => occurrencesPerDay(draft), [draft]);
  const slots = useMemo(() => plannedSlotCount(draft), [draft]);
  const overnight = isOvernightWindow(draft.startMinutes, draft.endMinutes);
  const duration = windowDurationMinutes(draft.startMinutes, draft.endMinutes);

  const tooManySlots = slots > MAX_SLOTS_PER_REMINDER;
  const overBudget = !tooManySlots && draft.enabled && otherSlots + slots > SLOT_BUDGET;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
              <Text style={styles.topBarAction}>Annuler</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>{isNew ? 'Nouveau rappel' : 'Modifier'}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={tooManySlots}
              onPress={() => onSave(draft)}
              hitSlop={12}
            >
              <Text style={[styles.topBarAction, styles.topBarSave, tooManySlots && styles.disabled]}>
                Enregistrer
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contenu</Text>
              <TextInput
                value={draft.title}
                onChangeText={(title) => patch({ title })}
                placeholder="Titre (ex. Boire de l'eau)"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                maxLength={60}
              />
              <TextInput
                value={draft.body}
                onChangeText={(body) => patch({ body })}
                placeholder="Message (facultatif)"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.inputMultiline]}
                multiline
                maxLength={160}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fréquence</Text>
              <Text style={styles.sectionHint}>
                Une notification toutes les {formatInterval(draft.intervalMinutes)}.
              </Text>

              <View style={styles.chipRow}>
                {INTERVAL_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    label={formatInterval(preset)}
                    selected={draft.intervalMinutes === preset}
                    onPress={() => setInterval(preset)}
                  />
                ))}
              </View>

              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Réduire l'intervalle"
                  onPress={() => setInterval(draft.intervalMinutes - STEP_MINUTES)}
                  style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
                >
                  <Text style={styles.stepperSymbol}>−</Text>
                </Pressable>
                <View style={styles.stepperValue}>
                  <Text style={styles.stepperValueText}>{formatInterval(draft.intervalMinutes)}</Text>
                  <Text style={styles.stepperValueHint}>réglage fin ({STEP_MINUTES} min)</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Augmenter l'intervalle"
                  onPress={() => setInterval(draft.intervalMinutes + STEP_MINUTES)}
                  style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
                >
                  <Text style={styles.stepperSymbol}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plage horaire</Text>
              <Text style={styles.sectionHint}>
                Les rappels démarrent à {formatClock(draft.startMinutes)} et s'arrêtent après{' '}
                {formatClock(draft.endMinutes)}.
              </Text>
              <View style={styles.timeRow}>
                <TimeField
                  label="Début"
                  value={draft.startMinutes}
                  onChange={(startMinutes) => patch({ startMinutes })}
                />
                <TimeField
                  label="Fin"
                  value={draft.endMinutes}
                  onChange={(endMinutes) => patch({ endMinutes })}
                />
              </View>
              {overnight ? (
                <Text style={styles.note}>
                  Plage de nuit : {Math.floor(duration / 60)} h {duration % 60 ? `${duration % 60} min ` : ''}
                  à cheval sur minuit. Les jours sélectionnés s'appliquent à l'heure de chaque
                  notification, pas à la nuit entière.
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jours</Text>
              <View style={styles.chipRow}>
                {DAY_ORDER.map((day) => (
                  <Chip
                    key={day}
                    label={DAY_SHORT[day]}
                    compact
                    selected={draft.days.includes(day)}
                    onPress={() => toggleDay(day)}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                <Chip
                  label="Tous les jours"
                  selected={draft.days.length === 7}
                  onPress={() => patch({ days: [0, 1, 2, 3, 4, 5, 6] })}
                />
                <Chip
                  label="En semaine"
                  selected={draft.days.join(',') === '1,2,3,4,5'}
                  onPress={() => patch({ days: [1, 2, 3, 4, 5] })}
                />
                <Chip
                  label="Week-end"
                  selected={draft.days.join(',') === '0,6'}
                  onPress={() => patch({ days: [0, 6] })}
                />
              </View>
            </View>

            <View style={[styles.summary, tooManySlots && styles.summaryError, overBudget && styles.summaryWarning]}>
              <Text style={styles.summaryTitle}>
                {perDay} notification{perDay > 1 ? 's' : ''} par jour actif
              </Text>
              <Text style={styles.summaryText}>
                {slots} créneau{slots > 1 ? 'x' : ''} réservé{slots > 1 ? 's' : ''} dans la file du
                système ({otherSlots + (draft.enabled ? slots : 0)} / {SLOT_BUDGET} au total).
              </Text>
              {tooManySlots ? (
                <Text style={styles.summaryAlert}>
                  Trop de créneaux pour un seul rappel (max. {MAX_SLOTS_PER_REMINDER}). Allongez
                  l'intervalle ou réduisez la plage horaire.
                </Text>
              ) : null}
              {overBudget ? (
                <Text style={styles.summaryAlert}>
                  Au-delà de {SLOT_BUDGET} créneaux, iOS cesse de planifier les rappels suivants.
                  Mettez un autre rappel en pause ou allongez l'intervalle.
                </Text>
              ) : null}
            </View>

            {!isNew ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onDelete(draft)}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              >
                <Text style={styles.deleteText}>Supprimer ce rappel</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  topBarAction: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  topBarSave: {
    color: colors.accent,
  },
  disabled: {
    color: colors.textFaint,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: -spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  stepperValueText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  stepperValueHint: {
    color: colors.textFaint,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  note: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  summary: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  summaryWarning: {
    borderColor: colors.warning,
  },
  summaryError: {
    borderColor: colors.danger,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryAlert: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
