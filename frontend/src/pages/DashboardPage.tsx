import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { DueDateLabel } from '../components/Badges';
import type { Task } from '../types';

function MiniTaskList({ tasks, emptyMsg }: { tasks: Task[]; emptyMsg: string }) {
  if (tasks.length === 0) return <p className="text-gray-400 text-xs py-2">{emptyMsg}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {tasks.map(t => (
        <li key={t.id} className="py-2 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <Link to={`/tasks/${t.id}`} className="text-blue-700 hover:underline text-sm font-medium truncate block">
              {t.title}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              {t.project_name && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.project_color ?? '#999' }} />
                  {t.project_name}
                </span>
              )}
              <span className="text-xs"><DueDateLabel dueDate={t.due_date} /></span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open:        { label: '未着手',   cls: 'bg-gray-200 text-gray-700' },
  in_progress: { label: '進行中',   cls: 'bg-blue-500 text-white' },
  closed:      { label: '完了',     cls: 'bg-gray-500 text-white' },
};

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.tasks.dashboard, refetchInterval: 30000 });

  if (isLoading) return <div className="text-gray-400 p-8 text-center">読み込み中...</div>;
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-lg font-bold text-gray-700 mb-4 pb-2 border-b border-gray-300">ダッシュボード</h1>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {data.statusCounts.map(s => {
          const cfg = STATUS_LABELS[s.status] ?? { label: s.status, cls: 'bg-gray-200' };
          return (
            <div key={s.status} className="card p-3 text-center">
              <div className={`text-2xl font-bold mb-1 ${s.status === 'open' ? 'text-gray-700' : s.status === 'in_progress' ? 'text-blue-600' : 'text-green-600'}`}>
                {s.count}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            期限切れ
            {data.overdue.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{data.overdue.length}</span>
            )}
          </h2>
          <MiniTaskList tasks={data.overdue} emptyMsg="期限切れのタスクはありません" />
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            今週の期限
            {data.dueThisWeek.length > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{data.dueThisWeek.length}</span>
            )}
          </h2>
          <MiniTaskList tasks={data.dueThisWeek} emptyMsg="今週期限のタスクはありません" />
        </div>
      </div>
    </div>
  );
}
