const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// POST /webhooks/zoho/sign - Zoho Sign webhook to activate signed entities
router.post('/zoho/sign', async (req, res) => {
  try {
    const payload = req.body || {};
    const email =
      payload?.recipient_email ||
      payload?.signer_email ||
      payload?.requests?.actions?.[0]?.recipient_email ||
      payload?.data?.recipient_email ||
      null;
    const statusRaw =
      payload?.status ||
      payload?.request_status ||
      payload?.document_status ||
      payload?.data?.status ||
      '';
    const status = String(statusRaw || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'recipient email required' });

    const user = await db.queryOne('SELECT id, role_id FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const signStatus = status.includes('complete') || status.includes('signed') ? 'signed' : 'pending';
    if (Number(user.role_id) === 3) {
      await db.query('UPDATE trainers SET sign_status = ? WHERE user_id = ?', [signStatus, user.id]);
    } else if (Number(user.role_id) === 4) {
      await db.query('UPDATE recruiters SET sign_status = ? WHERE user_id = ?', [signStatus, user.id]);
    }
    return res.json({ success: true, email, sign_status: signStatus });
  } catch (err) {
    console.error('Zoho sign webhook error:', err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
});

module.exports = router;

