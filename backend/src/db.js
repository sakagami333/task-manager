const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'tasks.db'));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    due_date TEXT,
    project_id INTEGER,
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

  CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operated_at TEXT DEFAULT (datetime('now', 'localtime')),
    operation TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id INTEGER,
    title TEXT,
    result TEXT NOT NULL,
    detail TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_logs_operated_at ON operation_logs(operated_at);
`);

// Migration: add summary column if not exists
try { db.exec("ALTER TABLE tasks ADD COLUMN summary TEXT DEFAULT ''"); } catch (_) {}
// Migration: add sort_order column to projects if not exists
try { db.exec("ALTER TABLE projects ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch (_) {}
// Initialize sort_order for existing projects that have 0
db.exec("UPDATE projects SET sort_order = id * 10 WHERE sort_order = 0");

// 30日より古いログを削除
db.exec("DELETE FROM operation_logs WHERE operated_at < datetime('now', 'localtime', '-30 days')");

const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
if (projectCount === 0) {
  const insertProject = db.prepare(
    'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
  );
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, due_date, project_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

  const p1 = insertProject.run('個人タスク', '日常的な個人のタスク', '#3B82F6').lastInsertRowid;
  const p2 = insertProject.run('仕事', '業務関連のタスク', '#10B981').lastInsertRowid;
  const p3 = insertProject.run('学習', '勉強・学習のタスク', '#8B5CF6').lastInsertRowid;

  insertTask.run('メール返信', '重要なメールに返信する', 'open', 'high', addDays(0), p2, null);
  insertTask.run('週次レポート作成', '今週の進捗をまとめる', 'in_progress', 'high', addDays(1), p2, null);
  insertTask.run('プロジェクト計画書レビュー', '来期の計画書を確認する', 'open', 'normal', addDays(3), p2, null);
  insertTask.run('買い物リスト作成', '週末の買い物準備', 'open', 'low', addDays(2), p1, null);
  const parent = insertTask.run('React勉強', 'Reactの基礎を学ぶ', 'in_progress', 'normal', addDays(7), p3, null);
  insertTask.run('Hooksの理解', 'useState, useEffectを練習', 'open', 'normal', addDays(5), p3, parent.lastInsertRowid);
  insertTask.run('コンポーネント設計', 'コンポーネント分割の練習', 'open', 'normal', addDays(6), p3, parent.lastInsertRowid);
  insertTask.run('期限切れタスクサンプル', 'このタスクは期限切れです', 'open', 'high', addDays(-2), p2, null);
}

module.exports = db;
