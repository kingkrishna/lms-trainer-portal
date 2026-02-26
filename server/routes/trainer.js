const express = require('express');
const { body } = require('express-validator');
const db = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// GET /trainer/enrollments – trainer sees own; admin sees all
router.get('/enrollments', authenticate, requireRole('trainer', 'super_admin'), async (req, res) => {
  try {
    const config = require('../config');
    const isAdmin = req.user.role === 'super_admin';
    if (config.useDummyData) {
      const memoryStore = require('../db/memoryStore');
      const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      const trainerId = isAdmin ? null : (trainerProfile && trainerProfile.id);
      const rows = memoryStore.getTrainerTrainees(trainerId);
      return res.json({ enrollments: rows });
    }
    // MySQL: SELECT * FROM trainer_trainees WHERE trainer_id = ? (or no WHERE for admin)
    const trainerProfile = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    const trainerId = isAdmin ? null : (trainerProfile && trainerProfile.id);
    const rows = trainerId
      ? await db.query('SELECT * FROM trainer_trainees WHERE trainer_id = ? ORDER BY created_at DESC', [trainerId])
      : await db.query('SELECT * FROM trainer_trainees ORDER BY created_at DESC', []);
    res.json({ enrollments: rows || [] });
  } catch (err) {
    console.error('Enrollments fetch error:', err);
    res.json({ enrollments: [] });
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

module.exports = router;
