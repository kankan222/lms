SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'announcement_targets'
    AND COLUMN_NAME = 'staff_type'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE announcement_targets ADD COLUMN staff_type ENUM(''teaching'',''non_teaching'',''all'') NULL AFTER scope_code',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
