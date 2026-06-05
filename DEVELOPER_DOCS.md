#UPDATE super_admin Phone Number
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