ALTER TABLE sections
ADD COLUMN medium ENUM('English','Assamese') NULL AFTER name;

UPDATE sections
SET medium = 'English'
WHERE medium IS NULL OR medium = '';

ALTER TABLE sections
MODIFY COLUMN medium ENUM('English','Assamese') NOT NULL;
