DROP PROCEDURE IF EXISTS migrate_marksheet_activity_class_scope_repair;

DELIMITER $$

CREATE PROCEDURE migrate_marksheet_activity_class_scope_repair()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'marksheet_activities'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND COLUMN_NAME = 'scope_key'
        AND IS_NULLABLE = 'NO'
    ) THEN
      ALTER TABLE marksheet_activities
        MODIFY scope_key ENUM('nursery_ukg','i_v','vi_vii','viii','ix','x') NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND COLUMN_NAME = 'class_id'
    ) THEN
      ALTER TABLE marksheet_activities
        ADD COLUMN class_id INT NULL AFTER scope_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND COLUMN_NAME = 'section_id'
    ) THEN
      ALTER TABLE marksheet_activities
        ADD COLUMN section_id INT NULL AFTER class_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND INDEX_NAME = 'uniq_marksheet_activity_scope_name'
    ) THEN
      ALTER TABLE marksheet_activities
        DROP INDEX uniq_marksheet_activity_scope_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND INDEX_NAME = 'idx_marksheet_activities_class_scope'
    ) THEN
      ALTER TABLE marksheet_activities
        ADD KEY idx_marksheet_activities_class_scope (class_id, section_id, is_active, sort_order);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND COLUMN_NAME = 'class_id'
        AND REFERENCED_TABLE_NAME = 'classes'
    ) THEN
      ALTER TABLE marksheet_activities
        ADD CONSTRAINT fk_marksheet_activities_class
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marksheet_activities'
        AND COLUMN_NAME = 'section_id'
        AND REFERENCED_TABLE_NAME = 'sections'
    ) THEN
      ALTER TABLE marksheet_activities
        ADD CONSTRAINT fk_marksheet_activities_section
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL migrate_marksheet_activity_class_scope_repair();

DROP PROCEDURE IF EXISTS migrate_marksheet_activity_class_scope_repair;
