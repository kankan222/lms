ALTER TABLE marks_entries
  MODIFY COLUMN approval_status ENUM('draft', 'pending', 'approved', 'rejected')
  NOT NULL DEFAULT 'draft';
