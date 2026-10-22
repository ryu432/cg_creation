import Constants from 'expo-constants';
import { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { useTasks } from '@/lib/TaskStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const { tasks, clearCompleted, clearAll } = useTasks();
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const doneCount = tasks.length - todoCount;

  const confirmClearCompleted = () => {
    Alert.alert('完了したタスクを削除', `${doneCount}件の完了したタスクを削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: clearCompleted },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert('すべてのデータを削除', 'すべてのタスクを削除します。元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'すべて削除', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Section title="タスク">
        <Row label="未完了" value={`${todoCount}件`} />
        <Row label="完了" value={`${doneCount}件`} />
      </Section>

      <Section title="データ">
        <ActionRow label="完了したタスクを削除" onPress={confirmClearCompleted} disabled={doneCount === 0} />
        <ActionRow label="すべてのデータを削除" onPress={confirmClearAll} disabled={tasks.length === 0} danger />
      </Section>

      <Section title="このアプリについて">
        <Row label="バージョン" value={Constants.expoConfig?.version ?? '-'} />
      </Section>

      <Text style={[styles.note, { color: theme.subText }]}>
        タスクはこのスマホの中に保存されています。ログインと端末間の同期は今後追加予定です。
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.subText }]}>{value}</Text>
    </View>
  );
}

function ActionRow(props: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.row, { opacity: props.disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.label, { color: props.danger ? theme.danger : theme.primary }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 4,
  },
});
