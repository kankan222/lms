-- Ensure super_admin (admin role) has every permission in the system
-- Safe to run multiple times

-- 1) Create any missing permissions referenced across modules
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

-- 2) Grant all permissions to super_admin role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'super_admin';
