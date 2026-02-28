const express = require('express');
const { body } = require('express-validator');
const crypto = require('crypto');
const db = require('../db/connection');
const zoho = require('../lib/zoho');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

function toBuf(v) {
  if (Buffer.isBuffer(v)) return v;
  return Buffer.from(String(v || '').replace(/-/g, ''), 'hex');
}

// GET /trainer/enrollments – trainer sees own; admin sees all
router.get('/enrollments', authenticate, requireRole('trainer', 'super_admin'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'super_admin';

    const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    const trainerId = isAdmin ? null : (trainerProfile && trainerProfile.id);
    const rows = trainerId
      ? await db.query('SELECT * FROM trainer_trainees WHERE trainer_id = ? ORDER BY created_at DESC', [trainerId])
      : await db.query('SELECT * FROM trainer_trainees ORDER BY created_at DESC', []);
    res.json({ enrollments: rows || [] });
  } catch (err) {
    console.error('Enrollments fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// POST /trainer/enroll-trainee – trainer enrolls a trainee (student name, course, contact, payment status)
router.post(
  '/enroll-trainee',
  authenticate,
  requireRole('trainer'),
  [
    body('student_name').trim().notEmpty().withMessage('Student name required'),
    body('course_id').trim().notEmpty().withMessage('Course required'),
    body('contact_number').trim().notEmpty().withMessage('Contact number required'),
    body('payment_status').optional().isIn(['pending', 'paid']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const trainerProfile = await db.queryOne('SELECT * FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!trainerProfile) {
        return res.status(403).json({ error: 'Trainer profile not found' });
      }
      const trainerId = trainerProfile.id;
      const { student_name, course_id, contact_number, payment_status } = req.body;
      const status = payment_status || 'pending';

      const idHex = require('crypto').randomBytes(16).toString('hex');
      const trainerIdBuf = Buffer.isBuffer(trainerId) ? trainerId : db.toBuffer(trainerId);
      await db.query(
        'INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [db.toBuffer(idHex), trainerIdBuf, student_name, course_id, contact_number, status]
      );

      res.status(201).json({ message: 'Trainee enrolled successfully' });
    } catch (err) {
      console.error('Enroll trainee error:', err);
      res.status(500).json({ error: 'Enrollment failed' });
    }
  }
);

// GET /trainer/sessions - trainer sessions
router.get('/sessions', authenticate, requireRole('trainer', 'super_admin'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'super_admin';
    const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    const trainerId = isAdmin ? null : trainerProfile?.id;
    if (!isAdmin && !trainerId) return res.status(403).json({ error: 'Trainer profile not found' });
    const rows = trainerId
      ? await db.query('SELECT * FROM trainer_sessions WHERE trainer_id = ? ORDER BY start_time DESC', [trainerId])
      : await db.query('SELECT * FROM trainer_sessions ORDER BY start_time DESC');
    res.json({
      sessions: (rows || []).map((r) => ({
        id: toHex(r.id),
        trainer_id: toHex(r.trainer_id),
        course_id: r.course_id ? toHex(r.course_id) : null,
        title: r.title,
        agenda: r.agenda,
        start_time: r.start_time,
        duration_minutes: r.duration_minutes,
        meeting_id: r.meeting_id,
        meeting_link: r.meeting_link,
        status: r.status,
      })),
    });
  } catch (err) {
    console.error('Trainer sessions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST /trainer/sessions - create Zoho Meeting session
router.post(
  '/sessions',
  authenticate,
  requireRole('trainer'),
  [
    body('title').trim().notEmpty(),
    body('start_time').isISO8601(),
    body('duration_minutes').optional().isInt({ min: 15, max: 480 }),
    body('agenda').optional().trim(),
    body('course_id').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!trainerProfile) return res.status(403).json({ error: 'Trainer profile not found' });
      const { title, start_time, duration_minutes, agenda, course_id } = req.body;

      let meetingId = null;
      let meetingLink = null;
      try {
        const meeting = await zoho.createMeeting({
          title,
          agenda,
          startTimeIso: start_time,
          durationMinutes: duration_minutes || 60,
        });
        meetingId = meeting?.session?.key || meeting?.id || null;
        meetingLink = meeting?.session?.join_url || meeting?.join_url || null;
      } catch (e) {
        console.error('Zoho meeting create failed:', e.message);
      }

      const idBuf = crypto.randomBytes(16);
      const courseBuf = course_id && /^[0-9a-f]{32}$/i.test(String(course_id).replace(/-/g, '')) ? toBuf(course_id) : null;
      await db.query(
        `INSERT INTO trainer_sessions (id, trainer_id, course_id, title, agenda, start_time, duration_minutes, meeting_id, meeting_link, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
        [idBuf, trainerProfile.id, courseBuf, title, agenda || null, new Date(start_time), Number(duration_minutes || 60), meetingId, meetingLink]
      );

      res.status(201).json({
        message: 'Session created',
        session: {
          id: toHex(idBuf),
          meeting_id: meetingId,
          meeting_link: meetingLink,
        },
      });
    } catch (err) {
      console.error('Trainer session create error:', err);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

// PATCH /trainer/sessions/:id/attendance - update attendance summary
router.patch(
  '/sessions/:id/attendance',
  authenticate,
  requireRole('trainer', 'super_admin'),
  [body('attendance_pct').isFloat({ min: 0, max: 100 })],
  handleValidation,
  async (req, res) => {
    try {
      const id = req.params.id;
      const idBuf = toBuf(id);
      const row = await db.queryOne('SELECT id, trainer_id FROM trainer_sessions WHERE id = ?', [idBuf]);
      if (!row) return res.status(404).json({ error: 'Session not found' });

      if (req.user.role === 'trainer') {
        const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
        if (!trainerProfile || toHex(trainerProfile.id) !== toHex(row.trainer_id)) {
          return res.status(403).json({ error: 'Not authorized for this session' });
        }
      }

      await db.query('UPDATE trainer_sessions SET status = ? WHERE id = ?', ['completed', idBuf]);
      res.json({ message: 'Attendance updated', attendance_pct: Number(req.body.attendance_pct) });
    } catch (err) {
      console.error('Attendance update error:', err);
      res.status(500).json({ error: 'Failed to update attendance' });
    }
  }
);

module.exports = router;
