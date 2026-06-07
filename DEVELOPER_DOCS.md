# #UPDATE super_admin Phone Number
--SQL--
 
-SELECT u.id, u.username, u.email, u.phone, u.status, r.name AS role
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'super_admin';

  UPDATE users
  SET phone = '6002649802'
  WHERE id = 55;

  UPDATE auth_trusted_devices
  SET revoked_at = NOW(),
      revoke_reason = 'manual_test'
  WHERE user_id = 1
    AND revoked_at IS NULL;

     SELECT id, user_id, phone, role_name, otp_template_id, reason, created_at, expires_at
  FROM auth_otp_challenges
  WHERE user_id = 1
  ORDER BY created_at DESC
  LIMIT 5;

  SELECT id, user_id, phone, role_name, reason, created_at, expires_at
  FROM auth_otp_challenges
  WHERE user_id = 50
  ORDER BY created_at DESC;


# **#UPDATE TEACHER PASSWORD **
node -e "import('bcrypt').then(async b => console.log(await b.hash('123456', 10)))"
$2b$10$kvxPr/c6kN9olKdYm.FFcOuQ9DH7pzsSOCNjB0AFAU0xuithTGNCK

UPDATE users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  SET u.password_hash = '$2b$10$kvxPr/c6kN9olKdYm.FFcOuQ9DH7pzsSOCNjB0AFAU0xuithTGNCK'
  WHERE r.name = 'teacher';

   -- Force OTP again after the password reset
  UPDATE auth_trusted_devices td
  JOIN user_roles ur ON ur.user_id = td.user_id
  JOIN roles r ON r.id = ur.role_id
  SET td.revoked_at = NOW(),
      td.revoke_reason = 'bulk_password_reset'
  WHERE r.name = 'teacher'
    AND td.revoked_at IS NULL;

  -- Revoke existing logged-in sessions
  UPDATE user_sessions s
  JOIN user_roles ur ON ur.user_id = s.user_id
  JOIN roles r ON r.id = ur.role_id
  SET s.revoked_at = NOW()
  WHERE r.name = 'teacher'
    AND s.revoked_at IS NULL;

  COMMIT;

  Verify the affected count before updating:

  SELECT COUNT(DISTINCT u.id) AS teacher_users
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'teacher';

#**UPDATE PARENT PASSWORD**
node -e "import('bcrypt').then(async b => console.log(await b.hash('ABCDEF', 10)))"
  $2b$10$lvHXmwYqvTnLq78hMzb/R.bUoR9wybeQ.83Yyyt4mpCkvP3VbT2Zq

  SELECT COUNT(DISTINCT u.id) AS parent_users
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'parent';

  UPDATE users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  SET u.password_hash = '$2b$10$lvHXmwYqvTnLq78hMzb/R.bUoR9wybeQ.83Yyyt4mpCkvP3VbT2Zq'
  WHERE r.name = 'parent';

   UPDATE auth_trusted_devices td
  JOIN user_roles ur ON ur.user_id = td.user_id
  JOIN roles r ON r.id = ur.role_id
  SET td.revoked_at = NOW(),
      td.revoke_reason = 'bulk_password_reset'
  WHERE r.name = 'parent'
    AND td.revoked_at IS NULL;

    UPDATE user_sessions s
  JOIN user_roles ur ON ur.user_id = s.user_id
  JOIN roles r ON r.id = ur.role_id
  SET s.revoked_at = NOW()
  WHERE r.name = 'parent'
    AND s.revoked_at IS NULL;