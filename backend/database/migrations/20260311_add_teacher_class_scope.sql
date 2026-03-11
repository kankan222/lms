ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS class_scope ENUM('school','hs') NOT NULL DEFAULT 'school' AFTER email;
