import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import type { Task } from '../types';
import { formatDate } from '../utils/date';

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

// 日付を yyyy/mm/dd 形式にフォーマット
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// タイトル列幅（日付列の約20%増し）
const NAME_COL_WIDTH = '144px';

// カスタムタスクリストヘッダー
// （gantt-task-react の内部 CSS クラス名をそのまま利用）
function GanttTaskListHeader({ headerHeight, rowWidth, fontFamily, fontSize }: {
  headerHeight: number; rowWidth: string; fontFamily: string; fontSize: string;
}) {
  const sep = { height: headerHeight * 0.5, marginTop: headerHeight * 0.2 };
  return (
    <div className="_3_ygE" style={{ fontFamily, fontSize }}>
      <div className="_1nBOt" style={{ height: headerHeight - 2 }}>
        <div className="_WuQ0f" style={{ minWidth: NAME_COL_WIDTH }}>&nbsp;タスク名</div>
        <div className="_2eZzQ" style={sep} />
        <div className="_WuQ0f" style={{ minWidth: rowWidth }}>&nbsp;開始日</div>
        <div className="_2eZzQ" style={sep} />
        <div className="_WuQ0f" style={{ minWidth: rowWidth }}>&nbsp;期日</div>
      </div>
    </div>
  );
}

// カスタムタスクリストテーブル（From/To を yyyy/mm/dd で表示）
function GanttTaskListTable({ rowHeight, rowWidth, fontFamily, fontSize, tasks, setSelectedTask, onExpanderClick }: {
  rowHeight: number; rowWidth: string; fontFamily: string; fontSize: string; locale: string;
  tasks: GanttTask[]; selectedTaskId: string;
  setSelectedTask: (id: string) => void;
  onExpanderClick: (task: GanttTask) => void;
}) {
  return (
    <div className="_3ZbQT" style={{ fontFamily, fontSize }}>
      {tasks.map(t => {
        const expanderSymbol = t.hideChildren === false ? '▼' : t.hideChildren === true ? '▶' : '';
        return (
          <div
            className="_34SS0"
            style={{ height: rowHeight }}
            key={`${t.id}row`}
            onClick={() => setSelectedTask(t.id)}
          >
            <div className="_3lLk3" style={{ minWidth: NAME_COL_WIDTH, maxWidth: NAME_COL_WIDTH }} title={t.name}>
              <div className="_nI1Xw">
                <div
                  className={expanderSymbol ? '_2QjE6' : '_2TfEi'}
                  onClick={e => { e.stopPropagation(); if (expanderSymbol) onExpanderClick(t); }}
                >
                  {expanderSymbol}
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
              </div>
            </div>
            <div className="_3lLk3" style={{ minWidth: rowWidth, maxWidth: rowWidth }}>
              &nbsp;{fmtDate(t.start)}
            </div>
            <div className="_3lLk3" style={{ minWidth: rowWidth, maxWidth: rowWidth }}>
              &nbsp;{fmtDate(t.end)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// カスタムツールチップ（日付を YYYY/MM/DD (曜日) で表示）
function GanttTooltip({ task }: { task: GanttTask; fontSize: string; fontFamily: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '10px 14px', minWidth: 220, fontSize: 12 }}>
      <p style={{ fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>{task.name}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#4b5563' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#9ca3af', width: 40 }}>開始日</span>
          <span>{formatDate(task.start.toISOString())}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#9ca3af', width: 40 }}>期日</span>
          <span>{formatDate(task.end.toISOString())}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#9ca3af', width: 40 }}>進捗</span>
          <span>{task.progress}%</span>
        </div>
      </div>
    </div>
  );
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
  const ganttWrapRef = useRef<HTMLDivElement>(null);

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

  const columnWidth = viewMode === ViewMode.Day ? 36 : viewMode === ViewMode.Week ? 72 : 160;

  // ライブラリが描画した SVG テキストを修正:
  //   - Week 表示: "W##" → 週の開始日 (mm/dd)
  //   - Day  表示: "{曜日}, {日}" → 日付のみ表示、日曜=赤・土曜=青
  useEffect(() => {
    if (!ganttWrapRef.current || ganttTasks.length === 0) return;

    // Week モード用: チャート開始日を算出 (getMonday(最小start) - 7日)
    let chartStart: Date | null = null;
    if (viewMode === ViewMode.Week) {
      const firstStart = ganttTasks.reduce(
        (min, t) => (t.start < min ? t.start : min),
        ganttTasks[0].start,
      );
      const dayOfWeek = firstStart.getDay();
      chartStart = new Date(firstStart);
      chartStart.setDate(chartStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7);
      chartStart.setHours(0, 0, 0, 0);
    }

    const replace = () => {
      ganttWrapRef.current?.querySelectorAll('text').forEach(el => {
        const text = el.textContent ?? '';

        // Week 表示: "W##" → mm/dd
        if (chartStart && /^W\d{2}$/.test(text)) {
          const x = parseFloat(el.getAttribute('x') ?? '0');
          const colIdx = Math.round(x / columnWidth);
          const d = new Date(chartStart);
          d.setDate(d.getDate() + colIdx * 7);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          el.textContent = `${mm}/${dd}`;
          return;
        }

        // Day 表示: "{曜日}, {日}" → 日付のみ、日曜=赤・土曜=青
        const dayMatch = text.match(/^([日月火水木金土]), (\d{1,2})$/);
        if (dayMatch) {
          const [, weekday, dayNum] = dayMatch;
          el.textContent = dayNum;
          el.style.fill = weekday === '日' ? '#dc2626'  // 日曜日 → 赤
                        : weekday === '土' ? '#2563eb'  // 土曜日 → 青
                        : '';
        }
      });
    };

    // 描画完了後に置換（RAF + MutationObserver で再描画にも追従）
    const raf = requestAnimationFrame(replace);
    const observer = new MutationObserver(() => {
      let needsReplace = false;
      ganttWrapRef.current?.querySelectorAll('text').forEach(el => {
        const t = el.textContent ?? '';
        if (/^W\d{2}$/.test(t) || /^[日月火水木金土], \d{1,2}$/.test(t)) {
          needsReplace = true;
        }
      });
      if (needsReplace) replace();
    });
    if (ganttWrapRef.current) {
      observer.observe(ganttWrapRef.current, { childList: true, subtree: true });
    }
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [ganttTasks, viewMode, columnWidth]);

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
        <div className="card overflow-hidden p-0" ref={ganttWrapRef}>
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onProgressChange={() => {}}
            listCellWidth="90px"
            columnWidth={columnWidth}
            locale="ja-JP"
            todayColor="rgba(16,185,129,0.12)"
            barCornerRadius={2}
            barFill={65}
            handleWidth={6}
            headerHeight={38}
            rowHeight={28}
            fontSize="11px"
            TooltipContent={GanttTooltip}
            TaskListHeader={GanttTaskListHeader}
            TaskListTable={GanttTaskListTable}
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
