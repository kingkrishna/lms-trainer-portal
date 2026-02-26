const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
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

// POST /payment/create-order – create Razorpay order for course enrollment
router.post(
  '/create-order',
  authenticate,
  [body('course_id').trim().notEmpty(), body('trainer_id').trim().notEmpty(), body('amount').optional().isNumeric()],
  handleValidation,
  async (req, res) => {
    try {
      const { course_id, trainer_id, amount } = req.body;
      const isHex = /^[0-9a-f]{32}$/i.test(String(course_id).replace(/-/g, ''));
      const course = isHex
        ? await db.queryOne('SELECT id, title, price, currency FROM courses WHERE id = ? AND is_active = 1', [toBuf(course_id)])
        : await db.queryOne('SELECT id, title, price, currency FROM courses WHERE slug = ? AND is_active = 1', [course_id]);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const amt = amount ? Number(amount) * 100 : Number(course.price) * 100;
      if (amt < 100) return res.status(400).json({ error: 'Invalid amount' });

      const rz = config.payment?.razorpay;
      if (!rz?.keyId || !rz?.keySecret) {
        return res.status(503).json({
          error: 'Payments not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
          demo: true,
          order_id: 'demo_' + Date.now(),
          amount: amt / 100,
          key_id: null,
        });
      }

      const Razorpay = require('razorpay');
      const rzInstance = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
      const order = await rzInstance.orders.create({
        amount: Math.round(amt),
        currency: course.currency || 'INR',
        receipt: 'lms_' + Date.now(),
        notes: { course_id, trainer_id, user_id: req.user.id },
      });

      const idBuf = crypto.randomBytes(16);
      const meta = JSON.stringify({ course_id, trainer_id });
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
  [
    body('razorpay_order_id').trim().notEmpty(),
    body('razorpay_payment_id').trim().notEmpty(),
    body('razorpay_signature').trim().notEmpty(),
    body('course_id').trim().notEmpty(),
    body('trainer_id').trim().notEmpty(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, course_id, trainer_id } = req.body;
      const rz = config.payment?.razorpay;

      if (!rz?.keySecret && razorpay_order_id.startsWith('demo_')) {
        const trainerBuf = await resolveTrainerBuf(trainer_id);
        if (!trainerBuf) return res.status(404).json({ error: 'Trainer not found' });
        const student = await db.queryOne('SELECT full_name, phone FROM students WHERE user_id = ?', [
          db.toBuffer(req.user.id),
        ]);
        const ttId = crypto.randomBytes(16);
        await db.query(
          `INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status)
           VALUES (?, ?, ?, ?, ?, 'paid')`,
          [ttId, trainerBuf, student?.full_name || 'Student', course_id, student?.phone || '']
        );
        return res.json({ success: true, message: 'Demo payment verified and enrollment confirmed' });
      }
      if (!rz?.keySecret) return res.status(503).json({ error: 'Payments not configured' });

      const sig = crypto
        .createHmac('sha256', rz.keySecret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
      if (sig !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      const payment = await db.queryOne(
        'SELECT id, user_id, amount FROM payments WHERE gateway_order_id = ? AND status = ?',
        [razorpay_order_id, 'pending']
      );
      if (!payment) return res.status(404).json({ error: 'Payment not found or already processed' });

      await db.query(
        `UPDATE payments SET gateway_payment_id = ?, gateway_signature = ?, status = 'completed', verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [razorpay_payment_id, razorpay_signature, payment.id]
      );

      const trainerBuf = await resolveTrainerBuf(trainer_id);
      if (!trainerBuf) return res.status(404).json({ error: 'Trainer not found' });
      const student = await db.queryOne('SELECT id, full_name, phone FROM students WHERE user_id = ?', [
        payment.user_id,
      ]);
      const studentName = student?.full_name || 'Student';
      const contactNumber = student?.phone || '';

      const ttId = crypto.randomBytes(16);
      await db.query(
        `INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status)
         VALUES (?, ?, ?, ?, ?, 'paid')`,
        [ttId, trainerBuf, studentName, course_id, contactNumber]
      );

      res.json({ success: true, message: 'Payment verified and enrollment confirmed' });
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
      const payRow = await db.queryOne('SELECT metadata FROM payments WHERE gateway_order_id = ?', [orderId]);
      const meta = payRow?.metadata ? (typeof payRow.metadata === 'string' ? JSON.parse(payRow.metadata) : payRow.metadata) : {};
      const courseId = meta.course_id;
      const trainerId = meta.trainer_id;
      await db.query(
        `UPDATE payments SET gateway_payment_id = ?, status = 'completed', verified_at = CURRENT_TIMESTAMP WHERE gateway_order_id = ?`,
        [paymentId, orderId]
      );
      if (courseId && trainerId) {
        const trainerBuf = await resolveTrainerBuf(trainerId);
        if (trainerBuf) {
          const pay = await db.queryOne('SELECT user_id FROM payments WHERE gateway_order_id = ?', [orderId]);
          if (pay) {
            const student = await db.queryOne('SELECT full_name, phone FROM students WHERE user_id = ?', [pay.user_id]);
            const ttId = crypto.randomBytes(16);
            await db.query(
              `INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status)
               VALUES (?, ?, ?, ?, ?, 'paid')`,
              [ttId, trainerBuf, student?.full_name || 'Student', courseId, student?.phone || '']
            );
          }
        }
      }
    } catch (e) {
      console.error('Webhook enrollment error:', e);
    }
  }
  res.json({ received: true });
});

// POST /payment/recruiter-access – create order for recruiter access fee
router.post('/recruiter-access', authenticate, async (req, res) => {
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
      await db.query('UPDATE recruiters SET has_paid_access = TRUE, access_paid_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
        db.toBuffer(req.user.id),
      ]);
      return res.json({ order_id: 'demo_recruiter_' + Date.now(), amount: amount * 100, key_id: null, demo: true });
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
  } catch (err) {
    console.error('Recruiter access order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /payment/recruiter-access/verify
router.post('/recruiter-access/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const rz = config.payment?.razorpay;
    if (!rz?.keySecret && razorpay_order_id.startsWith('demo_recruiter_')) {
      await db.query('UPDATE recruiters SET has_paid_access = TRUE, access_paid_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
        db.toBuffer(req.user.id),
      ]);
      return res.json({ success: true });
    }
    if (!rz?.keySecret) return res.status(503).json({ error: 'Payments not configured' });
    const sig = crypto.createHmac('sha256', rz.keySecret).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    if (sig !== razorpay_signature) return res.status(400).json({ error: 'Invalid signature' });
    const pay = await db.queryOne('SELECT id FROM payments WHERE gateway_order_id = ? AND payment_type = ? AND status = ?', [
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
    res.json({ success: true });
  } catch (err) {
    console.error('Recruiter verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
