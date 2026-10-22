import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { NewTask } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

type Props = {
  placeholder: string;
  /** 追加するタスクに最初から入れておく値（「今日」画面なら plannedDate など） */
  defaults?: Omit<NewTask, 'title'>;
};

export function AddTaskBar({ placeholder, defaults }: Props) {
  const theme = useTheme();
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const canSubmit = title.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    addTask({ ...defaults, title });
    setTitle('');
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={theme.subText}
        returnKeyType="done"
        submitBehavior="submit"
        style={[styles.input, { color: theme.text }]}
      />
      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        accessibilityLabel="タスクを追加"
        style={[styles.button, { backgroundColor: canSubmit ? theme.primary : theme.primarySoft }]}
      >
        <Ionicons name="add" size={22} color={theme.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
