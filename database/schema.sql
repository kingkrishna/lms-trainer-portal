-- ============================================================
-- LMS + Trainer Marketplace + Job Portal
-- Database Schema (MySQL-compatible; minor changes for PostgreSQL)
-- Zero-trust: pricing and access enforced server-side only.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Roles & Users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (id, name, description) VALUES
(1, 'super_admin', 'Full system control, pricing, payments'),
(2, 'student', 'Enroll, pay, learn, apply for jobs'),
(3, 'trainer', 'Teach courses, no pricing authority'),
(4, 'recruiter', 'Post jobs, search candidates after payment')
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TABLE IF NOT EXISTS users (
  id BINARY(16) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  google_id VARCHAR(255) NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  role_id TINYINT UNSIGNED NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_role ON users(role_id);

-- ------------------------------------------------------------
-- Role-specific profiles (1:1 with users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id BINARY(16) PRIMARY KEY,
  user_id BINARY(16) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  resume_url VARCHAR(512),
  bio TEXT,
  skills JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trainers (
  id BINARY(16) PRIMARY KEY,
  user_id BINARY(16) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(512),
  is_approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP NULL,
  approved_by BINARY(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trainers_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS recruiters (
  id BINARY(16) PRIMARY KEY,
  user_id BINARY(16) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  company_logo_url VARCHAR(512),
  contact_person VARCHAR(255),
  phone VARCHAR(32),
  has_paid_access BOOLEAN DEFAULT FALSE,
  access_paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recruiters_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Admin settings (pricing, commission, platform config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_settings (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(64) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  value_type ENUM('string','number','boolean','json') DEFAULT 'string',
  updated_by BINARY(16),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Default pricing keys (values set by Super Admin only)
INSERT INTO admin_settings (setting_key, setting_value, value_type) VALUES
('platform_commission_percent', '10', 'number'),
('recruiter_access_amount', '0', 'number')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ------------------------------------------------------------
-- Courses (created by Super Admin; prices set here only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id BINARY(16) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(3) DEFAULT 'INR',
  is_active BOOLEAN DEFAULT TRUE,
  created_by BINARY(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_active ON courses(is_active);

-- ------------------------------------------------------------
-- Trainer-Course mapping (trainer chooses courses to teach)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainer_course_map (
  id BINARY(16) PRIMARY KEY,
  trainer_id BINARY(16) NOT NULL,
  course_id BINARY(16) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_trainer_course (trainer_id, course_id),
  CONSTRAINT fk_tcm_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  CONSTRAINT fk_tcm_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_tcm_trainer ON trainer_course_map(trainer_id);
CREATE INDEX idx_tcm_course ON trainer_course_map(course_id);

-- ------------------------------------------------------------
-- Payments (server-verified only; webhook + amount from DB)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id BINARY(16) PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_type ENUM('course_enrollment','recruiter_access') NOT NULL,
  gateway_order_id VARCHAR(255),
  gateway_payment_id VARCHAR(255),
  gateway_signature VARCHAR(512),
  status ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
  metadata JSON,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gateway ON payments(gateway_order_id);

-- ------------------------------------------------------------
-- Enrollments (created only after verified payment)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
  id BINARY(16) PRIMARY KEY,
  student_id BINARY(16) NOT NULL,
  course_id BINARY(16) NOT NULL,
  trainer_id BINARY(16) NOT NULL,
  payment_id BINARY(16) NOT NULL,
  status ENUM('active','completed','cancelled') DEFAULT 'active',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_trainer ON enrollments(trainer_id);

-- ------------------------------------------------------------
-- LMS: materials, progress (access validated per request)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_materials (
  id BINARY(16) PRIMARY KEY,
  course_id BINARY(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('video','document','link','live_session') NOT NULL,
  url_or_content VARCHAR(1024),
  sort_order INT UNSIGNED DEFAULT 0,
  created_by BINARY(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS enrollment_progress (
  id BINARY(16) PRIMARY KEY,
  enrollment_id BINARY(16) NOT NULL,
  material_id BINARY(16) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uk_enroll_material (enrollment_id, material_id),
  CONSTRAINT fk_ep_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ep_material FOREIGN KEY (material_id) REFERENCES course_materials(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Job Portal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id BINARY(16) PRIMARY KEY,
  recruiter_id BINARY(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  job_type ENUM('full_time','part_time','internship','contract') DEFAULT 'full_time',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_jobs_recruiter FOREIGN KEY (recruiter_id) REFERENCES recruiters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_applications (
  id BINARY(16) PRIMARY KEY,
  job_id BINARY(16) NOT NULL,
  student_id BINARY(16) NOT NULL,
  status ENUM('applied','shortlisted','rejected','hired') DEFAULT 'applied',
  cover_message TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_job_student (job_id, student_id),
  CONSTRAINT fk_ja_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_ja_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_ja_job ON job_applications(job_id);
CREATE INDEX idx_ja_student ON job_applications(student_id);

-- ------------------------------------------------------------
-- Messaging (in-platform + Zoho sync)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id BINARY(16) PRIMARY KEY,
  sender_id BINARY(16) NOT NULL,
  recipient_id BINARY(16) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  related_type ENUM('enrollment','job_application','support') NULL,
  related_id BINARY(16) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ------------------------------------------------------------
-- Audit logs (non-deletable; full traceability)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BINARY(16),
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64),
  resource_id VARCHAR(64),
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ------------------------------------------------------------
-- Pricing history (audit trail for price changes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_log (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  course_id BINARY(16),
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2) NOT NULL,
  changed_by BINARY(16) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pl_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_pl_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

SET FOREIGN_KEY_CHECKS = 1;
