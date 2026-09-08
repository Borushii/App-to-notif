import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { clampToDay, formatClock } from '../schedule';
import { colors, radius, spacing } from '../theme';

type TimeFieldProps = {
  label: string;
  /** Minutes depuis minuit. */
  value: number;
  onChange: (minutes: number) => void;
};

function toDate(minutes: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [iosPickerVisible, setIosPickerVisible] = useState(false);

  const commit = (date?: Date) => {
    if (!date) return;
    onChange(clampToDay(date.getHours() * 60 + date.getMinutes()));
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type === 'set') commit(date);
        },
      });
      return;
    }
    setIosPickerVisible((visible) => !visible);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${formatClock(value)}`}
        onPress={open}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatClock(value)}</Text>
      </Pressable>

      {Platform.OS === 'ios' && iosPickerVisible ? (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour
          display="spinner"
          themeVariant="dark"
          onChange={(_event, date) => commit(date)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  fieldPressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
