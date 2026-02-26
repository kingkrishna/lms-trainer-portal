/**
 * Calendar API – group discussion slots (Zoho Calendar integration)
 * Returns available slots for group discussion. Uses Zoho Calendar when configured.
 */
const express = require('express');
const config = require('../config');

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
    if (config.zoho?.calendarId && config.zoho?.clientId && config.zoho?.refreshToken) {
      // Zoho Calendar API integration – requires OAuth token from client_id + refresh_token
      // Calendar ID stored: config.zoho.calendarId
      // TODO: Exchange refresh_token for access_token, call freebusy API
      // GET https://calendar.zoho.com/api/v1/calendars/{calendarId}/freebusy
    }
    res.json({ slots: FALLBACK_GROUP_SLOTS, source: 'default' });
  } catch (err) {
    console.error('Calendar slots error:', err);
    res.json({ slots: FALLBACK_GROUP_SLOTS, source: 'default' });
  }
});

module.exports = router;
