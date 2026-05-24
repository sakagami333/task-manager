export type Status = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';

export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  open_count?: number;
  total_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: Status;
  start_date: string | null;
  due_date: string | null;
  project_id: number | null;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  project_name?: string;
  project_color?: string;
  children?: Task[];
}

export interface Comment {
  id: number;
  task_id: number;
  body: string;
  created_at: string;
}

export interface OperationLog {
  id: number;
  operated_at: string;
  operation: string;
  resource: string;
  resource_id: number | null;
  title: string | null;
  result: 'success' | 'failure';
  detail: string;
}

export interface DashboardData {
  overdue: Task[];
  dueThisWeek: Task[];
  statusCounts: { status: string; count: number }[];
}
