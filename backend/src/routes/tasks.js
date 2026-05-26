const express = require('express');
const router = express.Router();
const db = require('../db');
const { log } = require('../logger');

function buildTaskTree(tasks) {
  const map = {};
  tasks.forEach(t => { map[t.id] = { ...t, children: [] }; });
  const roots = [];
  tasks.forEach(t => {
    if (t.parent_id && map[t.parent_id]) {
      map[t.parent_id].children.push(map[t.id]);
    } else {
      roots.push(map[t.id]);
    }
  });
  return roots;
}

router.get('/', (req, res) => {
  const { project_id, status, search, flat } = req.query;
  let sql = `
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
  if (status) {
    const statuses = status.split(',');
    sql += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  if (search) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ` ORDER BY
    CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
    t.due_date ASC,
    t.sort_order, t.created_at`;

  const tasks = db.prepare(sql).all(...params);
  res.json(flat === '1' ? tasks : buildTaskTree(tasks));
});

router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekLater = new Date();
  weekLater.setDate(weekLater.getDate() + 7);
  const weekStr = weekLater.toISOString().split('T')[0];

  const overdue = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.due_date < ? AND t.status NOT IN ('closed','resolved') AND t.parent_id IS NULL
    ORDER BY t.due_date ASC
  `).all(today);

  const dueThisWeek = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.due_date >= ? AND t.due_date <= ? AND t.status NOT IN ('closed','resolved') AND t.parent_id IS NULL
    ORDER BY t.due_date ASC
  `).all(today, weekStr);

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks WHERE parent_id IS NULL GROUP BY status
  `).all();

  res.json({ overdue, dueThisWeek, statusCounts });
});

router.get('/:id', (req, res) => {
  const task = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const children = db.prepare(`
    SELECT t.*, p.name as project_name FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.parent_id = ? ORDER BY t.sort_order, t.created_at
  `).all(req.params.id);

  res.json({ ...task, children });
});

router.post('/', (req, res) => {
  const { title, description = '', status = 'open', start_date = null, due_date = null, project_id = null, parent_id = null } = req.body;
  if (!title) {
    log({ operation: 'CREATE', resource: 'task', result: 'failure', detail: 'title is required' });
    return res.status(400).json({ error: 'title is required' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO tasks (title, description, status, start_date, due_date, project_id, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, status, start_date || null, due_date || null, project_id || null, parent_id || null);
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(result.lastInsertRowid);
    log({ operation: 'CREATE', resource: 'task', resourceId: task.id, title: task.title, result: 'success' });
    res.status(201).json(task);
  } catch (e) {
    log({ operation: 'CREATE', resource: 'task', title, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    log({ operation: 'UPDATE', resource: 'task', resourceId: Number(req.params.id), result: 'failure', detail: 'Not found' });
    return res.status(404).json({ error: 'Not found' });
  }
  const { title, description, status, start_date, due_date, project_id, parent_id } = req.body;
  try {
    db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?,
        start_date = ?, due_date = ?, project_id = ?, parent_id = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      title ?? task.title,
      description ?? task.description,
      status ?? task.status,
      'start_date' in req.body ? (start_date || null) : task.start_date,
      'due_date' in req.body ? (due_date || null) : task.due_date,
      'project_id' in req.body ? (project_id || null) : task.project_id,
      'parent_id' in req.body ? (parent_id || null) : task.parent_id,
      req.params.id
    );
    const updated = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(req.params.id);
    log({ operation: 'UPDATE', resource: 'task', resourceId: updated.id, title: updated.title, result: 'success' });
    res.json(updated);
  } catch (e) {
    log({ operation: 'UPDATE', resource: 'task', resourceId: Number(req.params.id), title: task.title, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// タスクの移動（並び替え・親変更）
router.post('/move', (req, res) => {
  const { id, parent_id, before_id } = req.body;
  const taskId = Number(id);
  const newParentId = parent_id != null ? Number(parent_id) : null;
  const beforeId  = before_id  != null ? Number(before_id)  : null;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    log({ operation: 'MOVE', resource: 'task', resourceId: taskId, result: 'failure', detail: 'Not found' });
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const siblings = newParentId != null
      ? db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND id != ? ORDER BY sort_order, created_at').all(newParentId, taskId)
      : db.prepare('SELECT id FROM tasks WHERE parent_id IS NULL AND id != ? ORDER BY sort_order, created_at').all(taskId);

    const insertIdx = beforeId != null
      ? (() => { const i = siblings.findIndex(s => s.id === beforeId); return i === -1 ? siblings.length : i; })()
      : siblings.length;

    siblings.splice(insertIdx, 0, { id: taskId });

    db.prepare("UPDATE tasks SET parent_id = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(newParentId, taskId);
    siblings.forEach((s, i) => db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?').run(i * 10, s.id));

    log({ operation: 'MOVE', resource: 'task', resourceId: taskId, title: task.title, result: 'success', detail: `parent_id=${newParentId ?? 'null'}` });
    res.status(204).end();
  } catch (e) {
    log({ operation: 'MOVE', resource: 'task', resourceId: taskId, title: task.title, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// タスクの複製（配下の子タスクも再帰的にコピー）
router.post('/:id/duplicate', (req, res) => {
  const source = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
  if (!source) {
    log({ operation: 'DUPLICATE', resource: 'task', resourceId: Number(req.params.id), result: 'failure', detail: 'Not found' });
    return res.status(404).json({ error: 'Not found' });
  }

  const { title = source.title, description = source.description } = req.body;

  try {
    // 子タスクを再帰的に複製するヘルパー
    const copyChildren = (srcId, newParentId) => {
      const children = db.prepare(
        'SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort_order, created_at'
      ).all(srcId);
      for (const child of children) {
        const r = db.prepare(
          'INSERT INTO tasks (title, description, status, start_date, due_date, project_id, parent_id) VALUES (?,?,?,?,?,?,?)'
        ).run(child.title, child.description, child.status, child.start_date, child.due_date, child.project_id, newParentId);
        copyChildren(child.id, r.lastInsertRowid);
      }
    };

    // ルートタスクをタイトル・説明のみ差し替えて複製
    const rootResult = db.prepare(
      'INSERT INTO tasks (title, description, status, start_date, due_date, project_id, parent_id) VALUES (?,?,?,?,?,?,?)'
    ).run(title, description, source.status, source.start_date, source.due_date, source.project_id, source.parent_id);

    copyChildren(source.id, rootResult.lastInsertRowid);

    const newTask = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(rootResult.lastInsertRowid);

    log({ operation: 'DUPLICATE', resource: 'task', resourceId: newTask.id, title: newTask.title, result: 'success', detail: `source=${source.id}` });
    res.status(201).json(newTask);
  } catch (e) {
    log({ operation: 'DUPLICATE', resource: 'task', resourceId: Number(req.params.id), title: source.title, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(req.params.id);
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    log({ operation: 'DELETE', resource: 'task', resourceId: Number(req.params.id), title: task?.title ?? null, result: 'success' });
    res.status(204).end();
  } catch (e) {
    log({ operation: 'DELETE', resource: 'task', resourceId: Number(req.params.id), title: task?.title ?? null, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
