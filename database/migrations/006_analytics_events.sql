CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(128) NOT NULL,
  user_id BINARY(16) NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analytics_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_analytics_name_created ON analytics_events(event_name, created_at);
