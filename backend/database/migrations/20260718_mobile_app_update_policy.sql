CREATE TABLE IF NOT EXISTS mobile_app_update_policy (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  platform ENUM('android', 'ios') NOT NULL,
  latest_version VARCHAR(32) NOT NULL DEFAULT '1.1.4',
  latest_build INT NULL,
  minimum_version VARCHAR(32) NOT NULL DEFAULT '1.1.4',
  minimum_build INT NULL,
  store_url VARCHAR(500) NULL,
  title VARCHAR(160) NOT NULL DEFAULT 'App update available',
  message TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_mobile_app_update_policy_platform (platform)
);

INSERT IGNORE INTO mobile_app_update_policy
  (platform, latest_version, latest_build, minimum_version, minimum_build, title, message, is_active)
VALUES
  ('android', '1.1.4', 26, '1.1.4', 26, 'App update available', 'A newer version of the app is available.', TRUE),
  ('ios', '1.1.4', NULL, '1.1.4', NULL, 'App update available', 'A newer version of the app is available.', TRUE);
