/**
 * Student enrollment – self-service enrollment with a trainer
 */
const express = require('express');
const { body } = require('express-validator');
const db = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// GET /student/my-enrollments – courses the logged-in student has registered for
router.get('/my-enrollments', authenticate, async (req, res) => {
  try {
    const student = await db.queryOne('SELECT id, full_name FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!student) return res.json({ enrollments: [] });

    const rows = await db.query(
      `SELECT e.id, e.course_id, e.trainer_id, e.status, e.enrolled_at, c.title AS course_title, c.slug AS course_slug,
              t.full_name AS trainer_name, p.status AS payment_status
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN trainers t ON e.trainer_id = t.id
       JOIN payments p ON e.payment_id = p.id
       WHERE e.student_id = ?
       ORDER BY e.enrolled_at DESC`,
      [student.id]
    );

    const enrollments = (rows || []).map((r) => ({
      id: toHex(r.id),
      course_id: toHex(r.course_id),
      course_title: r.course_title || '',
      course_slug: r.course_slug || '',
      trainer_name: r.trainer_name || '',
      payment_status: r.payment_status || 'pending',
      status: r.status || 'active',
      enrolled_at: r.enrolled_at,
    }));
    res.json({ enrollments });
  } catch (err) {
    console.error('My enrollments error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

async function resolveTrainerId(trainerSlug) {
  const row = await db.queryOne('SELECT id FROM trainers WHERE slug = ? OR id = ?', [trainerSlug, trainerSlug]);
  return row ? toHex(row.id) : null;
}

// POST /student/enroll – student enrolls with a trainer (requires login)
router.post(
  '/enroll',
  authenticate,
  [
    body('trainer_id').trim().notEmpty().withMessage('Trainer required'),
    body('course_id').trim().notEmpty().withMessage('Course required'),
    body('counselling_slot').trim().notEmpty().withMessage('Counselling slot required'),
    body('group_slot').optional().trim(),
    body('payment_option').optional().isIn(['after_counselling', 'direct_pay']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const trainerIdHex = await resolveTrainerId(req.body.trainer_id);
      if (!trainerIdHex) {
        return res.status(404).json({ error: 'Trainer not found' });
      }

      const { course_id, counselling_slot, group_slot, payment_option } = req.body;

      let studentName = req.user.email || 'Student';
      let contactNumber = '';
      try {
        const profile = await db.queryOne('SELECT * FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
        if (profile) {
          studentName = profile.full_name || studentName;
          contactNumber = profile.phone || '';
        } else {
          const tProfile = await db.queryOne('SELECT * FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
          if (tProfile) studentName = tProfile.full_name || studentName;
        }
      } catch (_) {}

      const idHex = require('crypto').randomBytes(16).toString('hex');
      const trainerIdBuf = Buffer.from(trainerIdHex, 'hex');

      await db.query(
        'INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [Buffer.from(idHex, 'hex'), trainerIdBuf, studentName, course_id, contactNumber || '-', payment_option === 'direct_pay' ? 'pending' : 'pending']
      );
      try { require('../lib/audit').log('enrollment', 'trainer_trainees', idHex, null, { course_id, student_name: studentName }, req.user.id, req); } catch (_) {}

      res.status(201).json({
        message: 'Enrollment submitted successfully',
        counselling_slot: counselling_slot,
        group_slot: group_slot || null,
      });
    } catch (err) {
      console.error('Student enroll error:', err);
      res.status(500).json({ error: 'Enrollment failed' });
    }
  }
);

module.exports = router;
