import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';

type Props = {
  hour: number;
  minute: number;
  onChange: (time: { hour: number; minute: number }) => void;
};

const MINUTE_STEP = 5;

// 時と分を −/＋ で変える（分は5分刻み。0時↔23時、0分↔55分で一周する）
export function TimeEditor({ hour, minute, onChange }: Props) {
  const theme = useTheme();
  const changeHour = (delta: number) => onChange({ hour: (hour + delta + 24) % 24, minute });
  const changeMinute = (delta: number) => {
    const rounded = Math.round(minute / MINUTE_STEP) * MINUTE_STEP;
    onChange({ hour, minute: (rounded + delta * MINUTE_STEP + 60) % 60 });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Stepper value={`${hour}時`} label="時" onMinus={() => changeHour(-1)} onPlus={() => changeHour(1)} />
      <Stepper
        value={`${String(minute).padStart(2, '0')}分`}
        label="分"
        onMinus={() => changeMinute(-1)}
        onPlus={() => changeMinute(1)}
      />
    </View>
  );
}

function Stepper(props: { value: string; label: string; onMinus: () => void; onPlus: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable onPress={props.onMinus} hitSlop={8} accessibilityLabel={`${props.label}を減らす`} style={styles.button}>
        <Ionicons name="remove-circle-outline" size={28} color={theme.primary} />
      </Pressable>
      <Text style={[styles.value, { color: theme.text }]}>{props.value}</Text>
      <Pressable onPress={props.onPlus} hitSlop={8} accessibilityLabel={`${props.label}を増やす`} style={styles.button}>
        <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'center',
  },
});
