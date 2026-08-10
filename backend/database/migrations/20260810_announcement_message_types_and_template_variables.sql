ALTER TABLE announcements
  ADD COLUMN message_type ENUM('custom','registered_dlt') NOT NULL DEFAULT 'custom' AFTER category_id;

UPDATE announcements
SET message_type = 'registered_dlt'
WHERE sms_template_id IS NOT NULL
   OR delivery_mode IN ('offline_sms', 'both');

ALTER TABLE announcement_sms_templates
  ADD COLUMN placeholder_schema_json JSON NULL AFTER placeholder_count;
