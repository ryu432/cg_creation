import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { LAST_DAY_OF_MONTH, RepeatRule, WEEKDAY_LABELS } from '@/lib/routines';

import { Chip } from './Chip';

type Props = {
  value: RepeatRule | null;
  onChange: (rule: RepeatRule | null) => void;
};

const KINDS: { label: string; kind: RepeatRule['kind'] | null }[] = [
  { label: 'しない', kind: null },
  { label: '日数ごと', kind: 'interval' },
  { label: '曜日', kind: 'weekly' },
  { label: '毎月', kind: 'monthly' },
];

function defaultRule(kind: RepeatRule['kind']): RepeatRule {
  switch (kind) {
    case 'interval':
      return { kind, days: 1 };
    case 'weekly':
      return { kind, weekdays: [] };
    case 'monthly':
      return { kind, days: [] };
  }
}

function toggle(list: number[], n: number): number[] {
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
}

// 繰り返しの設定：しない／○日ごと／曜日（複数）／毎月の日付（複数・月末あり）
export function RepeatEditor({ value, onChange }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Chip
            key={k.label}
            label={k.label}
            selected={(value?.kind ?? null) === k.kind}
            onPress={() => onChange(k.kind === null ? null : value?.kind === k.kind ? value : defaultRule(k.kind))}
          />
        ))}
      </View>

      {value?.kind === 'interval' && (
        <View style={[styles.stepper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={() => onChange({ ...value, days: Math.max(1, value.days - 1) })}
            hitSlop={8}
            accessibilityLabel="日数を減らす"
          >
            <Ionicons name="remove-circle-outline" size={28} color={theme.primary} />
          </Pressable>
          <Text style={[styles.stepperText, { color: theme.text }]}>
            {value.days === 1 ? '毎日' : `${value.days}日ごと`}
          </Text>
          <Pressable
            onPress={() => onChange({ ...value, days: Math.min(365, value.days + 1) })}
            hitSlop={8}
            accessibilityLabel="日数を増やす"
          >
            <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
          </Pressable>
        </View>
      )}

      {value?.kind === 'weekly' && (
        <View style={styles.chips}>
          {WEEKDAY_LABELS.map((label, w) => (
            <Chip
              key={label}
              label={label}
              selected={value.weekdays.includes(w)}
              onPress={() => onChange({ ...value, weekdays: toggle(value.weekdays, w) })}
            />
          ))}
        </View>
      )}

      {value?.kind === 'monthly' && (
        <View style={styles.days}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const selected = value.days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => onChange({ ...value, days: toggle(value.days, d) })}
                accessibilityLabel={`${d}日`}
                style={[
                  styles.day,
                  { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border },
                ]}
              >
                <Text style={{ color: selected ? theme.onPrimary : theme.text }}>{d}</Text>
              </Pressable>
            );
          })}
          <Chip
            label="月末"
            selected={value.days.includes(LAST_DAY_OF_MONTH)}
            onPress={() => onChange({ ...value, days: toggle(value.days, LAST_DAY_OF_MONTH) })}
          />
        </View>
      )}

      {value && value.kind !== 'interval' && (value.kind === 'weekly' ? value.weekdays : value.days).length === 0 && (
        <Text style={[styles.hint, { color: theme.danger }]}>1つ以上選んでください</Text>
      )}
      {value?.kind === 'monthly' && (
        <Text style={[styles.hint, { color: theme.subText }]}>その月にない日付（31日など）は、月の最終日になります</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepperText: {
    fontSize: 17,
    fontWeight: '600',
    minWidth: 90,
    textAlign: 'center',
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  day: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    marginLeft: 4,
  },
});
