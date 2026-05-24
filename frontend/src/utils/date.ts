const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** SQLite の "YYYY-MM-DD HH:MM:SS" も含め安全にパース */
function parse(str: string): Date {
  return new Date(str.replace(' ', 'T'));
}

/** 日付のみ → 2026/05/24 (日) */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = parse(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day} (${DAYS[d.getDay()]})`;
}

/** 日時 → 2026/05/24 (日) 14:30 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = parse(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} (${DAYS[d.getDay()]}) ${h}:${min}`;
}
