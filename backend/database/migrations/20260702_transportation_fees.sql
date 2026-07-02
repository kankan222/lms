CREATE TABLE IF NOT EXISTS transport_routes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transport_routes_name (name)
);

CREATE TABLE IF NOT EXISTS transport_stops (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  route_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  distance_km DECIMAL(8,2) NULL,
  monthly_fee DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transport_stops_route_name (route_id, name),
  KEY idx_transport_stops_route (route_id),
  CONSTRAINT fk_transport_stops_route
    FOREIGN KEY (route_id) REFERENCES transport_routes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_transport_assignments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  session_id INT NOT NULL,
  route_id BIGINT NOT NULL,
  stop_id BIGINT NOT NULL,
  monthly_fee DECIMAL(10,2) NOT NULL,
  start_month TINYINT NOT NULL,
  start_year SMALLINT NOT NULL,
  end_month TINYINT NULL,
  end_year SMALLINT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  remarks TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_transport_assignments_student_session (student_id, session_id),
  KEY idx_transport_assignments_route_stop (route_id, stop_id),
  CONSTRAINT fk_transport_assignments_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_assignments_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_assignments_route
    FOREIGN KEY (route_id) REFERENCES transport_routes(id),
  CONSTRAINT fk_transport_assignments_stop
    FOREIGN KEY (stop_id) REFERENCES transport_stops(id),
  CONSTRAINT fk_transport_assignments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_transport_fee_dues (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  assignment_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  session_id INT NOT NULL,
  due_month TINYINT NOT NULL,
  due_year SMALLINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transport_due_assignment_month (assignment_id, due_year, due_month),
  KEY idx_transport_dues_student_session (student_id, session_id),
  KEY idx_transport_dues_status (status),
  CONSTRAINT fk_transport_dues_assignment
    FOREIGN KEY (assignment_id) REFERENCES student_transport_assignments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_dues_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_dues_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transport_payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  session_id INT NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(40) NULL,
  remarks TEXT NULL,
  status ENUM('approved','cancelled') NOT NULL DEFAULT 'approved',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_transport_payments_student_session (student_id, session_id),
  KEY idx_transport_payments_created_at (created_at),
  CONSTRAINT fk_transport_payments_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_payments_session
    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_payments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transport_payment_allocations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  payment_id BIGINT NOT NULL,
  transport_due_id BIGINT NOT NULL,
  amount_applied DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transport_payment_due (payment_id, transport_due_id),
  KEY idx_transport_allocations_due (transport_due_id),
  CONSTRAINT fk_transport_allocations_payment
    FOREIGN KEY (payment_id) REFERENCES transport_payments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transport_allocations_due
    FOREIGN KEY (transport_due_id) REFERENCES student_transport_fee_dues(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transport_receipts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  receipt_no VARCHAR(50) NOT NULL UNIQUE,
  payment_id BIGINT NOT NULL UNIQUE,
  status ENUM('issued','cancelled') NOT NULL DEFAULT 'issued',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transport_receipts_payment
    FOREIGN KEY (payment_id) REFERENCES transport_payments(id)
    ON DELETE CASCADE
);
