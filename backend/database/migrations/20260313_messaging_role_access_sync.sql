-- Restore messaging access for roles that need cross-role communication
-- Safe to run multiple times

INSERT IGNORE INTO permissions(name) VALUES
('messages.view'),
('messages.send');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('messages.view', 'messages.send')
WHERE r.name IN ('super_admin', 'teacher', 'accounts', 'staff', 'parent');
