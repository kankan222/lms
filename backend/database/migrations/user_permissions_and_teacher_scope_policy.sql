-- Direct user permission support + teacher fee/report access policy
-- Run on LMS database

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Ensure required permission names exist
INSERT IGNORE INTO permissions(name) VALUES
('fee.view'),
('fee.create'),
('marks.enter'),
('marks.view');

-- Teacher can handle fee payment CRUD (scoped in service) and marks entry/view
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('fee.view', 'fee.create', 'marks.enter', 'marks.view')
WHERE r.name = 'teacher';

-- Parent can view marks/reports/messages and own children fee view (scope enforced in service/routes)
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('marks.view', 'messages.view', 'fee.view')
WHERE r.name = 'parent';
