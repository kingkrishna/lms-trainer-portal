const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db/connection');
const zoho = require('../lib/zoho');
const analytics = require('../lib/analytics');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const googleClient = config.google.clientId ? new OAuth2Client(config.google.clientId) : null;

function setTokenCookie(res, payload) {
  const id = Buffer.isBuffer(payload.id) ? db.toHex(payload.id) : payload.id;
  const token = jwt.sign(
    {
      id,
      email: payload.email,
      role: payload.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  const isProduction = config.env === 'production';
  const cookieOpts = {
    secure: isProduction,
    sameSite: 'lax', // lax allows redirect after login; strict can block in some browsers
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  res.cookie(config.jwt.cookieName, token, { ...cookieOpts, httpOnly: true });
  res.cookie('lms_ok', '1', { ...cookieOpts, httpOnly: false }); // readable by JS for isLoggedIn()
}

// POST /auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
    body('role').isIn(['student', 'trainer', 'recruiter']).withMessage('Invalid role'),
    body('full_name').optional().trim().isLength({ min: 1 }),
    body('company_name').optional().trim().isLength({ min: 1 }),
    body('contact_person').optional().trim(),
    body('phone').optional().trim(),
    body('bio').optional().trim(),
    body().custom((v) => {
      const role = String(v?.role || '').trim();
      if (role === 'student' && !String(v?.full_name || '').trim()) {
        throw new Error('full_name is required for student');
      }
      if (role === 'trainer' && !String(v?.full_name || '').trim()) {
        throw new Error('full_name is required for trainer');
      }
      if (role === 'recruiter' && !String(v?.company_name || '').trim()) {
        throw new Error('company_name is required for recruiter');
      }
      return true;
    }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { email, password, role, full_name, company_name, contact_person, phone, bio } = req.body;
      const idBuf = Buffer.from(uuidv4().replace(/-/g, ''), 'hex');

      const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const roleMap = { student: 2, trainer: 3, recruiter: 4 };
      const roleId = roleMap[role];
      const passwordHash = await bcrypt.hash(password, 12);

      await db.query(
        'INSERT INTO users (id, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
        [idBuf, email, passwordHash, roleId]
      );

      const name = full_name || contact_person || company_name || 'User';
      if (role === 'student') {
        await db.query(
          'INSERT INTO students (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)',
          [idBuf, idBuf, name, phone || null]
        );
      } else if (role === 'trainer') {
        await db.query(
          'INSERT INTO trainers (id, user_id, full_name, bio) VALUES (?, ?, ?, ?)',
          [idBuf, idBuf, name, bio || null]
        );
      } else if (role === 'recruiter') {
        await db.query(
          'INSERT INTO recruiters (id, user_id, company_name, contact_person) VALUES (?, ?, ?, ?)',
          [idBuf, idBuf, company_name || name, contact_person || null]
        );
      }

      const roleName = await db.queryOne('SELECT name FROM roles WHERE id = ?', [roleId]);
      try {
        await zoho.upsertCRMContact({
          email,
          fullName: name,
          role: roleName?.name,
          phone,
          lifecycleStage: 'registered',
        });
        await zoho.sendTemplateMail({
          to: email,
          subject: 'Welcome to Vision Connects',
          title: 'Registration successful',
          lines: [
            `Role: ${roleName?.name || role}`,
            'Your account is now active.',
            'You can login and complete your profile.',
          ],
        });
      } catch (e) {
        console.error('Zoho register sync failed:', e.message);
      }
      setTokenCookie(res, { id: idBuf, email, role: roleName.name });
      analytics.track('auth_register', { role: roleName.name, email_domain: String(email).split('@')[1] || '' }, db.toHex(idBuf));
      res.status(201).json({
        message: 'Registered successfully',
        user: { id: db.toHex(idBuf), email, role: roleName.name },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await db.queryOne(
        'SELECT u.id, u.email, u.password_hash, u.is_active, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
        [email]
      );
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      try {
        await zoho.upsertCRMContact({
          email: user.email,
          role: user.role,
          lifecycleStage: 'active_login',
        });
      } catch (e) {
        console.error('Zoho login sync failed:', e.message);
      }
      try { require('../lib/audit').log('login', 'user', db.toHex(user.id), null, { email: user.email, role: user.role }, user.id, req); } catch (_) {}
      setTokenCookie(res, { id: user.id, email: user.email, role: user.role });
      analytics.track('auth_login', { role: user.role }, db.toHex(user.id));
      res.json({
        message: 'Logged in',
        user: { id: db.toHex(user.id), email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// GET /auth/config – public config for frontend (Google Client ID)
router.get('/config', (req, res) => {
  res.json({
    googleClientId: config.google.clientId || '',
  });
});

// POST /auth/google – login or register with Google ID token
router.post(
  '/google',
  authLimiter,
  [body('credential').notEmpty().withMessage('Google credential required'), body('role').optional().isIn(['student', 'trainer', 'recruiter'])],
  handleValidation,
  async (req, res) => {
    try {
      const { credential, role } = req.body;
      if (!googleClient || !config.google.clientId) {
        return res.status(503).json({ error: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID in .env' });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, email_verified, name, picture } = payload;

      if (!email || !email_verified) {
        return res.status(400).json({ error: 'Google email not verified' });
      }

      let user = await db.queryOne(
        'SELECT u.id, u.email, u.google_id, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? OR u.google_id = ?',
        [email, googleId]
      );

      if (user) {
        if (!user.google_id) {
          await db.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
        }
        await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, email_verified = TRUE WHERE id = ?', [user.id]);
        try {
          await zoho.upsertCRMContact({
            email: user.email,
            fullName: name,
            role: user.role,
            lifecycleStage: 'active_login',
          });
        } catch (e) {
          console.error('Zoho google login sync failed:', e.message);
        }
        setTokenCookie(res, { id: user.id, email: user.email, role: user.role });
        return res.json({
          message: 'Logged in',
          user: { id: db.toHex(user.id), email: user.email, role: user.role },
        });
      }

      if (!role) {
        return res.status(400).json({ error: 'New user: please sign up with Google and choose your role first' });
      }

      const idBuf = Buffer.from(uuidv4().replace(/-/g, ''), 'hex');
      const roleMap = { student: 2, trainer: 3, recruiter: 4 };
      const roleId = roleMap[role];
      const fullName = name || email.split('@')[0];

      await db.query(
        'INSERT INTO users (id, email, google_id, password_hash, role_id, email_verified) VALUES (?, ?, ?, NULL, ?, TRUE)',
        [idBuf, email, googleId, roleId]
      );

      if (role === 'student') {
        await db.query('INSERT INTO students (id, user_id, full_name) VALUES (?, ?, ?)', [idBuf, idBuf, fullName]);
      } else if (role === 'trainer') {
        await db.query('INSERT INTO trainers (id, user_id, full_name) VALUES (?, ?, ?)', [idBuf, idBuf, fullName]);
      } else {
        await db.query('INSERT INTO recruiters (id, user_id, company_name, contact_person) VALUES (?, ?, ?, ?)', [
          idBuf,
          idBuf,
          fullName,
          fullName,
        ]);
      }

      const roleName = await db.queryOne('SELECT name FROM roles WHERE id = ?', [roleId]);
      try {
        await zoho.upsertCRMContact({
          email,
          fullName,
          role: roleName?.name,
          lifecycleStage: 'registered_google',
        });
      } catch (e) {
        console.error('Zoho google register sync failed:', e.message);
      }
      setTokenCookie(res, { id: idBuf, email, role: roleName.name });
      res.status(201).json({
        message: 'Registered with Google',
        user: { id: db.toHex(idBuf), email, role: roleName.name },
      });
    } catch (err) {
      console.error('Google auth error:', err);
      if (err.message && err.message.includes('Token used too late')) {
        return res.status(401).json({ error: 'Session expired. Please try again.' });
      }
      const msg = config.env === 'development' && err.message
        ? `Google sign-in failed: ${err.message}`
        : 'Google sign-in failed';
      res.status(500).json({ error: msg });
    }
  }
);

// POST /auth/logout
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie(config.jwt.cookieName, { path: '/' });
  res.clearCookie('lms_ok', { path: '/' });
  analytics.track('auth_logout', { role: req.user.role }, req.user.id);
  res.json({ message: 'Logged out' });
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const token =
      req.cookies?.[config.jwt.cookieName] ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, config.jwt.secret, { ignoreExpiration: true });
    setTokenCookie(res, { id: decoded.id, email: decoded.email, role: decoded.role });
    res.json({ message: 'Session refreshed' });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// GET /auth/me – current user + role profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const idBuf = db.toBuffer(req.user.id);
    const user = await db.queryOne(
      'SELECT u.id, u.email, u.is_active, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [idBuf]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    let profile = null;
    if (user.role === 'student') {
      profile = await db.queryOne('SELECT * FROM students WHERE user_id = ?', [idBuf]);
    } else if (user.role === 'trainer') {
      profile = await db.queryOne('SELECT * FROM trainers WHERE user_id = ?', [idBuf]);
    } else if (user.role === 'recruiter') {
      profile = await db.queryOne('SELECT * FROM recruiters WHERE user_id = ?', [idBuf]);
    } else if (user.role === 'super_admin') {
      profile = await db.queryOne('SELECT * FROM admin_profiles WHERE user_id = ?', [idBuf]);
    }

    res.json({
      user: {
        id: db.toHex(user.id),
        email: user.email,
        role: user.role,
        is_active: !!user.is_active,
      },
      profile: profile ? { ...profile, id: profile.id ? db.toHex(profile.id) : db.toHex(user.id), user_id: db.toHex(profile.user_id || user.id) } : null,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /auth/profile – update profile (name, phone, address, image, etc.)
router.patch(
  '/profile',
  authenticate,
  authLimiter,
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
      const { full_name, phone, address, profile_image_url, bio, company_name, contact_person, skills, resume_url } = req.body;

      const user = await db.queryOne(
        'SELECT u.id, u.email, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
        [idBuf]
      );
      if (!user) return res.status(404).json({ error: 'User not found' });

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

      const profile = await db.queryOne(
        user.role === 'student' ? 'SELECT * FROM students WHERE user_id = ?' :
        user.role === 'trainer' ? 'SELECT * FROM trainers WHERE user_id = ?' :
        user.role === 'recruiter' ? 'SELECT * FROM recruiters WHERE user_id = ?' :
        'SELECT * FROM admin_profiles WHERE user_id = ?',
        [idBuf]
      );

      res.json({
        message: 'Profile updated',
        profile: profile ? { ...profile, id: profile.id ? db.toHex(profile.id) : db.toHex(user.id), user_id: db.toHex(profile.user_id || user.id) } : null,
      });
      try {
        await zoho.upsertCRMContact({
          email: user.email,
          fullName: full_name || contact_person || company_name || user.email,
          role: user.role,
          phone,
          lifecycleStage: 'profile_updated',
        });
      } catch (e) {
        console.error('Zoho profile sync failed:', e.message);
      }
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

module.exports = router;
