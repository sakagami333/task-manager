import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChartBar } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { TaskTable } from '../components/TaskTable';
import { TaskForm } from '../components/TaskForm';
import { LinkifyText } from '../components/LinkifyText';
import type { Task } from '../types';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects.list });
  const project = projects.find(p => p.id === projectId);

  const params: Record<string, string> = { project_id: String(projectId) };
  if (statusFilter) params.status = statusFilter;

  const QUERY_KEY = ['tasks', 'project', projectId, statusFilter];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.tasks.list(params),
  });

  const createTask = useMutation({
    mutationFn: (data: Partial<Task>) => api.tasks.create({ ...data, project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
        <div className="flex items-center gap-3">
          {project && <span className="w-4 h-4 rounded-full" style={{ background: project.color }} />}
          <h1 className="text-lg font-bold text-gray-700">{project?.name ?? 'プロジェクト'}</h1>
          {project?.description && <span className="text-sm text-gray-500"><LinkifyText text={project.description} /></span>}
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/projects/${projectId}/gantt`} className="btn-secondary flex items-center gap-1.5">
            <FontAwesomeIcon icon={faChartBar} />ガントチャート
          </Link>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowForm(v => !v)}>
            <FontAwesomeIcon icon={faPlus} />新しいタスク
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-4 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">タスク作成</h2>
          <TaskForm
            initial={{ project_id: projectId }}
            onSubmit={d => createTask.mutate(d as Task)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="card mb-4 p-3 flex gap-3 items-end">
        <div>
          <label className="form-label">ステータス</label>
          <select className="form-select w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="open,in_progress,on_hold">未完了</option>
            <option value="open">未着手のみ</option>
            <option value="in_progress">進行中のみ</option>
            <option value="on_hold">保留のみ</option>
            <option value="resolved">解決済みのみ</option>
            <option value="closed">完了のみ</option>
            <option value="">すべて</option>
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <TaskTable tasks={tasks} queryKey={QUERY_KEY} showProject={false} />
        )}
      </div>
    </div>
  );
}
