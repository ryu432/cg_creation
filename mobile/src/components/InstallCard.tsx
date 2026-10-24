import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { dismissInstallHint, isInstallHintDismissed, promptInstall, useInstallState } from '@/lib/pwa';

// Web 版の「今日」画面に出す「ホーム画面に追加」の案内。
// iPhone はしばらく開かないとデータが消えることがあるので、特に強くすすめる。× で閉じたら出さない（設定からは見られる）
export function InstallCard() {
  const theme = useTheme();
  const install = useInstallState();
  const [dismissed, setDismissed] = useState(() => Platform.OS !== 'web' || isInstallHintDismissed());

  if (dismissed || install.standalone || !(install.ios || install.canPrompt)) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name="phone-portrait-outline" size={20} color={theme.primary} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>ホーム画面に追加しましょう</Text>
        <Text style={[styles.sub, { color: theme.subText }]}>
          {install.ios
            ? 'Safari では、しばらく開かないとデータが消えることがあります。共有ボタン（□に↑）→「ホーム画面に追加」で、アプリのように使えて消えにくくなります。'
            : 'アプリのように、ホーム画面からすぐ開けるようになります。'}
        </Text>
        {install.canPrompt && (
          <Pressable onPress={promptInstall} style={[styles.button, { backgroundColor: theme.primary }]}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>ホーム画面に追加する</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={() => {
          dismissInstallHint();
          setDismissed(true);
        }}
        hitSlop={10}
        accessibilityLabel="案内を閉じる"
      >
        <Ionicons name="close" size={20} color={theme.subText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
