/**
 * In-memory store for auth when no database is configured.
 * Uses dummy data so login, register, and Google Sign-In work without MySQL.
 */
const bcrypt = require('bcryptjs');

const roleMap = { 1: 'super_admin', 2: 'student', 3: 'trainer', 4: 'recruiter' };

// Use string IDs (16-char hex) for simplicity; we convert to Buffer when needed
function makeId() {
  return require('crypto').randomBytes(16).toString('hex');
}

// Dummy users – password for all: "password123"
const DUMMY_HASH = bcrypt.hashSync('password123', 12);

const roles = [
  { id: 1, name: 'super_admin' },
  { id: 2, name: 'student' },
  { id: 3, name: 'trainer' },
  { id: 4, name: 'recruiter' },
];

const users = [
  { id: 'a'.repeat(32), email: 'admin@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 1, is_active: true, email_verified: false },
  { id: 'b'.repeat(32), email: 'demo-student@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 2, is_active: true, email_verified: false },
  { id: 'c'.repeat(32), email: 'demo-trainer@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'd'.repeat(32), email: 'demo-recruiter@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 4, is_active: true, email_verified: false },
  { id: 'e1'.repeat(16), email: 'nitin@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'e2'.repeat(16), email: 'ashok@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'e3'.repeat(16), email: 'prasanth@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'e4'.repeat(16), email: 'venkatesh@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'e5'.repeat(16), email: 'srinivas@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
  { id: 'e6'.repeat(16), email: 'jayashree@visionconnects.com', password_hash: DUMMY_HASH, google_id: null, role_id: 3, is_active: true, email_verified: false },
];

const students = [
  { id: 'b'.repeat(32), user_id: 'b'.repeat(32), full_name: 'Demo Student', phone: null, address: null, profile_image_url: null, resume_url: null, bio: null, skills: null },
];
const trainers = [
  { id: 'e1'.repeat(16), slug: 'tr-1', user_id: 'e1'.repeat(16), full_name: 'Nitin Kumar D', phone: null, address: null, profile_image_url: null, bio: 'Specialist trainer for Zoho Books and AI in Accounting workflows.', approval_status: 'approved', courses: ['Zoho Books', 'AI in Accounting'] },
  { id: 'e2'.repeat(16), slug: 'tr-2', user_id: 'e2'.repeat(16), full_name: 'Ashok Raju', phone: null, address: null, profile_image_url: null, bio: 'Tax trainer focused on GST, Income Tax, and TDS compliance.', approval_status: 'approved', courses: ['GST', 'Income Tax', 'TDS'] },
  { id: 'e3'.repeat(16), slug: 'tr-3', user_id: 'e3'.repeat(16), full_name: 'Prasanth', phone: null, address: null, profile_image_url: null, bio: 'Taxz trainer for GST, Income Tax, and TDS practical sessions.', approval_status: 'approved', courses: ['Taxz - GST', 'Income Tax', 'TDS'] },
  { id: 'e4'.repeat(16), slug: 'tr-4', user_id: 'e4'.repeat(16), full_name: 'Venkatesh', phone: null, address: null, profile_image_url: null, bio: 'Core Accounting trainer with focus on strong accounting fundamentals.', approval_status: 'approved', courses: ['Core Accounting'] },
  { id: 'e5'.repeat(16), slug: 'tr-5', user_id: 'e5'.repeat(16), full_name: 'Srinivas', phone: null, address: null, profile_image_url: null, bio: 'Tally and GST Simulation trainer for hands-on practical learning.', approval_status: 'approved', courses: ['Tally', 'GST Simulation'] },
  { id: 'e6'.repeat(16), slug: 'tr-6', user_id: 'e6'.repeat(16), full_name: 'JayaShree', phone: null, address: null, profile_image_url: null, bio: 'GST Simulation trainer focused on practical workflows and filing scenarios.', approval_status: 'approved', courses: ['GST Simulation'] },
];
const recruiters = [
  { id: 'd'.repeat(32), user_id: 'd'.repeat(32), company_name: 'Demo Corp', contact_person: 'Demo Recruiter', phone: null, address: null, profile_image_url: null, approval_status: 'approved', has_paid_access: true },
];

// Courses (id as slug for simplicity; price stored as number)
const courses = [
  { id: 'core-accounting', title: 'Core Accounting', slug: 'core-accounting', description: 'Accounting fundamentals with practical workflow.', price: 3600, is_active: true, category: 'accounting', duration: '15 Working Days' },
  { id: 'income-tax-tds', title: 'Income Tax and TDS', slug: 'income-tax-tds', description: 'Income tax concepts, filing process, and TDS compliance.', price: 3600, is_active: true, category: 'tax', duration: '20 Working Days' },
  { id: 'gst-theory-simulation', title: 'GST Theory and Simulation', slug: 'gst-theory-simulation', description: 'GST concepts plus simulation-based practical sessions.', price: 5000, is_active: true, category: 'tax', duration: '15 Working Days' },
  { id: 'gst-simulation', title: 'GST Simulation', slug: 'gst-simulation', description: 'GST simulation for real transaction scenarios.', price: 3600, is_active: true, category: 'tax', duration: '15 Working Days' },
  { id: 'zoho-books', title: 'Zoho Books', slug: 'zoho-books', description: 'Zoho books operations and business accounting.', price: 5000, is_active: true, category: 'accounting', duration: '15 Working Days' },
  { id: 'tally', title: 'Tally', slug: 'tally', description: 'Hands-on Tally training for accounting execution.', price: 5000, is_active: true, category: 'accounting', duration: '30 Working Days' },
  { id: 'combo-accounting', title: 'Core Accounting, Tally and Zoho', slug: 'combo-accounting-tally-zoho', description: 'Accounting plus tools combo for practical job readiness.', price: 10000, is_active: true, category: 'accounting', duration: '30-45 Working Days' },
  { id: 'combo-tax', title: 'Tax (GST, Income Tax and TDS) including Simulation', slug: 'combo-tax-school', description: 'Complete tax combo with GST, Income Tax, TDS, and simulation.', price: 12000, is_active: true, category: 'tax', duration: '30-45 Working Days' },
  { id: 'technical-writing', title: 'Technical Writing', slug: 'technical-writing', description: 'Professional writing for reports, documentation, and business communication.', price: 12000, is_active: true, category: 'technical', duration: '20 Working Days' },
  { id: 'java-course', title: 'Java Course', slug: 'java-course', description: 'Java fundamentals to advanced concepts with practical coding assignments.', price: 10000, is_active: true, category: 'technical', duration: '30 Working Days' },
  { id: 'total-course-package', title: 'Total Course Package', slug: 'total-course-package', description: 'Full package that combines accounting and tax tracks.', price: 25000, is_active: true, category: 'all', duration: '3-4 Months' },
];

let trainerTraineesData = [];
let jobApplicationsData = [];
const MEMORY_JOBS = [
  { id: 'job-1', title: 'Junior Accountant', company: 'ABC & Co.', location: 'Mumbai' },
  { id: 'job-2', title: 'Tax Associate', company: 'XYZ Tax', location: 'Bangalore' },
  { id: 'job-3', title: 'Audit Trainee', company: 'Grant & Partners', location: 'Delhi NCR' },
  { id: 'job-4', title: 'Tally Operator', company: 'Retail Solutions', location: 'Chennai' },
  { id: 'job-5', title: 'Finance Intern', company: 'ScaleUp Ventures', location: 'Remote' },
];
function getJobByHex(hex) {
  const m = MEMORY_JOBS.find((j) => require('crypto').createHash('md5').update('job-' + j.id).digest('hex').slice(0, 32) === hex);
  return m || { id: hex, title: 'Job', company: '', location: '' };
}

// Mutable copies (so we can add Google users, new registrations, etc.)
let usersData = JSON.parse(JSON.stringify(users));
let studentsData = JSON.parse(JSON.stringify(students));
let trainersData = JSON.parse(JSON.stringify(trainers));
let recruitersData = JSON.parse(JSON.stringify(recruiters));
// Admin and other roles without a profile table
const adminProfiles = {};

function toBuf(v) {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'string') return Buffer.from(v, 'hex');
  return v;
}

function toHex(v) {
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v);
}

async function query(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();

  // SELECT id FROM users WHERE email = ?
  if (s.startsWith('SELECT id FROM users WHERE email = ?')) {
    const u = usersData.find((x) => x.email === params[0]);
    return u ? [{ id: u.id }] : [];
  }

  // SELECT name FROM roles WHERE id = ?
  if (s.startsWith('SELECT name FROM roles WHERE id = ?')) {
    const r = roles.find((x) => x.id === params[0]);
    return r ? [{ name: r.name }] : [];
  }

  // SELECT u.id, u.email, u.password_hash, u.is_active, r.name AS role ...
  if (s.includes('FROM users u JOIN roles r') && s.includes('WHERE u.email = ?')) {
    const u = usersData.find((x) => x.email === params[0]);
    if (!u) return [];
    const r = roles.find((x) => x.id === u.role_id);
    return [{ id: u.id, email: u.email, password_hash: u.password_hash, is_active: u.is_active, role: r?.name }];
  }

  // SELECT u.id, u.email, u.google_id, r.name AS role ... WHERE u.email = ? OR u.google_id = ?
  if (s.includes('u.google_id') && s.includes('u.email = ? OR u.google_id = ?')) {
    const u = usersData.find((x) => x.email === params[0] || x.google_id === params[1]);
    if (!u) return [];
    const r = roles.find((x) => x.id === u.role_id);
    return [{ id: u.id, email: u.email, google_id: u.google_id, role: r?.name }];
  }

  // SELECT u.id, u.email, [u.is_active,] r.name AS role ... WHERE u.id = ?
  if (s.includes('r.name AS role') && s.includes('FROM users u JOIN roles r') && s.includes('WHERE u.id = ?')) {
    const id = toHex(params[0]);
    const u = usersData.find((x) => x.id === id);
    if (!u) return [];
    const r = roles.find((x) => x.id === u.role_id);
    return [{ id: u.id, email: u.email, is_active: u.is_active, role: r?.name }];
  }

  // SELECT * FROM students WHERE user_id = ?
  if (s.includes('SELECT * FROM students WHERE user_id')) {
    const id = toHex(params[0]);
    const row = studentsData.find((x) => x.user_id === id);
    return row ? [{ ...row }] : [];
  }

  // SELECT * FROM trainers WHERE user_id = ?
  if (s.includes('SELECT * FROM trainers WHERE user_id')) {
    const id = toHex(params[0]);
    const row = trainersData.find((x) => x.user_id === id);
    return row ? [{ ...row }] : [];
  }

  // SELECT t.id, t.full_name, t.bio ... FROM trainers t ORDER BY t.full_name
  if (s.includes('FROM trainers') && s.includes('full_name')) {
    return trainersData.map((t) => ({
      id: t.id,
      slug: t.slug || t.id,
      full_name: t.full_name,
      bio: t.bio,
      approval_status: t.approval_status || 'pending',
      courses: t.courses || [],
    })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }

  // SELECT * FROM recruiters WHERE user_id = ?
  if (s.includes('SELECT * FROM recruiters WHERE user_id')) {
    const id = toHex(params[0]);
    const row = recruitersData.find((x) => x.user_id === id);
    return row ? [{ ...row }] : [];
  }

  // SELECT * FROM admin_profiles WHERE user_id = ? (for super_admin)
  if (s.includes('SELECT') && s.includes('admin_profiles') && s.includes('user_id')) {
    const id = toHex(params[0]);
    const row = adminProfiles[id] || null;
    return row ? [{ ...row, user_id: id }] : [];
  }

  // UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
  if (s.includes('UPDATE users SET last_login_at')) {
    return [];
  }

  // UPDATE users SET google_id = ? WHERE id = ?
  if (s.includes('UPDATE users SET google_id = ? WHERE id = ?')) {
    const u = usersData.find((x) => x.id === toHex(params[1]));
    if (u) u.google_id = params[0];
    return [];
  }

  // UPDATE users SET last_login_at = CURRENT_TIMESTAMP, email_verified = TRUE WHERE id = ?
  if (s.includes('email_verified = TRUE')) {
    const id = toHex(params[0]);
    const u = usersData.find((x) => x.id === id);
    if (u) u.email_verified = true;
    return [];
  }

  // INSERT INTO users (id, email, password_hash, role_id) VALUES (?, ?, ?, ?)
  if (s.includes('INSERT INTO users') && s.includes('password_hash') && !s.includes('google_id')) {
    const id = toHex(params[0]);
    usersData.push({ id, email: params[1], password_hash: params[2], google_id: null, role_id: params[3], is_active: true, email_verified: false });
    return [];
  }

  // INSERT INTO users (id, email, google_id, password_hash, role_id, email_verified) VALUES (?, ?, ?, NULL, ?, TRUE)
  if (s.includes('INSERT INTO users') && s.includes('google_id')) {
    const id = toHex(params[0]);
    usersData.push({ id, email: params[1], google_id: params[2], password_hash: null, role_id: params[4], is_active: true, email_verified: true });
    return [];
  }

  // INSERT INTO students (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)
  if (s.includes('INSERT INTO students')) {
    const id = toHex(params[0]);
    studentsData.push({ id, user_id: id, full_name: params[2], phone: params[3] || null });
    return [];
  }

  // INSERT INTO trainers (id, user_id, full_name, bio) or (id, user_id, full_name)
  if (s.includes('INSERT INTO trainers')) {
    const id = toHex(params[0]);
    trainersData.push({ id, user_id: id, full_name: params[2], bio: params[3] || null });
    return [];
  }

  // INSERT INTO recruiters (id, user_id, company_name, contact_person) VALUES (?, ?, ?, ?)
  if (s.includes('INSERT INTO recruiters')) {
    const id = toHex(params[0]);
    recruitersData.push({ id, user_id: id, company_name: params[2], contact_person: params[3], phone: null, address: null, profile_image_url: null });
    return [];
  }

  // UPDATE students SET full_name = ?, phone = ?, address = ?, profile_image_url = ?, skills = ?, resume_url = ? WHERE user_id = ?
  if (s.includes('UPDATE students SET') && s.includes('profile_image_url')) {
    const id = toHex(params[6]);
    const row = studentsData.find((x) => x.user_id === id);
    if (row) {
      row.full_name = params[0];
      row.phone = params[1];
      row.address = params[2];
      row.profile_image_url = params[3];
      row.skills = params[4];
      row.resume_url = params[5];
    }
    return [];
  }

  // UPDATE trainers SET full_name = ?, phone = ?, address = ?, profile_image_url = ?, bio = ? WHERE user_id = ?
  if (s.includes('UPDATE trainers SET') && s.includes('profile_image_url')) {
    const id = toHex(params[5]);
    const row = trainersData.find((x) => x.user_id === id);
    if (row) {
      row.full_name = params[0];
      row.phone = params[1];
      row.address = params[2];
      row.profile_image_url = params[3];
      row.bio = params[4];
    }
    return [];
  }

  // UPDATE recruiters SET company_name = ?, contact_person = ?, phone = ?, address = ?, profile_image_url = ? WHERE user_id = ?
  if (s.includes('UPDATE recruiters SET') && s.includes('profile_image_url')) {
    const id = toHex(params[5]);
    const row = recruitersData.find((x) => x.user_id === id);
    if (row) {
      row.company_name = params[0];
      row.contact_person = params[1];
      row.phone = params[2];
      row.address = params[3];
      row.profile_image_url = params[4];
    }
    return [];
  }

  // UPDATE admin_profiles SET full_name = ?, phone = ?, address = ?, profile_image_url = ? WHERE user_id = ?
  if (s.includes('admin_profiles') && s.includes('UPDATE')) {
    const id = toHex(params[4]);
    adminProfiles[id] = adminProfiles[id] || {};
    adminProfiles[id].full_name = params[0];
    adminProfiles[id].phone = params[1];
    adminProfiles[id].address = params[2];
    adminProfiles[id].profile_image_url = params[3];
    return [];
  }

  // SELECT ... FROM courses WHERE is_active = 1
  if (s.includes('FROM courses') && s.includes('is_active')) {
    return courses.filter((c) => c.is_active).map((c) => ({ ...c }));
  }

  // SELECT * FROM trainer_trainees WHERE student_name = ? [ORDER BY created_at DESC]
  if (s.includes('FROM trainer_trainees') && s.includes('student_name = ?')) {
    const name = String(params[0] || '').trim();
    const filtered = name
      ? trainerTraineesData.filter((r) => (r.student_name || '').toLowerCase() === name.toLowerCase())
      : [];
    return filtered;
  }

  // SELECT id FROM jobs WHERE id = ? AND is_active = 1
  if (s.includes('FROM jobs') && s.includes('WHERE id = ?')) {
    return []; // No real jobs in memory; caller uses DEMO_JOBS
  }

  // SELECT id, recruiter_id FROM jobs ...
  if (s.includes('FROM job_applications') && s.includes('JOIN jobs')) {
    return (jobApplicationsData || []).map((r) => ({ ...r }));
  }

  // SELECT ja... FROM job_applications ja JOIN students s WHERE ja.job_id = ?
  if (s.includes('job_applications') && s.includes('JOIN students') && s.includes('job_id = ?')) {
    const jid = toHex(params[0]);
    const apps = (jobApplicationsData || []).filter((r) => toHex(r.job_id) === jid);
    return apps.map((a) => {
      const st = studentsData.find((s) => toHex(s.id) === toHex(a.student_id));
      return {
        id: a.id,
        status: a.status,
        cover_message: a.cover_message,
        applied_at: new Date(),
        full_name: st ? st.full_name : '',
        phone: st ? st.phone : '',
        resume_url: st ? st.resume_url : '',
        skills: st && st.skills ? (Array.isArray(st.skills) ? st.skills : JSON.parse(st.skills || '[]')) : [],
      };
    });
  }

  // SELECT ja.id ... FROM job_applications ja JOIN jobs j ... WHERE ja.student_id = ?
  if (s.includes('job_applications') && s.includes('student_id = ?') && s.includes('JOIN jobs')) {
    const sid = toHex(params[0]);
    const apps = (jobApplicationsData || []).filter((r) => toHex(r.student_id) === sid);
    return apps.map((a) => {
      const j = getJobByHex(toHex(a.job_id));
      return {
        id: a.id,
        job_id: j.id,
        status: a.status,
        applied_at: a.applied_at || new Date(),
        job_title: j.title,
        job_company: j.company,
        job_location: j.location,
      };
    });
  }

  // SELECT id FROM job_applications WHERE job_id = ? AND student_id = ?
  if (s.includes('FROM job_applications') && s.includes('job_id = ?') && s.includes('student_id = ?')) {
    const jid = toHex(params[0]);
    const sid = toHex(params[1]);
    const found = (jobApplicationsData || []).find((r) => toHex(r.job_id) === jid && toHex(r.student_id) === sid);
    return found ? [{ id: found.id }] : [];
  }

  // INSERT INTO job_applications
  if (s.includes('INSERT INTO job_applications')) {
    const id = toHex(params[0]);
    jobApplicationsData.push({
      id,
      job_id: toHex(params[1]),
      student_id: toHex(params[2]),
      status: params[3] || 'applied',
      cover_message: params[4] || null,
    });
    return [];
  }

  // UPDATE job_applications SET status = ?
  if (s.includes('UPDATE job_applications SET status')) {
    const appId = toHex(params[1]);
    const row = (jobApplicationsData || []).find((r) => toHex(r.id) === appId);
    if (row) row.status = params[0];
    return [];
  }

  // INSERT INTO trainer_trainees (id, trainer_id, student_name, course_id, contact_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)
  if (s.includes('INSERT INTO trainer_trainees')) {
    const id = toHex(params[0]);
    const trainerId = toHex(params[1]);
    trainerTraineesData.push({
      id,
      trainer_id: trainerId,
      student_name: params[2],
      course_id: params[3],
      contact_number: params[4],
      payment_status: params[5] || 'pending',
    });
    return [];
  }

  // Messages: SELECT ... FROM messages WHERE recipient_id = ?
  if (s.includes('FROM messages') && s.includes('recipient_id = ?')) {
    return [];
  }
  // INSERT INTO messages
  if (s.includes('INSERT INTO messages')) {
    return [];
  }
  // UPDATE messages SET is_read
  if (s.includes('UPDATE messages SET is_read')) {
    return [];
  }

  return [];
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

function getTrainerTrainees(trainerId) {
  if (trainerId) {
    const tid = toHex(trainerId);
    return trainerTraineesData.filter((r) => r.trainer_id === tid);
  }
  return trainerTraineesData.slice();
}

module.exports = { query, queryOne, toHex, toBuffer: toBuf, getTrainerTrainees };
