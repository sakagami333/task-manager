# タスクマネージャ アプリ — Claude Code 引き継ぎドキュメント

## アプリ概要
個人用タスク管理 Web アプリ。React/TypeScript フロントエンド + Express.js/SQLite バックエンド。

- **起動方法**: `start.bat` を実行（バックエンドビルド → フロントエンドビルド → サーバー起動）
- **アクセス先**: http://localhost:3001
- **プロジェクトパス**: `C:\Users\sakagami\OneDrive - さくらインターネット株式会社\vscode_work\task-manager`

---

## 技術スタック

### フロントエンド (`frontend/`)
- React + TypeScript + Vite + TailwindCSS
- React Query (`@tanstack/react-query`) — データフェッチ・キャッシュ
- FontAwesome (`@fortawesome/react-fontawesome`)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — プロジェクトサイドバーの DnD
- `react-router-dom` — ルーティング

### バックエンド (`backend/`)
- Express.js (CommonJS)
- Node.js 組み込み SQLite (`node:sqlite`)
- `.env` ファイル不要（Sakura AI 要約機能は削除済み）

---

## ディレクトリ構成

```
task-manager/
├── CLAUDE.md              ← このファイル
├── start.bat              ← 起動スクリプト
├── frontend/
│   └── src/
│       ├── api/client.ts         ← API クライアント（全エンドポイント定義）
│       ├── types.ts              ← Task, Project, Status 等の型定義
│       ├── components/
│       │   ├── TaskTable.tsx     ← タスク一覧テーブル（DnD含む）
│       │   ├── TaskForm.tsx      ← タスク作成・編集フォーム
│       │   ├── Layout.tsx        ← サイドバー（リサイズ・プロジェクト並び替え）
│       │   ├── Badges.tsx        ← StatusBadge, DueDateLabel
│       │   └── LinkifyText.tsx   ← URL 自動リンク化コンポーネント
│       └── pages/
│           ├── DashboardPage.tsx
│           ├── ProjectPage.tsx   ← プロジェクト別タスク一覧
│           ├── TasksPage.tsx     ← 全タスク一覧
│           └── TaskDetailPage.tsx ← タスク詳細・コメント
└── backend/
    └── src/
        ├── server.js
        ├── db.js                 ← SQLite 初期化・マイグレーション
        └── routes/
            ├── tasks.js          ← タスク CRUD + /move エンドポイント
            ├── projects.js       ← プロジェクト CRUD + /reorder エンドポイント
            └── comments.js       ← コメント CRUD
```

---

## DB スキーマ（主要カラム）

### tasks
```sql
id, title, description, status, due_date, project_id, parent_id,
sort_order, created_at, updated_at
```
- `status`: `'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed'`
- `parent_id`: サブタスク構造（NULL = ルートタスク）
- `sort_order`: DnD による並び替え順

### projects
```sql
id, name, description, color, sort_order, created_at
```

### comments
```sql
id, task_id, body, created_at
```

---

## 主要 API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tasks` | タスク一覧（ツリー構造、クエリ: project_id/status/search/flat） |
| POST | `/api/tasks` | タスク作成 |
| PUT | `/api/tasks/:id` | タスク更新 |
| DELETE | `/api/tasks/:id` | タスク削除 |
| **POST** | **`/api/tasks/move`** | **タスク移動・並び替え（DnD用）** |
| GET | `/api/projects` | プロジェクト一覧（sort_order順） |
| POST | `/api/projects` | プロジェクト作成 |
| PUT | `/api/projects/:id` | プロジェクト更新（name/description/color） |
| DELETE | `/api/projects/:id` | プロジェクト削除 |
| **POST** | **`/api/projects/reorder`** | **プロジェクト並び替え（DnD用）** |
| GET | `/api/tasks/:id/comments` | コメント一覧 |
| POST | `/api/tasks/:id/comments` | コメント追加 |
| DELETE | `/api/tasks/:id/comments/:cid` | コメント削除 |

### `/api/tasks/move` リクエスト形式
```json
{ "id": 5, "parent_id": 3, "before_id": null }
```
- `parent_id`: 新しい親タスクID（null = ルート）
- `before_id`: この ID のタスクの直前に挿入（null = 末尾）

---

## 実装済み機能一覧

- ✅ タスク CRUD（ツリー構造・サブタスク）
- ✅ プロジェクト CRUD
- ✅ ステータス管理（未着手/進行中/保留/解決済み/完了）
- ✅ 期日管理（超過表示、完了・解決済みは超過表示しない）
- ✅ タスク一覧に説明文冒頭140文字を表示
- ✅ **タスクのドラッグ＆ドロップ**（順番変更・子タスク化・別の親へ移動）
- ✅ 右クリックメニューでサブタスク作成
- ✅ ステータス別の行背景色
- ✅ URL の自動リンク化（説明・コメント・プロジェクト概要）
- ✅ FontAwesome アイコン
- ✅ サイドバー幅リサイズ（マウスドラッグ、localStorage 保存）
- ✅ プロジェクトの並び替え（サイドバーでDnD）
- ✅ プロジェクト名・概要・カラーの編集（サイドバーのホバー時に編集ボタン表示）
- ✅ タスク更新後にプロジェクトのタスク一覧へ遷移
- ✅ コメント機能（Ctrl+Enter で送信）
- ✅ ダッシュボード（期限切れ・今週期限のタスク一覧、ステータス集計）

---

## TaskTable の DnD 実装メモ

`frontend/src/components/TaskTable.tsx` — HTML5 ネイティブ DnD API を使用。

**ドロップゾーン判定**（行の高さに対する相対Y位置）:
- 上30%: `before`（直前に挿入、緑の上ボーダー）
- 中40%: `child`（子タスク化、緑の背景・リング）
- 下30%: `after`（直後に挿入、緑の下ボーダー）

**ツリー探索ヘルパー**:
```ts
function findParentAndSiblings(tasks, targetId, parent = null)
// → { parent: Task | null; siblings: Task[] } | null
```

**ドラッグゴースト**: ブラウザデフォルトの半透明ゴーストを非表示にし、透明な1×1 div で代替。

---

## Layout の DnD 実装メモ

`frontend/src/components/Layout.tsx` — `@dnd-kit` を使用。

- `SortableProjectItem` に `useSortable({ id: project.id })`
- `DndContext onDragEnd` で `api.projects.reorder(newIds)` を呼び出し
- サイドバー幅: `localStorage` キー `sidebar-width`、範囲 160〜400px

---

## よくある開発コマンド

```bash
# フロントエンド開発サーバー（Vite）
cd frontend && npm run dev

# バックエンド起動（ポート 3001）
cd backend && node src/server.js

# フロントエンドビルド
cd frontend && npm run build

# 全部まとめて起動（本番モード）
start.bat
```

---

## DB ファイルの場所
`backend/data/tasks.db`（バックエンド初回起動時に自動作成）

---

## GitHub 運用ルール

- 修正完了後は必ず GitHub へ push する
- push 前に `git diff HEAD --stat` を表示し、AskUserQuestion ツールのボタンでユーザーに可否を確認する
- ユーザーが「プッシュする」を選択した場合のみ `git push` を実行する

---

## 過去の開発での注意点

- **LinkifyText の regex**: `split()` と `test()` で同じ `g` フラグ付き regex を使い回すと `lastIndex` がずれてリンク判定が壊れる。`IS_URL = /^https?:\/\//`（`g` フラグなし）を別途定義して使うこと。
- **SQLite マイグレーション**: `try { db.exec("ALTER TABLE ... ADD COLUMN ...") } catch(_) {}` パターンで既存 DB に追加。
- **ビルドキャッシュ**: 古い build が出た場合は `frontend/dist` を削除して再ビルド。
