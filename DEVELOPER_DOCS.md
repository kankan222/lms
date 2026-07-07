# #UPDATE super_admin Phone Number
--SQL--
 
-SELECT u.id, u.username, u.email, u.phone, u.status, r.name AS role
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'super_admin';

  UPDATE users
  SET phone = '6002649802'
  WHERE id = 1;

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
node -e "import('bcrypt').then(async b => console.log(await b.hash('ABCDEF', 10)))"
$2b$10$ONGuTIhuuyhlXLDO.9l.Cur/Hr/Ar8HDXMROUX4eyb8gvzGcAWQTW

UPDATE users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  SET u.password_hash = '$2b$10$ONGuTIhuuyhlXLDO.9l.Cur/Hr/Ar8HDXMROUX4eyb8gvzGcAWQTW'
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
node -e "import('bcrypt').then(async b => console.log(await b.hash('123456', 10)))"
  $2b$10$p65a0SH66NpRZ.oJd.ia0OqdNSIy/0c3QkbbISs49vs2I4nqmeihO

  SELECT COUNT(DISTINCT u.id) AS parent_users
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'parent';

  UPDATE users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  SET u.password_hash = '$2b$10$p65a0SH66NpRZ.oJd.ia0OqdNSIy/0c3QkbbISs49vs2I4nqmeihO'
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


/CHECK DUPLICATE IDs
    SELECT
    MIN(s.name) AS name,
    MIN(s.mobile) AS mobile,
    se.class_id,
    se.section_id,
    se.stream_id,
    se.session_id,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(s.id ORDER BY s.id) AS student_ids
  FROM students s
  JOIN student_enrollments se ON se.student_id = s.id
  JOIN classes c ON c.id = se.class_id
  WHERE c.name LIKE '%HS 2nd%'
    AND se.status = 'active'
  GROUP BY
    LOWER(TRIM(s.name)),
    COALESCE(NULLIF(TRIM(s.mobile), ''), ''),
    se.class_id,
    se.section_id,
    se.stream_id,
    se.session_id
  HAVING COUNT(*) > 1;

<!-- CREATE TEMPORARY TABLES -->
  CREATE TEMPORARY TABLE duplicate_student_ids AS
  SELECT student_id
  FROM (
    SELECT
      s.id AS student_id,
      ROW_NUMBER() OVER (
        PARTITION BY
          LOWER(TRIM(s.name)),
          COALESCE(NULLIF(TRIM(s.mobile), ''), ''),
          se.class_id,
          se.section_id,
          se.stream_id,
          se.session_id
        ORDER BY s.id
      ) AS rn
    FROM students s
    JOIN student_enrollments se ON se.student_id = s.id
    WHERE se.class_id = 32
      AND se.session_id = 3
      AND se.status = 'active'
  ) x
  WHERE rn > 1;



  • To remove all marks from all exams for all students, run this on the main server database after taking a backup:

  START TRANSACTION;

  SELECT COUNT(*) AS component_marks FROM exam_subject_component_marks;
  SELECT COUNT(*) AS exam_marks FROM marks_entries;
  SELECT COUNT(*) AS activity_marks FROM marksheet_activity_marks;
  SELECT COUNT(*) AS publications FROM exam_report_publications;

  DELETE FROM exam_subject_component_marks;
  DELETE FROM marksheet_activity_marks;
  DELETE FROM exam_report_publications;
  DELETE FROM marks_entries;

  COMMIT;


  <!-- DELETE PARENT ROLE FROM DUPLICATE TEACHERS -->
  START TRANSACTION;

  DELETE sp
  FROM student_parents sp
  JOIN parents p ON p.id = sp.parent_id
  JOIN users u ON u.id = p.user_id
  WHERE u.phone = '9707172848';

  DELETE p
  FROM parents p
  JOIN users u ON u.id = p.user_id
  WHERE u.phone = '9707172848';

  DELETE ur
  FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN roles r ON r.id = ur.role_id
  WHERE u.phone = '9707172848'
    AND r.name = 'parent';

  COMMIT;
<!-- VERIFY  -->
   SELECT u.id, u.phone, GROUP_CONCAT(r.name ORDER BY r.name) AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.phone = '9707172848'
  GROUP BY u.id, u.phone;

  SELECT p.*
  FROM parents p
  JOIN users u ON u.id = p.user_id
  WHERE u.phone = '9707172848';