import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTasks } from '@/lib/TaskStore';

import { Chip } from './Chip';

type Props = {
  ids: string[];
  /** 操作が終わったとき（選択モードを抜ける） */
  onDone: () => void;
};

// 選択モードの下に出る操作バー：まとめて完了・プロジェクトへ移動・削除（解除は画面上部の ← から）
export function SelectionBar({ ids, onDone }: Props) {
  const theme = useTheme();
  const { tasks, projects, completeTasks, updateTasks, removeTasks } = useTasks();
  const [moving, setMoving] = useState(false);

  // 「選択」から入ってまだ何も選んでいないときは、操作しない
  const none = ids.length === 0;

  const complete = () => {
    if (none) return;
    completeTasks(ids);
    onDone();
  };

  const moveTo = (projectId: string | null) => {
    updateTasks(ids, { projectId });
    onDone();
  };

  const remove = async () => {
    if (none) return;
    const routineCount = tasks.filter((t) => ids.includes(t.id) && t.routineId && t.status === 'todo').length;
    const message =
      `選んだ${ids.length}件のタスクを削除します。` +
      (routineCount > 0 ? `\nルーティンの回（${routineCount}件）は、この回だけ削除して次の回を作ります。` : '');
    if (await confirm('タスクを削除', message, '削除', true)) {
      removeTasks(ids);
      onDone();
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {moving && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projects}>
          <Chip label="プロジェクトなし" onPress={() => moveTo(null)} />
          {projects.map((p) => (
            <Chip key={p.id} label={p.name} dotColor={p.color} onPress={() => moveTo(p.id)} />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Action icon="checkmark-circle-outline" label="完了にする" onPress={complete} disabled={none} />
        <Action
          icon="folder-outline"
          label={moving ? '移動先を選ぶ' : 'プロジェクトへ'}
          onPress={() => !none && setMoving((v) => !v)}
          active={moving}
          disabled={none}
        />
        <Action icon="trash-outline" label="削除" onPress={remove} danger disabled={none} />
      </View>
    </View>
  );
}

function Action(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = props.danger ? theme.danger : props.active ? theme.primary : theme.text;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.action, { opacity: props.disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      accessibilityLabel={props.label}
    >
      <Ionicons name={props.icon} size={24} color={color} />
      <Text style={[styles.actionText, { color }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  projects: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 12,
  },
});
