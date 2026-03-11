UPDATE classes
SET medium = 'English'
WHERE medium IS NULL OR medium = '';

ALTER TABLE classes
MODIFY COLUMN medium SET('English','Assamese') NOT NULL;
