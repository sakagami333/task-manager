import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Task, Status } from '../types';

interface Props {
  initial?: Partial<Task>;
  parentId?: number | null;
  onSubmit: (data: Partial<Task>) => void;
  onCancel: () => void;
}

export function TaskForm({ initial, parentId, onSubmit, onCancel }: Props) {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects.list });
  const [form, setForm] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'open',
    due_date: null,
    project_id: null,
    parent_id: parentId ?? null,
    ...initial,
  });

  const set = (key: keyof Task, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="form-label">タイトル <span className="text-red-500">*</span></label>
        <input className="form-input" value={form.title ?? ''} onChange={e => set('title', e.target.value)} required autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">ステータス</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value as Status)}>
            <option value="open">未着手</option>
            <option value="in_progress">進行中</option>
            <option value="on_hold">保留</option>
            <option value="resolved">解決済み</option>
            <option value="closed">完了</option>
          </select>
        </div>
        <div>
          <label className="form-label">期日</label>
          <input type="date" className="form-input" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value || null)} />
        </div>
      </div>

      <div>
        <label className="form-label">プロジェクト</label>
        <select className="form-select" value={form.project_id ?? ''} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : null)}>
          <option value="">未設定</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="form-label">説明</label>
        <textarea className="form-input h-24 resize-none" value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">{initial?.id ? '更新' : '作成'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>キャンセル</button>
      </div>
    </form>
  );
}
