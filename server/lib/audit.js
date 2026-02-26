const db = require('../db/connection');
const config = require('../config');

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

async function log(action, resourceType, resourceId, oldValue, newValue, userId, req) {
  if (config.useDummyData) return;
  try {
    const userIdBuf = userId ? (Buffer.isBuffer(userId) ? userId : require('../db/connection').toBuffer(userId)) : null;
    const ip = req?.ip || req?.connection?.remoteAddress || null;
    const ua = req?.get?.('user-agent') || null;
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userIdBuf,
        action,
        resourceType || null,
        resourceId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ip,
        ua,
      ]
    );
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

module.exports = { log };
