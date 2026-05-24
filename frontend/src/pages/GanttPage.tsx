import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import type { Task } from '../types';

// ステータス → 進捗率
const STATUS_PROGRESS: Record<string, number> = {
  open: 0, in_progress: 50, on_hold: 30, resolved: 90, closed: 100,
};
// ステータス → バー色
const STATUS_COLOR: Record<string, string> = {
  open:        '#9ca3af',
  in_progress: '#3b82f6',
  on_hold:     '#f59e0b',
  resolved:    '#10b981',
  closed:      '#6b7280',
};

function resolveStart(task: Task): Date {
  if (task.start_date) return new Date(task.start_date);
  if (task.due_date) {
    const d = new Date(task.due_date);
    d.setDate(d.getDate() - 3);
    return d;
  }
  return new Date();
}

function resolveEnd(task: Task, start: Date): Date {
  if (task.due_date) {
    const end = new Date(task.due_date);
    if (end <= start) { const f = new Date(start); f.setDate(f.getDate() + 1); return f; }
    return end;
  }
  const f = new Date(start);
  f.setDate(f.getDate() + 7);
  return f;
}

function hasFallback(task: Task): boolean {
  return !task.start_date || !task.due_date;
}

function toGantt(task: Task, parentId?: string): GanttTask {
  const start = resolveStart(task);
  const end   = resolveEnd(task, start);
  return {
    id:       String(task.id),
    name:     task.title,
    start,
    end,
    type:     'task',
    progress: STATUS_PROGRESS[task.status] ?? 0,
    project:  parentId,
    isDisabled: false,
    styles: {
      backgroundColor:     STATUS_COLOR[task.status] ?? '#9ca3af',
      backgroundSelectedColor: STATUS_COLOR[task.status] ?? '#9ca3af',
      progressColor:       '#ffffff55',
      progressSelectedColor: '#ffffff55',
    },
  };
}

function flattenToGantt(tasks: Task[], parentId?: string): GanttTask[] {
  const result: GanttTask[] = [];
  for (const t of tasks) {
    result.push(toGantt(t, parentId));
    if (t.children?.length) result.push(...flattenToGantt(t.children, String(t.id)));
  }
  return result;
}

const VIEW_LABELS: [ViewMode, string][] = [
  [ViewMode.Day,   '日'],
  [ViewMode.Week,  '週'],
  [ViewMode.Month, '月'],
];

export function GanttPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects.list });
  const project = projects.find(p => p.id === projectId);

  const QUERY_KEY = ['tasks', 'project', projectId, 'gantt'];
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.tasks.list({ project_id: String(projectId) }),
  });

  const ganttTasks = useMemo(() => flattenToGantt(tasks), [tasks]);
  const anyFallback = useMemo(() => {
    const check = (list: Task[]): boolean =>
      list.some(t => hasFallback(t) || (t.children ? check(t.children) : false));
    return check(tasks);
  }, [tasks]);

  const handleDateChange = async (task: GanttTask) => {
    await api.tasks.update(Number(task.id), {
      start_date: task.start.toISOString().split('T')[0],
      due_date:   task.end.toISOString().split('T')[0],
    });
    qc.invalidateQueries({ queryKey: QUERY_KEY });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const columnWidth = viewMode === ViewMode.Day ? 60 : viewMode === ViewMode.Week ? 120 : 280;

  return (
    <div>
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
        <div className="flex items-center gap-3">
          {project && <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: project.color }} />}
          <h1 className="text-lg font-bold text-gray-700">{project?.name ?? 'プロジェクト'} — ガントチャート</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* ViewMode 切り替え */}
          <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
            {VIEW_LABELS.map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 transition-colors ${viewMode === mode ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to={`/projects/${projectId}`} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FontAwesomeIcon icon={faArrowLeft} />タスク一覧
          </Link>
        </div>
      </div>

      {/* 推定表示の注記 */}
      {anyFallback && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          開始日または期日が未設定のタスクは推定日程で表示しています。タスク編集フォームで日程を設定するか、バーをドラッグして調整してください。
        </div>
      )}

      {/* ガントチャート本体 */}
      {isLoading ? (
        <div className="card text-center py-16 text-gray-400">読み込み中...</div>
      ) : ganttTasks.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">タスクがありません</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onProgressChange={() => {}}
            listCellWidth="180px"
            columnWidth={columnWidth}
            locale="ja-JP"
            todayColor="rgba(16,185,129,0.12)"
            barCornerRadius={3}
            barFill={70}
            handleWidth={8}
            headerHeight={50}
            rowHeight={40}
            fontSize="13px"
          />
        </div>
      )}

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries({ '未着手': '#9ca3af', '進行中': '#3b82f6', '保留': '#f59e0b', '解決済み': '#10b981', '完了': '#6b7280' }).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
