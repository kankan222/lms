-- Fee Categories
CREATE TABLE fee_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO fee_categories (name)
VALUES
('Tuition'),
('Transport'),
('Library'),
('Sports'),
('Other');
-- Fee Structures (Per Class Per Year)
CREATE TABLE fee_structures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    session_id INT NOT NULL,

    admission_fee DECIMAL(10,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_class_session (class_id, session_id),

    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
);
-- Installment Definitions
CREATE TABLE fee_installments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fee_structure_id INT NOT NULL,
    installment_name VARCHAR(50),
    amount DECIMAL(10,2),
    due_date DATE,

    FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id)
);

CREATE TABLE student_fees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    installment_id INT,
    fee_type ENUM('admission','installment'),

    amount DECIMAL(10,2),
    status ENUM('pending','partial','paid') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id)
);

CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    student_fee_id BIGINT NOT NULL,
    amount_paid DECIMAL(10,2),

    remarks TEXT,

    status ENUM('pending','approved','rejected') DEFAULT 'pending',

    created_by BIGINT,
    approved_by BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,

    FOREIGN KEY (student_fee_id) REFERENCES student_fees(id)
);

CREATE TABLE fee_receipts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    receipt_no VARCHAR(50) UNIQUE,

    payment_id BIGINT NOT NULL,

    status ENUM('pending','approved','rejected') DEFAULT 'pending',

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id) REFERENCES payments(id)
);





CREATE TABLE messaging_permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    can_send_message BOOLEAN DEFAULT FALSE,
    approved_by BIGINT,
    approved_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('direct','class','section','broadcast') NOT NULL,
    name VARCHAR(150),
    class_id INT,
    section_id INT,
    created_by BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME NULL,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
);
CREATE TABLE conversation_members (
    conversation_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    last_read_at DATETIME NULL,

    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE conversation_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    recipient_type ENUM('user','class','section','all') NOT NULL,
    recipient_id BIGINT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id BIGINT NOT NULL,
    message TEXT,
    attachment_url TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE message_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    file_name VARCHAR(255),
    file_url VARCHAR(500),
    file_type VARCHAR(100),
    file_size INT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE TABLE message_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    status ENUM('sent','delivered','read') DEFAULT 'sent',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_message_user (message_id, user_id),

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);
CREATE INDEX idx_conversations_scope ON conversations(type, class_id, section_id);
CREATE INDEX idx_members_user ON conversation_members(user_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
