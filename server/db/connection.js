const config = require('../config');

async function getPool() {
  if (!config.db.user || !config.db.password) {
    throw new Error('Database credentials missing. Set DB_USER and DB_PASSWORD.');
  }
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
  if (!pool) pool = await getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
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
