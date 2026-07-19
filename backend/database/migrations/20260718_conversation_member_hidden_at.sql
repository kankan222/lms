DROP PROCEDURE IF EXISTS migrate_conversation_member_hidden_at;

DELIMITER $$

CREATE PROCEDURE migrate_conversation_member_hidden_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'conversation_members'
      AND COLUMN_NAME = 'hidden_at'
  ) THEN
    ALTER TABLE conversation_members
      ADD COLUMN hidden_at DATETIME NULL AFTER last_read_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'conversation_members'
      AND INDEX_NAME = 'idx_conversation_members_user_hidden'
  ) THEN
    CREATE INDEX idx_conversation_members_user_hidden
      ON conversation_members (user_id, hidden_at);
  END IF;
END $$

DELIMITER ;

CALL migrate_conversation_member_hidden_at();

DROP PROCEDURE IF EXISTS migrate_conversation_member_hidden_at;
