-- v4 core feature columns/tables for grading, sign, job reverse model, sessions

-- Students enhancements
ALTER TABLE students ADD COLUMN certifications_json JSON NULL;
ALTER TABLE students ADD COLUMN portfolio_url VARCHAR(512) NULL;
ALTER TABLE students ADD COLUMN visibility_flag VARCHAR(32) DEFAULT 'public';
ALTER TABLE students ADD COLUMN priority_score INT DEFAULT 0;
ALTER TABLE students ADD COLUMN grade VARCHAR(32) DEFAULT 'UNGRADED';
ALTER TABLE students ADD COLUMN profile_completeness_pct INT DEFAULT 0;

-- Trainer/recruiter approvals and signing lifecycle
ALTER TABLE trainers ADD COLUMN submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trainers ADD COLUMN queue_position INT NULL;
ALTER TABLE trainers ADD COLUMN sign_status VARCHAR(32) DEFAULT 'pending';
ALTER TABLE recruiters ADD COLUMN submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE recruiters ADD COLUMN queue_position INT NULL;
ALTER TABLE recruiters ADD COLUMN sign_status VARCHAR(32) DEFAULT 'pending';
ALTER TABLE recruiters ADD COLUMN access_expiry TIMESTAMP NULL;

-- Jobs enhancements for recruiter filtering
ALTER TABLE jobs ADD COLUMN skills_required_json JSON NULL;
ALTER TABLE jobs ADD COLUMN school_preferred VARCHAR(64) NULL;
ALTER TABLE jobs ADD COLUMN salary_range VARCHAR(128) NULL;
ALTER TABLE jobs ADD COLUMN openings_count INT DEFAULT 1;
ALTER TABLE jobs ADD COLUMN deadline TIMESTAMP NULL;
ALTER TABLE jobs ADD COLUMN status VARCHAR(32) DEFAULT 'open';

-- LMS materials optional external file reference
ALTER TABLE course_materials ADD COLUMN workdrive_file_id VARCHAR(255) NULL;

-- Contact requests (reverse model)
CREATE TABLE IF NOT EXISTS contact_requests (
  id BINARY(16) PRIMARY KEY,
  recruiter_id BINARY(16) NOT NULL,
  student_id BINARY(16) NOT NULL,
  status ENUM('pending','accepted','declined','blocked') DEFAULT 'pending',
  message_text TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  UNIQUE KEY uk_recruiter_student_contact (recruiter_id, student_id),
  CONSTRAINT fk_contact_recruiter FOREIGN KEY (recruiter_id) REFERENCES recruiters(id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Grading activity/history
CREATE TABLE IF NOT EXISTS profile_activity (
  id BINARY(16) PRIMARY KEY,
  student_id BINARY(16) NOT NULL,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  week_number INT NOT NULL,
  year INT NOT NULL,
  CONSTRAINT fk_profile_activity_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_activity_student_week ON profile_activity(student_id, year, week_number);

CREATE TABLE IF NOT EXISTS grade_history (
  id BINARY(16) PRIMARY KEY,
  student_id BINARY(16) NOT NULL,
  grade VARCHAR(32) NOT NULL,
  priority_score INT NOT NULL,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  week_number INT NOT NULL,
  year INT NOT NULL,
  CONSTRAINT fk_grade_history_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_grade_history_student ON grade_history(student_id, calculated_at);

-- Trainer sessions (Zoho Meeting integration)
CREATE TABLE IF NOT EXISTS trainer_sessions (
  id BINARY(16) PRIMARY KEY,
  trainer_id BINARY(16) NOT NULL,
  course_id BINARY(16) NULL,
  title VARCHAR(255) NOT NULL,
  agenda TEXT,
  start_time TIMESTAMP NOT NULL,
  duration_minutes INT DEFAULT 60,
  meeting_provider VARCHAR(32) DEFAULT 'zoho_meeting',
  meeting_id VARCHAR(255) NULL,
  meeting_link VARCHAR(1024) NULL,
  status VARCHAR(32) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainer_sessions_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  CONSTRAINT fk_trainer_sessions_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

