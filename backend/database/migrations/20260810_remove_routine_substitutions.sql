DROP PROCEDURE IF EXISTS remove_routine_substitutions;

DELIMITER $$

CREATE PROCEDURE remove_routine_substitutions()
BEGIN
  DELETE rp
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.name = 'routine_substitutions.manage';

  DELETE FROM permissions
  WHERE name = 'routine_substitutions.manage';

  DROP TABLE IF EXISTS routine_substitution_teachers;
  DROP TABLE IF EXISTS routine_substitutions;
END$$

DELIMITER ;

CALL remove_routine_substitutions();

DROP PROCEDURE IF EXISTS remove_routine_substitutions;
