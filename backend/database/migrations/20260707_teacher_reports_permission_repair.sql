-- Repair teacher report access after parent-role cleanup.
-- Teachers should keep marks/report access through the teacher role only.

INSERT IGNORE INTO permissions(name) VALUES
('marks.enter'),
('marks.view');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('marks.enter', 'marks.view')
WHERE r.name = 'teacher';
