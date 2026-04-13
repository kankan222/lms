DROP PROCEDURE IF EXISTS migrate_student_parents_guardian_role_names;

DELIMITER $$

CREATE PROCEDURE migrate_student_parents_guardian_role_names()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_parents'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'student_parents'
        AND COLUMN_NAME = 'father_name'
    ) THEN
      ALTER TABLE student_parents
        ADD COLUMN father_name VARCHAR(150) NULL AFTER relationship;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'student_parents'
        AND COLUMN_NAME = 'mother_name'
    ) THEN
      ALTER TABLE student_parents
        ADD COLUMN mother_name VARCHAR(150) NULL AFTER father_name;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL migrate_student_parents_guardian_role_names();

DROP PROCEDURE IF EXISTS migrate_student_parents_guardian_role_names;
