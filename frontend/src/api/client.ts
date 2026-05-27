import type { Task, Project, DashboardData, Comment, OperationLog } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    create: (data: Partial<Project>) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Project>) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    reorder: (ids: number[]) => request<void>('/projects/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  },
  tasks: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Task[]>(`/tasks${qs}`);
    },
    dashboard: () => request<DashboardData>('/tasks/dashboard'),
    get: (id: number) => request<Task>(`/tasks/${id}`),
    create: (data: Partial<Task>) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Task>) => request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    move: (id: number, parentId: number | null, beforeId: number | null) =>
      request<void>('/tasks/move', { method: 'POST', body: JSON.stringify({ id, parent_id: parentId, before_id: beforeId }) }),
    duplicate: (id: number, data: { title: string; description: string }) =>
      request<Task>(`/tasks/${id}/duplicate`, { method: 'POST', body: JSON.stringify(data) }),
    batchUpdate: (ids: number[], fields: { status?: string; start_date?: string | null; due_date?: string | null }) =>
      request<void>('/tasks/batch-update', { method: 'POST', body: JSON.stringify({ ids, fields }) }),
  },
  logs: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<OperationLog[]>(`/logs${qs}`);
    },
  },
  comments: {
    list:   (taskId: number) => request<Comment[]>(`/tasks/${taskId}/comments`),
    create: (taskId: number, body: string) => request<Comment>(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    delete: (taskId: number, commentId: number) => request<void>(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
  },
};
