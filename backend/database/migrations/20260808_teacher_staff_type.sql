ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS staff_type ENUM('teaching','non_teaching') NOT NULL DEFAULT 'teaching' AFTER name;

UPDATE teachers
SET staff_type = 'teaching'
WHERE staff_type IS NULL;
