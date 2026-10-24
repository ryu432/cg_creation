import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { notify } from '@/lib/confirm';

/** お問い合わせ（まだ窓口がないので、準備中と知らせるだけ） */
export function openContact() {
  notify('お問い合わせ', 'お問い合わせの窓口は準備中です。');
}

// 画面右上のボタン：使い方（チュートリアル）とお問い合わせ
export function HeaderActions() {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/tutorial')} hitSlop={8} accessibilityLabel="使い方">
        <Ionicons name="help-circle-outline" size={24} color={theme.subText} />
      </Pressable>
      <Pressable onPress={openContact} hitSlop={8} accessibilityLabel="お問い合わせ">
        <Ionicons name="mail-outline" size={22} color={theme.subText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
});
