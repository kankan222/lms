

CREATE DATABASE lms;
USE lms;

-- USERS
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(120) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active','inactive','suspended') DEFAULT 'active',
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ROLES
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles(name) VALUES
('super_admin'),
('teacher'),
('student'),
('parent'),
('accounts'),
('staff');

-- USER_ROLES
CREATE TABLE user_roles (
    user_id BIGINT,
    role_id INT,
    PRIMARY KEY(user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
CREATE TABLE user_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,

    device_id VARCHAR(120) NULL,
    device_type VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,

    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
-- PERMISSIONS
CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);
-- ROLE PERMISSIONS
CREATE TABLE role_permissions (
    role_id INT,
    permission_id INT,
    PRIMARY KEY(role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ACADEMIC STRUCTURE

-- ACADEMIC SESSIONS
CREATE TABLE academic_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE
);
INSERT INTO academic_sessions (name, start_date, end_date, is_active) VALUES ("2026-2027", "2026-04-01", "2027-04-01", true);
-- CLASSES 
CREATE TABLE classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    medium SET('English','Assamese') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
-- SECTIONS 
CREATE TABLE sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT,
    name VARCHAR(10),
    medium ENUM('English','Assamese') NOT NULL DEFAULT 'English',
    FOREIGN KEY (class_id) REFERENCES classes(id)
);
-- SUBJECTS 
CREATE TABLE subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    code VARCHAR(20)
);

CREATE TABLE class_subjects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_class_subject (class_id, subject_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);
CREATE TABLE streams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE
);

INSERT INTO streams(name)
VALUES ('Arts'),('Science'),('Commerce');
----------PEOPLE TABLES
-- STUDENTS 
CREATE TABLE students (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    admission_no VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,

    dob DATE,
    gender ENUM('male','female','other'),

    date_of_admission DATE,
    mobile VARCHAR(20),

    caste VARCHAR(50),
    religion VARCHAR(50),
    nationality VARCHAR(50),
    mother_tongue VARCHAR(50),
    category VARCHAR(50),

    blood_group VARCHAR(10),
    identification_mark VARCHAR(150),

    disability TEXT,
    medical_information TEXT,

    last_school_attended VARCHAR(200),

    photo_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- STUDENT ENROLLMENT
CREATE TABLE student_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT,
    class_id INT,
    section_id INT,
    session_id INT,
    roll_number INT,
    start_date DATE,
    end_date DATE,
    status ENUM('active','completed','transferred'),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(section_id) REFERENCES sections(id),
    FOREIGN KEY(session_id) REFERENCES academic_sessions(id),
    INDEX(student_id, session_id)
);
ALTER TABLE student_enrollments
ADD COLUMN stream_id INT NULL AFTER class_id,
ADD FOREIGN KEY (stream_id) REFERENCES streams(id);
CREATE INDEX idx_enrollment_section ON student_enrollments(section_id);
CREATE INDEX idx_enrollment_status ON student_enrollments(status);

CREATE TABLE addresses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    district VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    pin_code VARCHAR(10)
);
-- PARENTS
CREATE TABLE parents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNIQUE NOT NULL,

    name VARCHAR(150),
    qualification VARCHAR(150),
    occupation VARCHAR(150),

    mobile VARCHAR(20),
    email VARCHAR(120),`r`n    class_scope ENUM('school','hs') NOT NULL DEFAULT 'school',

    address_id BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id)
);
-- PARENT_STUDENTS (many children)
CREATE TABLE student_parents (
    student_id BIGINT,
    parent_id BIGINT,
    relationship ENUM('father','mother','guardian'),

    PRIMARY KEY(student_id,parent_id),

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
);

CREATE TABLE student_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    student_id BIGINT,
    type ENUM('id_card','report','receipt'),

    file_url TEXT,
    uploaded_by BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id)
);
-- TEACHERS 
CREATE TABLE teachers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE,
    name VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(120),`r`n    class_scope ENUM('school','hs') NOT NULL DEFAULT 'school',
    photo_url TEXT,
);
ALTER TABLE teachers
ADD COLUMN user_id BIGINT UNIQUE,
ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- STAFF 
CREATE TABLE staff (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    image_url VARCHAR(500),
    name VARCHAR(150) NOT NULL,
    title VARCHAR(50) NOT NULL DEFAULT 'HEADSTAFF',
    type ENUM('school','college') NOT NULL DEFAULT 'school',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- TEACHERS ASSIGNMENTS 
CREATE TABLE teacher_class_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    class_id INT NOT NULL,
    section_id INT NOT NULL,
    subject_id INT NOT NULL,
    session_id INT NOT NULL,

    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (section_id) REFERENCES sections(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id),

    UNIQUE KEY uniq_teacher_assignment (
        teacher_id,
        class_id,
        section_id,
        subject_id,
        session_id
    )
);

CREATE INDEX idx_teacher_session
ON teacher_class_assignments(teacher_id, session_id);

CREATE INDEX idx_class_section
ON teacher_class_assignments(class_id, section_id);

---------- ATTENDANCE 
-- ATTENDANCE DEVICES
CREATE TABLE attendance_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(100) UNIQUE,
    device_name VARCHAR(100),
    location VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ATTENDANCE LOGS
CREATE TABLE teacher_attendance_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    device_id BIGINT,
    punch_time DATETIME NOT NULL,
    punch_type ENUM('in','out','unknown') DEFAULT 'unknown',

    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (device_id) REFERENCES attendance_devices(id),

    INDEX idx_teacher_time (teacher_id, punch_time)
);
-- DAILY ATTENDANCE 
CREATE TABLE teacher_daily_attendance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    attendance_date DATE NOT NULL,

    check_in DATETIME,
    check_out DATETIME,

    status ENUM(
        'present',
        'late',
        'half_day',
        'absent'
    ) DEFAULT 'present',

    worked_hours DECIMAL(5,2),

    FOREIGN KEY (teacher_id) REFERENCES teachers(id),

    UNIQUE KEY uniq_teacher_day (teacher_id, attendance_date),

    INDEX idx_teacher_date (teacher_id, attendance_date)
);
INSERT INTO teacher_daily_attendance (teacher_id, attendance_date, check_in, check_out, status) VALUES ("14", "2026-05-03", "2026-05-03", "2026-05-03", "present");
-- EXAMS
CREATE TABLE exams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    session_id INT,
    class_id INT,
    section_id INT,
    created_by BIGINT,
    FOREIGN KEY(session_id) REFERENCES academic_sessions(id)
);
CREATE TABLE exam_scopes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    class_id INT NOT NULL,
    section_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_exam_scope (exam_id, class_id, section_id),
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(section_id) REFERENCES sections(id)
);
CREATE TABLE exam_subjects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    subject_id INT NOT NULL,
    max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
    pass_marks DECIMAL(6,2) NOT NULL DEFAULT 33,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_exam_subject (exam_id, subject_id),
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);
-- MARKS ENTRIES 
CREATE TABLE marks_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT,
    exam_id BIGINT,
    subject_id INT,
    marks DECIMAL(5,2),
    entered_by BIGINT,
    approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by BIGINT,
    approved_at DATETIME,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(exam_id) REFERENCES exams(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    UNIQUE KEY uniq_student_exam_subject (student_id, exam_id, subject_id),
    INDEX(student_id, exam_id)
);

--------------FINANCE

-- -- INVOICES 
-- CREATE TABLE invoices (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     student_id BIGINT,
--     total_amount DECIMAL(10,2),
--     status ENUM('pending','partial','paid'),
--     generated_by BIGINT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY(student_id) REFERENCES students(id)
-- );

-- ALTER TABLE invoices
-- ADD COLUMN due_date DATE AFTER total_amount,
-- ADD COLUMN late_fee DECIMAL(10,2) DEFAULT 0 AFTER due_date,
-- ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE AFTER late_fee;
-- -- PAYMENTS 
-- CREATE TABLE payments (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     invoice_id BIGINT,
--     amount_paid DECIMAL(10,2),
--     payment_method VARCHAR(50),
--     transaction_ref VARCHAR(100),
--     received_by BIGINT,
--     approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY(invoice_id) REFERENCES invoices(id),
--     INDEX(invoice_id)
-- );

-- MESSAGING SYSTEM
-- CREATE TABLE conversations (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     type ENUM('direct','broadcast','class','section'),
--     created_by BIGINT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- ALTER TABLE conversations
-- ADD COLUMN name VARCHAR(150) NULL AFTER type,
-- ADD COLUMN class_id INT NULL AFTER name,
-- ADD COLUMN section_id INT NULL AFTER class_id;

-- ALTER TABLE conversations
-- ADD COLUMN last_message_at DATETIME NULL AFTER created_at;

-- CREATE INDEX idx_last_message ON conversations(last_message_at);

-- CREATE TABLE conversation_members (
--     conversation_id BIGINT,
--     user_id BIGINT,
--     last_read_at DATETIME NULL AFTER user_id,
--     PRIMARY KEY(conversation_id, user_id),
--     FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
--     FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- ALTER TABLE conversation_members
-- ADD COLUMN last_read_at DATETIME NULL AFTER user_id;
-- INSERT INTO permissions(name)
-- VALUES ('messages.send'),
--        ('messages.view');
-- CREATE TABLE messages (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     conversation_id BIGINT,
--     sender_id BIGINT,
--     message TEXT,
--     attachment_url TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY(conversation_id) REFERENCES conversations(id)
-- );
-- CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
-- CREATE INDEX idx_messages_sender ON messages(sender_id);

-- NOTIFICATIONS 
CREATE TABLE notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    title VARCHAR(255),
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(user_id, is_read)
);

ALTER TABLE notifications
ADD COLUMN type VARCHAR(50) AFTER user_id,
ADD COLUMN entity_type VARCHAR(50) AFTER type,
ADD COLUMN entity_id BIGINT AFTER entity_type,
ADD COLUMN read_at DATETIME NULL AFTER is_read;

CREATE INDEX idx_user_read ON notifications(user_id, is_read);

INSERT INTO permissions(name)
VALUES ('notifications.view');
-- UNIVERSAL APPROVAL SYSTEM
CREATE TABLE approvals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    submitted_by BIGINT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by BIGINT,
    approved_at DATETIME,
    remarks TEXT
);

-- FILE STORAGE
CREATE TABLE files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(50),
    owner_id BIGINT,
    file_url TEXT,
    file_type VARCHAR(50),
    uploaded_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ACTIVITY LOGS
CREATE TABLE activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(255),
    entity_type VARCHAR(50),
    entity_id BIGINT,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(entity_type, entity_id)
);

