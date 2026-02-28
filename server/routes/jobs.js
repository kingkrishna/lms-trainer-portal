const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const analytics = require('../lib/analytics');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function normalizeId(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v || '');
}

function toBuffer(hex) {
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex).replace(/-/g, ''), 'hex');
}

// GET /jobs – list jobs
router.get('/', authenticate, requireRole('student', 'recruiter'), async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'recruiter') {
      const rec = await db.queryOne('SELECT id FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
      if (!rec) return res.status(403).json({ error: 'Recruiter profile required' });
      rows = await db.query(
        `SELECT id, title, company, location, job_type, description, skills_required_json, school_preferred, salary_range, openings_count, deadline, status
         FROM jobs
         WHERE recruiter_id = ? AND is_active = 1
         ORDER BY created_at DESC`,
        [rec.id]
      );
    } else {
      rows = await db.query(
        `SELECT id, title, company, location, job_type, description, skills_required_json, school_preferred, salary_range, openings_count, deadline, status
         FROM jobs
         WHERE is_active = 1
         ORDER BY created_at DESC`
      );
    }
    return res.json({ jobs: (rows || []).map((j) => ({ ...j, id: normalizeId(j.id) })) });
  } catch (err) {
    console.error('Jobs list error:', err);
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
});

// POST /jobs – recruiter creates job (requires paid recruiter access)
router.post('/', authenticate, requireRole('recruiter'), async (req, res) => {
  try {
    const rec = await db.queryOne('SELECT id, has_paid_access, access_expiry FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!rec) return res.status(403).json({ error: 'Recruiter profile required' });
    if (!rec.has_paid_access) return res.status(403).json({ error: 'Paid recruiter access required' });
    if (rec.access_expiry && new Date(rec.access_expiry).getTime() < Date.now()) {
      return res.status(403).json({ error: 'Recruiter access expired' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const payload = {
      company: String(req.body?.company || '').trim() || null,
      location: String(req.body?.location || '').trim() || null,
      job_type: String(req.body?.job_type || 'full_time'),
      description: String(req.body?.description || '').trim() || null,
      skills_required_json: req.body?.skills_required_json ? JSON.stringify(req.body.skills_required_json) : null,
      school_preferred: String(req.body?.school_preferred || '').trim() || null,
      salary_range: String(req.body?.salary_range || '').trim() || null,
      openings_count: Number(req.body?.openings_count || 1),
      deadline: req.body?.deadline ? new Date(req.body.deadline) : null,
      status: String(req.body?.status || 'open').trim() || 'open',
    };
    if (!['full_time', 'part_time', 'internship', 'contract'].includes(payload.job_type)) {
      return res.status(400).json({ error: 'Invalid job_type' });
    }

    const idBuf = crypto.randomBytes(16);
    await db.query(
      `INSERT INTO jobs (id, recruiter_id, title, company, description, location, job_type, is_active, skills_required_json, school_preferred, salary_range, openings_count, deadline, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        idBuf,
        rec.id,
        title,
        payload.company,
        payload.description,
        payload.location,
        payload.job_type,
        payload.skills_required_json,
        payload.school_preferred,
        payload.salary_range,
        payload.openings_count,
        payload.deadline,
        payload.status,
      ]
    );
    res.status(201).json({ message: 'Job created', id: normalizeId(idBuf) });
    analytics.track('job_created', { job_id: normalizeId(idBuf) }, req.user.id);
  } catch (err) {
    console.error('Job create error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// GET /jobs/my/applications – must be before /:id
router.get('/my/applications', authenticate, requireRole('student'), async (req, res) => {
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
router.get('/:id', authenticate, requireRole('student', 'recruiter'), async (req, res) => {
  const id = req.params.id;
  try {
    if (!/^[0-9a-f]{32}$/i.test(String(id).replace(/-/g, ''))) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const rows = await db.query(
      'SELECT id, title, company, location, job_type, description, skills_required_json, school_preferred, salary_range, openings_count, deadline, status FROM jobs WHERE is_active = 1 AND id = ?',
      [toBuffer(id)]
    );
    const list = (rows || []).map((j) => ({ ...j, id: normalizeId(j.id) }));
    const job = list.find((j) => j.id === id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (err) {
    console.error('Job detail error:', err);
    return res.status(500).json({ error: 'Failed to load job' });
  }
});

// PATCH /jobs/:id – recruiter updates own job
router.patch('/:id', authenticate, requireRole('recruiter'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const jobIdBuf = toBuffer(jobId);
    const existing = await db.queryOne('SELECT id, recruiter_id FROM jobs WHERE id = ? AND is_active = 1', [jobIdBuf]);
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    const rec = await db.queryOne('SELECT id, has_paid_access, access_expiry FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!rec) return res.status(403).json({ error: 'Recruiter profile required' });
    if (normalizeId(rec.id) !== normalizeId(existing.recruiter_id)) return res.status(403).json({ error: 'Not authorized to update this job' });
    if (!rec.has_paid_access) return res.status(403).json({ error: 'Paid recruiter access required' });
    if (rec.access_expiry && new Date(rec.access_expiry).getTime() < Date.now()) return res.status(403).json({ error: 'Recruiter access expired' });

    const patch = {};
    if (req.body?.title !== undefined) patch.title = String(req.body.title || '').trim();
    if (req.body?.company !== undefined) patch.company = String(req.body.company || '').trim() || null;
    if (req.body?.location !== undefined) patch.location = String(req.body.location || '').trim() || null;
    if (req.body?.job_type !== undefined) patch.job_type = String(req.body.job_type || '').trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description || '').trim() || null;
    if (req.body?.skills_required_json !== undefined) patch.skills_required_json = req.body.skills_required_json ? JSON.stringify(req.body.skills_required_json) : null;
    if (req.body?.school_preferred !== undefined) patch.school_preferred = String(req.body.school_preferred || '').trim() || null;
    if (req.body?.salary_range !== undefined) patch.salary_range = String(req.body.salary_range || '').trim() || null;
    if (req.body?.openings_count !== undefined) patch.openings_count = Number(req.body.openings_count || 1);
    if (req.body?.deadline !== undefined) patch.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
    if (req.body?.status !== undefined) patch.status = String(req.body.status || '').trim();
    if (req.body?.is_active !== undefined) patch.is_active = req.body.is_active ? 1 : 0;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields to update' });
    if (patch.job_type && !['full_time', 'part_time', 'internship', 'contract'].includes(patch.job_type)) {
      return res.status(400).json({ error: 'Invalid job_type' });
    }

    const set = [];
    const params = [];
    for (const [k, v] of Object.entries(patch)) {
      set.push(`${k} = ?`);
      params.push(v);
    }
    params.push(jobIdBuf);
    await db.query(`UPDATE jobs SET ${set.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Job updated' });
    analytics.track('job_updated', { job_id: jobId }, req.user.id);
  } catch (err) {
    console.error('Job update error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

async function applyToJob(req, res) {
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
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const jobIdBuf = /^[0-9a-f]{32}$/i.test(String(jobId).replace(/-/g, '')) ? toBuffer(jobId) : null;
    const studentIdBuf = studentProfile.id;
    if (!jobIdBuf) return res.status(400).json({ error: 'Invalid job id' });
    const existing = await db.queryOne('SELECT id FROM job_applications WHERE job_id = ? AND student_id = ?', [jobIdBuf, studentIdBuf]);
    if (existing) return res.status(400).json({ error: 'Already applied for this job' });

    const idBuf = crypto.randomBytes(16);
    await db.query(
      'INSERT INTO job_applications (id, job_id, student_id, status, cover_message) VALUES (?, ?, ?, ?, ?)',
      [idBuf, jobIdBuf, studentIdBuf, 'applied', cover_message || null]
    );
    try { require('../lib/audit').log('job_apply', 'job_applications', idBuf.toString('hex'), null, { job_id: jobId }, req.user.id, req); } catch (_) {}

    res.status(201).json({ message: 'Application submitted successfully' });
    analytics.track('job_applied', { job_id: jobId }, req.user.id);
  } catch (err) {
    console.error('Job apply error:', err);
    res.status(500).json({ error: 'Failed to apply' });
  }
}

// POST /jobs/:id/apply – legacy path
router.post('/:id/apply', authenticate, requireRole('student'), applyToJob);

// POST /jobs/:id/applications – contract path
router.post('/:id/applications', authenticate, requireRole('student'), applyToJob);

// GET /jobs/:id/applications – recruiter views applications (owns job)
router.get('/:id/applications', authenticate, requireRole('recruiter'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const jobIdBuf = toBuffer(jobId);

    const job = await db.queryOne('SELECT id, recruiter_id FROM jobs WHERE id = ?', [jobIdBuf]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const rec = await db.queryOne('SELECT id FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!rec || normalizeId(job.recruiter_id) !== normalizeId(rec.id)) {
      return res.status(403).json({ error: 'Not authorized to view this job\'s applications' });
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
router.patch('/applications/:id/status', authenticate, requireRole('recruiter', 'super_admin'), async (req, res) => {
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
