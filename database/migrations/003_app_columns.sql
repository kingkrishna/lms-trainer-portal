-- Add columns required by app (alignment with memoryStore/frontend)
-- Run after schema.sql and 001, 002
-- MySQL 8.0.12+ supports IF NOT EXISTS; for 5.7 run once on fresh DB

-- Students: address, profile_image_url
ALTER TABLE students ADD COLUMN address VARCHAR(512) NULL AFTER phone;
ALTER TABLE students ADD COLUMN profile_image_url VARCHAR(512) NULL AFTER resume_url;

-- Trainers: slug, approval_status, phone, address, profile_image_url, courses (JSON)
ALTER TABLE trainers ADD COLUMN slug VARCHAR(64) NULL UNIQUE AFTER user_id;
ALTER TABLE trainers ADD COLUMN approval_status VARCHAR(32) DEFAULT 'pending' AFTER bio;
ALTER TABLE trainers ADD COLUMN phone VARCHAR(32) NULL AFTER full_name;
ALTER TABLE trainers ADD COLUMN address VARCHAR(512) NULL AFTER phone;
ALTER TABLE trainers ADD COLUMN profile_image_url VARCHAR(512) NULL;
ALTER TABLE trainers ADD COLUMN courses JSON NULL;

-- Recruiters: address, profile_image_url, approval_status
ALTER TABLE recruiters ADD COLUMN address VARCHAR(512) NULL AFTER phone;
ALTER TABLE recruiters ADD COLUMN profile_image_url VARCHAR(512) NULL;
ALTER TABLE recruiters ADD COLUMN approval_status VARCHAR(32) DEFAULT 'pending';

-- Jobs: company (for display)
ALTER TABLE jobs ADD COLUMN company VARCHAR(255) NULL AFTER title;

-- Admin profiles (for super_admin)
CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id BINARY(16) PRIMARY KEY,
  full_name VARCHAR(255),
  phone VARCHAR(32),
  address VARCHAR(512),
  profile_image_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
