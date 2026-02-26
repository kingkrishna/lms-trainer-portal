const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

function toBuf(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex).replace(/-/g, ''), 'hex');
}

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

// GET /messages/inbox
router.get('/inbox', authenticate, async (req, res) => {
  try {
    const idBuf = db.toBuffer(req.user.id);
    const rows = await db.query(
      `SELECT m.id, m.subject, m.body, m.is_read, m.created_at, m.related_type,
              u.email AS sender_email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.recipient_id = ?
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [idBuf]
    );
    const messages = (rows || []).map((r) => ({
      id: toHex(r.id),
      subject: r.subject || '(No subject)',
      body: (r.body || '').slice(0, 200),
      is_read: !!r.is_read,
      created_at: r.created_at,
      sender_email: r.sender_email,
      related_type: r.related_type,
    }));
    res.json({ messages });
  } catch (err) {
    console.error('Inbox error:', err);
    res.json({ messages: [] });
  }
});

// POST /messages – send message
router.post(
  '/',
  authenticate,
  [body('recipient_id').trim().notEmpty(), body('subject').optional().trim(), body('body').trim().notEmpty()],
  handleValidation,
  async (req, res) => {
    try {
      const { recipient_id, subject, body } = req.body;
      const recipientBuf = toBuf(recipient_id);
      const recipient = await db.queryOne('SELECT id FROM users WHERE id = ?', [recipientBuf]);
      if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

      const idBuf = crypto.randomBytes(16);
      await db.query(
        `INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?, ?)`,
        [idBuf, db.toBuffer(req.user.id), recipientBuf, subject || null, body]
      );
      res.status(201).json({ message: 'Message sent', id: toHex(idBuf) });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Failed to send' });
    }
  }
);

// PATCH /messages/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const idBuf = toBuf(req.params.id);
    await db.query(
      'UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ?',
      [idBuf, db.toBuffer(req.user.id)]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
