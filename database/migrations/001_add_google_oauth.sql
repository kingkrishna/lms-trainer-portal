-- Add Google OAuth support to users table
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email;
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL;
CREATE INDEX idx_users_google_id ON users(google_id);
