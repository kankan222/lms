DROP PROCEDURE IF EXISTS migrate_exam_subject_offering_id;

DELIMITER $$

CREATE PROCEDURE migrate_exam_subject_offering_id()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exam_subjects'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME = 'subject_offering_id'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN subject_offering_id BIGINT NULL AFTER subject_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'subject_offerings'
    ) THEN
      UPDATE exam_subjects es
      JOIN (
        SELECT
          es_inner.id AS exam_subject_id,
          MIN(so.id) AS subject_offering_id
        FROM exam_subjects es_inner
        JOIN exam_scopes esc
          ON esc.exam_id = es_inner.exam_id
        JOIN subject_offerings so
          ON so.subject_id = es_inner.subject_id
         AND so.class_id = esc.class_id
         AND so.is_active = TRUE
         AND (
           so.section_id IS NULL
           OR esc.section_id IS NULL
           OR so.section_id = esc.section_id
         )
        WHERE es_inner.subject_offering_id IS NULL
        GROUP BY es_inner.id
        HAVING COUNT(DISTINCT so.id) = 1
      ) matched
        ON matched.exam_subject_id = es.id
      SET es.subject_offering_id = matched.subject_offering_id
      WHERE es.subject_offering_id IS NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'exam_subjects'
          AND INDEX_NAME = 'idx_exam_subjects_subject_offering'
      ) THEN
        ALTER TABLE exam_subjects
          ADD KEY idx_exam_subjects_subject_offering (subject_offering_id);
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'exam_subjects'
          AND COLUMN_NAME = 'subject_offering_id'
          AND REFERENCED_TABLE_NAME = 'subject_offerings'
      ) THEN
        ALTER TABLE exam_subjects
          ADD CONSTRAINT fk_exam_subjects_subject_offering
          FOREIGN KEY (subject_offering_id) REFERENCES subject_offerings(id);
      END IF;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL migrate_exam_subject_offering_id();

DROP PROCEDURE IF EXISTS migrate_exam_subject_offering_id;
