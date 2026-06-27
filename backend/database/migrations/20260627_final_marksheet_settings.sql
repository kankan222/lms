ALTER TABLE exams
  ADD COLUMN final_calculation_type ENUM('unit_test','half_yearly','annual','mock','display_only')
  NOT NULL DEFAULT 'display_only'
  AFTER section_id;

CREATE TABLE IF NOT EXISTS marksheet_grade_settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scale_type ENUM('percentage','activity') NOT NULL,
  grade_label VARCHAR(20) NOT NULL,
  qualitative_value VARCHAR(100) NULL,
  min_value DECIMAL(6,2) NOT NULL DEFAULT 0,
  max_value DECIMAL(6,2) NOT NULL DEFAULT 0,
  mark_value DECIMAL(6,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_grade_setting_range (scale_type, grade_label, min_value, max_value),
  KEY idx_grade_settings_type_active (scale_type, is_active, sort_order)
);

INSERT IGNORE INTO marksheet_grade_settings
  (scale_type, grade_label, qualitative_value, min_value, max_value, mark_value, sort_order)
VALUES
  ('percentage', 'A++', 'Excellent', 85, 100, NULL, 1),
  ('percentage', 'A+', 'Very Good', 75, 84.99, NULL, 2),
  ('percentage', 'A', 'Good', 60, 74.99, NULL, 3),
  ('percentage', 'B', 'Average', 45, 59.99, NULL, 4),
  ('percentage', 'C', 'Below Average', 0, 44.99, NULL, 5),
  ('activity', 'A', 'Excellent', 9, 10, 10, 1),
  ('activity', 'B', 'Very Good', 7, 8.99, 8, 2),
  ('activity', 'C', 'Good', 5, 6.99, 6, 3),
  ('activity', 'D', 'Average', 3, 4.99, 4, 4),
  ('activity', 'E', 'Below Average', 0, 2.99, 2, 5);

CREATE TABLE IF NOT EXISTS marksheet_activities (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  scope_key ENUM('nursery_ukg','i_v','vi_vii','viii','ix','x') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_marksheet_activity_scope_name (scope_key, name),
  KEY idx_marksheet_activities_scope (scope_key, is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS marksheet_activity_marks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  session_id INT NOT NULL,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  marks DECIMAL(6,2) NULL,
  entered_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_activity_student_scope (activity_id, student_id, session_id, class_id, section_id),
  KEY idx_activity_marks_scope (session_id, class_id, section_id),
  CONSTRAINT fk_activity_marks_activity
    FOREIGN KEY (activity_id) REFERENCES marksheet_activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_marks_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_marks_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_marks_class
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_marks_section
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_marks_entered_by
    FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL
);
