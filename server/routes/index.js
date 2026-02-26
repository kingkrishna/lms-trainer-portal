const express = require('express');
const authRoutes = require('./auth');
const trainerRoutes = require('./trainer');
const studentRoutes = require('./student');
const calendarRoutes = require('./calendar');
const jobsRoutes = require('./jobs');
const { optionalAuth, authenticate } = require('../middleware/auth');
const db = require('../db/connection');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/trainer', trainerRoutes);
router.use('/student', studentRoutes);
router.use('/calendar', calendarRoutes);
router.use('/jobs', jobsRoutes);
router.use('/payment', require('./payment'));
router.use('/lms', require('./lms'));
router.use('/admin', require('./admin'));
router.use('/messages', require('./messages'));

const DEMO_JOBS = [
  { id: 'job-1', title: 'Junior Accountant', company: 'ABC & Co. Chartered Accountants', location: 'Mumbai, Maharashtra', job_type: 'full_time', description: 'Handle day-to-day bookkeeping, bank reconciliation, and assist in financial statements. Tally experience preferred.' },
  { id: 'job-2', title: 'Tax Associate', company: 'XYZ Tax Consultants', location: 'Bangalore, Karnataka', job_type: 'full_time', description: 'Income tax and GST compliance, return filing, and client support.', badge: 'Popular' },
  { id: 'job-3', title: 'Audit Trainee', company: 'Grant & Partners', location: 'Delhi NCR', job_type: 'full_time', description: 'Support statutory and internal audit engagements.', badge: 'New' },
  { id: 'job-4', title: 'Tally Operator', company: 'Retail Solutions Pvt Ltd', location: 'Chennai, Tamil Nadu', job_type: 'full_time', description: 'Maintain accounts in Tally, GST returns, and vendor reconciliation.' },
  { id: 'job-5', title: 'Finance Intern', company: 'ScaleUp Ventures', location: 'Remote', job_type: 'internship', description: 'Assist in financial reporting and variance analysis.', badge: 'Remote' },
  { id: 'job-6', title: 'Accounts Executive', company: 'Metro Manufacturing Ltd', location: 'Pune, Maharashtra', job_type: 'full_time', description: 'Cost accounting, inventory, and month-end closing.' },
  { id: 'job-7', title: 'Part-time Bookkeeper', company: 'Small Business Services', location: 'Hyderabad, Telangana', job_type: 'part_time', description: 'Bookkeeping and payroll for multiple clients.' },
];

const DEMO_STUDENTS = [
  { id: 'st-1', full_name: 'Ananya Gupta', course: 'Financial Accounting', grade: 'A+', city: 'Mumbai', skills: ['Tally', 'GST', 'Bookkeeping'] },
  { id: 'st-2', full_name: 'Rohit Nair', course: 'Taxation', grade: 'A', city: 'Bangalore', skills: ['Income Tax', 'GST Filing', 'Excel'] },
  { id: 'st-3', full_name: 'Divya Sharma', course: 'Auditing & Assurance', grade: 'A', city: 'Delhi NCR', skills: ['Audit', 'Financial Statements', 'Excel'] },
  { id: 'st-4', full_name: 'Karthik Rao', course: 'Corporate Finance', grade: 'B+', city: 'Chennai', skills: ['Financial Modeling', 'MIS', 'Power BI'] },
  { id: 'st-5', full_name: 'Pooja Iyer', course: 'Bookkeeping & Payroll', grade: 'A', city: 'Hyderabad', skills: ['Payroll', 'Tally', 'Reconciliation'] },
];

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
  try {
    const rows = await db.query('SELECT id, slug, full_name, bio, approval_status FROM trainers ORDER BY full_name');
    return (rows || []).map(normalizeTrainer);
  } catch (_) {
    const rows = await db.query('SELECT id, full_name, bio FROM trainers ORDER BY full_name');
    return (rows || []).map(normalizeTrainer);
  }
}

router.get('/courses', async (req, res) => {
  try {
    const courses = await getAllCourses();
    return res.json({ courses });
  } catch (err) {
    console.error('Courses fetch error:', err);
    return res.json({ courses: [] });
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

router.get('/trainers', optionalAuth, async (req, res) => {
  const status = req.query.status; // approved | pending | rejected | all
  const isAdmin = req.user?.role === 'super_admin';

  try {
    let list = await getAllTrainers();
    if (isAdmin && (status === 'all' || status === 'pending' || status === 'rejected' || status === 'approved')) {
      if (status !== 'all') list = list.filter((t) => (t.approval_status || 'pending') === status);
    } else {
      list = list.filter((t) => (t.approval_status || 'pending') === 'approved');
    }
    return res.json({ trainers: list });
  } catch (err) {
    console.error('Trainers fetch error:', err);
    return res.json({ trainers: [] });
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

router.get('/students/search', authenticate, async (req, res) => {
  const skills = String(req.query.skills || '').trim().toLowerCase();
  const course = String(req.query.course || '').trim().toLowerCase();

  if (req.user.role !== 'recruiter' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Recruiter or admin access required' });
  }

  if (req.user.role === 'recruiter') {
    const rec = await db.queryOne('SELECT has_paid_access FROM recruiters WHERE user_id = ?', [db.toBuffer(req.user.id)]);
    if (!rec || !rec.has_paid_access) {
      return res.status(403).json({
        error: 'Recruiter access required. Pay the access fee to search candidates.',
        requires_payment: true,
      });
    }
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
    const rows = await db.query('SELECT id, full_name, skills, phone FROM students');
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ students: filterStudents(DEMO_STUDENTS) });
    }
    const mapped = (rows || []).map((s) => ({
      id: normalizeId(s.id),
      full_name: s.full_name || '',
      course: '',
      grade: '-',
      city: '',
      skills: Array.isArray(s.skills) ? s.skills : (typeof s.skills === 'string' ? (() => { try { return JSON.parse(s.skills || '[]'); } catch (_) { return []; } })() : []),
    }));
    return res.json({ students: filterStudents(mapped) });
  } catch (_) {
    return res.json({ students: filterStudents(DEMO_STUDENTS) });
  }
});

module.exports = router;
