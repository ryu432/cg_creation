import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { toDateString, today } from '@/lib/date';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  /** 選択中の日付（YYYY-MM-DD） */
  value: string | null;
  onSelect: (date: string) => void;
};

// 月ごとのカレンダー。日付をタップすると onSelect が呼ばれる
export function Calendar({ value, onSelect }: Props) {
  const theme = useTheme();
  const todayString = today();
  const [month, setMonth] = useState(() => {
    const [y, m] = (value ?? todayString).split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const moveMonth = (delta: number) => {
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // 月の初日の曜日ぶん空けてから、1日〜末日を並べる
  const firstWeekday = new Date(month.year, month.month, 1).getDay();
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateString(new Date(month.year, month.month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Pressable onPress={() => moveMonth(-1)} hitSlop={12} accessibilityLabel="前の月">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: theme.text }]}>
          {month.year}年{month.month + 1}月
        </Text>
        <Pressable onPress={() => moveMonth(1)} hitSlop={12} accessibilityLabel="次の月">
          <Ionicons name="chevron-forward" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            style={[
              styles.weekday,
              { color: i === 0 ? theme.danger : theme.subText },
            ]}
          >
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const selected = date === value;
            const isToday = date === todayString;
            const isPast = date < todayString;
            return (
              <Pressable
                key={date}
                onPress={() => onSelect(date)}
                accessibilityLabel={date}
                style={[
                  styles.cell,
                  styles.day,
                  selected && { backgroundColor: theme.primary },
                  !selected && isToday && { borderWidth: 1.5, borderColor: theme.primary },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: selected ? theme.onPrimary : di === 0 ? theme.danger : theme.text },
                    isPast && !selected && { opacity: 0.4 },
                    (selected || isToday) && styles.bold,
                  ]}
                >
                  {Number(date.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayText: {
    fontSize: 15,
  },
  bold: {
    fontWeight: '700',
  },
});
