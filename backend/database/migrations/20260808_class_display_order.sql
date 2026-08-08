DROP PROCEDURE IF EXISTS migrate_class_display_order;

CREATE PROCEDURE migrate_class_display_order()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'classes'
      AND COLUMN_NAME = 'display_order'
  ) THEN
    ALTER TABLE classes
      ADD COLUMN display_order INT NULL AFTER name,
      ADD KEY idx_classes_display_order (class_scope, display_order, id);
  END IF;

  UPDATE classes
  SET display_order = CASE
    WHEN LOWER(TRIM(name)) IN ('nursery', 'pre nursery', 'pre-nursery') THEN 1
    WHEN LOWER(TRIM(name)) IN ('lkg', 'lower kg', 'lower kindergarten') THEN 2
    WHEN LOWER(TRIM(name)) IN ('ukg', 'kg', 'upper kg', 'upper kindergarten', 'kindergarten') THEN 3
    WHEN UPPER(TRIM(name)) IN ('I', '1', 'CLASS I', 'CLASS 1') THEN 4
    WHEN UPPER(TRIM(name)) IN ('II', '2', 'CLASS II', 'CLASS 2') THEN 5
    WHEN UPPER(TRIM(name)) IN ('III', '3', 'CLASS III', 'CLASS 3') THEN 6
    WHEN UPPER(TRIM(name)) IN ('IV', '4', 'CLASS IV', 'CLASS 4') THEN 7
    WHEN UPPER(TRIM(name)) IN ('V', '5', 'CLASS V', 'CLASS 5') THEN 8
    WHEN UPPER(TRIM(name)) IN ('VI', '6', 'CLASS VI', 'CLASS 6') THEN 9
    WHEN UPPER(TRIM(name)) IN ('VII', '7', 'CLASS VII', 'CLASS 7') THEN 10
    WHEN UPPER(TRIM(name)) IN ('VIII', '8', 'CLASS VIII', 'CLASS 8') THEN 11
    WHEN UPPER(TRIM(name)) IN ('IX', '9', 'CLASS IX', 'CLASS 9') THEN 12
    WHEN UPPER(TRIM(name)) IN ('X', '10', 'CLASS X', 'CLASS 10') THEN 13
    WHEN UPPER(TRIM(name)) IN ('XI', '11', 'CLASS XI', 'CLASS 11') THEN 14
    WHEN UPPER(TRIM(name)) IN ('XII', '12', 'CLASS XII', 'CLASS 12') THEN 15
    ELSE COALESCE(display_order, id + 1000)
  END
  WHERE display_order IS NULL;
END;

CALL migrate_class_display_order();

DROP PROCEDURE IF EXISTS migrate_class_display_order;
