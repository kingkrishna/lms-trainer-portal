const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const zoho = require('../lib/zoho');
const audit = require('../lib/audit');
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

function parseJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function toSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

function parseSettingValue(row) {
  const raw = row?.setting_value;
  const t = row?.value_type || 'string';
  if (t === 'number') return Number(raw);
  if (t === 'boolean') return String(raw).toLowerCase() === 'true' || raw === '1';
  if (t === 'json') return parseJSON(raw, null);
  return raw;
}

async function fetchUserEmail(userIdBuf) {
  const u = await db.queryOne('SELECT email FROM users WHERE id = ?', [userIdBuf]);
  return u?.email || null;
}

async function resolveTrainerBuf(trainerId) {
  if (!trainerId) return null;
  const id = String(trainerId);
  if (/^[0-9a-f]{32}$/i.test(id.replace(/-/g, ''))) return toBuf(id);
  const row = await db.queryOne('SELECT id FROM trainers WHERE slug = ? OR id = ?', [id, id]);
  return row ? row.id : null;
}

async function ensureTrainerTraineeEnrollment(userIdBuf, trainerId, courseId, paymentIdBuf) {
  const trainerBuf = await resolveTrainerBuf(trainerId);
  if (!trainerBuf) throw new Error('Trainer not found for settlement');
  const course = await resolveCourseByIdentifier(courseId);
  if (!course) throw new Error('Course not found for settlement');

  const student = await db.queryOne('SELECT full_name, phone FROM students WHERE user_id = ?', [userIdBuf]);
  const studentName = student?.full_name || 'Student';
  const contactNumber = student?.phone || '';
  const existing = await db.queryOne(
    'SELECT id FROM trainer_trainees WHERE trainer_id = ? AND student_name = ? AND course_id = ? AND payment_status = ?',
    [trainerBuf, studentName, course.slug || toHex(course.id), 'paid']
  );
  if (existing) return;

  const idBuf = require('crypto').randomBytes(16);
  await db.query(
    'INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
    [idBuf, trainerBuf, studentName, course.slug || toHex(course.id), contactNumber, 'paid']
  );

  const studentProfile = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [userIdBuf]);
  if (studentProfile && paymentIdBuf) {
    const row = await db.queryOne(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND trainer_id = ? AND payment_id = ?',
      [studentProfile.id, course.id, trainerBuf, paymentIdBuf]
    );
    if (!row) {
      await db.query(
        `INSERT INTO enrollments (id, student_id, course_id, trainer_id, payment_id, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [crypto.randomBytes(16), studentProfile.id, course.id, trainerBuf, paymentIdBuf]
      );
    }
  }
}

async function resolveCourseByIdentifier(idOrSlug) {
  const val = String(idOrSlug || '').trim();
  if (!val) return null;
  if (/^[0-9a-f]{32}$/i.test(val.replace(/-/g, ''))) {
    return db.queryOne('SELECT id, title, slug, description, price, currency, is_active, created_at, updated_at FROM courses WHERE id = ?', [toBuf(val)]);
  }
  return db.queryOne('SELECT id, title, slug, description, price, currency, is_active, created_at, updated_at FROM courses WHERE slug = ?', [val]);
}

// GET /admin/users – paginated users list with role filter
router.get('/users', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const role = String(req.query.role || '').trim().toLowerCase();
    const isActive = String(req.query.is_active || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const rows = await db.query(
      `SELECT u.id, u.email, u.is_active, u.email_verified, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    let users = rows || [];
    if (role) users = users.filter((u) => String(u.role || '').toLowerCase() === role);
    if (isActive === 'true' || isActive === 'false') {
      const flag = isActive === 'true';
      users = users.filter((u) => Boolean(u.is_active) === flag);
    }
    const total = users.length;
    const offset = (page - 1) * limit;
    users = users.slice(offset, offset + limit).map((u) => ({
      id: toHex(u.id),
      email: u.email,
      role: u.role,
      is_active: Boolean(u.is_active),
      email_verified: Boolean(u.email_verified),
      created_at: u.created_at,
    }));

    res.json({ users, pagination: { page, limit, total } });
  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// PATCH /admin/users/:id – activate/deactivate user
router.patch(
  '/users/:id',
  authenticate,
  requireRole('super_admin'),
  [body('is_active').isBoolean()],
  handleValidation,
  async (req, res) => {
    try {
      const userIdBuf = toBuf(req.params.id);
      const target = await db.queryOne('SELECT id, is_active FROM users WHERE id = ?', [userIdBuf]);
      if (!target) return res.status(404).json({ error: 'User not found' });

      const isActive = Boolean(req.body.is_active);
      await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userIdBuf]);
      await audit.log('admin_user_status_update', 'users', toHex(userIdBuf), { is_active: Boolean(target.is_active) }, { is_active: isActive }, req.user.id, req);
      res.json({ message: 'User status updated', is_active: isActive });
    } catch (err) {
      console.error('Admin user update error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// POST /admin/courses – create course
router.post(
  '/courses',
  authenticate,
  requireRole('super_admin'),
  [
    body('title').isString().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().isString().isLength({ max: 10000 }),
    body('slug').optional().isString().isLength({ min: 2, max: 255 }),
    body('price').isFloat({ min: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const title = String(req.body.title).trim();
      const slug = toSlug(req.body.slug || title);
      const description = req.body.description ? String(req.body.description) : null;
      const price = Number(req.body.price);
      const currency = String(req.body.currency || 'INR').toUpperCase();
      if (!slug) return res.status(400).json({ error: 'Invalid title/slug for course' });

      const existing = await db.queryOne('SELECT id FROM courses WHERE slug = ?', [slug]);
      if (existing) return res.status(409).json({ error: 'Course slug already exists' });

      const idBuf = crypto.randomBytes(16);
      await db.query(
        `INSERT INTO courses (id, title, slug, description, price, currency, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [idBuf, title, slug, description, price, currency, toBuf(req.user.id)]
      );
      await db.query('INSERT INTO pricing_log (course_id, old_price, new_price, changed_by) VALUES (?, ?, ?, ?)', [idBuf, null, price, toBuf(req.user.id)]);
      await audit.log('admin_course_create', 'courses', toHex(idBuf), null, { title, slug, price, currency }, req.user.id, req);

      res.status(201).json({
        id: toHex(idBuf),
        title,
        slug,
        description,
        price,
        currency,
        is_active: true,
      });
    } catch (err) {
      console.error('Admin course create error:', err);
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
);

// GET /admin/courses – list courses for super admin
router.get('/courses', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || 'true').toLowerCase() === 'true';
    const rows = await db.query(
      includeInactive
        ? 'SELECT id, title, slug, description, price, currency, is_active, created_at, updated_at FROM courses ORDER BY created_at DESC'
        : 'SELECT id, title, slug, description, price, currency, is_active, created_at, updated_at FROM courses WHERE is_active = 1 ORDER BY created_at DESC'
    );
    const courses = (rows || []).map((c) => ({
      id: toHex(c.id),
      title: c.title,
      slug: c.slug,
      description: c.description || '',
      price: Number(c.price || 0),
      currency: c.currency || 'INR',
      is_active: Boolean(c.is_active),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
    res.json({ courses });
  } catch (err) {
    console.error('Admin courses list error:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /admin/courses/:id – course detail by id or slug
router.get('/courses/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const course = await resolveCourseByIdentifier(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({
      id: toHex(course.id),
      title: course.title,
      slug: course.slug,
      description: course.description || '',
      price: Number(course.price || 0),
      currency: course.currency || 'INR',
      is_active: Boolean(course.is_active),
      created_at: course.created_at,
      updated_at: course.updated_at,
    });
  } catch (err) {
    console.error('Admin course detail error:', err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// PATCH /admin/courses/:id – update course + pricing log
router.patch(
  '/courses/:id',
  authenticate,
  requireRole('super_admin'),
  [
    body('title').optional().isString().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().isString().isLength({ max: 10000 }),
    body('slug').optional().isString().isLength({ min: 2, max: 255 }),
    body('price').optional().isFloat({ min: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('is_active').optional().isBoolean(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const course = await resolveCourseByIdentifier(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const patch = {};
      if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
      if (req.body.description !== undefined) patch.description = String(req.body.description);
      if (req.body.slug !== undefined) patch.slug = toSlug(req.body.slug);
      if (req.body.price !== undefined) patch.price = Number(req.body.price);
      if (req.body.currency !== undefined) patch.currency = String(req.body.currency).toUpperCase();
      if (req.body.is_active !== undefined) patch.is_active = Boolean(req.body.is_active);
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields to update' });

      if (patch.slug) {
        const conflict = await db.queryOne('SELECT id FROM courses WHERE slug = ? AND id <> ?', [patch.slug, course.id]);
        if (conflict) return res.status(409).json({ error: 'Course slug already exists' });
      }

      const setClauses = [];
      const params = [];
      for (const [k, v] of Object.entries(patch)) {
        setClauses.push(`${k} = ?`);
        params.push(v);
      }
      params.push(course.id);
      await db.query(`UPDATE courses SET ${setClauses.join(', ')} WHERE id = ?`, params);

      if (patch.price !== undefined && Number(course.price) !== Number(patch.price)) {
        await db.query(
          'INSERT INTO pricing_log (course_id, old_price, new_price, changed_by) VALUES (?, ?, ?, ?)',
          [course.id, Number(course.price), Number(patch.price), toBuf(req.user.id)]
        );
      }
      await audit.log('admin_course_update', 'courses', toHex(course.id), {
        title: course.title,
        slug: course.slug,
        price: Number(course.price),
        currency: course.currency,
        is_active: Boolean(course.is_active),
      }, patch, req.user.id, req);

      const updated = await db.queryOne('SELECT id, title, slug, description, price, currency, is_active, created_at, updated_at FROM courses WHERE id = ?', [course.id]);
      res.json({
        message: 'Course updated',
        course: {
          id: toHex(updated.id),
          title: updated.title,
          slug: updated.slug,
          description: updated.description || '',
          price: Number(updated.price || 0),
          currency: updated.currency || 'INR',
          is_active: Boolean(updated.is_active),
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        },
      });
    } catch (err) {
      console.error('Admin course update error:', err);
      res.status(500).json({ error: 'Failed to update course' });
    }
  }
);

// DELETE /admin/courses/:id – soft delete (deactivate)
router.delete('/courses/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const course = await resolveCourseByIdentifier(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    await db.query('UPDATE courses SET is_active = 0 WHERE id = ?', [course.id]);
    await audit.log('admin_course_deactivate', 'courses', toHex(course.id), { is_active: Boolean(course.is_active) }, { is_active: false }, req.user.id, req);
    res.json({ message: 'Course deactivated' });
  } catch (err) {
    console.error('Admin course deactivate error:', err);
    res.status(500).json({ error: 'Failed to deactivate course' });
  }
});

// POST /admin/courses/:id/materials – add LMS material
router.post(
  '/courses/:id/materials',
  authenticate,
  requireRole('super_admin'),
  [
    body('title').isString().trim().isLength({ min: 2, max: 255 }),
    body('type').isIn(['video', 'document', 'link', 'live_session']),
    body('url_or_content').optional().isString().isLength({ max: 1024 }),
    body('sort_order').optional().isInt({ min: 0 }),
    body('workdrive_file_id').optional().isString().isLength({ max: 255 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const course = await resolveCourseByIdentifier(req.params.id);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const idBuf = crypto.randomBytes(16);
      await db.query(
        `INSERT INTO course_materials (id, course_id, title, type, url_or_content, workdrive_file_id, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idBuf,
          course.id,
          String(req.body.title).trim(),
          req.body.type,
          req.body.url_or_content || null,
          req.body.workdrive_file_id || null,
          Number(req.body.sort_order || 0),
          toBuf(req.user.id),
        ]
      );
      res.status(201).json({ message: 'Material created', id: toHex(idBuf) });
    } catch (err) {
      console.error('Admin material create error:', err);
      res.status(500).json({ error: 'Failed to create material' });
    }
  }
);

// PATCH /admin/materials/:id – update LMS material
router.patch(
  '/materials/:id',
  authenticate,
  requireRole('super_admin'),
  [
    body('title').optional().isString().trim().isLength({ min: 2, max: 255 }),
    body('type').optional().isIn(['video', 'document', 'link', 'live_session']),
    body('url_or_content').optional().isString().isLength({ max: 1024 }),
    body('sort_order').optional().isInt({ min: 0 }),
    body('workdrive_file_id').optional().isString().isLength({ max: 255 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const materialId = toBuf(req.params.id);
      const existing = await db.queryOne('SELECT id FROM course_materials WHERE id = ?', [materialId]);
      if (!existing) return res.status(404).json({ error: 'Material not found' });

      const patch = {};
      if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
      if (req.body.type !== undefined) patch.type = req.body.type;
      if (req.body.url_or_content !== undefined) patch.url_or_content = req.body.url_or_content;
      if (req.body.sort_order !== undefined) patch.sort_order = Number(req.body.sort_order);
      if (req.body.workdrive_file_id !== undefined) patch.workdrive_file_id = req.body.workdrive_file_id;
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields to update' });

      const setClauses = [];
      const params = [];
      for (const [k, v] of Object.entries(patch)) {
        setClauses.push(`${k} = ?`);
        params.push(v);
      }
      params.push(materialId);
      await db.query(`UPDATE course_materials SET ${setClauses.join(', ')} WHERE id = ?`, params);
      res.json({ message: 'Material updated' });
    } catch (err) {
      console.error('Admin material update error:', err);
      res.status(500).json({ error: 'Failed to update material' });
    }
  }
);

// GET /admin/trainers – list trainers (pending/approved/rejected/all)
router.get('/trainers', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const rows = await db.query(
      `SELECT t.id, t.full_name, t.bio, t.approval_status, t.created_at, u.email
       FROM trainers t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at ASC`
    );
    let trainers = rows || [];
    if (status !== 'all') trainers = trainers.filter((t) => String(t.approval_status || 'pending').toLowerCase() === status);
    const total = trainers.length;
    const offset = (page - 1) * limit;
    trainers = trainers.slice(offset, offset + limit).map((t) => ({
      id: toHex(t.id),
      full_name: t.full_name || '',
      email: t.email || '',
      bio: t.bio || '',
      approval_status: t.approval_status || 'pending',
      created_at: t.created_at,
    }));
    res.json({ trainers, pagination: { page, limit, total } });
  } catch (err) {
    console.error('Admin trainers list error:', err);
    res.status(500).json({ error: 'Failed to fetch trainers' });
  }
});

// PATCH /admin/trainers/:id/approve – approve/reject trainer
router.patch(
  '/trainers/:id/approve',
  authenticate,
  requireRole('super_admin'),
  [body('approval_status').isIn(['approved', 'rejected', 'pending'])],
  handleValidation,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { approval_status } = req.body;
      const idBuf = toBuf(id);

      const row = await db.queryOne('SELECT id FROM trainers WHERE id = ?', [idBuf]);
      if (!row) return res.status(404).json({ error: 'Trainer not found' });

      let queueHead = null;
      try {
        queueHead = await db.queryOne(
          "SELECT id FROM trainers WHERE approval_status = 'pending' ORDER BY submitted_at ASC, created_at ASC LIMIT 1"
        );
      } catch (_) {
        queueHead = await db.queryOne(
          "SELECT id FROM trainers WHERE approval_status = 'pending' ORDER BY created_at ASC LIMIT 1"
        );
      }
      if (queueHead && toHex(queueHead.id) !== toHex(idBuf)) {
        return res.status(400).json({ error: 'FIFO enforcement: approve/reject the oldest pending trainer first' });
      }

      await db.query('UPDATE trainers SET approval_status = ? WHERE id = ?', [approval_status, idBuf]);
      try {
        const trainer = await db.queryOne(
          `SELECT u.email, t.full_name
           FROM trainers t
           JOIN users u ON t.user_id = u.id
           WHERE t.id = ?`,
          [idBuf]
        );
        await zoho.upsertCRMContact({
          email: trainer?.email,
          fullName: trainer?.full_name,
          role: 'trainer',
          lifecycleStage: approval_status === 'approved' ? 'trainer_approved' : `trainer_${approval_status}`,
        });
        await zoho.postCliq(`Trainer ${approval_status}: ${trainer?.full_name || 'unknown'} (${trainer?.email || 'no-email'})`);
        if (approval_status === 'approved') {
          await zoho.sendTemplateMail({
            to: trainer?.email,
            subject: 'Trainer profile approved',
            title: 'Approval completed',
            lines: [
              'Your trainer profile has been approved.',
              'Please complete the digital agreement to activate all features.',
            ],
          });
          await zoho.dispatchSignAgreement({
            email: trainer?.email,
            name: trainer?.full_name || trainer?.email,
            type: 'Trainer Agreement',
            externalRef: toHex(idBuf),
          });
        }
      } catch (e) {
        console.error('Zoho trainer approval sync failed:', e.message);
      }
      res.json({ message: 'Trainer status updated', approval_status });
    } catch (err) {
      console.error('Admin trainer approve error:', err);
      res.status(500).json({ error: 'Failed to update' });
    }
  }
);

// POST /admin/trainers/:id/approve – contract alias (defaults to approved)
router.post(
  '/trainers/:id/approve',
  authenticate,
  requireRole('super_admin'),
  [body('approval_status').optional().isIn(['approved', 'rejected', 'pending'])],
  handleValidation,
  async (req, res) => {
    try {
      const idBuf = toBuf(req.params.id);
      const approval_status = req.body?.approval_status || 'approved';
      const row = await db.queryOne('SELECT id FROM trainers WHERE id = ?', [idBuf]);
      if (!row) return res.status(404).json({ error: 'Trainer not found' });

      let queueHead = null;
      try {
        queueHead = await db.queryOne(
          "SELECT id FROM trainers WHERE approval_status = 'pending' ORDER BY submitted_at ASC, created_at ASC LIMIT 1"
        );
      } catch (_) {
        queueHead = await db.queryOne(
          "SELECT id FROM trainers WHERE approval_status = 'pending' ORDER BY created_at ASC LIMIT 1"
        );
      }
      if (queueHead && toHex(queueHead.id) !== toHex(idBuf)) {
        return res.status(400).json({ error: 'FIFO enforcement: approve/reject the oldest pending trainer first' });
      }

      await db.query('UPDATE trainers SET approval_status = ? WHERE id = ?', [approval_status, idBuf]);
      res.json({ message: 'Trainer status updated', approval_status });
    } catch (err) {
      console.error('Admin trainer approve (POST) error:', err);
      res.status(500).json({ error: 'Failed to update trainer' });
    }
  }
);

// GET /admin/stats – platform stats for admin
router.get('/stats', authenticate, requireRole('super_admin'), async (req, res) => {
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

// GET /admin/settings – list platform settings
router.get('/settings', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT setting_key, setting_value, value_type, updated_at
       FROM admin_settings
       ORDER BY setting_key ASC`
    );
    const settings = (rows || []).map((s) => ({
      key: s.setting_key,
      value: parseSettingValue(s),
      value_type: s.value_type,
      updated_at: s.updated_at,
    }));
    res.json({ settings });
  } catch (err) {
    console.error('Admin settings list error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /admin/settings – update one platform setting
router.patch(
  '/settings',
  authenticate,
  requireRole('super_admin'),
  [
    body('key').isString().trim().isLength({ min: 2, max: 64 }),
    body('value').exists(),
    body('value_type').optional().isIn(['string', 'number', 'boolean', 'json']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const key = String(req.body.key).trim();
      const valueType = req.body.value_type || (typeof req.body.value === 'number'
        ? 'number'
        : typeof req.body.value === 'boolean'
          ? 'boolean'
          : typeof req.body.value === 'object'
            ? 'json'
            : 'string');
      const value = valueType === 'json' ? JSON.stringify(req.body.value) : String(req.body.value);

      await db.query(
        `INSERT INTO admin_settings (setting_key, setting_value, value_type, updated_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), value_type = VALUES(value_type), updated_by = VALUES(updated_by)`,
        [key, value, valueType, toBuf(req.user.id)]
      );
      await audit.log('admin_setting_update', 'admin_settings', key, null, { key, value: req.body.value, value_type: valueType }, req.user.id, req);
      res.json({ message: 'Setting updated', key, value: req.body.value, value_type: valueType });
    } catch (err) {
      console.error('Admin setting update error:', err);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
);

// GET /admin/audit-logs – paginated audit log list
router.get('/audit-logs', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const action = String(req.query.action || '').trim();
    const resourceType = String(req.query.resource_type || '').trim();
    const userId = String(req.query.user_id || '').trim();

    const where = [];
    const params = [];
    if (action) {
      where.push('al.action = ?');
      params.push(action);
    }
    if (resourceType) {
      where.push('al.resource_type = ?');
      params.push(resourceType);
    }
    if (userId && /^[0-9a-f]{32}$/i.test(userId.replace(/-/g, ''))) {
      where.push('al.user_id = ?');
      params.push(toBuf(userId));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const rows = await db.query(
      `SELECT al.id, al.user_id, u.email AS user_email, al.action, al.resource_type, al.resource_id,
              al.old_value, al.new_value, al.ip_address, al.user_agent, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countRow = await db.queryOne(
      `SELECT COUNT(*) AS c
       FROM audit_logs al
       ${whereSql}`,
      params
    );
    const logs = (rows || []).map((r) => ({
      id: Number(r.id),
      user_id: r.user_id ? toHex(r.user_id) : null,
      user_email: r.user_email || null,
      action: r.action,
      resource_type: r.resource_type || null,
      resource_id: r.resource_id || null,
      old_value: parseJSON(r.old_value, null),
      new_value: parseJSON(r.new_value, null),
      ip_address: r.ip_address || null,
      user_agent: r.user_agent || null,
      created_at: r.created_at,
    }));
    res.json({ logs, pagination: { page, limit, total: Number(countRow?.c || 0) } });
  } catch (err) {
    console.error('Admin audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /admin/disputes – support/dispute feed (ready for Zoho Desk sync)
router.get('/disputes', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;
    const rows = await db.query(
      `SELECT m.id, m.subject, m.body, m.related_type, m.created_at, m.is_read,
              su.email AS sender_email, ru.email AS recipient_email
       FROM messages m
       JOIN users su ON su.id = m.sender_id
       JOIN users ru ON ru.id = m.recipient_id
       WHERE m.related_type = 'support'
       ORDER BY m.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );
    const countRow = await db.queryOne("SELECT COUNT(*) AS c FROM messages WHERE related_type = 'support'");
    const disputes = (rows || []).map((r) => ({
      id: toHex(r.id),
      subject: r.subject || '',
      body: r.body || '',
      sender_email: r.sender_email || '',
      recipient_email: r.recipient_email || '',
      status: r.is_read ? 'open' : 'new',
      created_at: r.created_at,
      source: 'local_support',
    }));
    let deskTickets = [];
    try {
      const desk = await zoho.listDeskTickets({ limit, from: offset });
      const tickets = Array.isArray(desk?.data) ? desk.data : (Array.isArray(desk) ? desk : []);
      deskTickets = tickets.map((t) => ({
        id: String(t.id || ''),
        subject: t.subject || '',
        body: t.description || '',
        sender_email: t.email || '',
        recipient_email: '',
        status: t.status || 'open',
        created_at: t.createdTime || t.created_at || null,
        source: 'zoho_desk',
      }));
    } catch (e) {
      console.error('Zoho desk list failed:', e.message);
    }
    res.json({
      disputes: disputes.concat(deskTickets),
      pagination: { page, limit, total: Number(countRow?.c || 0) + deskTickets.length },
      source: deskTickets.length ? 'messages_support+zoho_desk' : 'messages_support',
    });
  } catch (err) {
    console.error('Admin disputes error:', err);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// GET /admin/payments – all payments with optional filters
router.get('/payments', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const paymentType = String(req.query.payment_type || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const where = [];
    const params = [];
    if (status) {
      where.push('p.status = ?');
      params.push(status);
    }
    if (paymentType) {
      where.push('p.payment_type = ?');
      params.push(paymentType);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const rows = await db.query(
      `SELECT p.id, p.user_id, p.amount, p.currency, p.payment_type, p.gateway_order_id, p.gateway_payment_id, p.status, p.metadata, p.verified_at, p.created_at, u.email
       FROM payments p
       JOIN users u ON p.user_id = u.id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const countRow = await db.queryOne(
      `SELECT COUNT(*) AS c
       FROM payments p
       ${whereSql}`,
      params
    );
    const payments = (rows || []).map((p) => ({
      id: toHex(p.id),
      user_id: toHex(p.user_id),
      email: p.email || '',
      amount: Number(p.amount || 0),
      currency: p.currency || 'INR',
      payment_type: p.payment_type,
      gateway_order_id: p.gateway_order_id || null,
      gateway_payment_id: p.gateway_payment_id || null,
      status: p.status,
      metadata: parseJSON(p.metadata, null),
      verified_at: p.verified_at,
      created_at: p.created_at,
    }));
    res.json({ payments, pagination: { page, limit, total: Number(countRow?.c || 0) } });
  } catch (err) {
    console.error('Admin payments list error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /admin/payments/pending – pending course/recruiter payments
router.get('/payments/pending', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.id, p.user_id, p.amount, p.currency, p.payment_type, p.gateway_order_id, p.status, p.metadata, p.created_at, u.email
       FROM payments p
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'pending'
       ORDER BY p.created_at DESC`
    );
    const payments = (rows || []).map((p) => ({
      id: toHex(p.id),
      user_id: toHex(p.user_id),
      email: p.email || '',
      amount: Number(p.amount || 0),
      currency: p.currency || 'INR',
      payment_type: p.payment_type,
      gateway_order_id: p.gateway_order_id || null,
      status: p.status,
      metadata: typeof p.metadata === 'string' ? (() => { try { return JSON.parse(p.metadata); } catch (_) { return null; } })() : (p.metadata || null),
      created_at: p.created_at,
    }));
    res.json({ payments });
  } catch (err) {
    console.error('Admin pending payments error:', err);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// PATCH /admin/payments/:id/settle – manual settlement when gateway is unavailable
router.patch(
  '/payments/:id/settle',
  authenticate,
  requireRole('super_admin'),
  [body('note').optional().isString().isLength({ max: 500 })],
  handleValidation,
  async (req, res) => {
    try {
      const paymentIdBuf = toBuf(req.params.id);
      const payment = await db.queryOne(
        'SELECT id, user_id, amount, currency, payment_type, gateway_order_id, status, metadata FROM payments WHERE id = ?',
        [paymentIdBuf]
      );
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (payment.status === 'completed') return res.json({ message: 'Payment already settled', already_settled: true });
      if (payment.status !== 'pending') return res.status(400).json({ error: `Cannot settle payment in status "${payment.status}"` });

      const metadata = typeof payment.metadata === 'string'
        ? (() => { try { return JSON.parse(payment.metadata || '{}'); } catch (_) { return {}; } })()
        : (payment.metadata || {});

      if (payment.payment_type === 'course_enrollment') {
        if (!metadata.course_id || !metadata.trainer_id) {
          return res.status(400).json({ error: 'Payment metadata missing course/trainer for settlement' });
        }
      }

      await db.query(
        `UPDATE payments
         SET status = 'completed',
             verified_at = CURRENT_TIMESTAMP,
             gateway_payment_id = COALESCE(gateway_payment_id, ?),
             gateway_signature = COALESCE(gateway_signature, ?)
         WHERE id = ? AND status = 'pending'`,
        [`manual_${Date.now()}`, 'manual_settlement', payment.id]
      );

      if (payment.payment_type === 'course_enrollment') {
        await ensureTrainerTraineeEnrollment(payment.user_id, metadata.trainer_id, metadata.course_id, payment.id);
      } else if (payment.payment_type === 'recruiter_access') {
        await db.query(
          'UPDATE recruiters SET has_paid_access = TRUE, access_paid_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [payment.user_id]
        );
      }
      try {
        const email = await fetchUserEmail(payment.user_id);
        await zoho.pushBooksInvoice({
          email,
          amount: payment.amount,
          currency: payment.currency || 'INR',
          description: `Manual settlement (${payment.payment_type})`,
        });
        await zoho.postCliq(`Manual settlement: ${payment.payment_type} | ${email || 'unknown'} | ${payment.amount} ${payment.currency || 'INR'}`);
      } catch (e) {
        console.error('Zoho manual settlement sync failed:', e.message);
      }

      try {
        require('../lib/audit').log(
          'payment_manual_settlement',
          'payments',
          toHex(payment.id),
          { status: 'pending' },
          { status: 'completed', note: req.body.note || null, payment_type: payment.payment_type },
          req.user.id,
          req
        );
      } catch (_) {}

      res.json({ message: 'Payment settled successfully', payment_id: toHex(payment.id), payment_type: payment.payment_type });
    } catch (err) {
      console.error('Admin payment settle error:', err);
      res.status(500).json({ error: 'Failed to settle payment' });
    }
  }
);

module.exports = router;
