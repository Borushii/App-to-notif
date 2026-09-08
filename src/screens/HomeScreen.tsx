import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReminderCard } from '../components/ReminderCard';
import { ReminderEditor } from '../components/ReminderEditor';
import {
  SLOT_BUDGET,
  getPermissionState,
  requestPermissions,
  sendTestNotification,
  syncAllReminders,
} from '../notifications';
import { createReminder, plannedSlotCount, totalPlannedSlots } from '../schedule';
import { loadReminders, saveReminders } from '../storage';
import { colors, radius, spacing } from '../theme';
import type { PermissionState, Reminder } from '../types';

type EditorState = { reminder: Reminder; isNew: boolean } | null;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [editor, setEditor] = useState<EditorState>(null);
  const [now, setNow] = useState(() => new Date());

  /** Enregistre la liste puis remet la file de notifications en accord avec elle. */
  const persist = useCallback(async (next: Reminder[]) => {
    setReminders(next);
    await saveReminders(next);
    try {
      await syncAllReminders(next);
    } catch (error) {
      Alert.alert(
        'Planification impossible',
        error instanceof Error ? error.message : 'Erreur inconnue.'
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, status] = await Promise.all([loadReminders(), getPermissionState()]);
      if (cancelled) return;
      setReminders(stored);
      setPermission(status);
      setLoading(false);
      try {
        await syncAllReminders(stored);
      } catch {
        // La resynchronisation réessaiera au prochain enregistrement.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rafraîchit « prochain rappel » sans attendre une interaction.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // L'utilisateur peut avoir changé l'autorisation dans les réglages système.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      getPermissionState().then(setPermission).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const usedSlots = useMemo(() => totalPlannedSlots(reminders), [reminders]);

  const askPermission = async () => {
    const status = await requestPermissions();
    setPermission(status);
    if (status !== 'granted') {
      Alert.alert(
        'Notifications désactivées',
        'Autorisez les notifications pour cette application dans les réglages du téléphone.',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleSave = async (reminder: Reminder) => {
    const exists = reminders.some((r) => r.id === reminder.id);
    const next = exists
      ? reminders.map((r) => (r.id === reminder.id ? reminder : r))
      : [...reminders, reminder];
    setEditor(null);
    await persist(next);
    if (permission !== 'granted') await askPermission();
  };

  const handleDelete = (reminder: Reminder) => {
    Alert.alert('Supprimer le rappel', `« ${reminder.title.trim() || 'Rappel'} » sera supprimé.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setEditor(null);
          await persist(reminders.filter((r) => r.id !== reminder.id));
        },
      },
    ]);
  };

  const handleToggle = async (reminder: Reminder, enabled: boolean) => {
    await persist(reminders.map((r) => (r.id === reminder.id ? { ...r, enabled } : r)));
    if (enabled && permission !== 'granted') await askPermission();
  };

  const handleTest = async () => {
    if (permission !== 'granted') {
      await askPermission();
      return;
    }
    await sendTestNotification();
    Alert.alert('Test envoyé', 'La notification arrive dans 5 secondes.');
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 96 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.appTitle}>Rappels</Text>
            <Text style={styles.appSubtitle}>
              {reminders.length === 0
                ? 'Aucun rappel pour le moment.'
                : `${usedSlots} créneau${usedSlots > 1 ? 'x' : ''} planifié${
                    usedSlots > 1 ? 's' : ''
                  } sur ${SLOT_BUDGET}.`}
            </Text>

            {permission !== 'granted' ? (
              <Pressable
                accessibilityRole="button"
                onPress={askPermission}
                style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
              >
                <Text style={styles.bannerTitle}>Notifications non autorisées</Text>
                <Text style={styles.bannerText}>
                  Touchez ici pour autoriser l'envoi des rappels.
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ReminderCard
            reminder={item}
            now={now}
            onPress={() => setEditor({ reminder: item, isNew: false })}
            onToggle={(enabled) => handleToggle(item, enabled)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Créez votre premier rappel</Text>
            <Text style={styles.emptyText}>
              Choisissez une fréquence (toutes les 30 min, toutes les heures…) et la plage horaire
              pendant laquelle vous voulez être notifié.
            </Text>
          </View>
        }
        ListFooterComponent={
          <Pressable
            accessibilityRole="button"
            onPress={handleTest}
            style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}
          >
            <Text style={styles.testButtonText}>Envoyer une notification de test</Text>
          </Pressable>
        }
      />

      <View style={[styles.fabWrapper, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditor({ reminder: createReminder(), isNew: true })}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Text style={styles.fabText}>Nouveau rappel</Text>
        </Pressable>
      </View>

      {editor ? (
        <ReminderEditor
          key={editor.reminder.id}
          visible
          reminder={editor.reminder}
          isNew={editor.isNew}
          otherSlots={reminders
            .filter((r) => r.enabled && r.id !== editor.reminder.id)
            .reduce((total, r) => total + plannedSlotCount(r), 0)}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setEditor(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  appTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  banner: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: spacing.lg,
    gap: 2,
  },
  bannerTitle: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: '700',
  },
  bannerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  testButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  testButtonText: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '600',
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  fab: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  fabText: {
    color: '#0B0E14',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
