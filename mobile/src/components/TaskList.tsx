import { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { Task } from '@/lib/tasks';

import { TaskItem } from './TaskItem';

type Props = {
  tasks: Task[];
  header?: ReactElement;
  emptyMessage: string;
  noteFor?: (task: Task) => string | undefined;
};

export function TaskList({ tasks, header, emptyMessage, noteFor }: Props) {
  const theme = useTheme();

  return (
    <FlatList
      data={tasks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => <TaskItem task={item} note={noteFor?.(item)} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.subText }]}>{emptyMessage}</Text>
        </View>
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.background }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 10,
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
});
