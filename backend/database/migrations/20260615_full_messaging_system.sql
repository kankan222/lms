-- Full messaging system upgrade
-- Backward-compatible with existing conversations, messages, and attachment_url data.

ALTER TABLE messages
  MODIFY COLUMN message TEXT NULL;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'message_type'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE messages ADD COLUMN message_type ENUM('text','image','document','voice') NOT NULL DEFAULT 'text' AFTER message",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'reply_to_message_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN reply_to_message_id INT NULL AFTER message_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'forwarded_from_message_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN forwarded_from_message_id INT NULL AFTER reply_to_message_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'edited_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL AFTER created_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'deleted_for_everyone_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN deleted_for_everyone_at DATETIME NULL AFTER edited_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'deleted_by'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN deleted_by BIGINT NULL AFTER deleted_for_everyone_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'messages' AND index_name = 'idx_messages_reply'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_messages_reply ON messages(reply_to_message_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS message_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NULL,
  uploaded_by BIGINT NOT NULL,
  category ENUM('image','document','voice') NOT NULL,
  storage_driver ENUM('local','s3') NOT NULL,
  object_key VARCHAR(700) NOT NULL,
  thumbnail_key VARCHAR(700) NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_extension VARCHAR(20) NOT NULL,
  file_size BIGINT NOT NULL,
  duration_ms INT NULL,
  width INT NULL,
  height INT NULL,
  status ENUM('pending','attached','deleted','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attached_at DATETIME NULL,
  deleted_at DATETIME NULL,
  purge_after DATETIME NULL,
  UNIQUE KEY uq_message_attachment_object_key (object_key),
  KEY idx_message_attachments_message (message_id),
  KEY idx_message_attachments_cleanup (status, purge_after),
  CONSTRAINT fk_message_attachments_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_message_attachments_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Upgrade older message_attachments tables in place.
ALTER TABLE message_attachments
  MODIFY COLUMN message_id INT NULL;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'uploaded_by'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN uploaded_by BIGINT NULL AFTER message_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'category'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE message_attachments ADD COLUMN category ENUM('image','document','voice') NULL AFTER uploaded_by",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'storage_driver'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE message_attachments ADD COLUMN storage_driver ENUM('local','s3') NULL AFTER category",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'object_key'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN object_key VARCHAR(700) NULL AFTER storage_driver',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'thumbnail_key'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN thumbnail_key VARCHAR(700) NULL AFTER object_key',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'original_name'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN original_name VARCHAR(255) NULL AFTER thumbnail_key',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'stored_name'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN stored_name VARCHAR(255) NULL AFTER original_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'mime_type'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN mime_type VARCHAR(150) NULL AFTER stored_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'file_extension'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN file_extension VARCHAR(20) NULL AFTER mime_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE message_attachments
  MODIFY COLUMN file_size BIGINT NULL;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'duration_ms'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN duration_ms INT NULL AFTER file_size',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'width'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN width INT NULL AFTER duration_ms',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'height'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN height INT NULL AFTER width',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'status'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE message_attachments ADD COLUMN status ENUM('pending','attached','deleted','rejected') NOT NULL DEFAULT 'pending' AFTER height",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'created_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'attached_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN attached_at DATETIME NULL AFTER created_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'deleted_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN deleted_at DATETIME NULL AFTER attached_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_attachments' AND column_name = 'purge_after'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_attachments ADD COLUMN purge_after DATETIME NULL AFTER deleted_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS message_hidden_users (
  message_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_message_hidden_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_hidden_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_status (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_message_user (message_id, user_id),
  KEY idx_message_status_user (user_id, status),
  CONSTRAINT fk_message_status_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_status_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_status' AND column_name = 'delivered_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_status ADD COLUMN delivered_at DATETIME NULL AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'message_status' AND column_name = 'read_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE message_status ADD COLUMN read_at DATETIME NULL AFTER delivered_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS message_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  reported_by BIGINT NOT NULL,
  reason VARCHAR(100) NOT NULL,
  details TEXT NULL,
  status ENUM('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
  reviewed_by BIGINT NULL,
  resolution_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  KEY idx_message_reports_status (status, created_at),
  CONSTRAINT fk_message_reports_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_reports_reporter
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_reports_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messaging_user_suspensions (
  user_id BIGINT PRIMARY KEY,
  suspended_by BIGINT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  suspended_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  lifted_at DATETIME NULL,
  lifted_by BIGINT NULL,
  CONSTRAINT fk_messaging_suspension_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messaging_suspension_admin
    FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messaging_suspension_lifter
    FOREIGN KEY (lifted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messaging_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT NULL,
  action VARCHAR(80) NOT NULL,
  conversation_id INT NULL,
  message_id INT NULL,
  attachment_id INT NULL,
  target_user_id BIGINT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messaging_audit_created (created_at),
  KEY idx_messaging_audit_message (message_id),
  CONSTRAINT fk_messaging_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_messaging_audit_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  CONSTRAINT fk_messaging_audit_message
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_messaging_audit_attachment
    FOREIGN KEY (attachment_id) REFERENCES message_attachments(id) ON DELETE SET NULL,
  CONSTRAINT fk_messaging_audit_target
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT IGNORE INTO permissions(name) VALUES
('messages.moderate'),
('messages.export');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('messages.moderate', 'messages.export')
WHERE r.name = 'super_admin';
