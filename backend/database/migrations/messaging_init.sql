-- Messaging module initialization / correction migration
-- Safe to run multiple times

-- ===============================
-- 1) Core messaging tables
-- ===============================

CREATE TABLE IF NOT EXISTS messaging_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  can_send_message BOOLEAN DEFAULT FALSE,
  approved_by BIGINT NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('direct','class','section','broadcast') NOT NULL,
  name VARCHAR(150) NULL,
  class_id INT NULL,
  section_id INT NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  last_read_at DATETIME NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id BIGINT NOT NULL,
  message TEXT,
  attachment_url TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optional compatibility tables (not required by current runtime flow)
CREATE TABLE IF NOT EXISTS conversation_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  recipient_type ENUM('user','class','section','all') NOT NULL,
  recipient_id BIGINT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  file_name VARCHAR(255),
  file_url VARCHAR(500),
  file_type VARCHAR(100),
  file_size INT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  status ENUM('sent','delivered','read') DEFAULT 'sent',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_message_user (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===============================
-- 2) Type/column corrections if tables already existed
-- (compatible with MySQL versions that do not support IF NOT EXISTS in ALTER/INDEX)
-- ===============================

ALTER TABLE messaging_permissions
  MODIFY COLUMN user_id BIGINT NOT NULL,
  MODIFY COLUMN approved_by BIGINT NULL;

ALTER TABLE conversations
  MODIFY COLUMN created_by BIGINT NOT NULL;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND column_name = 'name'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE conversations ADD COLUMN name VARCHAR(150) NULL AFTER type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND column_name = 'class_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE conversations ADD COLUMN class_id INT NULL AFTER name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND column_name = 'section_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE conversations ADD COLUMN section_id INT NULL AFTER class_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND column_name = 'last_message_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE conversations ADD COLUMN last_message_at DATETIME NULL AFTER created_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE conversation_members
  MODIFY COLUMN user_id BIGINT NOT NULL;

ALTER TABLE messages
  MODIFY COLUMN sender_id BIGINT NOT NULL;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'messages'
    AND column_name = 'attachment_url'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE messages ADD COLUMN attachment_url TEXT NULL AFTER message',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE conversation_recipients
  MODIFY COLUMN recipient_id BIGINT NULL;

ALTER TABLE message_status
  MODIFY COLUMN user_id BIGINT NOT NULL;

-- ===============================
-- 3) Indexes
-- ===============================

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND index_name = 'idx_conversations_last_message'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_conversations_last_message ON conversations(last_message_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'conversations'
    AND index_name = 'idx_conversations_scope'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_conversations_scope ON conversations(type, class_id, section_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'conversation_members'
    AND index_name = 'idx_members_user'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_members_user ON conversation_members(user_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'messages'
    AND index_name = 'idx_messages_conversation_created'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===============================
-- 4) Permissions seeds
-- ===============================

INSERT IGNORE INTO permissions(name) VALUES
('messages.view'),
('messages.send');

-- Give both message permissions to super_admin, staff, accounts, teacher
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name IN ('super_admin', 'staff', 'accounts', 'teacher')
  AND p.name IN ('messages.view', 'messages.send');
