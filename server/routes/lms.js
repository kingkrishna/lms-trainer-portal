const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function toBuf(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex).replace(/-/g, ''), 'hex');
}

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

// GET /lms/courses/:slug/materials – course materials (auth + enrollment required)
router.get('/courses/:slug/materials', authenticate, async (req, res) => {
  try {
    const slug = req.params.slug;
    const course = await db.queryOne('SELECT id FROM courses WHERE slug = ? AND is_active = 1', [slug]);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const student = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!student) return res.status(403).json({ error: 'Student profile required' });

    const rows = await db.query(
      `SELECT id, title, type, url_or_content, sort_order FROM course_materials
       WHERE course_id = ? ORDER BY sort_order ASC, title ASC`,
      [course.id]
    );

    const materials = (rows || []).map((m) => ({
      id: toHex(m.id),
      title: m.title || '',
      type: m.type || 'document',
      url_or_content: m.url_or_content || '',
      sort_order: m.sort_order || 0,
    }));

    res.json({ materials });
  } catch (err) {
    console.error('Materials fetch error:', err);
    res.json({ materials: [] });
  }
});

// POST /lms/progress – mark material as completed
router.post('/progress', authenticate, async (req, res) => {
  try {
    const { enrollment_id, material_id } = req.body;
    if (!enrollment_id || !material_id) {
      return res.status(400).json({ error: 'enrollment_id and material_id required' });
    }

    const student = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!student) return res.status(403).json({ error: 'Student profile required' });

    const idBuf = crypto.randomBytes(16);
    await db.query(
      `INSERT INTO enrollment_progress (id, enrollment_id, material_id, completed, completed_at)
       VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE completed = TRUE, completed_at = CURRENT_TIMESTAMP`,
      [idBuf, toBuf(enrollment_id), toBuf(material_id)]
    );

    res.json({ message: 'Progress updated' });
  } catch (err) {
    console.error('Progress update error:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

module.exports = router;
