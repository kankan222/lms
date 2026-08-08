ALTER TABLE class_routine_entries
  ADD COLUMN activity_id BIGINT NULL AFTER subject_id,
  ADD KEY idx_class_routine_entries_activity (activity_id),
  ADD CONSTRAINT fk_class_routine_entries_activity
    FOREIGN KEY (activity_id) REFERENCES marksheet_activities(id)
    ON DELETE SET NULL;
