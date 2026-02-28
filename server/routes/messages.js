const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const zoho = require('../lib/zoho');
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

// GET /messages/lookup?email=foo@bar.com
router.get('/lookup', authenticate, async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const row = await db.queryOne('SELECT id, email FROM users WHERE LOWER(email) = ?', [email]);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: toHex(row.id), email: row.email } });
  } catch (err) {
    console.error('Message lookup error:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

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

// Contract alias: GET /messages
router.get('/', authenticate, async (req, res) => {
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
    console.error('Messages list error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Contract alias: GET /messages
router.get('/', authenticate, async (req, res) => {
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
    console.error('Messages list error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /messages – send message
router.post(
  '/',
  authenticate,
  [body('recipient_id').trim().notEmpty(), body('subject').optional().trim(), body('body').trim().notEmpty(), body('related_type').optional().isIn(['enrollment', 'job_application', 'support'])],
  handleValidation,
  async (req, res) => {
    try {
      const { recipient_id, subject, body, related_type } = req.body;
      const recipientBuf = toBuf(recipient_id);
      const recipient = await db.queryOne('SELECT id FROM users WHERE id = ?', [recipientBuf]);
      if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

      const idBuf = crypto.randomBytes(16);
      await db.query(
        `INSERT INTO messages (id, sender_id, recipient_id, subject, body, related_type) VALUES (?, ?, ?, ?, ?, ?)`,
        [idBuf, db.toBuffer(req.user.id), recipientBuf, subject || null, body, related_type || null]
      );
      if (related_type === 'support') {
        try {
          const sender = await db.queryOne('SELECT email FROM users WHERE id = ?', [db.toBuffer(req.user.id)]);
          await zoho.createDeskTicket({
            subject: subject || 'Support request',
            description: body,
            email: sender?.email || null,
            priority: 'Medium',
          });
        } catch (e) {
          console.error('Zoho Desk ticket create failed:', e.message);
        }
      }
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
