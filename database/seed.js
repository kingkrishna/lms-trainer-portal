/**
 * Seed database with demo users, courses, trainers, jobs.
 * Run after: npm run db:migrate
 * Usage: node database/seed.js
 * Requires: DB_* env vars set
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'lms_platform',
};

const HASH = bcrypt.hashSync('password123', 12);

function toBuf(hex) {
  return Buffer.from(hex.replace(/-/g, ''), 'hex');
}

const USERS = [
  { id: 'a'.repeat(32), email: 'admin@visionconnects.com', role_id: 1 },
  { id: 'b'.repeat(32), email: 'demo-student@visionconnects.com', role_id: 2 },
  { id: 'c'.repeat(32), email: 'demo-trainer@visionconnects.com', role_id: 3 },
  { id: 'd'.repeat(32), email: 'demo-recruiter@visionconnects.com', role_id: 4 },
  { id: 'e1'.repeat(16), email: 'nitin@visionconnects.com', role_id: 3 },
  { id: 'e2'.repeat(16), email: 'ashok@visionconnects.com', role_id: 3 },
  { id: 'e3'.repeat(16), email: 'prasanth@visionconnects.com', role_id: 3 },
  { id: 'e4'.repeat(16), email: 'venkatesh@visionconnects.com', role_id: 3 },
  { id: 'e5'.repeat(16), email: 'srinivas@visionconnects.com', role_id: 3 },
  { id: 'e6'.repeat(16), email: 'jayashree@visionconnects.com', role_id: 3 },
];

const COURSES = [
  { slug: 'core-accounting', title: 'Core Accounting', price: 3600, description: 'Accounting fundamentals with practical workflow.' },
  { slug: 'income-tax-tds', title: 'Income Tax and TDS', price: 3600, description: 'Income tax concepts, filing process, and TDS compliance.' },
  { slug: 'gst-theory-simulation', title: 'GST Theory and Simulation', price: 5000, description: 'GST concepts plus simulation-based practical sessions.' },
  { slug: 'gst-simulation', title: 'GST Simulation', price: 3600, description: 'GST simulation for real transaction scenarios.' },
  { slug: 'zoho-books', title: 'Zoho Books', price: 5000, description: 'Zoho books operations and business accounting.' },
  { slug: 'tally', title: 'Tally', price: 5000, description: 'Hands-on Tally training for accounting execution.' },
  { slug: 'combo-accounting-tally-zoho', title: 'Core Accounting, Tally and Zoho', price: 10000, description: 'Accounting plus tools combo for practical job readiness.' },
  { slug: 'combo-tax-school', title: 'Tax (GST, Income Tax and TDS) including Simulation', price: 12000, description: 'Complete tax combo with GST, Income Tax, TDS.' },
  { slug: 'technical-writing', title: 'Technical Writing', price: 12000, description: 'Professional writing for reports and documentation.' },
  { slug: 'java-course', title: 'Java Course', price: 10000, description: 'Java fundamentals to advanced concepts.' },
  { slug: 'total-course-package', title: 'Total Course Package', price: 25000, description: 'Full package combining accounting and tax tracks.' },
];

const TRAINERS = [
  { id: 'e1', slug: 'tr-1', name: 'Nitin Kumar D', bio: 'Focused on Zoho Books and AI in Accounting.', courses: ['Zoho Books', 'AI in Accounting'] },
  { id: 'e2', slug: 'tr-2', name: 'Ashok Raju', bio: 'Tax trainer for GST, Income Tax, and TDS.', courses: ['GST', 'Income Tax', 'TDS'] },
  { id: 'e3', slug: 'tr-3', name: 'Prasanth', bio: 'Taxz instructor for GST, Income Tax, TDS.', courses: ['Taxz - GST', 'Income Tax', 'TDS'] },
  { id: 'e4', slug: 'tr-4', name: 'Venkatesh', bio: 'Core Accounting trainer.', courses: ['Core Accounting'] },
  { id: 'e5', slug: 'tr-5', name: 'Srinivas', bio: 'Tally and GST Simulation trainer.', courses: ['Tally', 'GST Simulation'] },
  { id: 'e6', slug: 'tr-6', name: 'JayaShree', bio: 'GST Simulation trainer.', courses: ['GST Simulation'] },
];

const JOBS = [
  { title: 'Junior Accountant', company: 'ABC & Co. Chartered Accountants', location: 'Mumbai, Maharashtra', job_type: 'full_time', description: 'Handle day-to-day bookkeeping, bank reconciliation. Tally experience preferred.' },
  { title: 'Tax Associate', company: 'XYZ Tax Consultants', location: 'Bangalore, Karnataka', job_type: 'full_time', description: 'Income tax and GST compliance, return filing.' },
  { title: 'Audit Trainee', company: 'Grant & Partners', location: 'Delhi NCR', job_type: 'full_time', description: 'Support statutory and internal audit engagements.' },
  { title: 'Tally Operator', company: 'Retail Solutions Pvt Ltd', location: 'Chennai, Tamil Nadu', job_type: 'full_time', description: 'Maintain accounts in Tally, GST returns.' },
  { title: 'Finance Intern', company: 'ScaleUp Ventures', location: 'Remote', job_type: 'internship', description: 'Assist in financial reporting and variance analysis.' },
];

async function run() {
  if (!config.user || !config.password) {
    console.error('Set DB_USER and DB_PASSWORD in .env');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);

  try {
    for (const u of USERS) {
      const idBuf = toBuf(u.id);
      await conn.execute(
        'INSERT IGNORE INTO users (id, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
        [idBuf, u.email, HASH, u.role_id]
      );
    }

    await conn.execute(
      'INSERT IGNORE INTO students (id, user_id, full_name) VALUES (?, ?, ?)',
      [toBuf('b'.repeat(32)), toBuf('b'.repeat(32)), 'Demo Student']
    );

    for (const t of TRAINERS) {
      const idBuf = toBuf(t.id.repeat(t.id.length === 2 ? 16 : 32));
      const coursesJson = JSON.stringify(t.courses);
      await conn.execute(
        'INSERT IGNORE INTO trainers (id, user_id, full_name, bio, slug, approval_status, courses) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [idBuf, idBuf, t.name, t.bio, t.slug, 'approved', coursesJson]
      );
    }

    await conn.execute(
      'INSERT IGNORE INTO recruiters (id, user_id, company_name, contact_person, approval_status, has_paid_access) VALUES (?, ?, ?, ?, ?, TRUE)',
      [toBuf('d'.repeat(32)), toBuf('d'.repeat(32)), 'Demo Corp', 'Demo Recruiter', 'approved', true]
    );

    const adminId = toBuf('a'.repeat(32));
    for (const c of COURSES) {
      const idHex = crypto.createHash('md5').update(c.slug).digest('hex').slice(0, 32);
      const idBuf = Buffer.from(idHex, 'hex');
      await conn.execute(
        'INSERT IGNORE INTO courses (id, title, slug, description, price, currency, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
        [idBuf, c.title, c.slug, c.description, c.price, 'INR']
      );
    }

    const MATERIALS = [
      { slug: 'core-accounting', items: [{ title: 'Introduction to Accounting', type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, { title: 'Module 1 – Basics', type: 'document', url: '#' }] },
      { slug: 'income-tax-tds', items: [{ title: 'Tax Overview', type: 'video', url: '#' }, { title: 'TDS Concepts', type: 'document', url: '#' }] },
    ];
    for (const m of MATERIALS) {
      const courseIdHex = crypto.createHash('md5').update(m.slug).digest('hex').slice(0, 32);
      const courseIdBuf = Buffer.from(courseIdHex, 'hex');
      for (let i = 0; i < m.items.length; i++) {
        const it = m.items[i];
        const matIdHex = crypto.createHash('md5').update('mat-' + m.slug + '-' + it.title).digest('hex').slice(0, 32);
        const matId = Buffer.from(matIdHex, 'hex');
        await conn.execute(
          'INSERT IGNORE INTO course_materials (id, course_id, title, type, url_or_content, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [matId, courseIdBuf, it.title, it.type, it.url, i, adminId]
        ).catch(() => {});
      }
    }

    const recruiterId = toBuf('d'.repeat(32));
    for (let i = 0; i < JOBS.length; i++) {
      const j = JOBS[i];
      const idHex = crypto.createHash('md5').update('job-' + i + '-' + j.title).digest('hex').slice(0, 32);
      const idBuf = Buffer.from(idHex, 'hex');
      await conn.execute(
        'INSERT IGNORE INTO jobs (id, recruiter_id, title, company, description, location, job_type, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)',
        [idBuf, recruiterId, j.title, j.company, j.description, j.location, j.job_type]
      );
    }

    console.log('Seed completed. Demo users: admin@visionconnects.com, demo-student@visionconnects.com, etc. Password: password123');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
