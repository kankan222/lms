DROP PROCEDURE IF EXISTS migrate_exam_scopes_class_only;

DELIMITER $$

CREATE PROCEDURE migrate_exam_scopes_class_only()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exam_scopes'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND COLUMN_NAME = 'section_id'
        AND IS_NULLABLE = 'NO'
    ) THEN
      ALTER TABLE exam_scopes
        MODIFY COLUMN section_id INT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND COLUMN_NAME = 'section_id_dedupe'
    ) THEN
      ALTER TABLE exam_scopes
        ADD COLUMN section_id_dedupe INT AS (IFNULL(section_id, 0)) STORED;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND INDEX_NAME = 'uniq_exam_scope'
    ) THEN
      ALTER TABLE exam_scopes
        DROP INDEX uniq_exam_scope;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND INDEX_NAME = 'uniq_exam_scope_class_section'
    ) THEN
      ALTER TABLE exam_scopes
        ADD UNIQUE KEY uniq_exam_scope_class_section (exam_id, class_id, section_id_dedupe);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND INDEX_NAME = 'idx_exam_scopes_class_section'
    ) THEN
      ALTER TABLE exam_scopes
        ADD KEY idx_exam_scopes_class_section (class_id, section_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND COLUMN_NAME = 'section_id'
        AND REFERENCED_TABLE_NAME = 'sections'
    ) THEN
      ALTER TABLE exam_scopes
        ADD CONSTRAINT fk_exam_scopes_section_id
        FOREIGN KEY (section_id) REFERENCES sections(id);
    END IF;
  END IF;
END $$

DELIMITER ;

CALL migrate_exam_scopes_class_only();

DROP PROCEDURE IF EXISTS migrate_exam_scopes_class_only;
