DROP PROCEDURE IF EXISTS migrate_hs_routine_entry_applicability;

DELIMITER $$

CREATE PROCEDURE migrate_hs_routine_entry_applicability()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_versions'
      AND COLUMN_NAME = 'section_id'
      AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE class_routine_versions
      MODIFY COLUMN section_id INT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_versions'
      AND COLUMN_NAME = 'medium'
      AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE class_routine_versions
      MODIFY COLUMN medium VARCHAR(40) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entries'
      AND COLUMN_NAME = 'applies_medium'
  ) THEN
    ALTER TABLE class_routine_entries
      ADD COLUMN applies_medium VARCHAR(40) NULL AFTER activity_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entries'
      AND INDEX_NAME = 'uq_class_routine_entry_period'
  ) THEN
    ALTER TABLE class_routine_entries
      DROP INDEX uq_class_routine_entry_period;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entries'
      AND INDEX_NAME = 'idx_class_routine_entry_period'
  ) THEN
    ALTER TABLE class_routine_entries
      ADD KEY idx_class_routine_entry_period (routine_version_id, weekday, period_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_routine_entry_sections'
  ) THEN
    CREATE TABLE class_routine_entry_sections (
      routine_entry_id BIGINT NOT NULL,
      section_id INT NOT NULL,
      PRIMARY KEY (routine_entry_id, section_id),
      KEY idx_class_routine_entry_sections_section (section_id),
      CONSTRAINT fk_class_routine_entry_sections_entry
        FOREIGN KEY (routine_entry_id) REFERENCES class_routine_entries(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_class_routine_entry_sections_section
        FOREIGN KEY (section_id) REFERENCES sections(id)
        ON DELETE CASCADE
    );
  END IF;
END$$

DELIMITER ;

CALL migrate_hs_routine_entry_applicability();

DROP PROCEDURE IF EXISTS migrate_hs_routine_entry_applicability;
