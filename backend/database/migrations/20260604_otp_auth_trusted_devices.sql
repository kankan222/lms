CREATE TABLE IF NOT EXISTS auth_trusted_devices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_id VARCHAR(120) NOT NULL,
  device_type VARCHAR(50) NULL,
  first_trusted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_ip VARCHAR(45) NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_trusted_devices_user_device (user_id, device_id),
  KEY idx_auth_trusted_devices_user (user_id),
  CONSTRAINT fk_auth_trusted_devices_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
  id VARCHAR(36) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role_name VARCHAR(50) NULL,
  otp_template_id VARCHAR(120) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  device_id VARCHAR(120) NULL,
  device_type VARCHAR(50) NULL,
  ip_address VARCHAR(45) NULL,
  reason VARCHAR(80) NULL,
  expires_at DATETIME NOT NULL,
  resend_count INT NOT NULL DEFAULT 0,
  last_sent_at DATETIME NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  blocked_until DATETIME NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_auth_otp_user_created (user_id, created_at),
  KEY idx_auth_otp_user_blocked (user_id, blocked_until),
  KEY idx_auth_otp_expires (expires_at),
  CONSTRAINT fk_auth_otp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_login_failures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_id VARCHAR(120) NULL,
  device_type VARCHAR(50) NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auth_login_failures_user_created (user_id, created_at),
  CONSTRAINT fk_auth_login_failures_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
