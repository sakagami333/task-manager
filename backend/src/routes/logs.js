const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { operation, resource, result, limit = 500 } = req.query;
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];

  if (operation) { sql += ' AND operation = ?'; params.push(operation); }
  if (resource)  { sql += ' AND resource = ?';  params.push(resource); }
  if (result)    { sql += ' AND result = ?';     params.push(result); }

  sql += ' ORDER BY operated_at DESC LIMIT ?';
  params.push(Number(limit));

  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
