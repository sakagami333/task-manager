import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { formatDateTime } from '../utils/date';

const OPERATION_OPTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'MOVE', 'REORDER'];
const RESOURCE_OPTIONS  = ['', 'task', 'project', 'comment'];
const RESULT_OPTIONS    = ['', 'success', 'failure'];

const OPERATION_LABELS: Record<string, { label: string; cls: string }> = {
  CREATE:  { label: '作成',     cls: 'bg-blue-100 text-blue-700' },
  UPDATE:  { label: '更新',     cls: 'bg-amber-100 text-amber-700' },
  DELETE:  { label: '削除',     cls: 'bg-red-100 text-red-700' },
  MOVE:    { label: '移動',     cls: 'bg-purple-100 text-purple-700' },
  REORDER: { label: '並び替え', cls: 'bg-gray-100 text-gray-600' },
};

const RESOURCE_LABELS: Record<string, string> = {
  task:    'タスク',
  project: 'プロジェクト',
  comment: 'コメント',
};

export function LogsPage() {
  const [filters, setFilters] = useState({ operation: '', resource: '', result: '' });

  const params: Record<string, string> = { limit: '500' };
  if (filters.operation) params.operation = filters.operation;
  if (filters.resource)  params.resource  = filters.resource;
  if (filters.result)    params.result    = filters.result;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs', params],
    queryFn: () => api.logs.list(params),
    refetchInterval: 10000,
  });

  const set = (key: string, val: string) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-700">操作ログ</h1>
        <span className="text-xs text-gray-400">過去30日間 · 10秒毎に更新</span>
      </div>

      <div className="card mb-4 p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">操作</label>
          <select className="form-select w-32" value={filters.operation} onChange={e => set('operation', e.target.value)}>
            {OPERATION_OPTIONS.map(o => <option key={o} value={o}>{o || 'すべて'}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">対象</label>
          <select className="form-select w-32" value={filters.resource} onChange={e => set('resource', e.target.value)}>
            {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r ? RESOURCE_LABELS[r] : 'すべて'}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">結果</label>
          <select className="form-select w-28" value={filters.result} onChange={e => set('result', e.target.value)}>
            {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r === 'success' ? '成功' : r === 'failure' ? '失敗' : 'すべて'}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-400 self-end pb-1">{logs.length} 件</span>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">ログがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header w-36">日時</th>
                <th className="table-header w-24">操作</th>
                <th className="table-header w-24">対象</th>
                <th className="table-header w-16">ID</th>
                <th className="table-header">タイトル / 名前</th>
                <th className="table-header w-20">結果</th>
                <th className="table-header">詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const opCfg = OPERATION_LABELS[log.operation] ?? { label: log.operation, cls: 'bg-gray-100 text-gray-600' };
                const isFailure = log.result === 'failure';
                return (
                  <tr key={log.id} className={`transition-colors ${isFailure ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                    <td className="table-cell text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.operated_at)}</td>
                    <td className="table-cell">
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${opCfg.cls}`}>
                        {opCfg.label}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-600">
                      {RESOURCE_LABELS[log.resource] ?? log.resource}
                    </td>
                    <td className="table-cell text-xs text-gray-400">
                      {log.resource_id != null ? `#${log.resource_id}` : '-'}
                    </td>
                    <td className="table-cell text-gray-700 max-w-xs truncate">
                      {log.title ?? <span className="text-gray-400">-</span>}
                    </td>
                    <td className="table-cell">
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${isFailure ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700'}`}>
                        {isFailure ? '失敗' : '成功'}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-400 max-w-xs truncate">
                      {log.detail || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
