import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { DialogRequest, setWebDialogPresenter } from '@/lib/confirm';

type Pending = DialogRequest & { resolve: (value: unknown) => void };

// Web 用のダイアログ（スマホは Alert を使うので何も出さない）。
// confirm / choose / notify を呼ぶと、ここに表示される。外側をタップするか Esc でキャンセル
export function DialogHost() {
  const theme = useTheme();
  const [queue, setQueue] = useState<Pending[]>([]);
  const current = queue[0];
  const currentRef = useRef<Pending | undefined>(undefined);
  currentRef.current = current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setWebDialogPresenter(
      (request) => new Promise((resolve) => setQueue((prev) => [...prev, { ...request, resolve }])),
    );
    return () => setWebDialogPresenter(null);
  }, []);

  const close = (value: unknown) => {
    current?.resolve(value);
    setQueue((prev) => prev.slice(1));
  };

  // Esc でキャンセル（キャンセルのボタンがあればその値、なければ null）
  useEffect(() => {
    if (Platform.OS !== 'web' || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const pending = currentRef.current;
      if (!pending) return;
      pending.resolve(pending.buttons.find((b) => b.style === 'cancel')?.value ?? null);
      setQueue((prev) => prev.slice(1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (Platform.OS !== 'web' || !current) return null;

  const cancelValue = current.buttons.find((b) => b.style === 'cancel')?.value ?? null;
  // ボタンが3つ以上なら縦に並べる（「この回だけ削除」など長い文言が入るので）
  const vertical = current.buttons.length > 2;
  // 縦並びのときはキャンセルをいちばん下に
  const buttons = vertical
    ? [...current.buttons.filter((b) => b.style !== 'cancel'), ...current.buttons.filter((b) => b.style === 'cancel')]
    : current.buttons;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(cancelValue)}>
      <Pressable style={styles.backdrop} onPress={() => close(cancelValue)} accessibilityLabel="閉じる">
        {/* ダイアログの中を押しても閉じないように、ここで押下を受け止める */}
        <Pressable
          onPress={() => {}}
          style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.title, { color: theme.text }]}>{current.title}</Text>
          {current.message !== '' && <Text style={[styles.message, { color: theme.subText }]}>{current.message}</Text>}
          <View style={[styles.buttons, vertical ? styles.vertical : styles.horizontal]}>
            {buttons.map((b) => {
              const primary = b.style !== 'cancel';
              const color = b.style === 'destructive' ? theme.danger : primary ? theme.primary : theme.subText;
              return (
                <Pressable
                  key={b.label}
                  onPress={() => close(b.value)}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.button,
                    vertical && styles.buttonVertical,
                    { borderColor: primary ? color : theme.border, opacity: pressed ? 0.6 : hovered ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.buttonText, { color }]}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    cursor: 'auto',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
  buttons: {
    marginTop: 8,
    gap: 8,
  },
  horizontal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  vertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonVertical: {
    alignSelf: 'stretch',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
