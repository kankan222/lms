SET @fk_name = (
  SELECT rc.CONSTRAINT_NAME
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = rc.constraint_schema
   AND kcu.table_name = rc.table_name
   AND kcu.constraint_name = rc.constraint_name
  WHERE rc.constraint_schema = DATABASE()
    AND rc.table_name = 'marks_entries'
    AND rc.referenced_table_name = 'exams'
    AND kcu.column_name = 'exam_id'
  LIMIT 1
);

SET @sql = IF(
  @fk_name IS NOT NULL,
  CONCAT('ALTER TABLE marks_entries DROP FOREIGN KEY ', @fk_name),
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'marks_entries'
    AND constraint_name = 'fk_marks_entries_exam_id'
);

SET @sql = IF(
  @fk_exists = 0,
  'ALTER TABLE marks_entries ADD CONSTRAINT fk_marks_entries_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
