import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus, faDiagramSuccessor, faChevronDown, faChevronRight, faLevelUpAlt, faGripVertical, faCopy } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import type { Task, Status } from '../types';
import { DueDateLabel } from './Badges';
import { TaskForm } from './TaskForm';
import { formatDateTime } from '../utils/date';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'open',        label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'on_hold',     label: '保留' },
  { value: 'closed',      label: '完了' },
];

const CLEAR = '__CLEAR__';

type DropZone = 'before' | 'child' | 'after';

interface DropState { taskId: number; zone: DropZone }
interface ContextMenuState { x: number; y: number; task: Task }

// ツリーからタスクの親と兄弟リストを探す
function findParentAndSiblings(
  tasks: Task[],
  targetId: number,
  parent: Task | null = null,
): { parent: Task | null; siblings: Task[] } | null {
  const level = parent ? (parent.children ?? []) : tasks;
  for (const t of level) {
    if (t.id === targetId) return { parent, siblings: level };
    if (t.children?.length) {
      const res = findParentAndSiblings(t.children, targetId, t);
      if (res) return res;
    }
  }
  return null;
}

function TaskRow({
  task, depth = 0, invalidateKey, showProject = true, onRightClick,
  draggingId, dropState, onDragStart, onDragEnd, onDragOverRow, onDropOnRow,
  selectedIds, onToggleSelect,
}: {
  task: Task;
  depth?: number;
  invalidateKey: readonly unknown[];
  showProject?: boolean;
  onRightClick: (e: React.MouseEvent, task: Task) => void;
  draggingId: number | null;
  dropState: DropState | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOverRow: (id: number, zone: DropZone) => void;
  onDropOnRow: (id: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = task.children && task.children.length > 0;

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) => api.tasks.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  });
  const deleteTask = useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  });

  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
    && task.status !== 'closed';

  const baseBg = isOverdue          ? 'bg-red-50 hover:bg-red-100'
    : task.status === 'in_progress' ? 'bg-blue-50 hover:bg-blue-100'
    : task.status === 'on_hold'     ? 'bg-amber-50 hover:bg-amber-100'
    : task.status === 'closed'      ? 'bg-gray-100 hover:bg-gray-200'
    : 'hover:bg-gray-50';

  const isDragging  = draggingId === task.id;
  const activeZone  = dropState?.taskId === task.id ? dropState.zone : null;

  const handleDragStart = (e: React.DragEvent) => {
    if ((e.target as HTMLElement).closest('a, button, select, input, [data-no-drag]')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
    // ブラウザの半透明ゴーストを消す（1×1 透明画像）
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    onDragStart(task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    onDragOverRow(task.id, ratio < 0.3 ? 'before' : ratio < 0.7 ? 'child' : 'after');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDropOnRow(task.id);
  };

  const sharedProps = { draggingId, dropState, onDragStart, onDragEnd, onDragOverRow, onDropOnRow, selectedIds, onToggleSelect };

  return (
    <>
      <tr
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={e => { e.preventDefault(); onRightClick(e, task); }}
        className={`transition-colors ${isDragging ? 'opacity-40' : ''} ${activeZone === 'child' ? 'bg-green-50 ring-2 ring-inset ring-green-400' : baseBg} ${task.status === 'closed' ? 'text-gray-400' : ''}`}
        style={{
          outline: activeZone === 'before' ? '2px solid #16a34a' : activeZone === 'after' ? '2px solid #16a34a' : undefined,
          outlineOffset: activeZone === 'before' ? '-1px' : activeZone === 'after' ? '-1px' : undefined,
          boxShadow: activeZone === 'before' ? 'inset 0 2px 0 #16a34a' : activeZone === 'after' ? 'inset 0 -2px 0 #16a34a' : undefined,
        }}
      >
        <td className="table-cell w-8 text-center" data-no-drag="" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.has(task.id)}
            onChange={() => onToggleSelect(task.id)}
            className="w-4 h-4 rounded cursor-pointer"
          />
        </td>
        <td className="table-cell w-6 text-center text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing select-none">
          <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
        </td>
        <td className="table-cell w-10 text-gray-400 text-xs">{task.id}</td>
        <td className="table-cell">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {hasChildren && (
              <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600 w-4 text-center">
                <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-xs" />
              </button>
            )}
            {!hasChildren && depth > 0 && (
              <span className="w-4 text-gray-300 text-center">
                <FontAwesomeIcon icon={faLevelUpAlt} className="text-xs rotate-90" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Link
                  to={`/tasks/${task.id}`}
                  className={`hover:underline font-medium ${task.status === 'closed' ? 'text-gray-400' : 'text-blue-700'}`}
                >
                  {task.title}
                </Link>
                {hasChildren && (
                  <span className="text-xs text-gray-400 ml-1">({task.children!.length})</span>
                )}
              </div>
              {task.description && (
                <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">
                  {task.description.slice(0, 140)}
                </p>
              )}
            </div>
          </div>
        </td>
        {showProject && (
          <td className="table-cell">
            {task.project_name && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: task.project_color ?? '#999' }} />
                <span className="text-gray-600">{task.project_name}</span>
              </span>
            )}
          </td>
        )}
        <td className="table-cell">
          <select
            value={task.status}
            onChange={e => updateStatus.mutate({ id: task.id, status: e.target.value as Status })}
            className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="table-cell text-xs"><DueDateLabel dueDate={task.due_date} status={task.status} /></td>
        <td className="table-cell text-xs text-gray-400">{formatDateTime(task.updated_at)}</td>
        <td className="table-cell text-right">
          <button
            onClick={() => { if (confirm(`「${task.title}」を削除しますか？`)) deleteTask.mutate(task.id); }}
            className="text-red-400 hover:text-red-600 px-1"
            title="削除"
          >
            <FontAwesomeIcon icon={faTrash} className="text-xs" />
          </button>
        </td>
      </tr>
      {expanded && hasChildren && task.children!.map(child => (
        <TaskRow
          key={child.id}
          task={child}
          depth={depth + 1}
          invalidateKey={invalidateKey}
          showProject={showProject}
          onRightClick={onRightClick}
          {...sharedProps}
        />
      ))}
    </>
  );
}

interface Props {
  tasks: Task[];
  queryKey: readonly unknown[];
  showProject?: boolean;
}

export function TaskTable({ tasks, queryKey, showProject = true }: Props) {
  const qc = useQueryClient();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [subtaskTarget, setSubtaskTarget] = useState<Task | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);

  // 一括選択
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allTaskIds = useMemo(() => {
    const ids: number[] = [];
    const collect = (list: Task[]) => list.forEach(t => { ids.push(t.id); if (t.children?.length) collect(t.children); });
    collect(tasks);
    return ids;
  }, [tasks]);

  const toggleSelect = useCallback((id: number) => setSelectedIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  }), []);

  const allChecked = allTaskIds.length > 0 && allTaskIds.every(id => selectedIds.has(id));
  const someChecked = allTaskIds.some(id => selectedIds.has(id)) && !allChecked;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked;
  }, [someChecked]);

  const createSubtask = useMutation({
    mutationFn: (data: Partial<Task>) => api.tasks.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setSubtaskTarget(null); },
  });

  // 複製
  const [duplicateTarget, setDuplicateTarget] = useState<Task | null>(null);
  const [dupTitle, setDupTitle] = useState('');
  const [dupDesc,  setDupDesc]  = useState('');
  useEffect(() => {
    if (duplicateTarget) {
      setDupTitle('');
      setDupDesc(duplicateTarget.description ?? '');
    }
  }, [duplicateTarget]);
  const duplicateTask = useMutation({
    mutationFn: () => api.tasks.duplicate(duplicateTarget!.id, { title: dupTitle, description: dupDesc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setDuplicateTarget(null); },
  });

  const moveTask = useMutation({
    mutationFn: ({ id, parentId, beforeId }: { id: number; parentId: number | null; beforeId: number | null }) =>
      api.tasks.move(id, parentId, beforeId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const batchUpdateMutation = useMutation({
    mutationFn: () => {
      const fields: { status?: string; start_date?: string | null; due_date?: string | null } = {};
      if (bulkStatus) fields.status = bulkStatus;
      if (bulkStartDate === CLEAR) fields.start_date = null;
      else if (bulkStartDate) fields.start_date = bulkStartDate;
      if (bulkDueDate === CLEAR) fields.due_date = null;
      else if (bulkDueDate) fields.due_date = bulkDueDate;
      return api.tasks.batchUpdate([...selectedIds], fields);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setSelectedIds(new Set());
      setBulkStatus(''); setBulkStartDate(''); setBulkDueDate('');
    },
  });

  const hasChanges = !!(bulkStatus || bulkStartDate || bulkDueDate);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    if (contextMenu) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  const handleRightClick = (e: React.MouseEvent, task: Task) => {
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  const handleCreateSubtask = () => {
    if (!contextMenu) return;
    setSubtaskTarget(contextMenu.task);
    setContextMenu(null);
  };

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropState(null);
  }, []);

  const handleDropOnRow = useCallback((targetId: number) => {
    if (!draggingId || !dropState || draggingId === targetId) {
      setDraggingId(null);
      setDropState(null);
      return;
    }

    const { zone } = dropState;

    if (zone === 'child') {
      moveTask.mutate({ id: draggingId, parentId: targetId, beforeId: null });
    } else {
      const res = findParentAndSiblings(tasks, targetId);
      if (!res) { setDraggingId(null); setDropState(null); return; }
      const { parent, siblings } = res;
      const targetIdx = siblings.findIndex(s => s.id === targetId);
      if (zone === 'before') {
        moveTask.mutate({ id: draggingId, parentId: parent?.id ?? null, beforeId: targetId });
      } else {
        const next = siblings[targetIdx + 1];
        moveTask.mutate({ id: draggingId, parentId: parent?.id ?? null, beforeId: next?.id ?? null });
      }
    }

    setDraggingId(null);
    setDropState(null);
  }, [draggingId, dropState, tasks, moveTask]);

  if (tasks.length === 0) {
    return <div className="text-center py-12 text-gray-400">タスクがありません</div>;
  }

  const sharedProps = {
    draggingId, dropState,
    onDragStart: setDraggingId,
    onDragEnd: handleDragEnd,
    onDragOverRow: (id: number, zone: DropZone) => setDropState({ taskId: id, zone }),
    onDropOnRow: handleDropOnRow,
    selectedIds,
    onToggleSelect: toggleSelect,
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-header w-8 text-center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setSelectedIds(allChecked ? new Set() : new Set(allTaskIds))}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </th>
              <th className="table-header w-6"></th>
              <th className="table-header w-10">#</th>
              <th className="table-header">タイトル</th>
              {showProject && <th className="table-header">プロジェクト</th>}
              <th className="table-header w-24">ステータス</th>
              <th className="table-header w-36">期日</th>
              <th className="table-header w-32">更新日時</th>
              <th className="table-header w-12"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                invalidateKey={queryKey}
                showProject={showProject}
                onRightClick={handleRightClick}
                {...sharedProps}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 一括更新ツールバー */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-gray-300 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 flex-wrap justify-center">
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            {selectedIds.size}件選択中
          </span>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkStatus(''); setBulkStartDate(''); setBulkDueDate(''); }}
            className="text-gray-400 hover:text-gray-600 text-xs"
            title="選択を解除"
          >✕</button>
          <div className="w-px h-6 bg-gray-200" />

          {/* ステータス */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">ステータス</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              <option value="">（変更なし）</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* 開始日 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">開始日</span>
            {bulkStartDate === CLEAR ? (
              <>
                <span className="text-xs text-gray-400 italic">クリア</span>
                <button onClick={() => setBulkStartDate('')} className="text-xs text-blue-500 hover:text-blue-700">↩取消</button>
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={bulkStartDate}
                  onChange={e => setBulkStartDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                />
                {bulkStartDate && (
                  <button onClick={() => setBulkStartDate(CLEAR)} className="text-xs text-gray-400 hover:text-red-500">×クリア</button>
                )}
              </>
            )}
          </div>

          {/* 期日 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">期日</span>
            {bulkDueDate === CLEAR ? (
              <>
                <span className="text-xs text-gray-400 italic">クリア</span>
                <button onClick={() => setBulkDueDate('')} className="text-xs text-blue-500 hover:text-blue-700">↩取消</button>
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={bulkDueDate}
                  onChange={e => setBulkDueDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                />
                {bulkDueDate && (
                  <button onClick={() => setBulkDueDate(CLEAR)} className="text-xs text-gray-400 hover:text-red-500">×クリア</button>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => batchUpdateMutation.mutate()}
            disabled={!hasChanges || batchUpdateMutation.isPending}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {batchUpdateMutation.isPending ? '適用中…' : '適用する'}
          </button>
        </div>
      )}

      {/* 右クリックメニュー */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-100 truncate max-w-[200px]">
            {contextMenu.task.title}
          </div>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={handleCreateSubtask}
          >
            <FontAwesomeIcon icon={faDiagramSuccessor} className="text-gray-400" />
            サブタスクを作成
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => { setDuplicateTarget(contextMenu.task); setContextMenu(null); }}
          >
            <FontAwesomeIcon icon={faCopy} className="text-gray-400" />
            複製
          </button>
        </div>
      )}

      {/* 複製モーダル */}
      {duplicateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDuplicateTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-gray-700 mb-1">タスクを複製</h2>
            <p className="text-xs text-gray-400 mb-4">
              「{duplicateTarget.title}」と配下の子タスクをすべて複製します。<br />
              最上位タスクのタイトルと内容を変更できます。
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
            <input
              className="input w-full mb-3"
              value={dupTitle}
              onChange={e => setDupTitle(e.target.value)}
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
            <textarea
              className="input w-full mb-5"
              rows={4}
              value={dupDesc}
              onChange={e => setDupDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDuplicateTarget(null)}>キャンセル</button>
              <button
                className="btn-primary"
                disabled={!dupTitle.trim() || duplicateTask.isPending}
                onClick={() => duplicateTask.mutate()}
              >
                {duplicateTask.isPending ? '複製中…' : '複製する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブタスク作成モーダル */}
      {subtaskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSubtaskTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-gray-700 mb-1">サブタスクを作成</h2>
            <p className="text-xs text-gray-400 mb-4">親タスク：{subtaskTarget.title}</p>
            <TaskForm
              initial={{ project_id: subtaskTarget.project_id, parent_id: subtaskTarget.id }}
              onSubmit={d => createSubtask.mutate(d as Task)}
              onCancel={() => setSubtaskTarget(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
