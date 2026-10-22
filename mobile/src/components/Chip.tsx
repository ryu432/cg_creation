import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  /** 指定すると、ラベルの左に色の丸を表示する（プロジェクト用） */
  dotColor?: string;
  onPress: () => void;
  onLongPress?: () => void;
};

export function Chip({ label, selected = false, dotColor, onPress, onLongPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor, borderColor: theme.surface }]} />}
      <Text style={{ color: selected ? theme.onPrimary : theme.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
});
