import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTasks } from '@/lib/TaskStore';

import { Chip } from './Chip';

type Props = {
  ids: string[];
  allSelected: boolean;
  onSelectAll: () => void;
  /** 操作が終わったとき・キャンセルしたとき（選択モードを抜ける） */
  onDone: () => void;
};

// 選択モードの下に出る操作バー：まとめて完了・プロジェクトへ移動・削除
export function SelectionBar({ ids, allSelected, onSelectAll, onDone }: Props) {
  const theme = useTheme();
  const { projects, completeTasks, updateTasks, removeTasks } = useTasks();
  const [moving, setMoving] = useState(false);

  const complete = () => {
    completeTasks(ids);
    onDone();
  };

  const moveTo = (projectId: string | null) => {
    updateTasks(ids, { projectId });
    onDone();
  };

  const remove = async () => {
    if (await confirm('タスクを削除', `選んだ${ids.length}件のタスクを削除します。`, '削除', true)) {
      removeTasks(ids);
      onDone();
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.top}>
        <Text style={[styles.count, { color: theme.text }]}>{ids.length}件を選択中</Text>
        <View style={styles.topActions}>
          {!allSelected && (
            <Pressable onPress={onSelectAll} hitSlop={8}>
              <Text style={[styles.link, { color: theme.primary }]}>すべて選択</Text>
            </Pressable>
          )}
          <Pressable onPress={onDone} hitSlop={8}>
            <Text style={[styles.link, { color: theme.subText }]}>キャンセル</Text>
          </Pressable>
        </View>
      </View>

      {moving && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projects}>
          <Chip label="プロジェクトなし" onPress={() => moveTo(null)} />
          {projects.map((p) => (
            <Chip key={p.id} label={p.name} dotColor={p.color} onPress={() => moveTo(p.id)} />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Action icon="checkmark-circle-outline" label="完了にする" onPress={complete} />
        <Action
          icon="folder-outline"
          label={moving ? '移動先を選ぶ' : 'プロジェクトへ'}
          onPress={() => setMoving((v) => !v)}
          active={moving}
        />
        <Action icon="trash-outline" label="削除" onPress={remove} danger />
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
}) {
  const theme = useTheme();
  const color = props.danger ? theme.danger : props.active ? theme.primary : theme.text;
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: 16,
  },
  link: {
    fontSize: 14,
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
