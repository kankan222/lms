-- Remove duplicate teacher punch logs that share the same teacher/device/time.
-- Keeps the oldest row (smallest id).
DELETE t1
FROM teacher_attendance_logs t1
JOIN teacher_attendance_logs t2
  ON t1.teacher_id = t2.teacher_id
 AND (
      t1.device_id = t2.device_id
      OR (t1.device_id IS NULL AND t2.device_id IS NULL)
     )
 AND t1.punch_time = t2.punch_time
 AND t1.id > t2.id;

-- Add a generated dedupe key so NULL device_id values are also protected by uniqueness.
-- MySQL unique keys allow multiple NULLs, so COALESCE is needed for strict dedupe.
ALTER TABLE teacher_attendance_logs
  ADD COLUMN device_id_dedupe BIGINT AS (IFNULL(device_id, 0)) STORED,
  ADD UNIQUE KEY uniq_teacher_device_time (teacher_id, device_id_dedupe, punch_time);
