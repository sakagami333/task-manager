import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faPlus, faComment, faPaperPlane, faDiagramSuccessor } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { TaskForm } from '../components/TaskForm';
import { StatusBadge, DueDateLabel } from '../components/Badges';
import { LinkifyText } from '../components/LinkifyText';
import { formatDateTime } from '../utils/date';
import type { Task } from '../types';

function CommentsSection({ taskId }: { taskId: number }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const QUERY_KEY = ['comments', taskId];

  const { data: comments = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.comments.list(taskId),
  });

  const create = useMutation({
    mutationFn: (text: string) => api.comments.create(taskId, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); setBody(''); },
  });

  const remove = useMutation({
    mutationFn: (commentId: number) => api.comments.delete(taskId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    create.mutate(body);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (body.trim()) create.mutate(body);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FontAwesomeIcon icon={faComment} className="text-gray-400" />
        コメント {comments.length > 0 && <span className="text-sm font-normal text-gray-400">({comments.length})</span>}
      </h3>

      {comments.length > 0 && (
        <ul className="mb-4 space-y-3">
          {comments.map(c => (
            <li key={c.id} className="bg-gray-50 border border-gray-200 rounded p-3 group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                <button
                  onClick={() => { if (confirm('このコメントを削除しますか？')) remove.mutate(c.id); }}
                  className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  削除
                </button>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap"><LinkifyText text={c.body} /></p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="form-input h-20 resize-none mb-2"
          placeholder="コメントを入力... (Ctrl+Enter で送信)"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          disabled={!body.trim() || create.isPending}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faPaperPlane} className="mr-1.5" />
          {create.isPending ? '送信中...' : 'コメントを追加'}
        </button>
      </form>
    </div>
  );
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.tasks.get(Number(id)),
  });

  const update = useMutation({
    mutationFn: (data: Partial<Task>) => api.tasks.update(Number(id), data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (updated.project_id) {
        navigate(`/projects/${updated.project_id}`);
      } else {
        setEditing(false);
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: () => api.tasks.delete(Number(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); navigate(-1); },
  });

  const createSub = useMutation({
    mutationFn: (data: Partial<Task>) => api.tasks.create({ ...data, parent_id: Number(id), project_id: task?.project_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task', id] }); qc.invalidateQueries({ queryKey: ['tasks'] }); setShowSubForm(false); },
  });

  const deleteSub = useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', id] }),
  });

  if (isLoading) return <div className="text-gray-400 p-8 text-center">読み込み中...</div>;
  if (!task) return <div className="text-red-500 p-8 text-center">タスクが見つかりません</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:underline text-blue-600">ホーム</Link>
        <span>/</span>
        {task.project_name && (
          <>
            <Link to={`/projects/${task.project_id}`} className="hover:underline text-blue-600">{task.project_name}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-700">#{task.id}</span>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-800 flex-1">{task.title}</h1>
            <div className="flex gap-2 flex-shrink-0">
              <button className="btn-secondary flex items-center gap-1.5" onClick={() => setEditing(v => !v)}>
                <FontAwesomeIcon icon={faPen} className="text-xs" />編集
              </button>
              <button className="btn-danger flex items-center gap-1.5" onClick={() => { if (confirm('削除しますか？')) deleteTask.mutate(); }}>
                <FontAwesomeIcon icon={faTrash} className="text-xs" />削除
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-3">
            <StatusBadge status={task.status} />
            {task.project_name && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-gray-300 rounded px-2 py-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: task.project_color ?? '#999' }} />
                {task.project_name}
              </span>
            )}
          </div>
        </div>

        {editing ? (
          <div className="p-4">
            <TaskForm
              initial={task}
              onSubmit={d => update.mutate(d)}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="p-4">
            <table className="text-sm w-full mb-4">
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-500 font-medium w-24">期日</td>
                  <td className="py-1.5"><DueDateLabel dueDate={task.due_date} status={task.status} /></td>
                  <td className="py-1.5 pr-4 text-gray-500 font-medium w-24">作成日時</td>
                  <td className="py-1.5 text-gray-600">{formatDateTime(task.created_at)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-500 font-medium">更新日時</td>
                  <td className="py-1.5 text-gray-600">{formatDateTime(task.updated_at)}</td>
                  {task.parent_id && (
                    <>
                      <td className="py-1.5 pr-4 text-gray-500 font-medium">親タスク</td>
                      <td><Link to={`/tasks/${task.parent_id}`} className="text-blue-600 hover:underline">#{task.parent_id}</Link></td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>

            {task.description && (
              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">説明</h3>
                <p className="text-gray-700 whitespace-pre-wrap text-sm"><LinkifyText text={task.description} /></p>
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FontAwesomeIcon icon={faDiagramSuccessor} className="text-gray-400" />
              サブタスク {task.children && task.children.length > 0 && `(${task.children.length})`}
            </h3>
            <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => setShowSubForm(v => !v)}>
              <FontAwesomeIcon icon={faPlus} />追加
            </button>
          </div>

          {showSubForm && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <TaskForm
                parentId={task.id}
                onSubmit={d => createSub.mutate(d as Task)}
                onCancel={() => setShowSubForm(false)}
              />
            </div>
          )}

          {task.children && task.children.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {task.children.map(child => (
                <li key={child.id} className="py-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={child.status === 'closed' || child.status === 'resolved'}
                    onChange={e => update.mutate({ ...child, status: e.target.checked ? 'closed' : 'open' })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <Link to={`/tasks/${child.id}`} className={`flex-1 text-sm hover:underline ${child.status === 'closed' ? 'line-through text-gray-400' : 'text-blue-700'}`}>
                    {child.title}
                  </Link>
                  <DueDateLabel dueDate={child.due_date} status={child.status} />
                  <button
                    onClick={() => { if (confirm('削除しますか？')) deleteSub.mutate(child.id); }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !showSubForm && <p className="text-gray-400 text-sm">サブタスクはありません</p>
          )}
        </div>

        <CommentsSection taskId={task.id} />
      </div>
    </div>
  );
}
