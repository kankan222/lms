


INSERT INTO permissions(name) VALUES
('academic.view'),
('academic.create'),
('academic.update'),
('academic.delete'),
('subjects.view'),
('subjects.create'),
("subjects.update"),
("subjects.delete"),
("subjects.assign"),
("classSubjects.view"),
("student.create"),
("student.view"),
("student.update"),
("student.delete"),

('teacher.assign'),
('teacher.view'),
('teacher.remove_assignment'),
                
                ("parent.create"),
                ("parent.view");


INSERT INTO role_permissions(role_id, permission_id)
SELECT 1, id FROM permissions
WHERE id NOT IN (
  SELECT permission_id
  FROM role_permissions
  WHERE role_id = 1
);