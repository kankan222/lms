DROP PROCEDURE IF EXISTS migrate_student_attendance_workflow;

DELIMITER $$

CREATE PROCEDURE migrate_student_attendance_workflow()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'attendance_sessions'
  ) THEN
    CREATE TABLE attendance_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      section_id INT NOT NULL,
      academic_session_id INT NULL,
      date DATE NOT NULL,
      taken_by BIGINT NOT NULL,
      device_source VARCHAR(50) DEFAULT 'manual',
      attendance_type ENUM('student', 'teacher') NOT NULL DEFAULT 'student',
      approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
      submitted_by BIGINT NULL,
      submitted_at DATETIME NULL,
      reviewed_by BIGINT NULL,
      reviewed_at DATETIME NULL,
      review_remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_attendance_scope (class_id, section_id, academic_session_id, date, attendance_type),
      INDEX idx_attendance_sessions_student_review (attendance_type, approval_status, date),
      INDEX idx_attendance_sessions_scope (academic_session_id, class_id, section_id, date),
      CONSTRAINT fk_attendance_sessions_class
        FOREIGN KEY (class_id) REFERENCES classes(id),
      CONSTRAINT fk_attendance_sessions_section
        FOREIGN KEY (section_id) REFERENCES sections(id),
      CONSTRAINT fk_attendance_sessions_academic_session
        FOREIGN KEY (academic_session_id) REFERENCES academic_sessions(id) ON DELETE SET NULL,
      CONSTRAINT fk_attendance_sessions_taken_by
        FOREIGN KEY (taken_by) REFERENCES users(id),
      CONSTRAINT fk_attendance_sessions_submitted_by
        FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_attendance_sessions_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'attendance_sessions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'academic_session_id'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN academic_session_id INT NULL AFTER section_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'attendance_type'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN attendance_type ENUM('student', 'teacher') NOT NULL DEFAULT 'student' AFTER device_source;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'approval_status'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER attendance_type;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'submitted_by'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN submitted_by BIGINT NULL AFTER approval_status;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'submitted_at'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN submitted_at DATETIME NULL AFTER submitted_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'reviewed_by'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN reviewed_by BIGINT NULL AFTER submitted_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'reviewed_at'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND COLUMN_NAME = 'review_remarks'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD COLUMN review_remarks TEXT NULL AFTER reviewed_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND INDEX_NAME = 'idx_attendance_sessions_student_review'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD INDEX idx_attendance_sessions_student_review (attendance_type, approval_status, date);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sessions'
        AND INDEX_NAME = 'idx_attendance_sessions_scope'
    ) THEN
      ALTER TABLE attendance_sessions
        ADD INDEX idx_attendance_sessions_scope (academic_session_id, class_id, section_id, date);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_attendance'
  ) THEN
    CREATE TABLE student_attendance (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      attendance_session_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      status ENUM('present', 'absent', 'late') NOT NULL DEFAULT 'absent',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_student_attendance_row (attendance_session_id, student_id),
      INDEX idx_student_attendance_student (student_id),
      INDEX idx_student_attendance_status (status),
      CONSTRAINT fk_student_attendance_session
        FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_attendance_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'approvals'
  ) THEN
    CREATE TABLE approvals (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(50),
      entity_id BIGINT,
      submitted_by BIGINT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      approved_by BIGINT,
      approved_at DATETIME,
      remarks TEXT
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
  ) THEN
    CREATE TABLE notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT,
      type VARCHAR(50) NULL,
      entity_type VARCHAR(50) NULL,
      entity_id BIGINT NULL,
      title VARCHAR(255),
      body TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      read_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_read (user_id, is_read),
      CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_attendance_parent_messages'
  ) THEN
    CREATE TABLE student_attendance_parent_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      attendance_session_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      parent_user_id BIGINT NOT NULL,
      conversation_id INT NULL,
      message_id INT NULL,
      notification_id BIGINT NULL,
      message_body TEXT NOT NULL,
      sent_by BIGINT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_student_attendance_parent_messages_session (attendance_session_id),
      INDEX idx_student_attendance_parent_messages_student (student_id),
      INDEX idx_student_attendance_parent_messages_parent (parent_user_id),
      CONSTRAINT fk_student_attendance_parent_messages_session
        FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_attendance_parent_messages_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_attendance_parent_messages_parent_user
        FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_student_attendance_parent_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
      CONSTRAINT fk_student_attendance_parent_messages_message
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
      CONSTRAINT fk_student_attendance_parent_messages_notification
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL,
      CONSTRAINT fk_student_attendance_parent_messages_sent_by
        FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE CASCADE
    );
  END IF;

  INSERT IGNORE INTO permissions(name)
  VALUES
    ('student_attendance.take'),
    ('student_attendance.view'),
    ('student_attendance.review'),
    ('student_attendance.notify');

  INSERT IGNORE INTO role_permissions(role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  JOIN permissions p
    ON p.name IN (
      'student_attendance.take',
      'student_attendance.view',
      'student_attendance.review',
      'student_attendance.notify'
    )
  WHERE r.name = 'super_admin';

  INSERT IGNORE INTO role_permissions(role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  JOIN permissions p
    ON p.name IN (
      'student_attendance.take',
      'student_attendance.view'
    )
  WHERE r.name = 'teacher';

  INSERT IGNORE INTO role_permissions(role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  JOIN permissions p
    ON p.name IN (
      'student_attendance.view',
      'student_attendance.review',
      'student_attendance.notify'
    )
  WHERE r.name = 'staff';

  INSERT IGNORE INTO role_permissions(role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  JOIN permissions p
    ON p.name = 'student_attendance.view'
  WHERE r.name = 'parent';
END $$

DELIMITER ;

CALL migrate_student_attendance_workflow();

DROP PROCEDURE IF EXISTS migrate_student_attendance_workflow;
