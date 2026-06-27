ALTER TABLE marksheet_activities
  MODIFY scope_key ENUM('nursery_ukg','i_v','vi_vii','viii','ix','x') NULL;

ALTER TABLE marksheet_activities
  ADD COLUMN class_id INT NULL AFTER scope_key,
  ADD COLUMN section_id INT NULL AFTER class_id;

ALTER TABLE marksheet_activities
  ADD KEY idx_marksheet_activities_class_scope (class_id, section_id, is_active, sort_order),
  ADD CONSTRAINT fk_marksheet_activities_class
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_marksheet_activities_section
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
