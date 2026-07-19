DROP PROCEDURE IF EXISTS migrate_notification_scope_push_permissions;

DELIMITER $$

CREATE PROCEDURE migrate_notification_scope_push_permissions()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME = 'category'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN category VARCHAR(50) NULL AFTER user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME = 'action_url'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN action_url VARCHAR(255) NULL AFTER body;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME = 'deep_link'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN deep_link VARCHAR(255) NULL AFTER action_url;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND INDEX_NAME = 'idx_notifications_user_category_read'
  ) THEN
    CREATE INDEX idx_notifications_user_category_read
      ON notifications(user_id, category, is_read);
  END IF;
END $$

DELIMITER ;

CALL migrate_notification_scope_push_permissions();

DROP PROCEDURE IF EXISTS migrate_notification_scope_push_permissions;

INSERT IGNORE INTO permissions(name) VALUES
('notifications.view'),
('notifications.push.receive'),
('notifications.manage'),
('notifications.send');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('notifications.view', 'notifications.push.receive')
WHERE r.name IN ('super_admin', 'admin', 'teacher', 'parent', 'accounts', 'staff', 'student');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('notifications.manage', 'notifications.send')
WHERE r.name IN ('super_admin', 'admin');

UPDATE notifications
SET category = CASE
  WHEN type LIKE 'student_attendance%' THEN 'attendance'
  WHEN type = 'message' THEN 'message'
  WHEN type LIKE 'fee%' THEN 'fee'
  WHEN type LIKE 'payment%' THEN 'fee'
  WHEN type LIKE 'marks%' OR type LIKE 'marksheet%' THEN 'marksheet'
  WHEN type LIKE 'account%' OR type LIKE 'security%' OR type LIKE 'otp%' THEN 'account'
  ELSE 'system'
END
WHERE category IS NULL OR category = '';
