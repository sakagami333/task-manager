import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faSpinner, faPause, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import type { Status } from '../types';
import { formatDate } from '../utils/date';

const STATUS_CONFIG: Record<Status, { label: string; cls: string; icon: typeof faCircle }> = {
  open:        { label: '未着手',   cls: 'bg-white text-gray-700 border border-gray-400', icon: faCircle },
  in_progress: { label: '進行中',   cls: 'bg-blue-600 text-white',                        icon: faSpinner },
  on_hold:     { label: '保留',     cls: 'bg-amber-400 text-white',                       icon: faPause },
  closed:      { label: '完了',     cls: 'bg-gray-500 text-white',                        icon: faCircleXmark },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${cfg.cls}`}>
      <FontAwesomeIcon icon={cfg.icon} className="text-[10px]" />
      {cfg.label}
    </span>
  );
}

export function DueDateLabel({ dueDate, status }: { dueDate: string | null; status?: Status }) {
  if (!dueDate) return <span className="text-gray-400">-</span>;
  const done = status === 'closed';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  let cls = 'text-gray-700';
  let suffix = '';
  if (!done) {
    if (diff < 0)        { cls = 'text-red-600 font-semibold'; suffix = ` (${Math.abs(diff)}日超過)`; }
    else if (diff === 0) { cls = 'text-red-500 font-semibold'; suffix = ' (今日)'; }
    else if (diff <= 3)  { cls = 'text-orange-600 font-medium'; suffix = ` (あと${diff}日)`; }
  }
  return <span className={cls}>{formatDate(dueDate)}{suffix}</span>;
}
