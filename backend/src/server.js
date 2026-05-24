const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/tasks/:taskId/comments', require('./routes/comments'));
app.use('/api/logs', require('./routes/logs'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 本番環境のみフロントエンドを配信（開発時は Vite の 5173 を使う）
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
