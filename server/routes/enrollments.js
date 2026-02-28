const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const zoho = require('../lib/zoho');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

function toBuf(v) {
  if (Buffer.isBuffer(v)) return v;
  return Buffer.from(String(v || '').replace(/-/g, ''), 'hex');
}

async function getStudentIdByUser(userId) {
  const row = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(userId)]);
  return row?.id || null;
}

// GET /enrollments/my
router.get('/my', authenticate, requireRole('student'), async (req, res) => {
  try {
    const studentId = await getStudentIdByUser(req.user.id);
    if (!studentId) return res.json({ enrollments: [] });
    const rows = await db.query(
      `SELECT e.id, e.course_id, e.trainer_id, e.payment_id, e.status, e.enrolled_at,
              c.title AS course_title, c.slug AS course_slug, t.full_name AS trainer_name, p.status AS payment_status
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN trainers t ON e.trainer_id = t.id
       JOIN payments p ON e.payment_id = p.id
       WHERE e.student_id = ?
       ORDER BY e.enrolled_at DESC`,
      [studentId]
    );
    res.json({
      enrollments: (rows || []).map((r) => ({
        id: toHex(r.id),
        course_id: toHex(r.course_id),
        course_title: r.course_title || '',
        course_slug: r.course_slug || '',
        trainer_id: toHex(r.trainer_id),
        trainer_name: r.trainer_name || '',
        payment_id: toHex(r.payment_id),
        payment_status: r.payment_status || 'pending',
        status: r.status || 'active',
        enrolled_at: r.enrolled_at,
      })),
    });
  } catch (err) {
    console.error('Enrollments my error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// GET /enrollments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const enrollmentId = toBuf(req.params.id);
    const row = await db.queryOne(
      `SELECT e.id, e.student_id, e.course_id, e.trainer_id, e.payment_id, e.status, e.enrolled_at,
              c.title AS course_title, c.slug AS course_slug,
              t.full_name AS trainer_name
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN trainers t ON e.trainer_id = t.id
       WHERE e.id = ?`,
      [enrollmentId]
    );
    if (!row) return res.status(404).json({ error: 'Enrollment not found' });

    if (req.user.role === 'student') {
      const studentId = await getStudentIdByUser(req.user.id);
      if (!studentId || toHex(studentId) !== toHex(row.student_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role === 'trainer') {
      const trainer = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!trainer || toHex(trainer.id) !== toHex(row.trainer_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      id: toHex(row.id),
      student_id: toHex(row.student_id),
      course_id: toHex(row.course_id),
      course_title: row.course_title || '',
      course_slug: row.course_slug || '',
      trainer_id: toHex(row.trainer_id),
      trainer_name: row.trainer_name || '',
      payment_id: toHex(row.payment_id),
      status: row.status || 'active',
      enrolled_at: row.enrolled_at,
    });
  } catch (err) {
    console.error('Enrollment detail error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollment detail' });
  }
});

// GET /enrollments/:id/materials
router.get('/:id/materials', authenticate, async (req, res) => {
  try {
    const enrollmentId = toBuf(req.params.id);
    const enrollment = await db.queryOne('SELECT id, student_id, course_id, trainer_id, status FROM enrollments WHERE id = ?', [enrollmentId]);
    if (!enrollment || enrollment.status !== 'active') return res.status(404).json({ error: 'Enrollment not found' });

    if (req.user.role === 'student') {
      const studentId = await getStudentIdByUser(req.user.id);
      if (!studentId || toHex(studentId) !== toHex(enrollment.student_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role === 'trainer') {
      const trainer = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!trainer || toHex(trainer.id) !== toHex(enrollment.trainer_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const rows = await db.query(
      `SELECT id, title, type, url_or_content, workdrive_file_id, sort_order
       FROM course_materials
       WHERE course_id = ?
       ORDER BY sort_order ASC, title ASC`,
      [enrollment.course_id]
    );
    const materials = [];
    for (const m of rows || []) {
      let url = m.url_or_content || '';
      if (m.workdrive_file_id) {
        try {
          const signed = await zoho.getWorkDriveDownloadUrl(m.workdrive_file_id);
          if (signed) url = signed;
        } catch (e) {
          console.error('WorkDrive material URL error:', e.message);
        }
      }
      materials.push({
        id: toHex(m.id),
        title: m.title || '',
        type: m.type || 'document',
        url_or_content: url,
        sort_order: Number(m.sort_order || 0),
      });
    }
    res.json({ materials });
  } catch (err) {
    console.error('Enrollment materials error:', err);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// GET /enrollments/:id/materials/:materialId/access
router.get('/:id/materials/:materialId/access', authenticate, requireRole('student'), async (req, res) => {
  try {
    const enrollmentId = toBuf(req.params.id);
    const materialId = toBuf(req.params.materialId);
    const enrollment = await db.queryOne('SELECT id, student_id, course_id, status FROM enrollments WHERE id = ?', [enrollmentId]);
    if (!enrollment || enrollment.status !== 'active') return res.status(404).json({ error: 'Enrollment not found' });
    const studentId = await getStudentIdByUser(req.user.id);
    if (!studentId || toHex(studentId) !== toHex(enrollment.student_id)) {
      return res.status(403).json({ error: 'Not authorized for this enrollment' });
    }

    const material = await db.queryOne(
      'SELECT id, title, type, url_or_content, workdrive_file_id FROM course_materials WHERE id = ? AND course_id = ?',
      [materialId, enrollment.course_id]
    );
    if (!material) return res.status(404).json({ error: 'Material not found' });

    let accessUrl = material.url_or_content || '';
    if (material.workdrive_file_id) {
      const signed = await zoho.getWorkDriveDownloadUrl(material.workdrive_file_id);
      if (signed) accessUrl = signed;
    }
    res.json({ access_url: accessUrl, material_id: toHex(material.id), type: material.type || 'document' });
  } catch (err) {
    console.error('Material access error:', err);
    res.status(500).json({ error: 'Failed to generate material access' });
  }
});

// POST /enrollments/:id/progress
router.post('/:id/progress', authenticate, requireRole('student'), async (req, res) => {
  try {
    const enrollmentId = toBuf(req.params.id);
    const materialIdRaw = req.body?.materialId || req.body?.material_id;
    if (!materialIdRaw) return res.status(400).json({ error: 'materialId is required' });
    const materialId = toBuf(materialIdRaw);

    const enrollment = await db.queryOne('SELECT id, student_id, course_id, status FROM enrollments WHERE id = ?', [enrollmentId]);
    if (!enrollment || enrollment.status !== 'active') return res.status(404).json({ error: 'Enrollment not found' });
    const studentId = await getStudentIdByUser(req.user.id);
    if (!studentId || toHex(studentId) !== toHex(enrollment.student_id)) {
      return res.status(403).json({ error: 'Not authorized for this enrollment' });
    }
    const material = await db.queryOne('SELECT id FROM course_materials WHERE id = ? AND course_id = ?', [materialId, enrollment.course_id]);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    await db.query(
      `INSERT INTO enrollment_progress (id, enrollment_id, material_id, completed, completed_at)
       VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE completed = TRUE, completed_at = CURRENT_TIMESTAMP`,
      [crypto.randomBytes(16), enrollment.id, material.id]
    );
    res.json({ message: 'Progress updated' });
  } catch (err) {
    console.error('Enrollment progress update error:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /enrollments/:id/progress
router.get('/:id/progress', authenticate, async (req, res) => {
  try {
    const enrollmentId = toBuf(req.params.id);
    const enrollment = await db.queryOne('SELECT id, student_id, trainer_id, course_id, status FROM enrollments WHERE id = ?', [enrollmentId]);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    if (req.user.role === 'student') {
      const studentId = await getStudentIdByUser(req.user.id);
      if (!studentId || toHex(studentId) !== toHex(enrollment.student_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role === 'trainer') {
      const trainer = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!trainer || toHex(trainer.id) !== toHex(enrollment.trainer_id)) {
        return res.status(403).json({ error: 'Not authorized for this enrollment' });
      }
    } else if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const totalRow = await db.queryOne('SELECT COUNT(*) AS c FROM course_materials WHERE course_id = ?', [enrollment.course_id]);
    const completedRow = await db.queryOne(
      'SELECT COUNT(*) AS c FROM enrollment_progress WHERE enrollment_id = ? AND completed = TRUE',
      [enrollment.id]
    );
    const total = Number(totalRow?.c || 0);
    const completed = Number(completedRow?.c || 0);
    const pct = total > 0 ? Math.round((completed * 100) / total) : 0;

    res.json({ enrollment_id: toHex(enrollment.id), total_materials: total, completed_materials: completed, completion_pct: pct });
  } catch (err) {
    console.error('Enrollment progress summary error:', err);
    res.status(500).json({ error: 'Failed to fetch progress summary' });
  }
});

module.exports = router;
