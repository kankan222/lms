CREATE TABLE IF NOT EXISTS teacher_attendance_sync_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  site_id VARCHAR(120) NOT NULL,
  source_log_id BIGINT NOT NULL,
  teacher_id BIGINT NULL,
  teacher_employee_id VARCHAR(50) NULL,
  device_code VARCHAR(100) NULL,
  punch_time DATETIME NOT NULL,
  punch_type ENUM('in', 'out', 'unknown') NOT NULL DEFAULT 'unknown',
  payload_json JSON NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_site_source_log (site_id, source_log_id),
  KEY idx_sync_punch_time (punch_time),
  KEY idx_sync_teacher_employee (teacher_employee_id),
  KEY idx_sync_device_code (device_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

