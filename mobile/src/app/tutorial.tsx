import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/theme';
import { useTasks } from '@/lib/TaskStore';

const PAGES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'sunny',
    title: 'Plano へようこそ',
    body: '「今日やること」を、期限と使える時間から段取りしてくれるタスク管理アプリです。\nまずは思いついたことを書き出しましょう。',
  },
  {
    icon: 'add-circle',
    title: 'タスクを追加する',
    body: '右下の＋ボタンから追加できます。\n期限・見積もり時間・プロジェクトを入れておくと、プランがより正確になります。',
  },
  {
    icon: 'calendar',
    title: '今日のプランを作る',
    body: '「今日」の画面で「今日のプランを作る」を押し、使える時間と体力を選ぶと、今日やるタスクを理由つきで選びます。',
  },
  {
    icon: 'moon',
    title: '夜に振り返る',
    body: 'やり残したタスクは、振り返りで「明日に回す」「期限を変える」などをワンタップで決められます。\n設定で朝と夜の通知もオンにできます。',
  },
  {
    icon: 'checkbox',
    title: 'まとめて操作する',
    body: 'タスクを長押しすると選択モードになり、まとめて完了・プロジェクトへ移動・削除ができます。\n使い方は右上の ？ からいつでも見直せます。',
  },
];

// 使い方の紹介。初めて開いたときに自動で出て、右上の ？ や設定からいつでも開ける
export default function TutorialScreen() {
  const theme = useTheme();
  const { setOnboarded } = useTasks();
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  const finish = () => {
    setOnboarded(true);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.top}>
        {!last && (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={[styles.skip, { color: theme.subText }]}>スキップ</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name={page.icon} size={56} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{page.title}</Text>
        <Text style={[styles.text, { color: theme.subText }]}>{page.body}</Text>
      </View>

      <View style={styles.dots}>
        {PAGES.map((p, i) => (
          <View key={p.title} style={[styles.dot, { backgroundColor: i === index ? theme.primary : theme.border }]} />
        ))}
      </View>

      <View style={styles.buttons}>
        {index > 0 ? (
          <Pressable onPress={() => setIndex(index - 1)} style={[styles.button, styles.secondary, { borderColor: theme.border }]}>
            <Text style={[styles.buttonText, { color: theme.text }]}>戻る</Text>
          </Pressable>
        ) : (
          <View style={styles.button} />
        )}
        <Pressable
          onPress={() => (last ? finish() : setIndex(index + 1))}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{last ? 'はじめる' : '次へ'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  top: {
    height: 32,
    alignItems: 'flex-end',
  },
  skip: {
    fontSize: 15,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondary: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
