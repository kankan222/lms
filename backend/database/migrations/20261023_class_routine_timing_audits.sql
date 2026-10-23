CREATE TABLE IF NOT EXISTS class_routine_timing_audits (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  changed_by BIGINT NULL,
  scope ENUM('routine', 'template') NOT NULL,
  source_template_id BIGINT NULL,
  target_template_id BIGINT NULL,
  details JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_class_routine_timing_audits_created (created_at),
  CONSTRAINT fk_class_routine_timing_audits_user
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
