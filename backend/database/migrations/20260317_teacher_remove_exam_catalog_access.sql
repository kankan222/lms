-- Remove exam-catalog visibility from teacher role.
-- Teachers should use marks-scoped endpoints for reports and marks entry.

DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'teacher'
  AND p.name = 'exams.view';
