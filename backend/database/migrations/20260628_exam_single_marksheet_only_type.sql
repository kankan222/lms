ALTER TABLE exams
  MODIFY COLUMN final_calculation_type ENUM(
    'unit_test',
    'half_yearly',
    'annual',
    'mock',
    'display_only',
    'single_marksheet_only'
  ) NOT NULL DEFAULT 'display_only';
