DROP PROCEDURE IF EXISTS migrate_class_scopes_entity;

DELIMITER $$

CREATE PROCEDURE migrate_class_scopes_entity()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'scopes'
  ) THEN
    CREATE TABLE scopes (
      id INT NOT NULL AUTO_INCREMENT,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_scopes_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  END IF;

  INSERT IGNORE INTO scopes (code, name, is_active)
  VALUES
    ('school', 'School', 1),
    ('hs', 'Higher Secondary', 1);

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'classes'
      AND COLUMN_NAME = 'scope_id'
  ) THEN
    ALTER TABLE classes
      ADD COLUMN scope_id INT NULL AFTER class_scope;
  END IF;

  UPDATE classes c
  LEFT JOIN scopes s ON s.code = c.class_scope
  SET c.scope_id = s.id
  WHERE c.scope_id IS NULL;

  UPDATE classes c
  JOIN scopes s ON s.code = 'school'
  SET c.scope_id = s.id
  WHERE c.scope_id IS NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'classes'
      AND INDEX_NAME = 'idx_classes_scope_id'
  ) THEN
    ALTER TABLE classes
      ADD KEY idx_classes_scope_id (scope_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'classes'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND CONSTRAINT_NAME = 'fk_classes_scope_id'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT fk_classes_scope_id
      FOREIGN KEY (scope_id) REFERENCES scopes(id);
  END IF;
END $$

DELIMITER ;

CALL migrate_class_scopes_entity();

DROP PROCEDURE IF EXISTS migrate_class_scopes_entity;
