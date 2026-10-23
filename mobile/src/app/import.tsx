import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useTheme } from '@/constants/theme';
import { BackupError, parseBackup } from '@/lib/backup';
import { confirm } from '@/lib/confirm';
import { useTasks } from '@/lib/TaskStore';

// 書き出したデータを貼り付けて読み込む。今のデータは置き換わる
export default function ImportScreen() {
  const theme = useTheme();
  const { tasks, replaceAll } = useTasks();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    let data;
    try {
      data = parseBackup(text);
    } catch (e) {
      setError(e instanceof BackupError ? e.message : '読み込みに失敗しました。');
      return;
    }
    const message =
      tasks.length > 0
        ? `タスク${data.tasks.length}件・プロジェクト${data.projects.length}件を読み込みます。今の${tasks.length}件のタスクは消えて、置き換わります。`
        : `タスク${data.tasks.length}件・プロジェクト${data.projects.length}件を読み込みます。`;
    if (await confirm('データを読み込む', message, '読み込む', tasks.length > 0)) {
      replaceAll(data);
      router.back();
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.help, { color: theme.subText }]}>
        「データを書き出す」で送った文字を、全部コピーしてここに貼り付けてください。
      </Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        placeholder='{"format":"plano-backup", ... }'
        placeholderTextColor={theme.subText}
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <Pressable
        onPress={load}
        disabled={text.trim() === ''}
        style={[styles.button, { backgroundColor: theme.primary, opacity: text.trim() === '' ? 0.4 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>読み込む</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  help: {
    fontSize: 14,
    lineHeight: 21,
  },
  input: {
    minHeight: 200,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 14,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
