import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useNavigation } from 'expo-router';
import { ReactElement, useEffect, useLayoutEffect, useState } from 'react';
import { BackHandler, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { Task } from '@/lib/tasks';

import { HeaderActions } from './HeaderActions';
import { SelectionBar } from './SelectionBar';
import { TaskItem } from './TaskItem';

type Props = {
  tasks: Task[];
  header?: ReactElement;
  emptyMessage: string;
  noteFor?: (task: Task) => string | undefined;
  /** 右下の＋ボタンを押したときに開く追加画面のパラメータ（省略すると＋ボタンを出さない） */
  addParams?: Record<string, string>;
};

// タスクの一覧。長押しで選択モードになり、選んだタスクをまとめて完了・移動・削除できる
export function TaskList({ tasks, header, emptyMessage, noteFor, addParams }: Props) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Web（パソコン）は長押ししにくいので、右上の「選択」から0件の状態で選択モードに入れる
  const [selectMode, setSelectMode] = useState(false);
  const selecting = selectMode || selected.size > 0;
  const navigation = useNavigation();
  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };
  const allSelected = selecting && selected.size === tasks.length;

  // 選択モードの間は、画面上部を「← N件を選択中 … すべて選択」にする（iPhone でも戻るボタンで解除できるように）
  useLayoutEffect(() => {
    navigation.setOptions(
      selecting
        ? {
            headerTitle: `${selected.size}件を選択中`,
            headerLeft: () => (
              <Pressable onPress={clearSelection} hitSlop={12} style={styles.headerButton} accessibilityLabel="選択を解除">
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </Pressable>
            ),
            headerRight: () =>
              allSelected ? null : (
                <Pressable
                  onPress={() => setSelected(new Set(tasks.map((t) => t.id)))}
                  hitSlop={12}
                  style={styles.headerButton}
                >
                  <Text style={[styles.headerLink, { color: theme.primary }]}>すべて選択</Text>
                </Pressable>
              ),
          }
        : {
            headerTitle: undefined,
            headerLeft: undefined,
            headerRight: () => (
              <View style={styles.headerRow}>
                {Platform.OS === 'web' && tasks.length > 0 && (
                  <Pressable onPress={() => setSelectMode(true)} hitSlop={12} accessibilityLabel="タスクを選択">
                    <Text style={[styles.headerLink, { color: theme.primary }]}>選択</Text>
                  </Pressable>
                )}
                <HeaderActions />
              </View>
            ),
          },
    );
  }, [navigation, selecting, selected.size, allSelected, tasks, theme]);

  // 一覧から消えたタスク（削除・別画面での変更）は選択から外す
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  // Android の戻るボタンで選択モードを抜ける
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            note={noteFor?.(item)}
            selecting={selecting}
            selected={selected.has(item.id)}
            onToggleSelect={() => toggle(item.id)}
          />
        )}
        extraData={selected}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{emptyMessage}</Text>
          </View>
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />

      {selecting ? (
        <SelectionBar ids={[...selected]} onDone={clearSelection} />
      ) : (
        addParams && (
          <Pressable
            onPress={() => router.push({ pathname: '/task/new', params: addParams })}
            accessibilityLabel="タスクを追加"
            style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="add" size={30} color={theme.onPrimary} />
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 10,
    // 右下の＋ボタン・下の操作バーに最後のタスクが隠れないように
    paddingBottom: 120,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  headerButton: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
