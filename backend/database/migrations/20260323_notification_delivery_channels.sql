DROP PROCEDURE IF EXISTS migrate_notification_delivery_channels;

DELIMITER $$

CREATE PROCEDURE migrate_notification_delivery_channels()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_devices'
  ) THEN
    CREATE TABLE notification_devices (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      platform ENUM('software', 'web', 'android', 'ios') NOT NULL DEFAULT 'software',
      device_token VARCHAR(255) NOT NULL,
      push_token VARCHAR(255) NULL,
      push_provider VARCHAR(50) NULL,
      device_name VARCHAR(120) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_notification_device_token (device_token),
      UNIQUE KEY uniq_notification_push_token (push_token),
      INDEX idx_notification_devices_user_active (user_id, is_active),
      CONSTRAINT fk_notification_devices_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  END IF;
END $$

DELIMITER ;

CALL migrate_notification_delivery_channels();

DROP PROCEDURE IF EXISTS migrate_notification_delivery_channels;
