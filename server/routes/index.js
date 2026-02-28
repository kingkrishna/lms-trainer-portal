const express = require('express');
const authRoutes = require('./auth');
const trainerRoutes = require('./trainer');
const studentRoutes = require('./student');
const calendarRoutes = require('./calendar');
const jobsRoutes = require('./jobs');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');
const { optionalAuth, authenticate, requireRole } = require('../middleware/auth');
const db = require('../db/connection');
const zoho = require('../lib/zoho');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/trainer', trainerRoutes);
router.use('/student', studentRoutes);
router.use('/calendar', calendarRoutes);
router.use('/jobs', jobsRoutes);
router.use('/payment', require('./payment'));
router.use('/payments', require('./payment'));
router.use('/lms', require('./lms'));
router.use('/enrollments', require('./enrollments'));
router.use('/admin', require('./admin'));
router.use('/messages', require('./messages'));
router.use('/notifications', require('./notifications'));
router.use('/webhooks', require('./webhooks'));

function normalizeId(value) {
  if (Buffer.isBuffer(value)) return value.toString('hex');
  return String(value || '');
}

function normalizeCourse(row) {
  return {
    id: normalizeId(row.id),
    title: row.title || '',
    slug: row.slug || normalizeId(row.id),
    description: row.description || '',
    price: row.price,
    currency: row.currency || 'INR',
    is_active: row.is_active !== 0,
  };
}

function normalizeTrainer(row) {
  return {
    id: normalizeId(row.id),
    slug: row.slug || normalizeId(row.id),
    full_name: row.full_name || '',
    bio: row.bio || '',
    approval_status: row.approval_status || 'pending',
    courses: Array.isArray(row.courses) ? row.courses : [],
  };
}

async function getAllCourses() {
  try {
    const rows = await db.query('SELECT id, title, slug, description, price, currency, is_active FROM courses WHERE is_active = 1 ORDER BY title');
    return (rows || []).map(normalizeCourse);
  } catch (_) {
    const rows = await db.query('SELECT id, title, slug, price FROM courses WHERE is_active = 1 ORDER BY title');
    return (rows || []).map(normalizeCourse);
  }
}

async function getAllTrainers() {
  const rows = await db.query('SELECT id, slug, full_name, bio, approval_status, courses FROM trainers ORDER BY full_name');
  const maps = await db.query(
    `SELECT tcm.trainer_id, c.slug
     FROM trainer_course_map tcm
     JOIN courses c ON c.id = tcm.course_id
     WHERE tcm.is_active = 1 AND c.is_active = 1`
  );
  const byTrainer = {};
  for (const m of maps || []) {
    const key = normalizeId(m.trainer_id);
    byTrainer[key] = byTrainer[key] || [];
    byTrainer[key].push(m.slug);
  }
  return (rows || []).map((r) => {
    const t = normalizeTrainer(r);
    const mapped = byTrainer[t.id] || [];
    if (mapped.length) t.courses = mapped;
    else if (!Array.isArray(t.courses) || !t.courses.length) {
      t.courses = Array.isArray(r.courses)
        ? r.courses
        : (typeof r.courses === 'string' ? (() => { try { return JSON.parse(r.courses || '[]'); } catch (_) { return []; } })() : []);
    }
    return t;
  });
}

router.get('/courses', async (req, res) => {
  try {
    const courses = await getAllCourses();
    return res.json({ courses });
  } catch (err) {
    console.error('Courses fetch error:', err);
    return res.status(500).json({ error: 'Failed to load courses' });
  }
});

router.get('/courses/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const courses = await getAllCourses();
    const course = courses.find((c) => c.slug === slug || c.id === slug);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    return res.json(course);
  } catch (err) {
    console.error('Course detail fetch error:', err);
    return res.status(500).json({ error: 'Failed to load course' });
  }
});

// Contract alias: GET /users/me (same model as /auth/me)
router.get('/users/me', authenticate, async (req, res) => {
  try {
    const idBuf = db.toBuffer(req.user.id);
    const user = await db.queryOne(
      'SELECT u.id, u.email, u.is_active, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [idBuf]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    let profile = null;
    if (user.role === 'student') profile = await db.queryOne('SELECT * FROM students WHERE user_id = ?', [idBuf]);
    else if (user.role === 'trainer') profile = await db.queryOne('SELECT * FROM trainers WHERE user_id = ?', [idBuf]);
    else if (user.role === 'recruiter') profile = await db.queryOne('SELECT * FROM recruiters WHERE user_id = ?', [idBuf]);
    else if (user.role === 'super_admin') profile = await db.queryOne('SELECT * FROM admin_profiles WHERE user_id = ?', [idBuf]);
    res.json({
      user: { id: normalizeId(user.id), email: user.email, role: user.role, is_active: !!user.is_active },
      profile: profile
        ? { ...profile, id: profile.id ? normalizeId(profile.id) : normalizeId(user.id), user_id: normalizeId(profile.user_id || user.id) }
        : null,
    });
  } catch (err) {
    console.error('Users/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Contract alias: PATCH /users/me (subset used by frontend)
router.patch(
  '/users/me',
  authenticate,
  [
    body('full_name').optional().trim().isLength({ min: 1 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('profile_image_url').optional().trim(),
    body('bio').optional().trim(),
    body('company_name').optional().trim(),
    body('contact_person').optional().trim(),
    body('skills').optional(),
    body('resume_url').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const idBuf = db.toBuffer(req.user.id);
      const user = await db.queryOne(
        'SELECT u.id, u.email, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
        [idBuf]
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { full_name, phone, address, profile_image_url, bio, company_name, contact_person, skills, resume_url } = req.body;
      if (user.role === 'student') {
        const skillsJson = skills ? (Array.isArray(skills) ? JSON.stringify(skills) : JSON.stringify(String(skills).split(',').map((s) => s.trim()).filter(Boolean))) : null;
        await db.query(
          'UPDATE students SET full_name = ?, phone = ?, address = ?, profile_image_url = ?, skills = ?, resume_url = ? WHERE user_id = ?',
          [full_name ?? '', phone ?? null, address ?? null, profile_image_url ?? null, skillsJson, resume_url ?? null, idBuf]
        );
      } else if (user.role === 'trainer') {
        await db.query(
          'UPDATE trainers SET full_name = ?, phone = ?, address = ?, profile_image_url = ?, bio = ? WHERE user_id = ?',
          [full_name ?? '', phone ?? null, address ?? null, profile_image_url ?? null, bio ?? null, idBuf]
        );
      } else if (user.role === 'recruiter') {
        await db.query(
          'UPDATE recruiters SET company_name = ?, contact_person = ?, phone = ?, address = ?, profile_image_url = ? WHERE user_id = ?',
          [company_name ?? '', contact_person ?? '', phone ?? null, address ?? null, profile_image_url ?? null, idBuf]
        );
      } else if (user.role === 'super_admin') {
        await db.query(
          'UPDATE admin_profiles SET full_name = ?, phone = ?, address = ?, profile_image_url = ? WHERE user_id = ?',
          [full_name ?? '', phone ?? null, address ?? null, profile_image_url ?? null, idBuf]
        );
      }
      res.json({ message: 'Profile updated' });
    } catch (err) {
      console.error('Users/me patch error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

router.get('/trainers', optionalAuth, async (req, res) => {
  const status = req.query.status; // approved | pending | rejected | all
  const course = String(req.query.course || '').trim().toLowerCase();
  const isAdmin = req.user?.role === 'super_admin';

  try {
    let list = await getAllTrainers();
    if (isAdmin && (status === 'all' || status === 'pending' || status === 'rejected' || status === 'approved')) {
      if (status !== 'all') list = list.filter((t) => (t.approval_status || 'pending') === status);
    } else {
      list = list.filter((t) => (t.approval_status || 'pending') === 'approved');
    }
    if (course) {
      list = list.filter((t) => (t.courses || []).some((c) => String(c || '').toLowerCase() === course));
    }
    return res.json({ trainers: list });
  } catch (err) {
    console.error('Trainers fetch error:', err);
    return res.status(500).json({ error: 'Failed to load trainers' });
  }
});

router.get('/trainers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const trainers = await getAllTrainers();
    const trainer = trainers.find((t) => t.id === id || t.slug === id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    return res.json(trainer);
  } catch (err) {
    console.error('Trainer detail fetch error:', err);
    return res.status(500).json({ error: 'Failed to load trainer' });
  }
});

// POST /trainers/me/courses – trainer adds course mapping (courseId/slug only)
router.post('/trainers/me/courses', authenticate, requireRole('trainer'), async (req, res) => {
  try {
    const courseId = String(req.body?.courseId || req.body?.course_id || '').trim();
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    const trainer = await db.queryOne('SELECT id, courses FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!trainer) return res.status(403).json({ error: 'Trainer profile required' });
    const course = /^[0-9a-f]{32}$/i.test(courseId.replace(/-/g, ''))
      ? await db.queryOne('SELECT id, slug FROM courses WHERE id = ? AND is_active = 1', [db.toBuffer(courseId)])
      : await db.queryOne('SELECT id, slug FROM courses WHERE slug = ? AND is_active = 1', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existing = await db.queryOne('SELECT id FROM trainer_course_map WHERE trainer_id = ? AND course_id = ?', [trainer.id, course.id]);
    if (!existing) {
      await db.query(
        'INSERT INTO trainer_course_map (id, trainer_id, course_id, is_active) VALUES (?, ?, ?, 1)',
        [require('crypto').randomBytes(16), trainer.id, course.id]
      );
    } else {
      await db.query('UPDATE trainer_course_map SET is_active = 1 WHERE id = ?', [existing.id]);
    }
    const list = Array.isArray(trainer.courses) ? trainer.courses : (typeof trainer.courses === 'string' ? (() => { try { return JSON.parse(trainer.courses || '[]'); } catch (_) { return []; } })() : []);
    const merged = Array.from(new Set([...(list || []), course.slug]));
    await db.query('UPDATE trainers SET courses = ? WHERE id = ?', [JSON.stringify(merged), trainer.id]);
    res.status(201).json({ message: 'Course linked to trainer', course_id: normalizeId(course.id), slug: course.slug });
  } catch (err) {
    console.error('Trainer add course error:', err);
    res.status(500).json({ error: 'Failed to add trainer course' });
  }
});

// DELETE /trainers/me/courses/:courseId – trainer removes course mapping
router.delete('/trainers/me/courses/:courseId', authenticate, requireRole('trainer'), async (req, res) => {
  try {
    const courseId = String(req.params.courseId || '').trim();
    const trainer = await db.queryOne('SELECT id, courses FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!trainer) return res.status(403).json({ error: 'Trainer profile required' });
    const course = /^[0-9a-f]{32}$/i.test(courseId.replace(/-/g, ''))
      ? await db.queryOne('SELECT id, slug FROM courses WHERE id = ?', [db.toBuffer(courseId)])
      : await db.queryOne('SELECT id, slug FROM courses WHERE slug = ?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    await db.query('UPDATE trainer_course_map SET is_active = 0 WHERE trainer_id = ? AND course_id = ?', [trainer.id, course.id]);

    const list = Array.isArray(trainer.courses) ? trainer.courses : (typeof trainer.courses === 'string' ? (() => { try { return JSON.parse(trainer.courses || '[]'); } catch (_) { return []; } })() : []);
    const filtered = (list || []).filter((s) => s !== course.slug);
    await db.query('UPDATE trainers SET courses = ? WHERE id = ?', [JSON.stringify(filtered), trainer.id]);
    res.json({ message: 'Course unlinked from trainer' });
  } catch (err) {
    console.error('Trainer remove course error:', err);
    res.status(500).json({ error: 'Failed to remove trainer course' });
  }
});

// PATCH /trainers/me – trainer profile update alias
router.patch('/trainers/me', authenticate, requireRole('trainer'), async (req, res) => {
  try {
    const trainer = await db.queryOne('SELECT id FROM trainers WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!trainer) return res.status(403).json({ error: 'Trainer profile required' });
    const patch = {};
    if (req.body?.full_name !== undefined) patch.full_name = String(req.body.full_name || '').trim();
    if (req.body?.bio !== undefined) patch.bio = String(req.body.bio || '').trim() || null;
    if (req.body?.phone !== undefined) patch.phone = String(req.body.phone || '').trim() || null;
    if (req.body?.address !== undefined) patch.address = String(req.body.address || '').trim() || null;
    if (req.body?.profile_image_url !== undefined) patch.profile_image_url = String(req.body.profile_image_url || '').trim() || null;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields to update' });

    const set = [];
    const params = [];
    for (const [k, v] of Object.entries(patch)) {
      set.push(`${k} = ?`);
      params.push(v);
    }
    params.push(trainer.id);
    await db.query(`UPDATE trainers SET ${set.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Trainer profile updated' });
  } catch (err) {
    console.error('Trainers/me update error:', err);
    res.status(500).json({ error: 'Failed to update trainer profile' });
  }
});

router.get('/students/search', authenticate, async (req, res) => {
  const skills = String(req.query.skills || '').trim().toLowerCase();
  const course = String(req.query.course || '').trim().toLowerCase();

  if (req.user.role !== 'recruiter') {
    return res.status(403).json({ error: 'Recruiter access required' });
  }

  const rec = await db.queryOne('SELECT has_paid_access, access_expiry FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
  if (!rec || !rec.has_paid_access) {
    return res.status(403).json({
      error: 'Recruiter access required. Pay the access fee to search candidates.',
      requires_payment: true,
    });
  }
  if (rec.access_expiry && new Date(rec.access_expiry).getTime() < Date.now()) {
    return res.status(403).json({ error: 'Recruiter access expired', requires_renewal: true });
  }

  const filterStudents = (list) => list.filter((s) => {
    const skillText = (s.skills || []).join(' ').toLowerCase();
    const courseText = String(s.course || '').toLowerCase();
    const nameText = String(s.full_name || '').toLowerCase();
    const skillMatch = !skills || skillText.includes(skills) || nameText.includes(skills);
    const courseMatch = !course || courseText.includes(course);
    return skillMatch && courseMatch;
  });
  try {
    const rows = await db.query(
      `SELECT id, full_name, skills, phone, location, grade, visibility_flag, priority_score, certifications_json
       FROM students
       WHERE COALESCE(visibility_flag, 'public') IN ('public', 'recruiters_only')
         AND COALESCE(grade, 'UNGRADED') <> 'UNGRADED'`
    );
    const mapped = (rows || []).map((s) => ({
      id: normalizeId(s.id),
      full_name: s.full_name || '',
      course: '',
      grade: s.grade || '-',
      city: s.location || '',
      location: s.location || '',
      priority_score: Number(s.priority_score || 0),
      certifications_count: Array.isArray(s.certifications_json)
        ? s.certifications_json.length
        : (typeof s.certifications_json === 'string' ? (() => { try { return JSON.parse(s.certifications_json || '[]').length; } catch (_) { return 0; } })() : 0),
      skills: Array.isArray(s.skills) ? s.skills : (typeof s.skills === 'string' ? (() => { try { return JSON.parse(s.skills || '[]'); } catch (_) { return []; } })() : []),
    }));
    const sorted = filterStudents(mapped).sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0));
    return res.json({ students: sorted });
  } catch (err) {
    try {
      const rows = await db.query('SELECT id, full_name, skills, phone FROM students');
      const mapped = (rows || []).map((s) => ({
        id: normalizeId(s.id),
        full_name: s.full_name || '',
        course: '',
        grade: '-',
        city: '',
        skills: Array.isArray(s.skills) ? s.skills : (typeof s.skills === 'string' ? (() => { try { return JSON.parse(s.skills || '[]'); } catch (_) { return []; } })() : []),
      }));
      return res.json({ students: filterStudents(mapped) });
    } catch (inner) {
      console.error('Students search error:', inner);
      return res.status(500).json({ error: 'Failed to search students' });
    }
  }
});

// POST /recruiter/contact/:studentId - recruiter sends contact request
router.post('/recruiter/contact/:studentId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Recruiter access required' });
    const rec = await db.queryOne('SELECT id, has_paid_access, access_expiry FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!rec || !rec.has_paid_access) return res.status(403).json({ error: 'Recruiter paid access required' });
    if (rec.access_expiry && new Date(rec.access_expiry).getTime() < Date.now()) {
      return res.status(403).json({ error: 'Recruiter access expired' });
    }
    const studentId = req.params.studentId;
    const studentBuf = Buffer.from(String(studentId).replace(/-/g, ''), 'hex');
    const student = await db.queryOne('SELECT id FROM students WHERE id = ?', [studentBuf]);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const idBuf = require('crypto').randomBytes(16);
    const msg = req.body?.message || null;
    await db.query(
      'INSERT INTO contact_requests (id, recruiter_id, student_id, status, message_text) VALUES (?, ?, ?, ?, ?)',
      [idBuf, rec.id, student.id, 'pending', msg]
    );
    try {
      const row = await db.queryOne(
        `SELECT u.email AS student_email, r.company_name
         FROM students s
         JOIN users u ON s.user_id = u.id
         JOIN recruiters r ON r.id = ?
         WHERE s.id = ?`,
        [rec.id, student.id]
      );
      await zoho.sendTemplateMail({
        to: row?.student_email,
        subject: 'New recruiter contact request',
        title: 'Contact request received',
        lines: [
          `Recruiter: ${row?.company_name || 'Recruiter'}`,
          msg ? `Message: ${msg}` : 'Open your dashboard to accept/decline.',
        ],
      });
    } catch (e) {
      console.error('Zoho contact-request mail failed:', e.message);
    }
    return res.status(201).json({ message: 'Contact request sent', id: normalizeId(idBuf) });
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('duplicate')) {
      return res.status(400).json({ error: 'Contact request already exists' });
    }
    console.error('Recruiter contact request error:', err);
    return res.status(500).json({ error: 'Failed to send contact request' });
  }
});

// GET /student/contact-requests - student inbox
router.get('/student/contact-requests', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const student = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!student) return res.status(404).json({ error: 'Student profile not found' });
    const rows = await db.query(
      `SELECT cr.id, cr.status, cr.message_text, cr.sent_at, r.company_name
       FROM contact_requests cr
       JOIN recruiters r ON cr.recruiter_id = r.id
       WHERE cr.student_id = ?
       ORDER BY cr.sent_at DESC`,
      [student.id]
    );
    return res.json({
      requests: (rows || []).map((r) => ({
        id: normalizeId(r.id),
        status: r.status,
        message_text: r.message_text || '',
        sent_at: r.sent_at,
        recruiter_company: r.company_name || '',
      })),
    });
  } catch (err) {
    console.error('Student contact requests error:', err);
    return res.status(500).json({ error: 'Failed to fetch contact requests' });
  }
});

// PATCH /student/contact-requests/:id - accept/decline/block
router.patch('/student/contact-requests/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const status = String(req.body?.status || '').toLowerCase();
    if (!['accepted', 'declined', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const student = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!student) return res.status(404).json({ error: 'Student profile not found' });
    const idBuf = Buffer.from(String(req.params.id).replace(/-/g, ''), 'hex');
    await db.query(
      'UPDATE contact_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND student_id = ?',
      [status, idBuf, student.id]
    );
    try {
      const row = await db.queryOne(
        `SELECT u.email AS recruiter_email, s.full_name
         FROM contact_requests cr
         JOIN recruiters r ON cr.recruiter_id = r.id
         JOIN users u ON r.user_id = u.id
         JOIN students s ON cr.student_id = s.id
         WHERE cr.id = ?`,
        [idBuf]
      );
      await zoho.sendTemplateMail({
        to: row?.recruiter_email,
        subject: 'Student response to contact request',
        title: 'Contact request updated',
        lines: [
          `Student: ${row?.full_name || 'Student'}`,
          `Status: ${status}`,
        ],
      });
    } catch (e) {
      console.error('Zoho contact-response mail failed:', e.message);
    }
    return res.json({ message: 'Contact request updated', status });
  } catch (err) {
    console.error('Student contact update error:', err);
    return res.status(500).json({ error: 'Failed to update contact request' });
  }
});

module.exports = router;
