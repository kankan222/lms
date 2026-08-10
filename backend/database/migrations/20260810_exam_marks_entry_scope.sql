SET @exam_marks_entry_scope_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exams'
    AND COLUMN_NAME = 'marks_entry_scope'
);

SET @exam_marks_entry_scope_sql = IF(
  @exam_marks_entry_scope_column_exists = 0,
  'ALTER TABLE exams ADD COLUMN marks_entry_scope ENUM(''subject_assignment'',''class_section_assignment'') NOT NULL DEFAULT ''subject_assignment'' AFTER final_calculation_type',
  'SELECT ''marks_entry_scope already exists'' AS message'
);

PREPARE exam_marks_entry_scope_stmt FROM @exam_marks_entry_scope_sql;
EXECUTE exam_marks_entry_scope_stmt;
DEALLOCATE PREPARE exam_marks_entry_scope_stmt;

UPDATE exams
SET marks_entry_scope = 'subject_assignment'
WHERE marks_entry_scope IS NULL;

UPDATE exams
SET marks_entry_scope = 'class_section_assignment'
WHERE final_calculation_type = 'mock'
  AND marks_entry_scope = 'subject_assignment';
