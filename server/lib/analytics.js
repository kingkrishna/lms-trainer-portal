const db = require('../db/connection');
const zoho = require('./zoho');

async function track(eventName, payload = {}, userId = null) {
  try {
    const userIdBuf = userId ? db.toBuffer(userId) : null;
    await db.query(
      'INSERT INTO analytics_events (event_name, user_id, payload) VALUES (?, ?, ?)',
      [String(eventName || 'unknown'), userIdBuf, JSON.stringify(payload || {})]
    );
  } catch (e) {
    console.error('Analytics local track error:', e.message);
  }
  try {
    await zoho.pushAnalyticsEvent({
      event_name: String(eventName || 'unknown'),
      user_id: userId || null,
      payload: payload || {},
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Analytics Zoho push error:', e.message);
  }
}

module.exports = { track };
