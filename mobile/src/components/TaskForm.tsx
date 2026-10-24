import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Calendar } from '@/components/Calendar';
import { Chip } from '@/components/Chip';
import { RepeatEditor } from '@/components/RepeatEditor';
import { Toggle } from '@/components/Toggle';
import { useTheme } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { addDays, formatDueDate, today } from '@/lib/date';
import { formatMinutes } from '@/lib/plan';
import { isValidRule, RepeatRule } from '@/lib/routines';
import { estimateOptions } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

/** 追加・編集画面で入力する内容（「登録」を押すまで保存しない下書き） */
export type TaskDraft = {
  title: string;
  note: string;
  /** 繰り返し（ルーティン）。null なら単発のタスク */
  repeat: RepeatRule | null;
  dueDate: string | null;
  estimateMinutes: number | null;
  projectId: string | null;
  plannedToday: boolean;
  allowSplit: boolean;
};

type Props = {
  initial: TaskDraft;
  submitLabel: string;
  /** false を返すと画面を閉じない（「この回だけ／全体」の選択でキャンセルしたときなど） */
  onSubmit: (draft: TaskDraft) => boolean | void | Promise<boolean | void>;
  /** 編集のときだけ渡す（削除ボタンを出す）。確認は呼び出す側で行い、削除したら true */
  onDelete?: () => Promise<boolean>;
};

function isSameDraft(a: TaskDraft, b: TaskDraft): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.note.trim() === b.note.trim() &&
    JSON.stringify(a.repeat) === JSON.stringify(b.repeat) &&
    a.dueDate === b.dueDate &&
    a.estimateMinutes === b.estimateMinutes &&
    a.projectId === b.projectId &&
    a.plannedToday === b.plannedToday &&
    a.allowSplit === b.allowSplit
  );
}

// タスクの追加・編集画面の中身。戻るときに変更があれば、破棄してよいか確認する
export function TaskForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const theme = useTheme();
  const { projects, planSettings } = useTasks();
  const [draft, setDraft] = useState(initial);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const set = (changes: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...changes }));

  const dirty = !isSameDraft(draft, initial);
  const canSubmit = draft.title.trim().length > 0 && (draft.repeat === null || isValidRule(draft.repeat));

  const allowLeave = usePreventRemove(dirty, ({ repeat }) => {
    confirm('変更を破棄しますか？', '入力した内容は保存されません。', '破棄する', true).then((ok) => {
      if (ok) repeat();
    });
  });

  const leave = () => {
    allowLeave();
    router.back();
  };

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await onSubmit({ ...draft, title: draft.title.trim(), note: draft.note.trim() });
    if (ok !== false) leave();
  };

  const remove = async () => {
    if (onDelete && (await onDelete())) leave();
  };

  // 「＋ 新規」で作ったプロジェクトを、この下書きで選んだ状態にする
  const waitingForProject = useRef<number | null>(null);
  useEffect(() => {
    if (waitingForProject.current !== null && projects.length > waitingForProject.current) {
      set({ projectId: projects[projects.length - 1].id });
      waitingForProject.current = null;
    }
  }, [projects]);

  const date = today();
  const dueOptions: { label: string; value: string | null }[] = [
    { label: 'なし', value: null },
    { label: '今日', value: date },
    { label: '明日', value: addDays(date, 1) },
    { label: '1週間後', value: addDays(date, 7) },
  ];
  // 選択肢にない期限が入っているときは、それも選択肢として表示する
  if (draft.dueDate && !dueOptions.some((o) => o.value === draft.dueDate)) {
    dueOptions.push({ label: formatDueDate(draft.dueDate), value: draft.dueDate });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>
          名前 <Text style={{ color: theme.danger }}>（必須）</Text>
        </Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => set({ title })}
          placeholder="例：企画書の構成を決める"
          placeholderTextColor={theme.subText}
          autoFocus={initial.title === ''}
          multiline
          submitBehavior="blurAndSubmit"
          // Web（パソコン）では Enter で登録・保存する（変換中の Enter は除く。Shift+Enter は改行）
          {...(Platform.OS === 'web' ? ({ blurOnSubmit: true, onSubmitEditing: submit } as object) : null)}
          style={[styles.titleInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>詳細（任意）</Text>
        <TextInput
          value={draft.note}
          onChangeText={(note) => set({ note })}
          placeholder="メモ・やることの中身・URL など"
          placeholderTextColor={theme.subText}
          multiline
          style={[styles.noteInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>
          {draft.repeat ? '次の予定日（なしなら今日以降の最初の日）' : '期限'}
        </Text>
        <View style={styles.chips}>
          {dueOptions.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={draft.dueDate === option.value}
              onPress={() => {
                set({ dueDate: option.value });
                setCalendarOpen(false);
              }}
            />
          ))}
          <Chip label={calendarOpen ? '📅 閉じる' : '📅 日付を選ぶ'} onPress={() => setCalendarOpen((v) => !v)} />
        </View>
        {calendarOpen && (
          <Calendar
            value={draft.dueDate}
            onSelect={(d) => {
              set({ dueDate: d });
              setCalendarOpen(false);
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>
          <Ionicons name="repeat" size={13} color={theme.subText} /> 繰り返し（ルーティン）
        </Text>
        <RepeatEditor value={draft.repeat} onChange={(repeat) => set({ repeat })} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>見積もり時間（任意）</Text>
        <View style={styles.chips}>
          <Chip label="なし" selected={draft.estimateMinutes === null} onPress={() => set({ estimateMinutes: null })} />
          {estimateOptions.map((option) => (
            <Chip
              key={option.minutes}
              label={option.label}
              selected={draft.estimateMinutes === option.minutes}
              onPress={() => set({ estimateMinutes: option.minutes })}
            />
          ))}
          {/* 選択肢にない時間（AI の推定などで入った値）も表示する */}
          {draft.estimateMinutes !== null && !estimateOptions.some((o) => o.minutes === draft.estimateMinutes) && (
            <Chip label={formatMinutes(draft.estimateMinutes)} selected onPress={() => {}} />
          )}
        </View>
      </View>

      {/* 区切る対象になる大きさのときだけ出す */}
      {planSettings.split.enabled &&
        draft.estimateMinutes !== null &&
        draft.estimateMinutes >= planSettings.split.minTaskMinutes && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.rowText, { color: theme.text }]}>区切って進めてもよい</Text>
                <Text style={[styles.hint, { color: theme.subText }]}>
                  オフにすると、プランに入れるときは全部の時間をとります（途中で止められない用事など）
                </Text>
              </View>
              <Toggle
                value={draft.allowSplit}
                onValueChange={(allowSplit) => set({ allowSplit })}
              />
            </View>
          </View>
        )}

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>プロジェクト</Text>
        <View style={styles.chips}>
          <Chip label="なし" selected={draft.projectId === null} onPress={() => set({ projectId: null })} />
          {projects.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              dotColor={p.color}
              selected={draft.projectId === p.id}
              onPress={() => set({ projectId: p.id })}
            />
          ))}
          <Chip
            label="＋ 新規"
            onPress={() => {
              waitingForProject.current = projects.length;
              router.push('/project/edit');
            }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.switchRow}>
          <Text style={[styles.rowText, { color: theme.text }]}>
            <Ionicons name="sunny-outline" size={16} color={theme.primary} /> 今日やる
          </Text>
          <Toggle
            value={draft.plannedToday}
            onValueChange={(plannedToday) => set({ plannedToday })}
          />
        </View>
      </View>

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={[styles.button, { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.4 }]}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{submitLabel}</Text>
      </Pressable>

      {onDelete && (
        <Pressable onPress={remove} style={styles.removeButton} hitSlop={8}>
          <Text style={[styles.removeText, { color: theme.danger }]}>このタスクを削除</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    marginLeft: 4,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  noteInput: {
    fontSize: 15,
    lineHeight: 21,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 16,
  },
  switchLabel: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
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
  removeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 15,
  },
});
