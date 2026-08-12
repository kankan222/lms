ALTER TABLE announcement_sms_templates
  ADD COLUMN provider_template_id VARCHAR(80) NULL AFTER dlt_template_id;

UPDATE announcement_sms_templates
SET provider_template_id = '222243'
WHERE dlt_template_id = '1077292690020752699'
  AND header = 'KKVPTH'
  AND (provider_template_id IS NULL OR provider_template_id = '');
