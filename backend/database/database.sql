

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
-- CLASSES 
CREATE TABLE classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
ALTER TABLE classes ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
-- SECTIONS 
CREATE TABLE sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT,
    name VARCHAR(10),
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
    UNIQUE KEY unique_class_subject (class_id, subject_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

ALTER TABLE subjects
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
----------PEOPLE TABLES
-- STUDENTS 
CREATE TABLE students (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_no VARCHAR(50) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    dob DATE,
    gender ENUM('male','female','other'),
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE students
ADD COLUMN section_id INT,
ADD CONSTRAINT fk_student_section
FOREIGN KEY (section_id) REFERENCES sections(id);
ALTER TABLE classes
MODIFY is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE students 
ADD COLUMN student_class VARCHAR(50), 
ADD CONSTRAINT fk_students_class 
FOREIGN KEY (student_class) REFERENCES classes(name);

-- PARENTS
CREATE TABLE parents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(120),
    address TEXT
);
-- PARENT_STUDENTS (many children)
CREATE TABLE parent_students (
    parent_id BIGINT,
    student_id BIGINT,
    relationship VARCHAR(50),
    PRIMARY KEY(parent_id, student_id),
    FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
-- TEACHERS 
CREATE TABLE teachers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE,
    name VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(120),
    photo_url TEXT
);
-- STAFF 
CREATE TABLE staff (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150),
    department VARCHAR(100),
    role_type VARCHAR(100)
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

CREATE INDEX idx_enrollment_section ON student_enrollments(section_id);
CREATE INDEX idx_enrollment_status ON student_enrollments(status);
-- TEACHERS ASSIGNMENTS 
CREATE TABLE teacher_class_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT,
    class_id INT,
    section_id INT,
    subject_id INT,
    session_id INT,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(section_id) REFERENCES sections(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(session_id) REFERENCES academic_sessions(id)
);
ALTER TABLE teacher_class_assignments
ADD UNIQUE KEY uniq_teacher_assignment
(
  teacher_id,
  class_id,
  section_id,
  subject_id,
  session_id
);

CREATE INDEX idx_teacher_session
ON teacher_class_assignments(teacher_id, session_id);

CREATE INDEX idx_class_section
ON teacher_class_assignments(class_id, section_id);
---------- ATTENDANCE 
-- ATTENDANCE SESSIONS 
CREATE TABLE attendance_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    class_id INT,
    section_id INT,
    date DATE,
    taken_by BIGINT,
    device_source VARCHAR(50),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(section_id) REFERENCES sections(id)
);
ALTER TABLE attendance_sessions
ADD UNIQUE KEY uniq_daily_attendance
(class_id, section_id, date);
--STUDENT ATTENDANCE
CREATE TABLE student_attendance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attendance_session_id BIGINT,
    student_id BIGINT,
    status ENUM('present','absent','late'),
    FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions(id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    INDEX(student_id)
);

-- EXAMS
CREATE TABLE exams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    session_id INT,
    FOREIGN KEY(session_id) REFERENCES academic_sessions(id)
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
    INDEX(student_id, exam_id)
);

--------------FINANCE

-- INVOICES 
CREATE TABLE invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT,
    total_amount DECIMAL(10,2),
    status ENUM('pending','partial','paid'),
    generated_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
);

ALTER TABLE invoices
ADD COLUMN due_date DATE AFTER total_amount,
ADD COLUMN late_fee DECIMAL(10,2) DEFAULT 0 AFTER due_date,
ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE AFTER late_fee;
-- PAYMENTS 
CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT,
    amount_paid DECIMAL(10,2),
    payment_method VARCHAR(50),
    transaction_ref VARCHAR(100),
    received_by BIGINT,
    approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    INDEX(invoice_id)
);

-- MESSAGING SYSTEM
CREATE TABLE conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('direct','broadcast','class','section'),
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE conversations
ADD COLUMN name VARCHAR(150) NULL AFTER type,
ADD COLUMN class_id INT NULL AFTER name,
ADD COLUMN section_id INT NULL AFTER class_id;

ALTER TABLE conversations
ADD COLUMN last_message_at DATETIME NULL AFTER created_at;

CREATE INDEX idx_last_message ON conversations(last_message_at);

CREATE TABLE conversation_members (
    conversation_id BIGINT,
    user_id BIGINT,
    last_read_at DATETIME NULL AFTER user_id,
    PRIMARY KEY(conversation_id, user_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE conversation_members
ADD COLUMN last_read_at DATETIME NULL AFTER user_id;
INSERT INTO permissions(name)
VALUES ('messages.send'),
       ('messages.view');
CREATE TABLE messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT,
    sender_id BIGINT,
    message TEXT,
    attachment_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);

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