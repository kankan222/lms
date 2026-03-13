-- Sync role access model on server
-- Intended result:
--   super_admin -> all permissions
--   teacher     -> marks/report access + teacher profile + attendance + messaging
--   accounts    -> payments + messaging

INSERT IGNORE INTO permissions(name) VALUES
('dashboard.view'),
('academic.view'),
('academic.create'),
('academic.update'),
('academic.delete'),
('attendance.take'),
('subjects.view'),
('subjects.create'),
('subjects.update'),
('subjects.delete'),
('subjects.assign'),
('classSubjects.view'),
('parent.create'),
('parent.view'),
('student.create'),
('student.view'),
('student.update'),
('student.delete'),
('teacher.create'),
('teacher.view'),
('teacher.update'),
('teacher.delete'),
('teacher.assign'),
('fee.view'),
('fee.create'),
('fee.update'),
('fee.delete'),
('payment.view'),
('payment.create'),
('payment.update'),
('payment.delete'),
('exams.create'),
('exams.view'),
('exams.update'),
('exams.delete'),
('marks.enter'),
('marks.view'),
('marks.approve'),
('messages.view'),
('messages.send'),
('notifications.view');

-- super_admin gets everything
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'super_admin';

-- teacher gets only these permissions
DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE r.name = 'teacher';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('marks.enter', 'marks.view', 'teacher.view', 'attendance.take', 'subjects.view', 'exams.view', 'messages.view', 'messages.send')
WHERE r.name = 'teacher';

-- accounts gets only payments access
DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE r.name = 'accounts';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('payment.view', 'payment.create', 'payment.update', 'payment.delete', 'messages.view', 'messages.send')
WHERE r.name = 'accounts';
