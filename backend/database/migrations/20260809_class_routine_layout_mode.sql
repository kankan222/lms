DROP PROCEDURE IF EXISTS migrate_class_routine_layout_mode;

DELIMITER $$

CREATE PROCEDURE migrate_class_routine_layout_mode()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_versions'
      AND COLUMN_NAME = 'layout_mode'
  ) THEN
    ALTER TABLE class_routine_versions
      ADD COLUMN layout_mode ENUM('standard','packed_hs') NOT NULL DEFAULT 'standard' AFTER stream_id;
  END IF;

  UPDATE class_routine_versions
  SET layout_mode = 'standard'
  WHERE layout_mode IS NULL;
END$$

DELIMITER ;

CALL migrate_class_routine_layout_mode();

DROP PROCEDURE IF EXISTS migrate_class_routine_layout_mode;
