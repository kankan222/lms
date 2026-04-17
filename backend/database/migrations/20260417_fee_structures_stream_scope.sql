DROP PROCEDURE IF EXISTS migrate_fee_structures_stream_scope;

DELIMITER $$

CREATE PROCEDURE migrate_fee_structures_stream_scope()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND COLUMN_NAME = 'stream_id'
  ) THEN
    ALTER TABLE fee_structures
      ADD COLUMN stream_id INT NULL AFTER session_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND COLUMN_NAME = 'stream_id_dedupe'
  ) THEN
    ALTER TABLE fee_structures
      ADD COLUMN stream_id_dedupe INT AS (IFNULL(stream_id, 0)) STORED;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND INDEX_NAME = 'unique_class_session'
  ) THEN
    ALTER TABLE fee_structures
      DROP INDEX unique_class_session;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND INDEX_NAME = 'unique_class_session_stream'
  ) THEN
    ALTER TABLE fee_structures
      ADD UNIQUE KEY unique_class_session_stream (class_id, session_id, stream_id_dedupe);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND INDEX_NAME = 'idx_fee_structures_stream_id'
  ) THEN
    ALTER TABLE fee_structures
      ADD KEY idx_fee_structures_stream_id (stream_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fee_structures'
      AND CONSTRAINT_NAME = 'fee_structures_ibfk_3'
      AND COLUMN_NAME = 'stream_id'
  ) THEN
    ALTER TABLE fee_structures
      ADD CONSTRAINT fee_structures_ibfk_3
      FOREIGN KEY (stream_id) REFERENCES streams(id);
  END IF;
END $$

DELIMITER ;

CALL migrate_fee_structures_stream_scope();

DROP PROCEDURE IF EXISTS migrate_fee_structures_stream_scope;
