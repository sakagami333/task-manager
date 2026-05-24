import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGauge, faListCheck, faFolder, faPlus, faClipboardList, faPen, faGripVertical, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api/client';
import type { Project } from '../types';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 208; // w-52

function ProjectForm({ onClose, project }: { onClose: () => void; project?: Project }) {
  const qc = useQueryClient();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? '#3B82F6');
  const create = useMutation({ mutationFn: api.projects.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); } });
  const update = useMutation({ mutationFn: ({ id, data }: any) => api.projects.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); } });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (project) update.mutate({ id: project.id, data: { name, description, color } });
    else create.mutate({ name, description, color });
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-gray-50 border border-gray-200 rounded mt-2">
      <div className="mb-2">
        <label className="form-label">プロジェクト名</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} required autoFocus />
      </div>
      <div className="mb-2">
        <label className="form-label">概要</label>
        <textarea className="form-input h-16 resize-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="プロジェクトの概要を入力..." />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <label className="form-label mb-0">色</label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-7 w-12 rounded cursor-pointer border border-gray-300" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">{project ? '更新' : '追加'}</button>
        <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
      </div>
    </form>
  );
}

function SortableProjectItem({
  project,
  editingId,
  onEdit,
  onCloseEdit,
}: {
  project: Project;
  editingId: number | null;
  onEdit: (p: Project) => void;
  onCloseEdit: () => void;
}) {
  const location = useLocation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const isActive = location.pathname === `/projects/${project.id}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (editingId === project.id) {
    return (
      <li ref={setNodeRef} style={style}>
        <ProjectForm project={project} onClose={onCloseEdit} />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors group ${isActive ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
        {/* ドラッグハンドル */}
        <span
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-white/50' : 'text-gray-300'}`}
        >
          <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
        </span>
        <Link to={`/projects/${project.id}`} className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
          <span className="flex-1 truncate">{project.name}</span>
        </Link>
        {project.open_count != null && (
          <span className={`text-xs rounded-full px-1.5 py-0.5 flex-shrink-0 ${isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {project.open_count}
          </span>
        )}
        <button
          onClick={e => { e.preventDefault(); onEdit(project); }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isActive ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          title="プロジェクト名を編集"
        >
          <FontAwesomeIcon icon={faPen} className="text-xs" />
        </button>
      </div>
    </li>
  );
}

function Sidebar({ width, onResizeStart }: { width: number; onResizeStart: (e: React.MouseEvent) => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects.list });
  const [localProjects, setLocalProjects] = useState<Project[]>([]);

  useEffect(() => { setLocalProjects(projects); }, [projects]);

  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.projects.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localProjects.findIndex(p => p.id === active.id);
    const newIndex = localProjects.findIndex(p => p.id === over.id);
    const reordered = arrayMove(localProjects, oldIndex, newIndex);
    setLocalProjects(reordered);
    reorder.mutate(reordered.map(p => p.id));
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className="flex-shrink-0 bg-white border-r border-gray-200 min-h-screen relative"
      style={{ width }}
    >
      <nav className="p-3 overflow-hidden">
        <div className="mb-4">
          <Link
            to="/"
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm font-medium transition-colors ${isActive('/') ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <FontAwesomeIcon icon={faGauge} className="w-4 flex-shrink-0" />
            <span className="truncate">ダッシュボード</span>
          </Link>
          <Link
            to="/tasks"
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm font-medium transition-colors mt-1 ${isActive('/tasks') ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <FontAwesomeIcon icon={faListCheck} className="w-4 flex-shrink-0" />
            <span className="truncate">全タスク</span>
          </Link>
          <Link
            to="/logs"
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm font-medium transition-colors mt-1 ${isActive('/logs') ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <FontAwesomeIcon icon={faClockRotateLeft} className="w-4 flex-shrink-0" />
            <span className="truncate">操作ログ</span>
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FontAwesomeIcon icon={faFolder} />プロジェクト
            </span>
            <button onClick={() => setShowForm(v => !v)} className="text-green-700 hover:text-green-900" title="プロジェクト追加">
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>

          {showForm && <ProjectForm onClose={() => setShowForm(false)} />}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {localProjects.map(p => (
                  <SortableProjectItem
                    key={p.id}
                    project={p}
                    editingId={editingProject?.id ?? null}
                    onEdit={setEditingProject}
                    onCloseEdit={() => setEditingProject(null)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      {/* リサイズハンドル */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-green-400 active:bg-green-500 transition-colors"
        title="ドラッグで幅を変更"
      />
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? Number(saved) : SIDEBAR_DEFAULT;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + e.clientX - startX.current));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(w => { localStorage.setItem('sidebarWidth', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-800 text-white px-4 py-2 flex items-center gap-4 shadow">
        <Link to="/" className="text-white font-bold text-lg tracking-wide hover:opacity-90 flex items-center gap-2">
          <FontAwesomeIcon icon={faClipboardList} />
          TaskBoard
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="text-green-200 hover:text-white">ホーム</Link>
          <Link to="/tasks" className="text-green-200 hover:text-white">タスク一覧</Link>
        </nav>
      </header>
      <div className="flex flex-1">
        <Sidebar width={sidebarWidth} onResizeStart={handleResizeStart} />
        <main className="flex-1 p-4 min-w-0">{children}</main>
      </div>
    </div>
  );
}
