import { Switch } from 'react-native';

import { useTheme } from '@/constants/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

// アプリの色に合わせたオン・オフのスイッチ（Web はオンのときのつまみの色を別に指定する必要がある）
export function Toggle({ value, onValueChange, disabled }: Props) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: theme.primary, false: theme.border }}
      thumbColor="#FFFFFF"
      {...({ activeThumbColor: '#FFFFFF' } as object)}
    />
  );
}
