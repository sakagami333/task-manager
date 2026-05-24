const db = require('./db');

const stmt = db.prepare(`
  INSERT INTO operation_logs (operation, resource, resource_id, title, result, detail)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function log({ operation, resource, resourceId = null, title = null, result, detail = '' }) {
  try {
    stmt.run(operation, resource, resourceId, title, result, detail);
  } catch (e) {
    console.error('Failed to write operation log:', e.message);
  }
}

module.exports = { log };
