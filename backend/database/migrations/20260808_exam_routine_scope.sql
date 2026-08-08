ALTER TABLE exam_routine_versions
  ADD COLUMN class_scope ENUM('school','hs') NULL AFTER session_id,
  ADD COLUMN class_id INT NULL AFTER class_scope,
  ADD COLUMN section_id INT NULL AFTER class_id,
  ADD COLUMN medium VARCHAR(40) NULL AFTER section_id,
  ADD COLUMN stream_id INT NULL AFTER medium;

UPDATE exam_routine_versions v
JOIN (
  SELECT
    exam_routine_version_id,
    MIN(class_id) AS class_id,
    MIN(section_id) AS section_id,
    MIN(medium) AS medium,
    MIN(stream_id) AS stream_id
  FROM exam_routine_entries
  GROUP BY exam_routine_version_id
) e ON e.exam_routine_version_id = v.id
LEFT JOIN classes c ON c.id = e.class_id
SET
  v.class_scope = COALESCE(c.class_scope, 'school'),
  v.class_id = e.class_id,
  v.section_id = e.section_id,
  v.medium = e.medium,
  v.stream_id = e.stream_id;

ALTER TABLE exam_routine_versions
  ADD KEY idx_exam_routine_scope_status (exam_id, class_scope, class_id, section_id, medium, stream_id, status),
  ADD CONSTRAINT fk_exam_routine_class
    FOREIGN KEY (class_id) REFERENCES classes(id),
  ADD CONSTRAINT fk_exam_routine_section
    FOREIGN KEY (section_id) REFERENCES sections(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_exam_routine_stream
    FOREIGN KEY (stream_id) REFERENCES streams(id)
    ON DELETE SET NULL;
