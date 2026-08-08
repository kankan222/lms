CREATE TABLE IF NOT EXISTS routine_time_slot_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  scope_level ENUM('school','higher_secondary','class_section') NOT NULL DEFAULT 'school',
  session_id INT NULL,
  class_id INT NULL,
  section_id INT NULL,
  medium VARCHAR(40) NULL,
  stream_id INT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_routine_slot_templates_scope (scope_level, session_id, class_id, section_id, medium, stream_id),
  CONSTRAINT fk_routine_slot_templates_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_slot_templates_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_slot_templates_section
    FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_slot_templates_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_slot_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS routine_time_slots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  weekday TINYINT NULL,
  period_number INT NOT NULL,
  label VARCHAR(80) NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  default_entry_type ENUM('subject','break','activity','assembly','games','library','remedial','free','custom') NOT NULL DEFAULT 'subject',
  is_break TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_routine_time_slots_template_day_period (template_id, weekday, period_number),
  KEY idx_routine_time_slots_template_time (template_id, weekday, start_time, end_time),
  CONSTRAINT fk_routine_time_slots_template
    FOREIGN KEY (template_id) REFERENCES routine_time_slot_templates(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_routine_time_slots_weekday
    CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_routine_time_slots_time
    CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS class_routine_versions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  medium VARCHAR(40) NOT NULL,
  stream_id INT NULL,
  stream_id_dedupe INT GENERATED ALWAYS AS (COALESCE(stream_id, 0)) STORED,
  time_slot_template_id BIGINT NULL,
  version_number INT NOT NULL DEFAULT 1,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  title VARCHAR(180) NULL,
  source ENUM('manual','import') NOT NULL DEFAULT 'manual',
  parent_version_id BIGINT NULL,
  published_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_routine_scope_version (session_id, class_id, section_id, medium, stream_id_dedupe, version_number),
  KEY idx_class_routine_scope_status (session_id, class_id, section_id, medium, stream_id, status),
  KEY idx_class_routine_status (status),
  CONSTRAINT fk_class_routine_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_class_routine_class
    FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_class_routine_section
    FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT fk_class_routine_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id),
  CONSTRAINT fk_class_routine_template
    FOREIGN KEY (time_slot_template_id) REFERENCES routine_time_slot_templates(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_class_routine_parent
    FOREIGN KEY (parent_version_id) REFERENCES class_routine_versions(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_class_routine_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_class_routine_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_routine_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  routine_version_id BIGINT NOT NULL,
  time_slot_id BIGINT NULL,
  weekday TINYINT NOT NULL,
  period_number INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  entry_type ENUM('subject','break','activity','assembly','games','library','remedial','free','custom') NOT NULL DEFAULT 'subject',
  subject_id INT NULL,
  activity_id BIGINT NULL,
  title VARCHAR(160) NULL,
  room VARCHAR(120) NULL,
  notes TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_routine_entry_period (routine_version_id, weekday, period_number),
  KEY idx_class_routine_entries_subject (subject_id),
  KEY idx_class_routine_entries_activity (activity_id),
  KEY idx_class_routine_entries_day_time (weekday, start_time, end_time),
  CONSTRAINT fk_class_routine_entries_version
    FOREIGN KEY (routine_version_id) REFERENCES class_routine_versions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_class_routine_entries_slot
    FOREIGN KEY (time_slot_id) REFERENCES routine_time_slots(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_class_routine_entries_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_class_routine_entries_activity
    FOREIGN KEY (activity_id) REFERENCES marksheet_activities(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_class_routine_entries_weekday
    CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_class_routine_entries_time
    CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS class_routine_entry_teachers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  routine_entry_id BIGINT NOT NULL,
  teacher_id BIGINT NOT NULL,
  teacher_role ENUM('primary','co_teacher','assistant') NOT NULL DEFAULT 'primary',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_routine_entry_teacher (routine_entry_id, teacher_id, teacher_role),
  KEY idx_class_routine_entry_teachers_teacher (teacher_id),
  CONSTRAINT fk_class_routine_entry_teachers_entry
    FOREIGN KEY (routine_entry_id) REFERENCES class_routine_entries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_class_routine_entry_teachers_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_routine_versions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  session_id INT NOT NULL,
  title VARCHAR(180) NULL,
  version_number INT NOT NULL DEFAULT 1,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  source ENUM('manual','import') NOT NULL DEFAULT 'manual',
  parent_version_id BIGINT NULL,
  publish_announcement_requested TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_routine_version (exam_id, version_number),
  KEY idx_exam_routine_status (exam_id, status),
  CONSTRAINT fk_exam_routine_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exam_routine_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_exam_routine_parent
    FOREIGN KEY (parent_version_id) REFERENCES exam_routine_versions(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exam_routine_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exam_routine_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS exam_routine_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_routine_version_id BIGINT NOT NULL,
  class_id INT NOT NULL,
  section_id INT NULL,
  medium VARCHAR(40) NULL,
  stream_id INT NULL,
  subject_id INT NULL,
  exam_subject_id BIGINT NULL,
  entry_type ENUM('subject','practical','activity','custom') NOT NULL DEFAULT 'subject',
  title VARCHAR(160) NULL,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(120) NULL,
  instructions TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_exam_routine_entries_scope (class_id, section_id, medium, stream_id, exam_date),
  KEY idx_exam_routine_entries_subject (subject_id),
  KEY idx_exam_routine_entries_date_time (exam_date, start_time, end_time),
  CONSTRAINT fk_exam_routine_entries_version
    FOREIGN KEY (exam_routine_version_id) REFERENCES exam_routine_versions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exam_routine_entries_class
    FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_exam_routine_entries_section
    FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exam_routine_entries_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exam_routine_entries_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exam_routine_entries_exam_subject
    FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_exam_routine_entries_time
    CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS exam_routine_entry_invigilators (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_routine_entry_id BIGINT NOT NULL,
  teacher_id BIGINT NOT NULL,
  invigilation_role ENUM('invigilator','assistant','reliever') NOT NULL DEFAULT 'invigilator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_routine_entry_invigilator (exam_routine_entry_id, teacher_id, invigilation_role),
  KEY idx_exam_routine_invigilators_teacher (teacher_id),
  CONSTRAINT fk_exam_routine_invigilators_entry
    FOREIGN KEY (exam_routine_entry_id) REFERENCES exam_routine_entries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exam_routine_invigilators_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_substitutions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_routine_entry_id BIGINT NULL,
  session_id INT NOT NULL,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  medium VARCHAR(40) NOT NULL,
  stream_id INT NULL,
  weekday TINYINT NULL,
  period_number INT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  change_type ENUM('teacher_substitution','subject_change','extra_class','cancelled','free_period','room_change') NOT NULL,
  status ENUM('draft','published','cancelled') NOT NULL DEFAULT 'draft',
  original_subject_id INT NULL,
  replacement_subject_id INT NULL,
  title VARCHAR(160) NULL,
  original_room VARCHAR(120) NULL,
  replacement_room VARCHAR(120) NULL,
  reason VARCHAR(160) NULL,
  notes TEXT NULL,
  published_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_routine_substitutions_scope_date (session_id, class_id, section_id, medium, stream_id, starts_on, ends_on),
  KEY idx_routine_substitutions_status (status),
  KEY idx_routine_substitutions_entry (class_routine_entry_id),
  CONSTRAINT fk_routine_substitutions_entry
    FOREIGN KEY (class_routine_entry_id) REFERENCES class_routine_entries(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_substitutions_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  CONSTRAINT fk_routine_substitutions_class
    FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_routine_substitutions_section
    FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT fk_routine_substitutions_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_substitutions_original_subject
    FOREIGN KEY (original_subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_substitutions_replacement_subject
    FOREIGN KEY (replacement_subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_substitutions_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_routine_substitutions_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_routine_substitutions_weekday
    CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_routine_substitutions_dates
    CHECK (starts_on <= ends_on),
  CONSTRAINT chk_routine_substitutions_time
    CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS routine_substitution_teachers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  substitution_id BIGINT NOT NULL,
  teacher_id BIGINT NOT NULL,
  assignment_role ENUM('original','replacement','additional') NOT NULL DEFAULT 'replacement',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_routine_substitution_teacher (substitution_id, teacher_id, assignment_role),
  KEY idx_routine_substitution_teachers_teacher (teacher_id),
  CONSTRAINT fk_routine_substitution_teachers_substitution
    FOREIGN KEY (substitution_id) REFERENCES routine_substitutions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_routine_substitution_teachers_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    ON DELETE CASCADE
);

INSERT IGNORE INTO permissions(name) VALUES
('routines.view'),
('routines.manage'),
('routines.publish'),
('routine_substitutions.manage'),
('exam_routines.manage');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name = 'routines.view'
WHERE r.name IN ('super_admin', 'admin', 'teacher', 'parent', 'staff', 'accounts', 'student');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('routines.manage', 'routines.publish', 'routine_substitutions.manage', 'exam_routines.manage')
WHERE r.name IN ('super_admin', 'admin');
