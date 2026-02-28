/**
 * Run database schema + migrations.
 * Usage: node server/db/migrate.js
 * Ensure DB exists and .env has correct DB_* credentials.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'lms_platform',
  multipleStatements: true,
};

function shouldIgnore(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('duplicate column') || msg.includes('duplicate key') || msg.includes('already exists');
}

async function run() {
  if (!config.user || !config.password) {
    console.error('Set DB_USER and DB_PASSWORD in .env');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  const migrationsDir = path.join(__dirname, '../../database/migrations');

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const schemaStmts = schemaSql.split(/;\s*$/m).filter((s) => s.trim());
    for (const stmt of schemaStmts) {
      const s = stmt.trim();
      if (!s) continue;
      try {
        await conn.query(s + (s.endsWith(';') ? '' : ';'));
      } catch (err) {
        if (shouldIgnore(err)) {
          console.log(`Skipped (already applied): schema.sql - ${err.message.slice(0, 60)}`);
        } else {
          throw err;
        }
      }
    }
    console.log('Schema applied.');

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      const stmts = sql.split(/;\s*$/m).filter((s) => s.trim());
      for (const stmt of stmts) {
        const s = stmt.trim();
        if (!s) continue;
        try {
          await conn.query(s + (s.endsWith(';') ? '' : ';'));
        } catch (err) {
          if (shouldIgnore(err)) {
            console.log(`Skipped (already applied): ${f} - ${err.message.slice(0, 60)}`);
          } else {
            throw err;
          }
        }
      }
      console.log(`Migration: ${f}`);
    }

    console.log('Migrations completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
