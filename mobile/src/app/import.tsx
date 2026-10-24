import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { BackupError, parseBackup } from '@/lib/backup';
import { confirm } from '@/lib/confirm';
import { useTasks } from '@/lib/TaskStore';
import { pickTextFile } from '@/lib/webFiles';

// 書き出したデータを貼り付けて読み込む。今のデータは置き換わる。
// 入力欄は高さを固定し（長い文字は欄の中でスクロール）、読み込める文字を貼ったら要約だけ表示して欄を畳む
export default function ImportScreen() {
  const theme = useTheme();
  const { tasks, replaceAll } = useTasks();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(true);

  // 貼り付けた時点で中身を確かめる
  const result = useMemo(() => {
    if (text.trim() === '') return null;
    try {
      return { data: parseBackup(text), error: null };
    } catch (e) {
      return { data: null, error: e instanceof BackupError ? e.message : '読み込みに失敗しました。' };
    }
  }, [text]);
  const data = result?.data ?? null;
  const showInput = editing || !data;

  // Web では、書き出したファイルを選んで読み込める
  const pickFile = async () => {
    const content = await pickTextFile();
    if (content === null) return;
    setText(content);
    setEditing(false);
  };

  const load = async () => {
    if (!data) return;
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
        {Platform.OS === 'web'
          ? '「データを書き出す」で保存したファイルを選ぶか、コピーした文字を下の欄に貼り付けてください。'
          : '「データを書き出す」で送った文字を、全部コピーして下の欄に貼り付けてください。'}
      </Text>

      {Platform.OS === 'web' && showInput && (
        <Pressable onPress={pickFile} style={[styles.fileButton, { borderColor: theme.primary }]}>
          <Ionicons name="document-outline" size={18} color={theme.primary} />
          <Text style={[styles.fileButtonText, { color: theme.primary }]}>ファイルを選ぶ</Text>
        </Pressable>
      )}

      {showInput ? (
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setEditing(false);
          }}
          placeholder={Platform.OS === 'web' ? 'ここに貼り付け' : 'ここを長押しして「貼り付け」'}
          placeholderTextColor={theme.subText}
          multiline
          scrollEnabled
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        />
      ) : (
        data && (
        <View style={[styles.summary, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
          <View style={styles.summaryBody}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>読み込めるデータです</Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              タスク{data.tasks.length}件（未完了{data.tasks.filter((t) => t.status === 'todo').length}件）・プロジェクト
              {data.projects.length}件
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setText('');
              setEditing(true);
            }}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: theme.primary }]}>貼り直す</Text>
          </Pressable>
        </View>
        )
      )}

      {result?.error && <Text style={[styles.error, { color: theme.danger }]}>{result.error}</Text>}

      <Pressable
        onPress={load}
        disabled={!data}
        style={[styles.button, { backgroundColor: theme.primary, opacity: data ? 1 : 0.4 }]}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>読み込む</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  help: {
    fontSize: 14,
    lineHeight: 21,
  },
  // 高さを固定して、画面のスクロールを入力欄が奪わないようにする
  input: {
    height: 120,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 13,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
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
