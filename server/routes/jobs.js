const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const DEMO_JOBS = [
  { id: 'job-1', title: 'Junior Accountant', company: 'ABC & Co.', location: 'Mumbai', job_type: 'full_time', description: 'Tally experience preferred.' },
  { id: 'job-2', title: 'Tax Associate', company: 'XYZ Tax', location: 'Bangalore', job_type: 'full_time', description: 'Income tax and GST.' },
  { id: 'job-3', title: 'Audit Trainee', company: 'Grant & Partners', location: 'Delhi NCR', job_type: 'full_time', description: 'Support audit engagements.' },
  { id: 'job-4', title: 'Tally Operator', company: 'Retail Solutions', location: 'Chennai', job_type: 'full_time', description: 'Tally, GST returns.' },
  { id: 'job-5', title: 'Finance Intern', company: 'ScaleUp Ventures', location: 'Remote', job_type: 'internship', description: 'Financial reporting.' },
];

function normalizeId(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

function toBuffer(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex).replace(/-/g, ''), 'hex');
}

// GET /jobs – list jobs
router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT id, title, company, location, job_type, description FROM jobs WHERE is_active = 1 ORDER BY created_at DESC');
    if (Array.isArray(rows) && rows.length > 0) {
      return res.json({ jobs: rows.map((j) => ({ ...j, id: normalizeId(j.id) })) });
    }
    return res.json({ jobs: DEMO_JOBS });
  } catch (_) {
    return res.json({ jobs: DEMO_JOBS });
  }
});

// GET /jobs/my/applications – must be before /:id
router.get('/my/applications', authenticate, requireRole(['student']), async (req, res) => {
  try {
    const profile = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!profile) return res.json({ applications: [] });

    const rows = await db.query(
      `SELECT ja.id, ja.status, ja.applied_at, j.id AS job_id, j.title, j.company, j.location
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE ja.student_id = ?
       ORDER BY ja.applied_at DESC`,
      [profile.id]
    );

    const applications = (rows || []).map((r) => ({
      id: normalizeId(r.id),
      job_id: normalizeId(r.job_id),
      status: r.status || 'applied',
      applied_at: r.applied_at,
      job_title: r.title || '',
      job_company: r.company || '',
      job_location: r.location || '',
    }));

    res.json({ applications });
  } catch (err) {
    console.error('My applications error:', err);
    res.json({ applications: [] });
  }
});

// GET /jobs/:id – job detail
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const rows = await db.query('SELECT id, title, company, location, job_type, description FROM jobs WHERE is_active = 1');
    const list = (rows || []).map((j) => ({ ...j, id: normalizeId(j.id) }));
    const job = list.find((j) => j.id === id) || DEMO_JOBS.find((j) => j.id === id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (_) {
    const job = DEMO_JOBS.find((j) => j.id === id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  }
});

// POST /jobs/:id/apply – student applies for job
router.post('/:id/apply', authenticate, requireRole(['student']), async (req, res) => {
  try {
    const jobId = req.params.id;
    const studentProfile = await db.queryOne('SELECT id FROM students WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!studentProfile) return res.status(403).json({ error: 'Student profile required' });

    const cover_message = (req.body.cover_message || '').trim();

    let job = null;
    if (/^[0-9a-f]{32}$/i.test(jobId.replace(/-/g, ''))) {
      const jobIdBuf = toBuffer(jobId);
      job = await db.queryOne('SELECT id FROM jobs WHERE id = ? AND is_active = 1', [jobIdBuf]);
    }
    if (!job) {
      job = DEMO_JOBS.find((j) => j.id === jobId) ? { id: jobId } : null;
    }
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const jobIdBuf = /^[0-9a-f]{32}$/i.test(String(jobId).replace(/-/g, '')) ? toBuffer(jobId) : null;
    const studentIdBuf = studentProfile.id;
    const existing = jobIdBuf
      ? await db.queryOne('SELECT id FROM job_applications WHERE job_id = ? AND student_id = ?', [jobIdBuf, studentIdBuf])
      : null;
    if (existing) return res.status(400).json({ error: 'Already applied for this job' });

    const idBuf = crypto.randomBytes(16);
    if (jobIdBuf) {
        await db.query(
        'INSERT INTO job_applications (id, job_id, student_id, status, cover_message) VALUES (?, ?, ?, ?, ?)',
        [idBuf, jobIdBuf, studentIdBuf, 'applied', cover_message || null]
      );
    } else {
      await db.query(
        'INSERT INTO job_applications (id, job_id, student_id, status, cover_message) VALUES (?, ?, ?, ?, ?)',
        [idBuf, toBuffer(crypto.createHash('md5').update('job-' + jobId).digest('hex').slice(0, 32)), studentIdBuf, 'applied', cover_message || null]
      );
    }
    try { require('../lib/audit').log('job_apply', 'job_applications', idBuf.toString('hex'), null, { job_id: jobId }, req.user.id, req); } catch (_) {}

    res.status(201).json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error('Job apply error:', err);
    res.status(500).json({ error: 'Failed to apply' });
  }
});

// GET /jobs/:id/applications – recruiter views applications (owns job)
router.get('/:id/applications', authenticate, requireRole(['recruiter', 'super_admin']), async (req, res) => {
  try {
    const jobId = req.params.id;
    const jobIdBuf = toBuffer(jobId);

    const job = await db.queryOne('SELECT id, recruiter_id FROM jobs WHERE id = ?', [jobIdBuf]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (req.user.role === 'recruiter') {
      const rec = await db.queryOne('SELECT id FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!rec || normalizeId(job.recruiter_id) !== normalizeId(rec.id)) {
        return res.status(403).json({ error: 'Not authorized to view this job\'s applications' });
      }
    }

    const rows = await db.query(
      `SELECT ja.id, ja.status, ja.cover_message, ja.applied_at,
              s.full_name, s.phone, s.resume_url, s.skills
       FROM job_applications ja
       JOIN students s ON ja.student_id = s.id
       WHERE ja.job_id = ?
       ORDER BY ja.applied_at DESC`,
      [jobIdBuf]
    );

    const applications = (rows || []).map((r) => ({
      id: normalizeId(r.id),
      status: r.status || 'applied',
      cover_message: r.cover_message || '',
      applied_at: r.applied_at,
      student_name: r.full_name || '',
      student_phone: r.phone || '',
      student_resume_url: r.resume_url || '',
      student_skills: Array.isArray(r.skills) ? r.skills : (r.skills ? JSON.parse(r.skills || '[]') : []),
    }));

    res.json({ applications });
  } catch (err) {
    console.error('Job applications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// PATCH /jobs/applications/:id/status – recruiter updates status (shortlisted, rejected, hired)
router.patch('/applications/:id/status', authenticate, requireRole(['recruiter', 'super_admin']), async (req, res) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;
    if (!['applied', 'shortlisted', 'rejected', 'hired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const appIdBuf = toBuffer(appId);
    const app = await db.queryOne(
      `SELECT ja.id, j.recruiter_id FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE ja.id = ?`,
      [appIdBuf]
    );
    if (!app) return res.status(404).json({ error: 'Application not found' });

    if (req.user.role === 'recruiter') {
      const rec = await db.queryOne('SELECT id FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!rec || normalizeId(app.recruiter_id) !== normalizeId(rec.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    await db.query('UPDATE job_applications SET status = ? WHERE id = ?', [status, appIdBuf]);
    res.json({ message: 'Status updated', status });
  } catch (err) {
    console.error('Update application status error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

module.exports = router;
