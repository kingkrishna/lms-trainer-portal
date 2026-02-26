const express = require('express');
const db = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');
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

// PATCH /admin/trainers/:id/approve – approve/reject trainer
router.patch(
  '/trainers/:id/approve',
  authenticate,
  requireRole(['super_admin']),
  [body('approval_status').isIn(['approved', 'rejected', 'pending'])],
  handleValidation,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { approval_status } = req.body;
      const idBuf = toBuf(id);

      const row = await db.queryOne('SELECT id FROM trainers WHERE id = ?', [idBuf]);
      if (!row) return res.status(404).json({ error: 'Trainer not found' });

      await db.query('UPDATE trainers SET approval_status = ? WHERE id = ?', [approval_status, idBuf]);
      res.json({ message: 'Trainer status updated', approval_status });
    } catch (err) {
      console.error('Admin trainer approve error:', err);
      res.status(500).json({ error: 'Failed to update' });
    }
  }
);

// GET /admin/stats – platform stats for admin
router.get('/stats', authenticate, requireRole(['super_admin']), async (req, res) => {
  try {
    const users = await db.queryOne('SELECT COUNT(*) AS c FROM users');
    const courses = await db.queryOne('SELECT COUNT(*) AS c FROM courses WHERE is_active = 1');
    const jobs = await db.queryOne('SELECT COUNT(*) AS c FROM jobs WHERE is_active = 1');
    const enrollments = await db.queryOne('SELECT COUNT(*) AS c FROM trainer_trainees');
    res.json({
      users: users?.c || 0,
      courses: courses?.c || 0,
      jobs: jobs?.c || 0,
      enrollments: enrollments?.c || 0,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.json({ users: 0, courses: 0, jobs: 0, enrollments: 0 });
  }
});

module.exports = router;
