-- Full demo dataset for LMS (realistic names/use-cases)
-- Safe to re-run (uses INSERT IGNORE or NOT EXISTS guards where possible)

USE lms;

-- Reuse existing admin password hash for all seeded users
SET @pwd_hash = (
  SELECT password_hash
  FROM users
  WHERE username = 'admin'
  LIMIT 1
);

-- ------------------------------------------------------------------
-- 1) Academic sessions
-- ------------------------------------------------------------------
INSERT INTO academic_sessions (name, start_date, end_date, is_active)
SELECT '2025-2026', '2025-04-01', '2026-03-31', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM academic_sessions WHERE name = '2025-2026'
);

INSERT INTO academic_sessions (name, start_date, end_date, is_active)
SELECT '2026-2027', '2026-04-01', '2027-03-31', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM academic_sessions WHERE name = '2026-2027'
);

SET @active_session = (
  SELECT id FROM academic_sessions WHERE is_active = TRUE ORDER BY id DESC LIMIT 1
);

-- ------------------------------------------------------------------
-- 2) Core users (admin/staff/accounts/teachers/parents)
-- ------------------------------------------------------------------
INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'accounts.ronit', 'ronit.mehta@kkv.edu.in', '9001002001', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'ronit.mehta@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'staff.nandita', 'nandita.sen@kkv.edu.in', '9001002002', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'nandita.sen@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'teacher.ananya', 'ananya.sharma@kkv.edu.in', '9001003001', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'ananya.sharma@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'teacher.rakesh', 'rakesh.das@kkv.edu.in', '9001003002', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'rakesh.das@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'teacher.priyanka', 'priyanka.gogoi@kkv.edu.in', '9001003003', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'priyanka.gogoi@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'teacher.amit', 'amit.baruah@kkv.edu.in', '9001003004', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'amit.baruah@kkv.edu.in');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.rahul', 'rahul.bora@gmail.com', '9001004001', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'rahul.bora@gmail.com');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.sonali', 'sonali.bora@gmail.com', '9001004002', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sonali.bora@gmail.com');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.bikash', 'bikash.deka@gmail.com', '9001004003', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'bikash.deka@gmail.com');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.anjali', 'anjali.deka@gmail.com', '9001004004', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'anjali.deka@gmail.com');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.sudip', 'sudip.kalita@gmail.com', '9001004005', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sudip.kalita@gmail.com');

INSERT INTO users (username, email, phone, password_hash, status)
SELECT 'parent.nibedita', 'nibedita.kalita@gmail.com', '9001004006', @pwd_hash, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'nibedita.kalita@gmail.com');

-- ------------------------------------------------------------------
-- 3) Roles for seeded users
-- ------------------------------------------------------------------
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'accounts'
WHERE u.email = 'ronit.mehta@kkv.edu.in';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'staff'
WHERE u.email = 'nandita.sen@kkv.edu.in';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'teacher'
WHERE u.email IN (
  'ananya.sharma@kkv.edu.in',
  'rakesh.das@kkv.edu.in',
  'priyanka.gogoi@kkv.edu.in',
  'amit.baruah@kkv.edu.in'
);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'parent'
WHERE u.email IN (
  'rahul.bora@gmail.com',
  'sonali.bora@gmail.com',
  'bikash.deka@gmail.com',
  'anjali.deka@gmail.com',
  'sudip.kalita@gmail.com',
  'nibedita.kalita@gmail.com'
);

-- ------------------------------------------------------------------
-- 4) Classes, sections, subjects
-- ------------------------------------------------------------------
INSERT INTO classes (name, medium, is_active)
SELECT 'VIII', 'English,Assamese', TRUE
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name='VIII' AND is_active=TRUE);

INSERT INTO classes (name, medium, is_active)
SELECT 'IX', 'English,Assamese', TRUE
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name='IX' AND is_active=TRUE);

INSERT INTO classes (name, medium, is_active)
SELECT 'X', 'English,Assamese', TRUE
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name='X' AND is_active=TRUE);

SET @class_viii = (SELECT id FROM classes WHERE name='VIII' ORDER BY id DESC LIMIT 1);
SET @class_ix   = (SELECT id FROM classes WHERE name='IX' ORDER BY id DESC LIMIT 1);
SET @class_x    = (SELECT id FROM classes WHERE name='X' ORDER BY id DESC LIMIT 1);

INSERT INTO sections (class_id, name, medium)
SELECT @class_viii, 'A', 'English'
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id=@class_viii AND name='A');
INSERT INTO sections (class_id, name, medium)
SELECT @class_viii, 'B', 'Assamese'
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id=@class_viii AND name='B');
INSERT INTO sections (class_id, name, medium)
SELECT @class_ix, 'A', 'English'
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id=@class_ix AND name='A');
INSERT INTO sections (class_id, name, medium)
SELECT @class_ix, 'B', 'Assamese'
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id=@class_ix AND name='B');
INSERT INTO sections (class_id, name, medium)
SELECT @class_x, 'A', 'English'
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE class_id=@class_x AND name='A');

SET @sec_viii_a = (SELECT id FROM sections WHERE class_id=@class_viii AND name='A' LIMIT 1);
SET @sec_viii_b = (SELECT id FROM sections WHERE class_id=@class_viii AND name='B' LIMIT 1);
SET @sec_ix_a   = (SELECT id FROM sections WHERE class_id=@class_ix AND name='A' LIMIT 1);
SET @sec_ix_b   = (SELECT id FROM sections WHERE class_id=@class_ix AND name='B' LIMIT 1);
SET @sec_x_a    = (SELECT id FROM sections WHERE class_id=@class_x AND name='A' LIMIT 1);

INSERT INTO subjects (name, code)
SELECT 'Social Studies', 'SST'
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name='Social Studies');
INSERT INTO subjects (name, code)
SELECT 'Computer Applications', 'COMP'
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name='Computer Applications');

SET @sub_math     = (SELECT id FROM subjects WHERE name='Mathematics' LIMIT 1);
SET @sub_science  = (SELECT id FROM subjects WHERE name='Science' LIMIT 1);
SET @sub_english  = (SELECT id FROM subjects WHERE name='English' LIMIT 1);
SET @sub_assamese = (SELECT id FROM subjects WHERE name='Assamese' LIMIT 1);
SET @sub_sst      = (SELECT id FROM subjects WHERE name='Social Studies' LIMIT 1);
SET @sub_comp     = (SELECT id FROM subjects WHERE name='Computer Applications' LIMIT 1);

INSERT IGNORE INTO class_subjects (class_id, subject_id, is_active)
SELECT @class_viii, @sub_math, TRUE UNION ALL
SELECT @class_viii, @sub_science, TRUE UNION ALL
SELECT @class_viii, @sub_english, TRUE UNION ALL
SELECT @class_viii, @sub_assamese, TRUE UNION ALL
SELECT @class_viii, @sub_sst, TRUE UNION ALL
SELECT @class_ix, @sub_math, TRUE UNION ALL
SELECT @class_ix, @sub_science, TRUE UNION ALL
SELECT @class_ix, @sub_english, TRUE UNION ALL
SELECT @class_ix, @sub_assamese, TRUE UNION ALL
SELECT @class_ix, @sub_sst, TRUE UNION ALL
SELECT @class_x, @sub_math, TRUE UNION ALL
SELECT @class_x, @sub_science, TRUE UNION ALL
SELECT @class_x, @sub_english, TRUE UNION ALL
SELECT @class_x, @sub_assamese, TRUE UNION ALL
SELECT @class_x, @sub_sst, TRUE UNION ALL
SELECT @class_x, @sub_comp, TRUE;

-- ------------------------------------------------------------------
-- 5) Teacher profiles + assignments
-- ------------------------------------------------------------------
INSERT INTO teachers (employee_id, name, phone, email, user_id)
SELECT 'T-1001', 'Ananya Sharma', '9001003001', 'ananya.sharma@kkv.edu.in', u.id
FROM users u
WHERE u.email='ananya.sharma@kkv.edu.in'
  AND NOT EXISTS (SELECT 1 FROM teachers WHERE employee_id='T-1001');

INSERT INTO teachers (employee_id, name, phone, email, user_id)
SELECT 'T-1002', 'Rakesh Das', '9001003002', 'rakesh.das@kkv.edu.in', u.id
FROM users u
WHERE u.email='rakesh.das@kkv.edu.in'
  AND NOT EXISTS (SELECT 1 FROM teachers WHERE employee_id='T-1002');

INSERT INTO teachers (employee_id, name, phone, email, user_id)
SELECT 'T-1003', 'Priyanka Gogoi', '9001003003', 'priyanka.gogoi@kkv.edu.in', u.id
FROM users u
WHERE u.email='priyanka.gogoi@kkv.edu.in'
  AND NOT EXISTS (SELECT 1 FROM teachers WHERE employee_id='T-1003');

INSERT INTO teachers (employee_id, name, phone, email, user_id)
SELECT 'T-1004', 'Amit Baruah', '9001003004', 'amit.baruah@kkv.edu.in', u.id
FROM users u
WHERE u.email='amit.baruah@kkv.edu.in'
  AND NOT EXISTS (SELECT 1 FROM teachers WHERE employee_id='T-1004');

SET @t_ananya   = (SELECT id FROM teachers WHERE employee_id='T-1001' LIMIT 1);
SET @t_rakesh   = (SELECT id FROM teachers WHERE employee_id='T-1002' LIMIT 1);
SET @t_priyanka = (SELECT id FROM teachers WHERE employee_id='T-1003' LIMIT 1);
SET @t_amit     = (SELECT id FROM teachers WHERE employee_id='T-1004' LIMIT 1);

INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_ananya, @class_viii, @sec_viii_a, @sub_english, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_ananya AND class_id=@class_viii AND section_id=@sec_viii_a
    AND subject_id=@sub_english AND session_id=@active_session
);
INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_ananya, @class_viii, @sec_viii_b, @sub_english, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_ananya AND class_id=@class_viii AND section_id=@sec_viii_b
    AND subject_id=@sub_english AND session_id=@active_session
);
INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_rakesh, @class_viii, @sec_viii_a, @sub_math, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_rakesh AND class_id=@class_viii AND section_id=@sec_viii_a
    AND subject_id=@sub_math AND session_id=@active_session
);
INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_priyanka, @class_viii, @sec_viii_a, @sub_science, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_priyanka AND class_id=@class_viii AND section_id=@sec_viii_a
    AND subject_id=@sub_science AND session_id=@active_session
);
INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_amit, @class_viii, @sec_viii_a, @sub_assamese, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_amit AND class_id=@class_viii AND section_id=@sec_viii_a
    AND subject_id=@sub_assamese AND session_id=@active_session
);
INSERT INTO teacher_class_assignments (teacher_id, class_id, section_id, subject_id, session_id)
SELECT @t_rakesh, @class_ix, @sec_ix_a, @sub_math, @active_session
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_class_assignments
  WHERE teacher_id=@t_rakesh AND class_id=@class_ix AND section_id=@sec_ix_a
    AND subject_id=@sub_math AND session_id=@active_session
);

-- ------------------------------------------------------------------
-- 6) Parent profiles
-- ------------------------------------------------------------------
INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Rahul Bora', 'B.Com', 'Bank Officer', '9001004001', 'rahul.bora@gmail.com'
FROM users u
WHERE u.email='rahul.bora@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Sonali Bora', 'M.A', 'School Counselor', '9001004002', 'sonali.bora@gmail.com'
FROM users u
WHERE u.email='sonali.bora@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Bikash Deka', 'B.Sc', 'Civil Engineer', '9001004003', 'bikash.deka@gmail.com'
FROM users u
WHERE u.email='bikash.deka@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Anjali Deka', 'B.Ed', 'Teacher', '9001004004', 'anjali.deka@gmail.com'
FROM users u
WHERE u.email='anjali.deka@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Sudip Kalita', 'MBA', 'Business Owner', '9001004005', 'sudip.kalita@gmail.com'
FROM users u
WHERE u.email='sudip.kalita@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

INSERT INTO parents (user_id, name, qualification, occupation, mobile, email)
SELECT u.id, 'Nibedita Kalita', 'M.Sc', 'Data Analyst', '9001004006', 'nibedita.kalita@gmail.com'
FROM users u
WHERE u.email='nibedita.kalita@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM parents WHERE user_id=u.id);

SET @p_rahul   = (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='rahul.bora@gmail.com' LIMIT 1);
SET @p_sonali  = (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='sonali.bora@gmail.com' LIMIT 1);
SET @p_bikash  = (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='bikash.deka@gmail.com' LIMIT 1);
SET @p_anjali  = (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='anjali.deka@gmail.com' LIMIT 1);
SET @p_sudip   = (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='sudip.kalita@gmail.com' LIMIT 1);
SET @p_nibedita= (SELECT p.id FROM parents p JOIN users u ON u.id=p.user_id WHERE u.email='nibedita.kalita@gmail.com' LIMIT 1);

-- ------------------------------------------------------------------
-- 7) Students + enrollment + parents map
-- ------------------------------------------------------------------
INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-001', 'Aarav Bora', '2012-05-14', 'male', '2026-04-04', '9876001101', 'Indian', 'Assamese', 'B+', 'Hindu', 'General'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-001');

INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-002', 'Ishita Bora', '2012-11-02', 'female', '2026-04-04', '9876001102', 'Indian', 'Assamese', 'A+', 'Hindu', 'General'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-002');

INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-003', 'Ritwik Deka', '2011-08-19', 'male', '2026-04-05', '9876001103', 'Indian', 'Assamese', 'O+', 'Hindu', 'General'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-003');

INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-004', 'Megha Deka', '2011-09-25', 'female', '2026-04-05', '9876001104', 'Indian', 'Assamese', 'AB+', 'Hindu', 'General'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-004');

INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-005', 'Parth Kalita', '2010-02-09', 'male', '2026-04-06', '9876001105', 'Indian', 'Assamese', 'A-', 'Hindu', 'OBC'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-005');

INSERT INTO students
(admission_no, name, dob, gender, date_of_admission, mobile, nationality, mother_tongue, blood_group, religion, category)
SELECT 'KKV-2026-006', 'Diya Kalita', '2010-12-17', 'female', '2026-04-06', '9876001106', 'Indian', 'Assamese', 'B-', 'Hindu', 'OBC'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE admission_no='KKV-2026-006');

SET @s_aarav = (SELECT id FROM students WHERE admission_no='KKV-2026-001' LIMIT 1);
SET @s_ishita= (SELECT id FROM students WHERE admission_no='KKV-2026-002' LIMIT 1);
SET @s_ritwik= (SELECT id FROM students WHERE admission_no='KKV-2026-003' LIMIT 1);
SET @s_megha = (SELECT id FROM students WHERE admission_no='KKV-2026-004' LIMIT 1);
SET @s_parth = (SELECT id FROM students WHERE admission_no='KKV-2026-005' LIMIT 1);
SET @s_diya  = (SELECT id FROM students WHERE admission_no='KKV-2026-006' LIMIT 1);

INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_aarav, @class_viii, @sec_viii_a, @active_session, NULL, 1, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_aarav AND session_id=@active_session AND status='active'
);
INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_ishita, @class_viii, @sec_viii_a, @active_session, NULL, 2, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_ishita AND session_id=@active_session AND status='active'
);
INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_ritwik, @class_viii, @sec_viii_b, @active_session, NULL, 1, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_ritwik AND session_id=@active_session AND status='active'
);
INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_megha, @class_ix, @sec_ix_a, @active_session, NULL, 1, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_megha AND session_id=@active_session AND status='active'
);
INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_parth, @class_x, @sec_x_a, @active_session, 2, 1, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_parth AND session_id=@active_session AND status='active'
);
INSERT INTO student_enrollments
(student_id, class_id, section_id, session_id, stream_id, roll_number, start_date, status)
SELECT @s_diya, @class_x, @sec_x_a, @active_session, 2, 2, '2026-04-10', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_enrollments WHERE student_id=@s_diya AND session_id=@active_session AND status='active'
);

INSERT IGNORE INTO student_parents (student_id, parent_id, relationship) VALUES
(@s_aarav, @p_rahul, 'father'),
(@s_aarav, @p_sonali, 'mother'),
(@s_ishita, @p_rahul, 'father'),
(@s_ishita, @p_sonali, 'mother'),
(@s_ritwik, @p_bikash, 'father'),
(@s_ritwik, @p_anjali, 'mother'),
(@s_megha, @p_bikash, 'father'),
(@s_megha, @p_anjali, 'mother'),
(@s_parth, @p_sudip, 'father'),
(@s_parth, @p_nibedita, 'mother'),
(@s_diya, @p_sudip, 'father'),
(@s_diya, @p_nibedita, 'mother');

-- ------------------------------------------------------------------
-- 8) Fees, student fees, payments, receipts
-- ------------------------------------------------------------------
INSERT INTO fee_structures (class_id, session_id, admission_fee)
SELECT @class_viii, @active_session, 2500
WHERE NOT EXISTS (SELECT 1 FROM fee_structures WHERE class_id=@class_viii AND session_id=@active_session);
INSERT INTO fee_structures (class_id, session_id, admission_fee)
SELECT @class_ix, @active_session, 3000
WHERE NOT EXISTS (SELECT 1 FROM fee_structures WHERE class_id=@class_ix AND session_id=@active_session);
INSERT INTO fee_structures (class_id, session_id, admission_fee)
SELECT @class_x, @active_session, 3500
WHERE NOT EXISTS (SELECT 1 FROM fee_structures WHERE class_id=@class_x AND session_id=@active_session);

SET @fs_viii = (SELECT id FROM fee_structures WHERE class_id=@class_viii AND session_id=@active_session LIMIT 1);
SET @fs_ix   = (SELECT id FROM fee_structures WHERE class_id=@class_ix AND session_id=@active_session LIMIT 1);
SET @fs_x    = (SELECT id FROM fee_structures WHERE class_id=@class_x AND session_id=@active_session LIMIT 1);

INSERT INTO fee_installments (fee_structure_id, installment_name, amount, due_date)
SELECT @fs_viii, 'Quarter 1', 4500, '2026-06-15'
WHERE NOT EXISTS (SELECT 1 FROM fee_installments WHERE fee_structure_id=@fs_viii AND installment_name='Quarter 1');
INSERT INTO fee_installments (fee_structure_id, installment_name, amount, due_date)
SELECT @fs_viii, 'Quarter 2', 4500, '2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM fee_installments WHERE fee_structure_id=@fs_viii AND installment_name='Quarter 2');
INSERT INTO fee_installments (fee_structure_id, installment_name, amount, due_date)
SELECT @fs_x, 'Quarter 1', 5500, '2026-06-20'
WHERE NOT EXISTS (SELECT 1 FROM fee_installments WHERE fee_structure_id=@fs_x AND installment_name='Quarter 1');

SET @admin_user = (SELECT id FROM users WHERE username='admin' LIMIT 1);

-- create student_fee rows (admission + installment) for selected students
INSERT INTO student_fees (enrollment_id, installment_id, fee_type, amount, status)
SELECT se.id, NULL, 'admission', 2500, 'paid'
FROM student_enrollments se
WHERE se.student_id=@s_aarav AND se.session_id=@active_session
  AND NOT EXISTS (
    SELECT 1 FROM student_fees sf
    WHERE sf.enrollment_id=se.id AND sf.fee_type='admission'
  );

INSERT INTO student_fees (enrollment_id, installment_id, fee_type, amount, status)
SELECT se.id, fi.id, 'installment', fi.amount, 'partial'
FROM student_enrollments se
JOIN fee_structures fs ON fs.class_id=se.class_id AND fs.session_id=se.session_id
JOIN fee_installments fi ON fi.fee_structure_id=fs.id AND fi.installment_name='Quarter 1'
WHERE se.student_id IN (@s_aarav, @s_ishita, @s_ritwik, @s_parth)
  AND se.session_id=@active_session
  AND NOT EXISTS (
    SELECT 1 FROM student_fees sf
    WHERE sf.enrollment_id=se.id AND sf.installment_id=fi.id
  );

-- payment entries
INSERT INTO payments (student_fee_id, amount_paid, remarks, status, created_by, approved_by, approved_at)
SELECT sf.id, 2500, 'Admission paid at counter', 'approved', @admin_user, @admin_user, NOW()
FROM student_fees sf
JOIN student_enrollments se ON se.id=sf.enrollment_id
WHERE se.student_id=@s_aarav AND sf.fee_type='admission'
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.student_fee_id=sf.id
  );

INSERT INTO payments (student_fee_id, amount_paid, remarks, status, created_by)
SELECT sf.id, 2000, 'Part payment via UPI', 'pending', @admin_user
FROM student_fees sf
JOIN student_enrollments se ON se.id=sf.enrollment_id
WHERE se.student_id=@s_ishita AND sf.fee_type='installment'
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.student_fee_id=sf.id
  );

INSERT INTO fee_receipts (receipt_no, payment_id, status)
SELECT CONCAT('RCPT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', p.id), p.id, p.status
FROM payments p
WHERE p.status='approved'
  AND NOT EXISTS (
    SELECT 1 FROM fee_receipts fr WHERE fr.payment_id=p.id
  );

-- ------------------------------------------------------------------
-- 9) Messaging
-- ------------------------------------------------------------------
INSERT IGNORE INTO messaging_permissions (user_id, can_send_message, approved_by, approved_at)
SELECT u.id, TRUE, @admin_user, NOW()
FROM users u;

-- direct conversation: admin <-> Ananya
INSERT INTO conversations (type, name, class_id, section_id, created_by, created_at, last_message_at)
SELECT 'direct', 'Admin - Ananya (Direct)', NULL, NULL, @admin_user, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.type='direct' AND c.name='Admin - Ananya (Direct)'
);

SET @conv_direct = (
  SELECT c.id
  FROM conversations c
  WHERE c.type='direct' AND c.name='Admin - Ananya (Direct)'
  LIMIT 1
);

INSERT IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
SELECT @conv_direct, @admin_user, NOW();
INSERT IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
SELECT @conv_direct, (SELECT user_id FROM teachers WHERE id=@t_ananya), NOW();

INSERT INTO messages (conversation_id, sender_id, message, created_at)
SELECT @conv_direct, @admin_user, 'Please upload the Class VIII A English marks by Friday.', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM messages WHERE conversation_id=@conv_direct
);

-- class conversation: Class VIII A
INSERT INTO conversations (type, name, class_id, section_id, created_by, created_at, last_message_at)
SELECT 'class', 'Class VIII A - Parents & Teachers', @class_viii, @sec_viii_a, @admin_user, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM conversations
  WHERE type='class' AND class_id=@class_viii AND section_id=@sec_viii_a
);

SET @conv_class = (
  SELECT id FROM conversations
  WHERE type='class' AND class_id=@class_viii AND section_id=@sec_viii_a
  ORDER BY id DESC LIMIT 1
);

INSERT IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
SELECT @conv_class, @admin_user, NOW();
INSERT IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
SELECT @conv_class, t.user_id, NOW()
FROM teachers t
WHERE t.id IN (@t_ananya, @t_rakesh, @t_priyanka, @t_amit);
INSERT IGNORE INTO conversation_members (conversation_id, user_id, last_read_at)
SELECT @conv_class, p.user_id, NOW()
FROM parents p
WHERE p.id IN (@p_rahul, @p_sonali);

INSERT INTO messages (conversation_id, sender_id, message, created_at)
SELECT @conv_class, @admin_user, 'Parent-teacher meeting for Class VIII A is scheduled on Saturday at 10:30 AM.', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM messages WHERE conversation_id=@conv_class
);

-- ------------------------------------------------------------------
-- 10) Exams + scopes + subjects + marks
-- ------------------------------------------------------------------
INSERT INTO exams (name, session_id, class_id, section_id, created_by)
SELECT 'First Terminal Examination 2026', @active_session, @class_viii, @sec_viii_a, @admin_user
WHERE NOT EXISTS (
  SELECT 1 FROM exams WHERE name='First Terminal Examination 2026' AND session_id=@active_session
);

INSERT INTO exams (name, session_id, class_id, section_id, created_by)
SELECT 'Half Yearly Examination 2026', @active_session, @class_ix, @sec_ix_a, @admin_user
WHERE NOT EXISTS (
  SELECT 1 FROM exams WHERE name='Half Yearly Examination 2026' AND session_id=@active_session
);

SET @exam_term = (SELECT id FROM exams WHERE name='First Terminal Examination 2026' AND session_id=@active_session LIMIT 1);
SET @exam_half = (SELECT id FROM exams WHERE name='Half Yearly Examination 2026' AND session_id=@active_session LIMIT 1);

INSERT IGNORE INTO exam_scopes (exam_id, class_id, section_id) VALUES
(@exam_term, @class_viii, @sec_viii_a),
(@exam_term, @class_viii, @sec_viii_b),
(@exam_half, @class_ix, @sec_ix_a),
(@exam_half, @class_ix, @sec_ix_b),
(@exam_half, @class_x, @sec_x_a);

INSERT IGNORE INTO exam_subjects (exam_id, subject_id, max_marks, pass_marks) VALUES
(@exam_term, @sub_english, 100, 33),
(@exam_term, @sub_math, 100, 33),
(@exam_term, @sub_science, 100, 33),
(@exam_term, @sub_assamese, 100, 33),
(@exam_half, @sub_english, 100, 33),
(@exam_half, @sub_math, 100, 33),
(@exam_half, @sub_science, 100, 33),
(@exam_half, @sub_assamese, 100, 33),
(@exam_half, @sub_sst, 100, 33);

-- Approved marks for report generation (Class VIII A)
INSERT INTO marks_entries
(student_id, exam_id, subject_id, marks, entered_by, approval_status, approved_by, approved_at)
VALUES
(@s_aarav, @exam_term, @sub_english, 86, (SELECT user_id FROM teachers WHERE id=@t_ananya), 'approved', @admin_user, NOW()),
(@s_aarav, @exam_term, @sub_math, 78, (SELECT user_id FROM teachers WHERE id=@t_rakesh), 'approved', @admin_user, NOW()),
(@s_aarav, @exam_term, @sub_science, 81, (SELECT user_id FROM teachers WHERE id=@t_priyanka), 'approved', @admin_user, NOW()),
(@s_aarav, @exam_term, @sub_assamese, 73, (SELECT user_id FROM teachers WHERE id=@t_amit), 'approved', @admin_user, NOW()),
(@s_ishita, @exam_term, @sub_english, 91, (SELECT user_id FROM teachers WHERE id=@t_ananya), 'approved', @admin_user, NOW()),
(@s_ishita, @exam_term, @sub_math, 88, (SELECT user_id FROM teachers WHERE id=@t_rakesh), 'approved', @admin_user, NOW()),
(@s_ishita, @exam_term, @sub_science, 84, (SELECT user_id FROM teachers WHERE id=@t_priyanka), 'approved', @admin_user, NOW()),
(@s_ishita, @exam_term, @sub_assamese, 79, (SELECT user_id FROM teachers WHERE id=@t_amit), 'approved', @admin_user, NOW())
ON DUPLICATE KEY UPDATE
marks = VALUES(marks),
entered_by = VALUES(entered_by),
approval_status = VALUES(approval_status),
approved_by = VALUES(approved_by),
approved_at = VALUES(approved_at);

-- Pending marks for review flow
INSERT INTO marks_entries
(student_id, exam_id, subject_id, marks, entered_by, approval_status)
VALUES
(@s_ritwik, @exam_term, @sub_math, 67, (SELECT user_id FROM teachers WHERE id=@t_rakesh), 'pending'),
(@s_ritwik, @exam_term, @sub_english, 72, (SELECT user_id FROM teachers WHERE id=@t_ananya), 'pending')
ON DUPLICATE KEY UPDATE
marks = VALUES(marks),
entered_by = VALUES(entered_by),
approval_status = VALUES(approval_status),
approved_by = NULL,
approved_at = NULL;

-- ------------------------------------------------------------------
-- 11) Quick verification snapshot
-- ------------------------------------------------------------------
SELECT 'Seed completed' AS status;
