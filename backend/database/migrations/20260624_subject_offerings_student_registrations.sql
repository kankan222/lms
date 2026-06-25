DROP PROCEDURE IF EXISTS migrate_subject_offerings_student_registrations;

DELIMITER $$

CREATE PROCEDURE migrate_subject_offerings_student_registrations()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'subject_offerings'
  ) THEN
    CREATE TABLE subject_offerings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      section_id INT NULL,
      section_id_dedupe INT AS (IFNULL(section_id, 0)) STORED,
      stream_id INT NULL,
      stream_id_dedupe INT AS (IFNULL(stream_id, 0)) STORED,
      subject_id INT NOT NULL,
      subject_group ENUM('compulsory','elective','optional') NOT NULL DEFAULT 'compulsory',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_subject_offering_scope_subject (
        class_id,
        section_id_dedupe,
        stream_id_dedupe,
        subject_id
      ),
      KEY idx_subject_offerings_class_section_stream (class_id, section_id, stream_id),
      KEY idx_subject_offerings_subject (subject_id),
      CONSTRAINT fk_subject_offerings_class
        FOREIGN KEY (class_id) REFERENCES classes(id),
      CONSTRAINT fk_subject_offerings_section
        FOREIGN KEY (section_id) REFERENCES sections(id),
      CONSTRAINT fk_subject_offerings_stream
        FOREIGN KEY (stream_id) REFERENCES streams(id),
      CONSTRAINT fk_subject_offerings_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_subject_registrations'
  ) THEN
    CREATE TABLE student_subject_registrations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT NOT NULL,
      subject_offering_id BIGINT NOT NULL,
      status ENUM('active','dropped') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_student_subject_registration (student_id, subject_offering_id),
      KEY idx_student_subject_registrations_student_status (student_id, status),
      KEY idx_student_subject_registrations_offering_status (subject_offering_id, status),
      CONSTRAINT fk_student_subject_registrations_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_subject_registrations_offering
        FOREIGN KEY (subject_offering_id) REFERENCES subject_offerings(id) ON DELETE CASCADE
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'class_subjects'
  ) THEN
    INSERT INTO subject_offerings (
      class_id,
      section_id,
      stream_id,
      subject_id,
      subject_group,
      is_active
    )
    SELECT
      cs.class_id,
      NULL,
      NULL,
      cs.subject_id,
      'compulsory',
      TRUE
    FROM class_subjects cs
    ON DUPLICATE KEY UPDATE
      subject_group = IF(subject_group = 'compulsory', subject_group, VALUES(subject_group)),
      is_active = TRUE;
  END IF;
END $$

DELIMITER ;

CALL migrate_subject_offerings_student_registrations();

DROP PROCEDURE IF EXISTS migrate_subject_offerings_student_registrations;
