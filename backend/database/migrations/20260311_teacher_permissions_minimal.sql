-- Restrict teacher role to marks/report access, teacher profile view, attendance, and messaging
DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE r.name = 'teacher';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('marks.enter', 'marks.view', 'teacher.view', 'attendance.take', 'subjects.view', 'messages.view', 'messages.send')
WHERE r.name = 'teacher';
