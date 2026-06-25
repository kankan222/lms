DROP PROCEDURE IF EXISTS migrate_teacher_assignment_unique_key;

DELIMITER $$

CREATE PROCEDURE migrate_teacher_assignment_unique_key()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'teacher_class_assignments'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM teacher_class_assignments
      GROUP BY teacher_id, class_id, section_id, subject_id, session_id
      HAVING COUNT(*) > 1
      LIMIT 1
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Duplicate teacher assignments exist. Deduplicate teacher_class_assignments before adding uniq_teacher_assignment.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'teacher_class_assignments'
        AND INDEX_NAME = 'uniq_teacher_assignment'
    ) THEN
      ALTER TABLE teacher_class_assignments
        ADD UNIQUE KEY uniq_teacher_assignment (
          teacher_id,
          class_id,
          section_id,
          subject_id,
          session_id
        );
    END IF;
  END IF;
END $$

DELIMITER ;

CALL migrate_teacher_assignment_unique_key();

DROP PROCEDURE IF EXISTS migrate_teacher_assignment_unique_key;
