const express = require('express');
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

// GET /notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = db.toBuffer(req.user.id);
    const rows = await db.query(
      `SELECT id, subject, body, is_read, created_at
       FROM messages
       WHERE recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId]
    );
    const notifications = (rows || []).map((r) => ({
      id: toHex(r.id),
      title: r.subject || 'New message',
      message: (r.body || '').slice(0, 180),
      is_read: !!r.is_read,
      created_at: r.created_at,
      type: 'message',
    }));
    res.json({
      notifications,
      unread_count: notifications.filter((n) => !n.is_read).length,
    });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
