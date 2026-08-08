ALTER TABLE announcements
  ADD COLUMN root_announcement_id BIGINT NULL AFTER id,
  ADD COLUMN version_number INT NOT NULL DEFAULT 1 AFTER root_announcement_id,
  ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 1 AFTER version_number,
  ADD COLUMN archived_at DATETIME NULL AFTER cancelled_at,
  ADD KEY idx_announcements_root_version (root_announcement_id, version_number),
  ADD KEY idx_announcements_current (is_current, status),
  ADD CONSTRAINT fk_announcements_root
    FOREIGN KEY (root_announcement_id) REFERENCES announcements(id)
    ON DELETE SET NULL;

UPDATE announcements
SET root_announcement_id = id
WHERE root_announcement_id IS NULL;
