SET @has_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'classes'
    AND COLUMN_NAME = 'class_scope'
);

SET @sql := IF(
  @has_column = 0,
  "ALTER TABLE classes ADD COLUMN class_scope ENUM('school','hs') NOT NULL DEFAULT 'school' AFTER name",
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
