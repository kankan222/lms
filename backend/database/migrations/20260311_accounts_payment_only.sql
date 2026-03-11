-- Split payment access from fee-structure access
-- Accounts should only access the payments module

INSERT IGNORE INTO permissions(name) VALUES
('payment.view'),
('payment.create'),
('payment.update'),
('payment.delete');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('payment.view', 'payment.create', 'payment.update', 'payment.delete')
WHERE r.name = 'super_admin';

DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'accounts'
  AND p.name IN (
    'fee.view',
    'fee.create',
    'fee.update',
    'fee.delete',
    'payment.view',
    'payment.create',
    'payment.update',
    'payment.delete'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.name IN ('payment.view', 'payment.create', 'payment.update', 'payment.delete')
WHERE r.name = 'accounts';
