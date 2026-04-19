DROP PROCEDURE IF EXISTS migrate_exam_marks_split_components;

DELIMITER $$

CREATE PROCEDURE migrate_exam_marks_split_components()
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
        AND COLUMN_NAME = 'mark_pattern'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN mark_pattern ENUM('single','split') NOT NULL DEFAULT 'single' AFTER subject_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME = 'theory_max'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN theory_max DECIMAL(6,2) NULL AFTER pass_marks;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME = 'theory_pass'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN theory_pass DECIMAL(6,2) NULL AFTER theory_max;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME = 'practical_max'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN practical_max DECIMAL(6,2) NULL AFTER theory_pass;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME = 'practical_pass'
    ) THEN
      ALTER TABLE exam_subjects
        ADD COLUMN practical_pass DECIMAL(6,2) NULL AFTER practical_max;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'marks_entries'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marks_entries'
        AND COLUMN_NAME = 'theory_marks'
    ) THEN
      ALTER TABLE marks_entries
        ADD COLUMN theory_marks DECIMAL(5,2) NULL AFTER marks;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marks_entries'
        AND COLUMN_NAME = 'practical_marks'
    ) THEN
      ALTER TABLE marks_entries
        ADD COLUMN practical_marks DECIMAL(5,2) NULL AFTER theory_marks;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_exam_subjects'
  ) THEN
    CREATE TABLE student_exam_subjects (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      exam_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      subject_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_student_exam_subject_map (exam_id, student_id, subject_id),
      KEY idx_student_exam_subjects_exam_student (exam_id, student_id),
      KEY idx_student_exam_subjects_exam_subject (exam_id, subject_id),
      CONSTRAINT fk_student_exam_subjects_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_exam_subjects_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_exam_subjects_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
  END IF;
END $$

DELIMITER ;

CALL migrate_exam_marks_split_components();

DROP PROCEDURE IF EXISTS migrate_exam_marks_split_components;
