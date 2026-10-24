import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { openContact } from '@/components/HeaderActions';
import { TimeEditor } from '@/components/TimeEditor';
import { Toggle } from '@/components/Toggle';
import { useTheme } from '@/constants/theme';
import { exportBackup } from '@/lib/backup';
import { choose, confirm, notify } from '@/lib/confirm';
import { formatDueDate, today } from '@/lib/date';
import { describeRule } from '@/lib/routines';
import { chunkOptions, SplitSettings, splitThresholdOptions } from '@/lib/plan';
import { ensureNotificationPermission, formatTime, notificationsSupported, ReminderSettings } from '@/lib/notifications';
import { promptInstall, useInstallState } from '@/lib/pwa';
import { SyncStatus, useSync } from '@/lib/sync/SyncProvider';
import { useTasks } from '@/lib/TaskStore';
import { copyText, downloadText } from '@/lib/webFiles';

export default function SettingsScreen() {
  const theme = useTheme();
  const { tasks, projects, routines, clearCompleted, clearAll, reminders, setReminders, planSettings, setPlanSettings } = useTasks();

  // スマホの共有機能で送る（メモ・LINE・Google ドライブなど）。題名は本文に混ざることがあるので付けない
  const exportData = async () => {
    const text = exportBackup({ tasks, projects, reminders, planSettings, routines });
    if (Platform.OS !== 'web') {
      Share.share({ message: text }).catch((e) => console.warn('書き出しに失敗しました', e));
      return;
    }
    // Web はファイルに保存するか、コピーしてメモなどに貼る
    const how = await choose('データを書き出す', 'バックアップの保存方法を選んでください。', [
      { label: 'ファイルに保存', value: 'file' },
      { label: 'コピーする', value: 'copy' },
    ]);
    if (how === 'file') downloadText(`plano-backup-${today()}.json`, text);
    if (how === 'copy') {
      if (await copyText(text)) notify('コピーしました', 'メモなどに貼り付けて保存してください。');
      else notify('コピーできませんでした', '「ファイルに保存」を試してください。');
    }
  };
  const split = planSettings.split;
  const setSplit = (changes: Partial<SplitSettings>) =>
    setPlanSettings({ ...planSettings, split: { ...split, ...changes } });
  const [editingTime, setEditingTime] = useState<keyof ReminderSettings | null>(null);
  const canNotify = notificationsSupported();
  const install = useInstallState();
  const sync = useSync();

  const signIn = () =>
    sync.signIn().catch((e) => notify('ログインできませんでした', e instanceof Error ? e.message : String(e)));

  const confirmSignOut = async () => {
    const how = await choose('ログアウト', 'この端末のタスクはどうしますか？（アカウントのデータはサーバーに残ります）', [
      { label: 'この端末に残す', value: 'keep' },
      { label: 'この端末から消す', value: 'clear', destructive: true },
    ]);
    if (!how) return;
    // まだ送っていない変更を送ってから
    await sync.syncNow();
    await sync.signOut(how === 'keep');
  };

  const confirmDeleteAccount = async () => {
    if (
      !(await confirm(
        'アカウントを削除',
        'サーバーにあるタスクなどのデータと、アカウントをすべて削除します。元に戻せません。この端末のタスクは残ります。',
        '削除へ進む',
        true,
      ))
    )
      return;
    if (!(await confirm('本当に削除しますか？', 'ほかの端末からも、同期したデータが見られなくなります。', '削除する', true))) return;
    try {
      await sync.deleteAccount();
      notify('アカウントを削除しました', 'この端末のタスクは残っています。');
    } catch (e) {
      notify('削除できませんでした', e instanceof Error ? e.message : String(e));
    }
  };

  const toggleReminder = async (key: keyof ReminderSettings, on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      Alert.alert('通知が許可されていません', 'スマホの設定アプリから、Plano の通知を許可してください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setReminders({ ...reminders, [key]: { ...reminders[key], enabled: on } });
  };
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const doneCount = tasks.length - todoCount;

  const confirmClearCompleted = async () => {
    if (await confirm('完了したタスクを削除', `${doneCount}件の完了したタスクを削除します。`, '削除', true)) clearCompleted();
  };

  const confirmClearAll = async () => {
    const message =
      'すべてのタスクとプロジェクトを削除します。元に戻せません。' +
      (sync.email ? '\nログイン中なので、ほかの端末からも消えます。' : '');
    if (await confirm('すべてのデータを削除', message, 'すべて削除', true)) {
      clearAll();
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {sync.available && (
        <Section title="アカウント">
          {sync.email ? (
            <>
              <View style={styles.row}>
                <Text style={[styles.label, styles.noShrink, { color: theme.text }]}>ログイン中</Text>
                <Text style={[styles.value, styles.email, { color: theme.subText }]} numberOfLines={1}>
                  {sync.email}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: theme.text }]}>同期</Text>
                <Text style={[styles.value, { color: sync.status === 'error' ? theme.danger : theme.subText }]}>
                  {syncStatusText(sync.status, sync.lastSyncedAt)}
                </Text>
              </View>
              <ActionRow label="今すぐ同期" onPress={sync.syncNow} disabled={sync.status === 'syncing'} />
              <ActionRow label="ログアウト" onPress={confirmSignOut} />
              <ActionRow label="アカウントを削除" onPress={confirmDeleteAccount} danger />
            </>
          ) : (
            <>
              <View style={styles.options}>
                <Text style={[styles.label, styles.installTitle, { color: theme.text }]}>スマホとパソコンで同じタスクを使う</Text>
                <Text style={[styles.sub, styles.installText, { color: theme.subText }]}>
                  ログインすると、タスクがサーバーに保存され、ほかの端末と自動でそろいます。データは本人しか見られません。
                  今この端末にあるタスクも、そのまま引き継がれます。
                </Text>
              </View>
              <ActionRow label="Google でログイン" onPress={signIn} />
            </>
          )}
        </Section>
      )}

      <Section title="タスク">
        <Row label="未完了" value={`${todoCount}件`} />
        <Row label="完了" value={`${doneCount}件`} />
      </Section>

      <Section title="プラン">
        <View style={styles.row}>
          <View style={styles.reminderLabel}>
            <Text style={[styles.label, { color: theme.text }]}>大きいタスクを区切って入れる</Text>
            <Text style={[styles.sub, { color: theme.subText }]}>今日の時間に入らないとき「30分だけ」のように進める</Text>
          </View>
          <Toggle
            value={split.enabled}
            onValueChange={(enabled) => setSplit({ enabled })}
          />
        </View>
        {split.enabled && (
          <View style={styles.options}>
            <Text style={[styles.sub, { color: theme.subText }]}>区切る対象（見積もり時間）</Text>
            <View style={styles.chips}>
              {splitThresholdOptions.map((o) => (
                <Chip
                  key={o.minutes}
                  label={o.label}
                  selected={split.minTaskMinutes === o.minutes}
                  onPress={() => setSplit({ minTaskMinutes: o.minutes })}
                />
              ))}
            </View>
            <Text style={[styles.sub, { color: theme.subText }]}>1回に進める時間</Text>
            <View style={styles.chips}>
              {chunkOptions.map((o) => (
                <Chip
                  key={o.minutes}
                  label={o.label}
                  selected={split.chunkMinutes === o.minutes}
                  onPress={() => setSplit({ chunkMinutes: o.minutes })}
                />
              ))}
            </View>
            <Text style={[styles.sub, { color: theme.subText }]}>
              期限切れ・今日が期限のもの、見積もりがないもの、「区切らない」にしたタスクは区切りません。区切るのは1日2件までです。
            </Text>
          </View>
        )}
      </Section>

      <Section title="通知">
        {(
          [
            { key: 'morning', label: '朝のプラン', sub: '今日のプランを作るお知らせ' },
            { key: 'evening', label: '夜の振り返り', sub: 'やり残しを振り返るお知らせ' },
          ] as const
        ).map(({ key, label, sub }) => (
          <View key={key}>
            <View style={styles.row}>
              <View style={styles.reminderLabel}>
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.sub, { color: theme.subText }]}>{sub}</Text>
              </View>
              <Pressable
                onPress={() => setEditingTime((v) => (v === key ? null : key))}
                hitSlop={8}
                accessibilityLabel={`${label}の時刻を変える`}
              >
                <Text style={[styles.time, { color: canNotify && reminders[key].enabled ? theme.primary : theme.subText }]}>
                  {formatTime(reminders[key])}
                </Text>
              </Pressable>
              <Toggle
                value={canNotify && reminders[key].enabled}
                disabled={!canNotify}
                onValueChange={(on) => toggleReminder(key, on)}
              />
            </View>
            {editingTime === key && (
              <TimeEditor
                hour={reminders[key].hour}
                minute={reminders[key].minute}
                onChange={(time) => setReminders({ ...reminders, [key]: { ...reminders[key], ...time } })}
              />
            )}
          </View>
        ))}
        {!canNotify && (
          <Text style={[styles.sub, styles.notice, { color: theme.subText }]}>
            {Platform.OS === 'web'
              ? 'Web 版ではまだ通知を使えません（今後対応予定です）。'
              : 'Expo Go では通知を使えません。Plano 専用のアプリで使えるようになります（時刻の設定は保存されます）。'}
          </Text>
        )}
      </Section>

      {routines.length > 0 && (
        <Section title="ルーティン">
          {routines.map((r) => {
            const next = tasks.find((t) => t.routineId === r.id && t.status === 'todo');
            return (
              <Pressable
                key={r.id}
                disabled={!next}
                onPress={() => next && router.push({ pathname: '/task/[id]', params: { id: next.id } })}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={styles.reminderLabel}>
                  <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={[styles.sub, { color: theme.subText }]}>
                    {describeRule(r.rule)}
                    {next?.dueDate ? `・次は${formatDueDate(next.dueDate)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subText} />
              </Pressable>
            );
          })}
        </Section>
      )}

      <Section title="プロジェクト">
        {projects.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/project/edit', params: { id: p.id } })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.projectName}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            <View style={styles.projectName}>
              <Text style={[styles.value, { color: theme.subText }]}>
                {tasks.filter((t) => t.projectId === p.id && t.status === 'todo').length}件
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.subText} />
            </View>
          </Pressable>
        ))}
        <ActionRow label="＋ プロジェクトを追加" onPress={() => router.push('/project/edit')} />
      </Section>

      {Platform.OS === 'web' && (
        <Section title="ホーム画面に追加">
          <View style={styles.options}>
            <Text style={[styles.label, styles.installTitle, { color: theme.text }]}>
              {install.standalone ? 'ホーム画面から使っています ✓' : 'アプリのように使う'}
            </Text>
            <Text style={[styles.sub, styles.installText, { color: theme.subText }]}>
              {install.standalone
                ? 'データはこの端末のこのアプリの中に保存されています。ときどき「データを書き出す」でバックアップしておくと安心です。'
                : install.ios
                  ? 'Safari の共有ボタン（□に↑）→「ホーム画面に追加」。しばらく開かなくてもデータが消えにくくなります。'
                  : 'ブラウザのメニュー（︙）→「ホーム画面に追加」または「アプリをインストール」。パソコンの Chrome・Edge でもアドレス欄の右のボタンから追加できます。'}
            </Text>
          </View>
          {!install.standalone && install.canPrompt && <ActionRow label="ホーム画面に追加する" onPress={promptInstall} />}
        </Section>
      )}

      <Section title="データ">
        <ActionRow label="データを書き出す（バックアップ）" onPress={exportData} />
        <ActionRow label="データを読み込む" onPress={() => router.push('/import')} />
        <ActionRow label="完了したタスクを削除" onPress={confirmClearCompleted} disabled={doneCount === 0} />
        <ActionRow label="すべてのデータを削除" onPress={confirmClearAll} disabled={tasks.length === 0} danger />
      </Section>

      <Section title="ヘルプ">
        <ActionRow label="使い方（チュートリアル）" onPress={() => router.push('/tutorial')} />
        <ActionRow label="お問い合わせ（準備中）" onPress={openContact} />
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

function syncStatusText(status: SyncStatus, lastSyncedAt: Date | null): string {
  switch (status) {
    case 'syncing':
      return '同期中…';
    case 'offline':
      return 'オフライン（つながったら送ります）';
    case 'error':
      return '同期できませんでした';
    default:
      return lastSyncedAt
        ? `${lastSyncedAt.getHours()}:${String(lastSyncedAt.getMinutes()).padStart(2, '0')} に同期`
        : '準備中';
  }
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  reminderLabel: {
    flex: 1,
    gap: 2,
  },
  sub: {
    fontSize: 12,
  },
  options: {
    gap: 8,
    paddingBottom: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noShrink: {
    flexShrink: 0,
  },
  email: {
    flexShrink: 1,
    marginLeft: 16,
  },
  installTitle: {
    paddingTop: 14,
  },
  installText: {
    lineHeight: 18,
  },
  notice: {
    lineHeight: 18,
    paddingBottom: 14,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  projectName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 4,
  },
});
