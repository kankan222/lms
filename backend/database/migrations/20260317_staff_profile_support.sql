-- Support linked staff user profiles in the staff module.

INSERT IGNORE INTO permissions(name) VALUES
('staff.view');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'staff.view'
WHERE r.name IN ('super_admin', 'staff');

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS user_id BIGINT NULL AFTER id;
