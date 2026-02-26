-- Trainer-enrolled trainees (trainer initiates enrollment)
CREATE TABLE IF NOT EXISTS trainer_trainees (
  id BINARY(16) PRIMARY KEY,
  trainer_id BINARY(16) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  contact_number VARCHAR(32) NOT NULL,
  payment_status ENUM('pending','paid') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tt_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);
