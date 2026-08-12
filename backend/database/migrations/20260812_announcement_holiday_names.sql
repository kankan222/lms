CREATE TABLE IF NOT EXISTS announcement_holiday_names (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  category ENUM('holiday','festival','vacation','event','other') NOT NULL DEFAULT 'holiday',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_announcement_holiday_names_name (name),
  KEY idx_announcement_holiday_names_active (is_active, category, name),
  CONSTRAINT fk_announcement_holiday_names_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT IGNORE INTO announcement_holiday_names (name, category, is_active)
VALUES
  ('Saraswati Puja', 'festival', 1),
  ('Bihu', 'festival', 1),
  ('Independence Day', 'holiday', 1),
  ('Republic Day', 'holiday', 1),
  ('Summer Vacation', 'vacation', 1),
  ('Winter Vacation', 'vacation', 1);

INSERT IGNORE INTO announcement_holiday_names (name, category, is_active)
SELECT DISTINCT title, 'holiday', 1
FROM holiday_calendar
WHERE title IS NOT NULL AND TRIM(title) <> '';
