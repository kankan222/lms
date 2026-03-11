-- Exams/Marks module upgrade migration
-- Run on database: lms

-- 1) exams table: class/section/user linkage
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'exams' AND column_name = 'class_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE exams ADD COLUMN class_id INT NULL AFTER session_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'exams' AND column_name = 'section_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE exams ADD COLUMN section_id INT NULL AFTER class_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'exams' AND column_name = 'created_by'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE exams ADD COLUMN created_by BIGINT NULL AFTER section_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) exam_subjects table: subject allocation and mark limits per exam
CREATE TABLE IF NOT EXISTS exam_scopes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id BIGINT NOT NULL,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_exam_scope (exam_id, class_id, section_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

INSERT IGNORE INTO exam_scopes (exam_id, class_id, section_id)
SELECT id, class_id, section_id
FROM exams
WHERE class_id IS NOT NULL AND section_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS exam_subjects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id BIGINT NOT NULL,
  subject_id INT NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  pass_marks DECIMAL(6,2) NOT NULL DEFAULT 33,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_exam_subject (exam_id, subject_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- 3) marks_entries uniqueness for upsert
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'marks_entries'
    AND index_name = 'uniq_student_exam_subject'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE marks_entries ADD UNIQUE KEY uniq_student_exam_subject (student_id, exam_id, subject_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) performance indexes
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exams' AND index_name = 'idx_exams_scope'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_exams_scope ON exams(session_id, class_id, section_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exam_scopes' AND index_name = 'idx_exam_scopes_class_section'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_exam_scopes_class_section ON exam_scopes(class_id, section_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'marks_entries' AND index_name = 'idx_marks_exam_subject'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_marks_exam_subject ON marks_entries(exam_id, subject_id, approval_status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) permissions
INSERT IGNORE INTO permissions(name) VALUES
('exams.create'),
('exams.view'),
('exams.update'),
('exams.delete'),
('marks.enter'),
('marks.view'),
('marks.approve');

-- Teacher access: exam view + marks enter/view
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'teacher'
  AND p.name IN ('exams.view', 'marks.enter', 'marks.view');

-- Parent can view approved marks/report
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'parent'
  AND p.name IN ('marks.view');

-- Admin side
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name IN ('super_admin', 'staff', 'accounts')
  AND p.name IN ('exams.create', 'exams.view', 'exams.update', 'exams.delete', 'marks.view', 'marks.approve');
