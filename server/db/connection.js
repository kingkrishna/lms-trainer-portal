const config = require('../config');

// Use in-memory dummy data when USE_DUMMY_DATA=true (no MySQL required)
const memoryStore = config.useDummyData ? require('./memoryStore') : null;

async function getPool() {
  if (memoryStore) return null;
  const mysql = require('mysql2/promise');
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

let pool = null;

async function query(sql, params = []) {
  if (memoryStore) return memoryStore.query(sql, params);
  if (!pool) pool = await getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  if (memoryStore) return memoryStore.queryOne(sql, params);
  const rows = await query(sql, params);
  return rows[0] || null;
}

function toHex(buffer) {
  if (Buffer.isBuffer(buffer)) return buffer.toString('hex');
  return buffer;
}

function toBuffer(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex), 'hex');
}

module.exports = {
  getPool: async () => (pool || (pool = await getPool())),
  query,
  queryOne,
  toHex,
  toBuffer,
};
