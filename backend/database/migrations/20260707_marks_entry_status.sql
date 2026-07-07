SET @has_mark_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'marks_entries'
    AND COLUMN_NAME = 'mark_status'
);

SET @add_mark_status := IF(
  @has_mark_status = 0,
  'ALTER TABLE marks_entries ADD COLUMN mark_status ENUM(''present'', ''absent'', ''pending'') NOT NULL DEFAULT ''present'' AFTER marks',
  'SELECT 1'
);

PREPARE stmt FROM @add_mark_status;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE marks_entries
SET mark_status = CASE
  WHEN marks IS NULL THEN 'pending'
  ELSE 'present'
END
WHERE mark_status = 'present';

SET @has_mark_status_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'marks_entries'
    AND INDEX_NAME = 'idx_marks_entries_mark_status'
);

SET @add_mark_status_index := IF(
  @has_mark_status_index = 0,
  'CREATE INDEX idx_marks_entries_mark_status ON marks_entries(mark_status)',
  'SELECT 1'
);

PREPARE stmt FROM @add_mark_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
