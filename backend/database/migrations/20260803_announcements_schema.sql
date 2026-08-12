CREATE TABLE IF NOT EXISTS announcement_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_announcement_categories_slug (slug),
  CONSTRAINT fk_announcement_categories_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT IGNORE INTO announcement_categories (name, slug, is_system, is_active)
VALUES
  ('General', 'general', 1, 1),
  ('Holiday', 'holiday', 1, 1),
  ('Festival', 'festival', 1, 1),
  ('Exam', 'exam', 1, 1),
  ('Exam Reschedule', 'exam_reschedule', 1, 1),
  ('Vacation', 'vacation', 1, 1),
  ('Urgent', 'urgent', 1, 1);

CREATE TABLE IF NOT EXISTS announcement_sms_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_name VARCHAR(160) NOT NULL,
  dlt_template_id VARCHAR(80) NOT NULL,
  provider_template_id VARCHAR(80) NULL,
  header VARCHAR(40) NOT NULL,
  communication_type VARCHAR(80) NULL,
  template_content TEXT NOT NULL,
  brand_dlt_id VARCHAR(80) NULL,
  placeholder_style ENUM('var','alp','mixed') NOT NULL DEFAULT 'alp',
  placeholder_count INT NOT NULL DEFAULT 0,
  status ENUM('registered','inactive','pending','rejected') NOT NULL DEFAULT 'registered',
  provider VARCHAR(80) NOT NULL DEFAULT 'fast2sms',
  creator VARCHAR(120) NULL,
  registered_on DATE NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_announcement_sms_templates_dlt_id (dlt_template_id),
  KEY idx_announcement_sms_templates_status (status),
  CONSTRAINT fk_announcement_sms_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  root_announcement_id BIGINT NULL,
  version_number INT NOT NULL DEFAULT 1,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  category_id BIGINT NULL,
  title VARCHAR(220) NOT NULL,
  body TEXT NOT NULL,
  delivery_mode ENUM('online','offline_sms','both') NOT NULL DEFAULT 'online',
  status ENUM('draft','scheduled','published','sent','failed','cancelled','expired') NOT NULL DEFAULT 'draft',
  priority ENUM('normal','urgent') NOT NULL DEFAULT 'normal',
  publish_at DATETIME NULL,
  published_at DATETIME NULL,
  expires_at DATETIME NULL,
  event_start_date DATE NULL,
  event_end_date DATE NULL,
  reopen_date DATE NULL,
  show_in_software TINYINT(1) NOT NULL DEFAULT 1,
  show_in_mobile TINYINT(1) NOT NULL DEFAULT 1,
  show_on_website TINYINT(1) NOT NULL DEFAULT 0,
  create_notification TINYINT(1) NOT NULL DEFAULT 1,
  send_push TINYINT(1) NOT NULL DEFAULT 1,
  sms_template_id BIGINT NULL,
  sms_variables_json JSON NULL,
  sms_send_at DATETIME NULL,
  sms_content_locked TINYINT(1) NOT NULL DEFAULT 0,
  cancelled_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_announcements_status_publish (status, publish_at, published_at),
  KEY idx_announcements_root_version (root_announcement_id, version_number),
  KEY idx_announcements_current (is_current, status),
  KEY idx_announcements_visibility (show_in_software, show_in_mobile, show_on_website),
  KEY idx_announcements_dates (event_start_date, event_end_date, expires_at),
  CONSTRAINT fk_announcements_category
    FOREIGN KEY (category_id) REFERENCES announcement_categories(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcements_root
    FOREIGN KEY (root_announcement_id) REFERENCES announcements(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcements_sms_template
    FOREIGN KEY (sms_template_id) REFERENCES announcement_sms_templates(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcements_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcements_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_announcements_event_dates
    CHECK (event_end_date IS NULL OR event_start_date IS NULL OR event_start_date <= event_end_date)
);

CREATE TABLE IF NOT EXISTS announcement_targets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  announcement_id BIGINT NOT NULL,
  target_type ENUM('all','role','user','parents','teachers','staff','accounts','class','section','scope') NOT NULL,
  role_name VARCHAR(80) NULL,
  user_id BIGINT NULL,
  session_id INT NULL,
  scope_code VARCHAR(80) NULL,
  class_id INT NULL,
  section_id INT NULL,
  medium VARCHAR(40) NULL,
  stream_id INT NULL,
  include_inactive TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_announcement_targets_announcement (announcement_id),
  KEY idx_announcement_targets_scope (target_type, session_id, class_id, section_id, medium, stream_id),
  CONSTRAINT fk_announcement_targets_announcement
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_targets_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_targets_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcement_targets_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcement_targets_section
    FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcement_targets_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcement_attachments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  announcement_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT NULL,
  uploaded_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_announcement_attachments_announcement (announcement_id),
  CONSTRAINT fk_announcement_attachments_announcement
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcement_sms_jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  announcement_id BIGINT NOT NULL,
  sms_template_id BIGINT NOT NULL,
  status ENUM('draft','scheduled','queued','sending','sent','partial_failed','failed','cancelled') NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  provider VARCHAR(80) NOT NULL DEFAULT 'fast2sms',
  provider_job_id VARCHAR(120) NULL,
  error_message TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_announcement_sms_jobs_status (status, scheduled_at),
  KEY idx_announcement_sms_jobs_announcement (announcement_id),
  CONSTRAINT fk_announcement_sms_jobs_announcement
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_sms_jobs_template
    FOREIGN KEY (sms_template_id) REFERENCES announcement_sms_templates(id),
  CONSTRAINT fk_announcement_sms_jobs_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcement_sms_recipients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sms_job_id BIGINT NOT NULL,
  announcement_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  student_id BIGINT NULL,
  parent_id BIGINT NULL,
  phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(160) NULL,
  recipient_role VARCHAR(80) NULL,
  status ENUM('queued','sent','failed','delivered','undelivered','retrying','cancelled') NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(160) NULL,
  provider_status VARCHAR(120) NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  delivered_at DATETIME NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_announcement_sms_job_phone (sms_job_id, phone),
  KEY idx_announcement_sms_recipients_status (status),
  KEY idx_announcement_sms_recipients_user (user_id),
  CONSTRAINT fk_announcement_sms_recipients_job
    FOREIGN KEY (sms_job_id) REFERENCES announcement_sms_jobs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_sms_recipients_announcement
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_announcement_sms_recipients_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcement_sms_recipients_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_announcement_sms_recipients_parent
    FOREIGN KEY (parent_id) REFERENCES parents(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS holiday_calendar (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  announcement_id BIGINT NULL,
  category_id BIGINT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reopen_date DATE NULL,
  scope_type ENUM('school_wide','school','college','class','section','custom') NOT NULL DEFAULT 'school_wide',
  session_id INT NULL,
  class_id INT NULL,
  section_id INT NULL,
  medium VARCHAR(40) NULL,
  stream_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_holiday_calendar_dates (starts_on, ends_on, is_active),
  KEY idx_holiday_calendar_scope (scope_type, session_id, class_id, section_id, medium, stream_id),
  CONSTRAINT fk_holiday_calendar_announcement
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_category
    FOREIGN KEY (category_id) REFERENCES announcement_categories(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_section
    FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_holiday_calendar_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_holiday_calendar_dates
    CHECK (starts_on <= ends_on)
);

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

INSERT IGNORE INTO permissions(name) VALUES
('announcements.view'),
('announcements.manage'),
('announcements.publish'),
('announcements.sms.send'),
('announcement_templates.manage');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name = 'announcements.view'
WHERE r.name IN ('super_admin', 'admin', 'teacher', 'parent', 'staff', 'accounts', 'student');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('announcements.manage', 'announcements.publish', 'announcements.sms.send', 'announcement_templates.manage')
WHERE r.name IN ('super_admin', 'admin');
