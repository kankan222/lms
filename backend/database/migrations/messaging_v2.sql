-- Messaging V2 migration
-- Run on the LMS database used by backend/.env

-- 1) Ensure conversations has fields used by the messaging module
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
    AND index_name = 'idx_conversations_type_class_section'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_conversations_type_class_section ON conversations(type, class_id, section_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Conversation membership table for direct and grouped conversations
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  last_read_at DATETIME NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'conversation_members'
    AND index_name = 'idx_conversation_members_user'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_conversation_members_user ON conversation_members(user_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Ensure messages table has attachment support
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
