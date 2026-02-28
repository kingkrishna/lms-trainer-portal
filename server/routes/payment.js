const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const zoho = require('../lib/zoho');
const analytics = require('../lib/analytics');
const { authenticate, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

function toBuf(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  const s = String(hex).replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(s)) return Buffer.from(s, 'hex');
  return null;
}

async function resolveTrainerBuf(trainerId) {
  if (!trainerId) return null;
  const buf = toBuf(trainerId);
  if (buf) return buf;
  const row = await db.queryOne('SELECT id FROM trainers WHERE slug = ? OR id = ?', [trainerId, trainerId]);
  return row ? row.id : null;
}

async function resolveCourseByIdentifier(courseId) {
  if (!courseId) return null;
  const id = String(courseId);
  if (/^[0-9a-f]{32}$/i.test(id.replace(/-/g, ''))) {
    return db.queryOne('SELECT id, slug, title FROM courses WHERE id = ? AND is_active = 1', [toBuf(id)]);
  }
  return db.queryOne('SELECT id, slug, title FROM courses WHERE slug = ? AND is_active = 1', [id]);
}

async function ensureTrainerTraineeEnrollment(userIdBuf, trainerId, courseId, paymentIdBuf) {
  const trainerBuf = await resolveTrainerBuf(trainerId);
  if (!trainerBuf) throw new Error('Trainer not found');
  const course = await resolveCourseByIdentifier(courseId);
  if (!course) throw new Error('Course not found');

  const student = await db.queryOne('SELECT full_name, phone FROM students WHERE user_id = ?', [userIdBuf]);
  const studentName = student?.full_name || 'Student';
  const contactNumber = student?.phone || '';
  const existing = await db.queryOne(
    'SELECT id FROM trainer_trainees WHERE trainer_id = ? AND student_name = ? AND course_id = ? AND payment_status = ?',
    [trainerBuf, studentName, course.slug || db.toHex(course.id), 'paid']
  );
  if (existing) return;

  const ttId = crypto.randomBytes(16);
  await db.query(
    `INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status)
     VALUES (?, ?, ?, ?, ?, 'paid')`,
    [ttId, trainerBuf, studentName, course.slug || db.toHex(course.id), contactNumber]
  );

  const studentProfile = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [userIdBuf]);
  if (!studentProfile || !paymentIdBuf) return;
  const enrollment = await db.queryOne(
    'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND trainer_id = ? AND payment_id = ?',
    [studentProfile.id, course.id, trainerBuf, paymentIdBuf]
  );
  if (!enrollment) {
    await db.query(
      `INSERT INTO enrollments (id, student_id, course_id, trainer_id, payment_id, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [crypto.randomBytes(16), studentProfile.id, course.id, trainerBuf, paymentIdBuf]
    );
  }
}

async function fetchUserEmail(userIdBuf) {
  const u = await db.queryOne('SELECT email FROM users WHERE id = ?', [userIdBuf]);
  return u?.email || null;
}

async function notifyZohoPayment(paymentRow, description) {
  try {
    const email = await fetchUserEmail(paymentRow.user_id);
    await zoho.pushBooksInvoice({
      email,
      amount: paymentRow.amount,
      currency: paymentRow.currency || 'INR',
      description,
    });
    await zoho.postCliq(`Payment completed: ${description || paymentRow.payment_type} | ${email || 'unknown user'} | ${paymentRow.amount} ${paymentRow.currency || 'INR'}`);
  } catch (e) {
    console.error('Zoho payment sync failed:', e.message);
  }
}

// POST /payment/create-order – create Razorpay order for course enrollment
router.post(
  '/create-order',
  authenticate,
  requireRole('student'),
  [body('course_id').optional().trim(), body('courseId').optional().trim(), body('trainer_id').optional().trim(), body('trainerId').optional().trim()],
  handleValidation,
  async (req, res) => {
    try {
      const course_id = req.body.course_id || req.body.courseId;
      const trainer_id = req.body.trainer_id || req.body.trainerId;
      if (!course_id || !trainer_id) {
        return res.status(400).json({ error: 'course_id/courseId and trainer_id/trainerId are required' });
      }
      const isHex = /^[0-9a-f]{32}$/i.test(String(course_id).replace(/-/g, ''));
      const course = isHex
        ? await db.queryOne('SELECT id, title, price, currency FROM courses WHERE id = ? AND is_active = 1', [toBuf(course_id)])
        : await db.queryOne('SELECT id, title, price, currency FROM courses WHERE slug = ? AND is_active = 1', [course_id]);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const trainerBuf = await resolveTrainerBuf(trainer_id);
      if (!trainerBuf) return res.status(404).json({ error: 'Trainer not found' });

      const amt = Number(course.price) * 100;
      if (amt < 100) return res.status(400).json({ error: 'Invalid amount' });

      const rz = config.payment?.razorpay;
      if (!rz?.keyId || !rz?.keySecret) {
        return res.status(503).json({ error: 'Payments not configured', code: 'PAYMENT_NOT_CONFIGURED' });
      }

      const Razorpay = require('razorpay');
      const rzInstance = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
      const order = await rzInstance.orders.create({
        amount: Math.round(amt),
        currency: course.currency || 'INR',
        receipt: 'lms_' + Date.now(),
        notes: { course_id: db.toHex(course.id), trainer_id: db.toHex(trainerBuf), user_id: req.user.id },
      });

      const idBuf = crypto.randomBytes(16);
      const meta = JSON.stringify({ course_id: db.toHex(course.id), trainer_id: db.toHex(trainerBuf), course_slug: course_id });
      await db.query(
        `INSERT INTO payments (id, user_id, amount, currency, payment_type, gateway_order_id, status, metadata)
         VALUES (?, ?, ?, ?, 'course_enrollment', ?, 'pending', ?)`,
        [idBuf, toBuf(req.user.id), amt / 100, course.currency || 'INR', order.id, meta]
      );

      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: rz.keyId,
        payment_id: db.toHex ? db.toHex(idBuf) : idBuf.toString('hex'),
      });
      analytics.track('payment_order_created', { payment_type: 'course_enrollment', amount: amt / 100 }, req.user.id);
    } catch (err) {
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

// POST /payment/verify – verify Razorpay payment (called from frontend after success)
router.post(
  '/verify',
  authenticate,
  requireRole('student'),
  [
    body('razorpay_order_id').trim().notEmpty(),
    body('razorpay_payment_id').trim().notEmpty(),
    body('razorpay_signature').trim().notEmpty(),
    body('course_id').optional().trim(),
    body('courseId').optional().trim(),
    body('trainer_id').optional().trim(),
    body('trainerId').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const course_id = req.body.course_id || req.body.courseId;
      const trainer_id = req.body.trainer_id || req.body.trainerId;
      const rz = config.payment?.razorpay;
      if (!rz?.keySecret) return res.status(503).json({ error: 'Payments not configured' });

      const sig = crypto
        .createHmac('sha256', rz.keySecret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
      if (sig !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      const payment = await db.queryOne(
        'SELECT id, user_id, amount, metadata FROM payments WHERE gateway_order_id = ? AND status = ?',
        [razorpay_order_id, 'pending']
      );
      if (!payment) return res.status(404).json({ error: 'Payment not found or already processed' });

      const metadata = typeof payment.metadata === 'string'
        ? (() => { try { return JSON.parse(payment.metadata || '{}'); } catch (_) { return {}; } })()
        : (payment.metadata || {});
      const effectiveCourseId = course_id || metadata.course_id || metadata.course_slug;
      const effectiveTrainerId = trainer_id || metadata.trainer_id;
      if (!effectiveCourseId || !effectiveTrainerId) {
        return res.status(400).json({ error: 'Missing course/trainer data for verification' });
      }
      const course = await resolveCourseByIdentifier(effectiveCourseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (Number(payment.amount || 0) !== Number(course.price || 0)) {
        return res.status(400).json({ error: 'Amount mismatch for payment verification' });
      }

      await db.query(
        `UPDATE payments SET gateway_payment_id = ?, gateway_signature = ?, status = 'completed', verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [razorpay_payment_id, razorpay_signature, payment.id]
      );

      await ensureTrainerTraineeEnrollment(payment.user_id, effectiveTrainerId, effectiveCourseId, payment.id);
      await notifyZohoPayment(
        {
          user_id: payment.user_id,
          amount: payment.amount,
          currency: 'INR',
          payment_type: 'course_enrollment',
        },
        `Course enrollment (${effectiveCourseId})`
      );
      try {
        const email = await fetchUserEmail(payment.user_id);
        await zoho.sendTemplateMail({
          to: email,
          subject: 'Enrollment payment verified',
          title: 'Payment successful',
          lines: [
            `Course: ${effectiveCourseId}`,
            `Trainer: ${effectiveTrainerId}`,
            'Your LMS access has been activated.',
          ],
        });
      } catch (e) {
        console.error('Zoho payment mail failed:', e.message);
      }

      res.json({ success: true, message: 'Payment verified and enrollment confirmed' });
      analytics.track('payment_verified', { payment_type: 'course_enrollment', amount: Number(payment.amount || 0) }, req.user.id);
    } catch (err) {
      console.error('Verify payment error:', err);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

// POST /payment/webhook – Razorpay webhook (raw body via app.js middleware)
router.post('/webhook', async (req, res) => {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = JSON.parse(body.toString());
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const crypto = require('crypto');
  const sig = req.headers['x-razorpay-signature'];
  const secret = config.payment?.razorpay?.webhookSecret;
  if (!secret) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  if (sig !== expected) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
    const event = body.event;
  if (event === 'payment.captured') {
    const payment = body.payload?.payment?.entity;
    if (!payment) return res.json({ received: true });
    const orderId = payment.order_id;
    const paymentId = payment.id;
    try {
      const existing = await db.queryOne('SELECT id FROM payments WHERE gateway_order_id = ? AND status = ?', [
        orderId,
        'pending',
      ]);
      if (!existing) return res.json({ received: true });
      const payMetaRow = await db.queryOne('SELECT metadata FROM payments WHERE gateway_order_id = ?', [orderId]);
      const meta = payMetaRow?.metadata ? (typeof payMetaRow.metadata === 'string' ? JSON.parse(payMetaRow.metadata) : payMetaRow.metadata) : {};
      const courseId = meta.course_id;
      const trainerId = meta.trainer_id;
      if (courseId) {
        const course = await resolveCourseByIdentifier(courseId);
        const paidAmount = Number(payment.amount || 0) / 100;
        const expectedAmount = Number(course?.price || 0);
        if (!course || expectedAmount !== paidAmount) {
          await db.query("UPDATE payments SET status = 'failed' WHERE gateway_order_id = ?", [orderId]);
          return res.json({ received: true });
        }
      }
      await db.query(
        `UPDATE payments SET gateway_payment_id = ?, status = 'completed', verified_at = CURRENT_TIMESTAMP WHERE gateway_order_id = ?`,
        [paymentId, orderId]
      );
      if (courseId && trainerId) {
        const payRow = await db.queryOne('SELECT id, user_id FROM payments WHERE gateway_order_id = ?', [orderId]);
        if (payRow) {
          await ensureTrainerTraineeEnrollment(payRow.user_id, trainerId, courseId, payRow.id);
          await notifyZohoPayment(
            {
              user_id: payRow.user_id,
              amount: Number(payment.amount || 0) / 100,
              currency: payment.currency || 'INR',
              payment_type: 'course_enrollment',
            },
            `Course enrollment (${courseId})`
          );
        }
      }
    } catch (e) {
      console.error('Webhook enrollment error:', e);
    }
  }
  res.json({ received: true });
});

// POST /payment/recruiter-access – create order for recruiter access fee
router.post('/recruiter-access', authenticate, requireRole('recruiter'), async (req, res) => {
  try {
    const config = require('../config');
    const rec = await db.queryOne(
      'SELECT r.id, r.has_paid_access FROM recruiters r WHERE r.user_id = ?',
      [db.toBuffer(req.user.id)]
    );
    if (!rec) return res.status(403).json({ error: 'Recruiter profile required' });
    if (rec.has_paid_access) return res.status(400).json({ error: 'Already has access' });

    let amount = 0;
    try {
      const row = await db.queryOne(
        "SELECT setting_value FROM admin_settings WHERE setting_key = 'recruiter_access_amount'"
      );
      amount = row ? Number(row.setting_value) || 0 : 0;
    } catch (_) {}
    if (amount < 1) {
      await db.query('UPDATE recruiters SET has_paid_access = TRUE, access_paid_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
        db.toBuffer(req.user.id),
      ]);
      return res.json({ already_active: true, message: 'Access granted (no fee)' });
    }

    const rz = config.payment?.razorpay;
    if (!rz?.keyId || !rz?.keySecret) {
      return res.status(503).json({ error: 'Payments not configured', code: 'PAYMENT_NOT_CONFIGURED' });
    }

    const Razorpay = require('razorpay');
    const rzInstance = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
    const order = await rzInstance.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: 'recruiter_' + Date.now(),
      notes: { type: 'recruiter_access', user_id: req.user.id },
    });

    const idBuf = crypto.randomBytes(16);
    await db.query(
      `INSERT INTO payments (id, user_id, amount, currency, payment_type, gateway_order_id, status, metadata)
       VALUES (?, ?, ?, 'INR', 'recruiter_access', ?, 'pending', ?)`,
      [idBuf, db.toBuffer(req.user.id), amount, order.id, JSON.stringify({ type: 'recruiter_access' })]
    );

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: 'INR',
      key_id: rz.keyId,
    });
    analytics.track('payment_order_created', { payment_type: 'recruiter_access', amount }, req.user.id);
  } catch (err) {
    console.error('Recruiter access order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /payment/recruiter-access/verify
router.post('/recruiter-access/verify', authenticate, requireRole('recruiter'), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const rz = config.payment?.razorpay;
    if (!rz?.keySecret) return res.status(503).json({ error: 'Payments not configured' });
    const sig = crypto.createHmac('sha256', rz.keySecret).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    if (sig !== razorpay_signature) return res.status(400).json({ error: 'Invalid signature' });
    const pay = await db.queryOne('SELECT id, user_id, amount, currency FROM payments WHERE gateway_order_id = ? AND payment_type = ? AND status = ?', [
      razorpay_order_id,
      'recruiter_access',
      'pending',
    ]);
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    await db.query(
      `UPDATE payments SET gateway_payment_id = ?, gateway_signature = ?, status = 'completed', verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [razorpay_payment_id, razorpay_signature, pay.id]
    );
    await db.query('UPDATE recruiters SET has_paid_access = TRUE, access_paid_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
      db.toBuffer(req.user.id),
    ]);
    await notifyZohoPayment(
      {
        user_id: pay.user_id,
        amount: pay.amount,
        currency: pay.currency || 'INR',
        payment_type: 'recruiter_access',
      },
      'Recruiter access payment'
    );
    try {
      const email = await fetchUserEmail(pay.user_id);
      await zoho.sendTemplateMail({
        to: email,
        subject: 'Recruiter access activated',
        title: 'Access payment successful',
        lines: [
          'Your recruiter access is now active.',
          'You can now search students and manage job listings.',
        ],
      });
      await zoho.dispatchSignAgreement({
        email,
        name: email,
        type: 'Recruiter Agreement',
        externalRef: req.user.id,
      });
    } catch (e) {
      console.error('Zoho recruiter post-payment sync failed:', e.message);
    }
    res.json({ success: true });
    analytics.track('payment_verified', { payment_type: 'recruiter_access', amount: Number(pay.amount || 0) }, req.user.id);
  } catch (err) {
    console.error('Recruiter verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /payment/my – payment history for current user
router.get('/my', authenticate, requireRole('student', 'recruiter'), async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, amount, currency, payment_type, status, gateway_order_id, gateway_payment_id, verified_at, created_at
       FROM payments
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [db.toBuffer(req.user.id)]
    );
    const payments = (rows || []).map((p) => ({
      id: db.toHex(p.id),
      amount: Number(p.amount || 0),
      currency: p.currency || 'INR',
      payment_type: p.payment_type,
      status: p.status,
      gateway_order_id: p.gateway_order_id || null,
      gateway_payment_id: p.gateway_payment_id || null,
      verified_at: p.verified_at,
      created_at: p.created_at,
    }));
    res.json({ payments });
  } catch (err) {
    console.error('My payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;
