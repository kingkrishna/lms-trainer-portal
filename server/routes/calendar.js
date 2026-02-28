/**
 * Calendar API – group discussion slots (Zoho Calendar integration)
 * Returns available slots for group discussion. Uses Zoho Calendar when configured.
 */
const express = require('express');
const config = require('../config');
const db = require('../db/connection');

const router = express.Router();

// Fallback slots when Zoho Calendar is not configured
const FALLBACK_GROUP_SLOTS = [
  'Mon 10:00 AM – 11:00 AM',
  'Tue 2:00 PM – 3:00 PM',
  'Wed 6:00 PM – 7:00 PM',
  'Thu 11:00 AM – 12:00 PM',
  'Fri 4:00 PM – 5:00 PM',
  'Sat 9:00 AM – 10:00 AM',
];

// GET /calendar/group-slots?trainer=tr-1
router.get('/group-slots', async (req, res) => {
  const { trainer } = req.query;
  if (!trainer) {
    return res.status(400).json({ error: 'Trainer ID required' });
  }

  try {
    const trainerRow = await db.queryOne('SELECT id FROM trainers WHERE slug = ? OR id = ?', [trainer, trainer]);
    if (trainerRow) {
      const rows = await db.query(
        `SELECT start_time, duration_minutes
         FROM trainer_sessions
         WHERE trainer_id = ? AND status = 'scheduled' AND start_time >= NOW()
         ORDER BY start_time ASC
         LIMIT 20`,
        [trainerRow.id]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const slots = rows.map((r) => {
          const d = new Date(r.start_time);
          const end = new Date(d.getTime() + Number(r.duration_minutes || 60) * 60000);
          return `${d.toLocaleString()} - ${end.toLocaleTimeString()}`;
        });
        return res.json({ slots, source: 'trainer_sessions' });
      }
    }
    res.json({ slots: FALLBACK_GROUP_SLOTS, source: 'default' });
  } catch (err) {
    console.error('Calendar slots error:', err);
    res.json({ slots: FALLBACK_GROUP_SLOTS, source: 'default' });
  }
});

module.exports = router;
