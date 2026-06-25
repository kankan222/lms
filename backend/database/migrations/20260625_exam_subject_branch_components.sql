CREATE TABLE IF NOT EXISTS exam_subject_components (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_subject_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  mark_pattern ENUM('single','split') NOT NULL DEFAULT 'split',
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 0,
  pass_marks DECIMAL(6,2) NOT NULL DEFAULT 0,
  theory_max DECIMAL(6,2) NULL,
  theory_pass DECIMAL(6,2) NULL,
  practical_max DECIMAL(6,2) NULL,
  practical_pass DECIMAL(6,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_exam_subject_components_subject (exam_subject_id),
  CONSTRAINT fk_exam_subject_components_exam_subject
    FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_subject_component_marks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT NOT NULL,
  exam_subject_component_id BIGINT NOT NULL,
  marks DECIMAL(5,2) NOT NULL DEFAULT 0,
  theory_marks DECIMAL(5,2) NULL,
  practical_marks DECIMAL(5,2) NULL,
  entered_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_component_student_mark (student_id, exam_subject_component_id),
  KEY idx_component_marks_student (student_id),
  CONSTRAINT fk_component_marks_component
    FOREIGN KEY (exam_subject_component_id) REFERENCES exam_subject_components(id) ON DELETE CASCADE,
  CONSTRAINT fk_component_marks_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_component_marks_entered_by
    FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL
);
