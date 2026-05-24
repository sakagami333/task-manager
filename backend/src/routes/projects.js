const express = require('express');
const router = express.Router();
const db = require('../db');
const { log } = require('../logger');

router.get('/', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order, id').all();
  const counts = db.prepare(`
    SELECT project_id,
      SUM(CASE WHEN status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) as open_count,
      COUNT(*) as total_count
    FROM tasks WHERE parent_id IS NULL
    GROUP BY project_id
  `).all();
  const countMap = Object.fromEntries(counts.map(c => [c.project_id, c]));
  res.json(projects.map(p => ({ ...p, ...( countMap[p.id] || { open_count: 0, total_count: 0 }) })));
});

router.post('/', (req, res) => {
  const { name, description = '', color = '#3B82F6' } = req.body;
  if (!name) {
    log({ operation: 'CREATE', resource: 'project', result: 'failure', detail: 'name is required' });
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
    ).run(name, description, color);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    log({ operation: 'CREATE', resource: 'project', resourceId: project.id, title: project.name, result: 'success' });
    res.status(201).json(project);
  } catch (e) {
    log({ operation: 'CREATE', resource: 'project', title: name, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description, color } = req.body;
  const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!proj) {
    log({ operation: 'UPDATE', resource: 'project', resourceId: Number(req.params.id), result: 'failure', detail: 'Not found' });
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    db.prepare(`
      UPDATE projects SET name=?, description=?, color=?, updated_at=datetime('now','localtime') WHERE id=?
    `).run(name ?? proj.name, description ?? proj.description, color ?? proj.color, req.params.id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    log({ operation: 'UPDATE', resource: 'project', resourceId: updated.id, title: updated.name, result: 'success' });
    res.json(updated);
  } catch (e) {
    log({ operation: 'UPDATE', resource: 'project', resourceId: Number(req.params.id), title: proj.name, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 並び順の一括更新: { ids: [3, 1, 2] } → sort_order を 10,20,30... に設定
router.post('/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    log({ operation: 'REORDER', resource: 'project', result: 'failure', detail: 'ids required' });
    return res.status(400).json({ error: 'ids required' });
  }
  try {
    const stmt = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?');
    ids.forEach((id, i) => stmt.run((i + 1) * 10, id));
    log({ operation: 'REORDER', resource: 'project', result: 'success', detail: `ids=[${ids.join(',')}]` });
    res.status(204).end();
  } catch (e) {
    log({ operation: 'REORDER', resource: 'project', result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  const proj = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.id);
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    log({ operation: 'DELETE', resource: 'project', resourceId: Number(req.params.id), title: proj?.name ?? null, result: 'success' });
    res.status(204).end();
  } catch (e) {
    log({ operation: 'DELETE', resource: 'project', resourceId: Number(req.params.id), title: proj?.name ?? null, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
