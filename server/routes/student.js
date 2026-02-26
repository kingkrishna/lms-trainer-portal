/**
 * Student enrollment – self-service enrollment with a trainer
 */
const express = require('express');
const { body } = require('express-validator');
const db = require('../db/connection');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// GET /student/my-enrollments – courses the logged-in student has registered for
router.get('/my-enrollments', authenticate, async (req, res) => {
  try {
    let studentName = req.user.email || '';
    try {
      const profile = await db.queryOne('SELECT * FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (profile) studentName = profile.full_name || studentName;
      else {
        const tProfile = await db.queryOne('SELECT * FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
        if (tProfile) studentName = tProfile.full_name || studentName;
      }
    } catch (_) {}
    if (!studentName) return res.json({ enrollments: [] });

    const config = require('../config');
    let rows = [];
    if (config.useDummyData) {
      rows = await db.query('SELECT * FROM trainer_trainees WHERE student_name = ?', [studentName]);
    } else {
      rows = await db.query('SELECT * FROM trainer_trainees WHERE student_name = ? ORDER BY created_at DESC', [studentName]);
    }
    const courses = await db.query('SELECT id, title, slug, price FROM courses WHERE is_active = 1');
    const trainersList = await db.query('SELECT id, slug, full_name FROM trainers ORDER BY full_name');
    const courseMap = (courses || []).reduce((m, c) => { const cid = toHex(c.id); m[cid] = m[c.slug] = c; return m; }, {});
    const trainerMap = (trainersList || []).reduce((m, t) => { const tid = toHex(t.id); m[tid] = m[t.slug] = t; return m; }, {});

    const enrollments = (rows || []).map((r) => {
      const tid = toHex(r.trainer_id);
      const course = courseMap[r.course_id] || courseMap[r.course_id?.replace(/-/g, '_')] || { title: r.course_id, slug: r.course_id };
      const trainer = trainerMap[tid] || { full_name: 'Trainer' };
      return {
        id: toHex(r.id),
        course_id: r.course_id,
        course_title: course.title || r.course_id,
        course_slug: course.slug || r.course_id,
        trainer_name: trainer.full_name,
        payment_status: r.payment_status || 'pending',
      };
    });
    res.json({ enrollments });
  } catch (err) {
    console.error('My enrollments error:', err);
    res.json({ enrollments: [] });
  }
});

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

async function resolveTrainerId(trainerSlug) {
  if (config.useDummyData) {
    const memoryStore = require('../db/memoryStore');
    const trainers = await db.query('SELECT id, slug FROM trainers ORDER BY full_name');
    const t = (trainers || []).find((x) => x.slug === trainerSlug || toHex(x.id) === trainerSlug);
    return t ? toHex(t.id) : null;
  }
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
