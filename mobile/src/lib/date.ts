// 日付は端末のローカル時刻で "YYYY-MM-DD" の文字列として扱う

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return toDateString(new Date());
}

export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

// 期限の表示用ラベル（今日 / 明日 / 昨日 / 10/24(金) など）
export function formatDueDate(dateString: string): string {
  const base = today();
  if (dateString === base) return '今日';
  if (dateString === addDays(base, 1)) return '明日';
  if (dateString === addDays(base, -1)) return '昨日';
  const [y, m, d] = dateString.split('-').map(Number);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
  return `${m}/${d}(${weekday})`;
}
