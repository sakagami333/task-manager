const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { log } = require('../logger');

router.get('/', (req, res) => {
  const comments = db.prepare(
    'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC'
  ).all(req.params.taskId);
  res.json(comments);
});

router.post('/', (req, res) => {
  const { body } = req.body;
  const taskId = Number(req.params.taskId);
  if (!body || !body.trim()) {
    log({ operation: 'CREATE', resource: 'comment', resourceId: taskId, result: 'failure', detail: 'body is required' });
    return res.status(400).json({ error: 'body is required' });
  }
  try {
    const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
    const result = db.prepare(
      'INSERT INTO comments (task_id, body) VALUES (?, ?)'
    ).run(taskId, body.trim());
    log({ operation: 'CREATE', resource: 'comment', resourceId: taskId, title: task?.title ?? null, result: 'success', detail: `comment_id=${result.lastInsertRowid}` });
    res.status(201).json(
      db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid)
    );
  } catch (e) {
    log({ operation: 'CREATE', resource: 'comment', resourceId: taskId, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:commentId', (req, res) => {
  const taskId = Number(req.params.taskId);
  try {
    const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
    db.prepare('DELETE FROM comments WHERE id = ? AND task_id = ?')
      .run(req.params.commentId, taskId);
    log({ operation: 'DELETE', resource: 'comment', resourceId: taskId, title: task?.title ?? null, result: 'success', detail: `comment_id=${req.params.commentId}` });
    res.status(204).end();
  } catch (e) {
    log({ operation: 'DELETE', resource: 'comment', resourceId: taskId, result: 'failure', detail: e.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
