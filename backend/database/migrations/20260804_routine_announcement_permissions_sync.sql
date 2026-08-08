INSERT IGNORE INTO permissions(name) VALUES
('routines.view'),
('routines.manage'),
('routines.publish'),
('routine_substitutions.manage'),
('exam_routines.manage'),
('announcements.view'),
('announcements.manage'),
('announcements.publish'),
('announcements.sms.send'),
('announcement_templates.manage');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'routines.view',
    'routines.manage',
    'routines.publish',
    'routine_substitutions.manage',
    'exam_routines.manage',
    'announcements.view',
    'announcements.manage',
    'announcements.publish',
    'announcements.sms.send',
    'announcement_templates.manage'
  );

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'routines.view',
    'routines.manage',
    'routines.publish',
    'routine_substitutions.manage',
    'exam_routines.manage',
    'announcements.view',
    'announcements.manage',
    'announcements.publish',
    'announcements.sms.send',
    'announcement_templates.manage'
  );

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name IN ('teacher', 'parent', 'staff', 'accounts', 'student')
  AND p.name IN ('routines.view', 'announcements.view');
