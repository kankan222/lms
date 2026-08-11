DROP PROCEDURE IF EXISTS migrate_class_routine_combined_group;

DELIMITER $$

CREATE PROCEDURE migrate_class_routine_combined_group()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entries'
      AND COLUMN_NAME = 'combined_group_key'
  ) THEN
    ALTER TABLE class_routine_entries
      ADD COLUMN combined_group_key VARCHAR(120) NULL AFTER sort_order;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entries'
      AND INDEX_NAME = 'idx_class_routine_entries_combined_group'
  ) THEN
    ALTER TABLE class_routine_entries
      ADD KEY idx_class_routine_entries_combined_group (combined_group_key);
  END IF;
END$$

DELIMITER ;

CALL migrate_class_routine_combined_group();

DROP PROCEDURE IF EXISTS migrate_class_routine_combined_group;
