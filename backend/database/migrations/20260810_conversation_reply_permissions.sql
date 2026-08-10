DROP PROCEDURE IF EXISTS migrate_conversation_reply_permissions;

DELIMITER //
CREATE PROCEDURE migrate_conversation_reply_permissions()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'conversations'
      AND COLUMN_NAME = 'allow_parent_reply'
  ) THEN
    ALTER TABLE conversations
      ADD COLUMN allow_parent_reply TINYINT(1) NOT NULL DEFAULT 0 AFTER last_message_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'conversations'
      AND COLUMN_NAME = 'allow_teacher_reply'
  ) THEN
    ALTER TABLE conversations
      ADD COLUMN allow_teacher_reply TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_parent_reply;
  END IF;
END//
DELIMITER ;

CALL migrate_conversation_reply_permissions();

DROP PROCEDURE IF EXISTS migrate_conversation_reply_permissions;
