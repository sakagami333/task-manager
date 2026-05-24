import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { TaskTable } from '../components/TaskTable';
import { TaskForm } from '../components/TaskForm';
import type { Task } from '../types';

const QUERY_KEY = ['tasks'];

export function TasksPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<{ status: string; search: string }>({
    status: 'open,in_progress',
    search: '',
  });

  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => api.tasks.list(params),
  });

  const createTask = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); setShowForm(false); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-700">全タスク</h1>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowForm(v => !v)}>
          <FontAwesomeIcon icon={faPlus} />新しいタスク
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">タスク作成</h2>
          <TaskForm onSubmit={d => createTask.mutate(d as Task)} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="card mb-4 p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">ステータス</label>
          <select className="form-select w-40" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="open,in_progress,on_hold">未完了</option>
            <option value="open">未着手のみ</option>
            <option value="in_progress">進行中のみ</option>
            <option value="on_hold">保留のみ</option>
            <option value="resolved">解決済みのみ</option>
            <option value="closed">完了のみ</option>
            <option value="">すべて</option>
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="form-label">検索</label>
          <input className="form-input" placeholder="タイトル・説明で検索..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <TaskTable tasks={tasks} queryKey={[...QUERY_KEY, params]} />
        )}
      </div>
    </div>
  );
}
