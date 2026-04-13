DROP PROCEDURE IF EXISTS migrate_teacher_device_user_mapping;

DELIMITER $$

CREATE PROCEDURE migrate_teacher_device_user_mapping()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'attendance_devices'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'teachers'
  ) THEN
    CREATE TABLE IF NOT EXISTS teacher_device_users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id BIGINT NOT NULL,
      device_user_id VARCHAR(50) NOT NULL,
      teacher_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_device_user (device_id, device_user_id),
      KEY idx_tdu_teacher (teacher_id),
      CONSTRAINT fk_tdu_device
        FOREIGN KEY (device_id) REFERENCES attendance_devices(id) ON DELETE CASCADE,
      CONSTRAINT fk_tdu_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );
  END IF;
END $$

DELIMITER ;

CALL migrate_teacher_device_user_mapping();

DROP PROCEDURE IF EXISTS migrate_teacher_device_user_mapping;
