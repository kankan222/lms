import { execute, query } from "../../core/db/query.js";

let supportsScopesTableCache;
let examSubjectSplitSchemaStatusCache;
let marksEntrySplitSchemaStatusCache;
let studentExamSubjectsTableCache;
let subjectRegistrationTablesCache;
let examSubjectComponentsTableCache;
let reportPublicationsTableCache;
let examFinalCalculationTypeCache;
let studentParentGuardianColumnsCache;

async function supportsScopesTable() {
  if (typeof supportsScopesTableCache === "boolean") {
    return supportsScopesTableCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'scopes'
    `
  );

  supportsScopesTableCache = Number(rows[0]?.total || 0) > 0;
  return supportsScopesTableCache;
}

function buildClassScopeExpression(hasScopesTable, classAlias = "c", scopeAlias = "sc_ref") {
  if (hasScopesTable) {
    return `COALESCE(${scopeAlias}.code, ${classAlias}.class_scope, 'school')`;
  }

  return `COALESCE(${classAlias}.class_scope, 'school')`;
}

export async function getExamSubjectSplitSchemaStatus() {
  if (examSubjectSplitSchemaStatusCache) {
    return examSubjectSplitSchemaStatusCache;
  }

  const rows = await query(
    `
      SELECT
        SUM(COLUMN_NAME = 'mark_pattern') AS has_mark_pattern,
        SUM(COLUMN_NAME = 'theory_max') AS has_theory_max,
        SUM(COLUMN_NAME = 'theory_pass') AS has_theory_pass,
        SUM(COLUMN_NAME = 'practical_max') AS has_practical_max,
        SUM(COLUMN_NAME = 'practical_pass') AS has_practical_pass,
        SUM(COLUMN_NAME = 'subject_offering_id') AS has_subject_offering_id
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME IN (
          'mark_pattern',
          'theory_max',
          'theory_pass',
          'practical_max',
          'practical_pass',
          'subject_offering_id'
        )
    `
  );

  const status = {
    hasMarkPattern: Number(rows[0]?.has_mark_pattern || 0) > 0,
    hasTheoryMax: Number(rows[0]?.has_theory_max || 0) > 0,
    hasTheoryPass: Number(rows[0]?.has_theory_pass || 0) > 0,
    hasPracticalMax: Number(rows[0]?.has_practical_max || 0) > 0,
    hasPracticalPass: Number(rows[0]?.has_practical_pass || 0) > 0,
    hasSubjectOfferingId: Number(rows[0]?.has_subject_offering_id || 0) > 0,
  };

  examSubjectSplitSchemaStatusCache = status;
  return status;
}

export async function getMarksEntrySplitSchemaStatus() {
  if (marksEntrySplitSchemaStatusCache) {
    return marksEntrySplitSchemaStatusCache;
  }

  const rows = await query(
    `
      SELECT
        SUM(COLUMN_NAME = 'theory_marks') AS has_theory_marks,
        SUM(COLUMN_NAME = 'practical_marks') AS has_practical_marks
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'marks_entries'
        AND COLUMN_NAME IN ('theory_marks', 'practical_marks')
    `
  );

  const status = {
    hasTheoryMarks: Number(rows[0]?.has_theory_marks || 0) > 0,
    hasPracticalMarks: Number(rows[0]?.has_practical_marks || 0) > 0,
  };

  marksEntrySplitSchemaStatusCache = status;
  return status;
}

export async function supportsStudentExamSubjectsTable() {
  if (typeof studentExamSubjectsTableCache === "boolean") {
    return studentExamSubjectsTableCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'student_exam_subjects'
    `
  );

  studentExamSubjectsTableCache = Number(rows[0]?.total || 0) > 0;
  return studentExamSubjectsTableCache;
}

async function supportsSubjectRegistrationTables() {
  if (typeof subjectRegistrationTablesCache === "boolean") {
    return subjectRegistrationTablesCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('subject_offerings', 'student_subject_registrations')
    `
  );

  subjectRegistrationTablesCache = Number(rows[0]?.total || 0) === 2;
  return subjectRegistrationTablesCache;
}

export async function supportsExamSubjectComponentsTable() {
  if (typeof examSubjectComponentsTableCache === "boolean") {
    return examSubjectComponentsTableCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('exam_subject_components', 'exam_subject_component_marks')
    `
  );

  examSubjectComponentsTableCache = Number(rows[0]?.total || 0) === 2;
  return examSubjectComponentsTableCache;
}

export async function supportsReportPublicationsTable() {
  if (typeof reportPublicationsTableCache === "boolean") {
    return reportPublicationsTableCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_report_publications'
    `
  );

  reportPublicationsTableCache = Number(rows[0]?.total || 0) > 0;
  return reportPublicationsTableCache;
}

async function supportsExamFinalCalculationTypeColumn() {
  if (typeof examFinalCalculationTypeCache === "boolean") {
    return examFinalCalculationTypeCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exams'
        AND COLUMN_NAME = 'final_calculation_type'
    `
  );

  examFinalCalculationTypeCache = Number(rows[0]?.total || 0) > 0;
  return examFinalCalculationTypeCache;
}

async function supportsStudentParentGuardianColumns() {
  if (typeof studentParentGuardianColumnsCache === "boolean") {
    return studentParentGuardianColumnsCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'student_parents'
        AND COLUMN_NAME IN ('father_name', 'mother_name')
    `
  );

  studentParentGuardianColumnsCache = Number(rows[0]?.total || 0) === 2;
  return studentParentGuardianColumnsCache;
}

async function guardianNameExpression() {
  if (await supportsStudentParentGuardianColumns()) {
    return `COALESCE(
      MAX(NULLIF(sp.father_name, '')),
      MAX(NULLIF(sp.mother_name, '')),
      GROUP_CONCAT(DISTINCT p.name ORDER BY FIELD(LOWER(sp.relationship), 'father', 'mother', 'guardian'), p.name SEPARATOR ', ')
    )`;
  }

  return `GROUP_CONCAT(DISTINCT p.name ORDER BY FIELD(LOWER(sp.relationship), 'father', 'mother', 'guardian'), p.name SEPARATOR ', ')`;
}

export async function supportsMarksDraftStatus() {
  const rows = await query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'marks_entries'
       AND COLUMN_NAME = 'approval_status'
     LIMIT 1`
  );

  const columnType = String(rows[0]?.COLUMN_TYPE || "").toLowerCase();
  return columnType.includes("'draft'");
}

export async function getUserRoleNames(userId) {
  const rows = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((row) => row.name);
}

export async function getTeacherProfileByUser(userId) {
  const rows = await query(`SELECT id FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function getParentStudentIds(userId) {
  const rows = await query(
    `SELECT DISTINCT sp.student_id
     FROM parents p
     JOIN student_parents sp ON sp.parent_id = p.id
     WHERE p.user_id = ?`,
    [userId]
  );
  return rows.map((row) => Number(row.student_id));
}

export async function getStudentsByIds(studentIds) {
  if (!studentIds.length) return [];

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT
      s.id,
      s.name,
      se.roll_number,
      c.name AS class_name,
      sec.name AS section_name
     FROM students s
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE s.id IN (${placeholders})
     ORDER BY s.name ASC`,
    studentIds
  );
}

export async function getStudentProfileByUser(userId) {
  const rows = await query(
    `SELECT s.id
     FROM users u
     JOIN students s ON s.mobile = u.phone
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getExamById(examId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const rows = await query(
    `SELECT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name,
      ${classScopeExpr} AS class_scope
     FROM exams e
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     LEFT JOIN classes c ON c.id = e.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     WHERE e.id = ?
     LIMIT 1`,
    [examId]
  );
  return rows[0] || null;
}

export async function getExamSubjects(examId) {
  const schema = await getExamSubjectSplitSchemaStatus();
  const supportsSplitSchema =
    schema.hasMarkPattern &&
    schema.hasTheoryMax &&
    schema.hasTheoryPass &&
    schema.hasPracticalMax &&
    schema.hasPracticalPass;

  const markPatternExpr = supportsSplitSchema ? "es.mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSchema ? "es.theory_max" : "NULL";
  const theoryPassExpr = supportsSplitSchema ? "es.theory_pass" : "NULL";
  const practicalMaxExpr = supportsSplitSchema ? "es.practical_max" : "NULL";
  const practicalPassExpr = supportsSplitSchema ? "es.practical_pass" : "NULL";
  const subjectOfferingExpr = schema.hasSubjectOfferingId ? "es.subject_offering_id" : "NULL";
  const subjectGroupExpr = schema.hasSubjectOfferingId ? "so.subject_group" : "NULL";
  const subjectOfferingJoin = schema.hasSubjectOfferingId
    ? "LEFT JOIN subject_offerings so ON so.id = es.subject_offering_id"
    : "";

  const subjects = await query(
    `SELECT
      es.id AS exam_subject_id,
      es.subject_id,
      ${subjectOfferingExpr} AS subject_offering_id,
      ${subjectGroupExpr} AS subject_group,
      ${markPatternExpr} AS mark_pattern,
      sub.name AS subject_name,
      es.max_marks,
      es.pass_marks,
      ${theoryMaxExpr} AS theory_max,
      ${theoryPassExpr} AS theory_pass,
      ${practicalMaxExpr} AS practical_max,
      ${practicalPassExpr} AS practical_pass
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     ${subjectOfferingJoin}
     WHERE es.exam_id = ?
     ORDER BY sub.name ASC`,
    [examId]
  );

  return attachExamSubjectComponents(subjects);
}

async function attachExamSubjectComponents(subjects) {
  if (!(await supportsExamSubjectComponentsTable()) || !subjects.length) {
    return subjects.map((subject) => ({ ...subject, components: [] }));
  }

  const examSubjectIds = subjects.map((subject) => Number(subject.exam_subject_id || subject.id)).filter(Boolean);
  if (!examSubjectIds.length) return subjects.map((subject) => ({ ...subject, components: [] }));

  const placeholders = examSubjectIds.map(() => "?").join(",");
  const components = await query(
    `SELECT
      id,
      exam_subject_id,
      name,
      mark_pattern,
      max_marks,
      pass_marks,
      theory_max,
      theory_pass,
      practical_max,
      practical_pass,
      sort_order
     FROM exam_subject_components
     WHERE exam_subject_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    examSubjectIds
  );
  const componentsBySubject = new Map();
  components.forEach((component) => {
    const key = Number(component.exam_subject_id);
    const list = componentsBySubject.get(key) || [];
    list.push(component);
    componentsBySubject.set(key, list);
  });

  return subjects.map((subject) => ({
    ...subject,
    components: componentsBySubject.get(Number(subject.exam_subject_id || subject.id)) || [],
  }));
}

export function attachComponentsToExamSubjects(subjects) {
  return attachExamSubjectComponents(subjects);
}

export async function getExamScopes(examId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  return query(
    `SELECT
      es.class_id,
      es.section_id,
      ${classScopeExpr} AS class_scope,
      c.name AS class_name,
      s.name AS section_name
     FROM exam_scopes es
     JOIN classes c ON c.id = es.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     LEFT JOIN sections s ON s.id = es.section_id
     WHERE es.exam_id = ?
     ORDER BY c.name, es.section_id IS NULL DESC, s.name`,
    [examId]
  );
}

export async function getClassSectionScope(classId, sectionId) {
  const rows = await query(
    `SELECT
       c.id AS class_id,
       c.name AS class_name,
       sec.id AS section_id,
       sec.name AS section_name,
       sec.medium
     FROM classes c
     JOIN sections sec ON sec.class_id = c.id
     WHERE c.id = ?
       AND sec.id = ?
     LIMIT 1`,
    [classId, sectionId]
  );
  return rows[0] || null;
}

export async function getTeacherAccessibleExams(userId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name,
      COALESCE(
        NULLIF(GROUP_CONCAT(DISTINCT ${classScopeExpr} ORDER BY ${classScopeExpr} SEPARATOR ','), ''),
        'school'
      ) AS class_scope
     FROM teachers t
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
     JOIN exams e
       ON e.session_id = tca.session_id
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = tca.class_id
      AND (sc.section_id IS NULL OR sc.section_id = tca.section_id)
     JOIN classes c ON c.id = sc.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE t.user_id = ?
     GROUP BY e.id, e.name, e.session_id, ses.name
     ORDER BY e.id DESC`,
    [userId]
  );
}

export async function getOwnedStudentAccessibleExams(studentIds) {
  if (!studentIds.length) return [];

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name
     FROM exams e
     JOIN student_enrollments se
       ON se.session_id = e.session_id
      AND se.status = 'active'
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = se.class_id
      AND (sc.section_id IS NULL OR sc.section_id = se.section_id)
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE se.student_id IN (${placeholders})
     ORDER BY e.id DESC`,
    studentIds
  );
}

export async function getExamSubject(examId, subjectId) {
  const schema = await getExamSubjectSplitSchemaStatus();
  const supportsSplitSchema =
    schema.hasMarkPattern &&
    schema.hasTheoryMax &&
    schema.hasTheoryPass &&
    schema.hasPracticalMax &&
    schema.hasPracticalPass;

  const markPatternExpr = supportsSplitSchema ? "es.mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSchema ? "es.theory_max" : "NULL";
  const theoryPassExpr = supportsSplitSchema ? "es.theory_pass" : "NULL";
  const practicalMaxExpr = supportsSplitSchema ? "es.practical_max" : "NULL";
  const practicalPassExpr = supportsSplitSchema ? "es.practical_pass" : "NULL";
  const subjectOfferingExpr = schema.hasSubjectOfferingId ? "es.subject_offering_id" : "NULL";
  const subjectGroupExpr = schema.hasSubjectOfferingId ? "so.subject_group" : "NULL";
  const subjectOfferingJoin = schema.hasSubjectOfferingId
    ? "LEFT JOIN subject_offerings so ON so.id = es.subject_offering_id"
    : "";

  const rows = await query(
    `SELECT
      es.id,
      es.exam_id,
      es.subject_id,
      ${subjectOfferingExpr} AS subject_offering_id,
      ${subjectGroupExpr} AS subject_group,
      ${markPatternExpr} AS mark_pattern,
      es.max_marks,
      es.pass_marks,
      ${theoryMaxExpr} AS theory_max,
      ${theoryPassExpr} AS theory_pass,
      ${practicalMaxExpr} AS practical_max,
      ${practicalPassExpr} AS practical_pass,
      sub.name AS subject_name
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     ${subjectOfferingJoin}
     WHERE es.exam_id = ? AND es.subject_id = ?
     LIMIT 1`,
    [examId, subjectId]
  );
  const [subject] = await attachExamSubjectComponents(rows);
  return subject || null;
}

export async function isTeacherAssignedToExamScope(userId, examId, classId, sectionId, subjectId = null) {
  const params = subjectId
    ? [userId, classId, sectionId, sectionId, subjectId, examId]
    : [userId, classId, sectionId, sectionId, examId];

  const subjectClause = subjectId ? `AND tca.subject_id = ?` : "";

  const rows = await query(
    `SELECT 1
     FROM exams e
     JOIN teachers t ON t.user_id = ?
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND (sc.section_id IS NULL OR sc.section_id = ?)
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
      AND tca.session_id = e.session_id
      AND tca.class_id = sc.class_id
      AND tca.section_id = ?
      ${subjectClause}
     WHERE e.id = ?
     LIMIT 1`,
    params
  );

  return rows.length > 0;
}

export async function getAllowedTeacherScopes(userId, examId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  return query(
    `SELECT DISTINCT
      sc.class_id,
      tca.section_id,
      ${classScopeExpr} AS class_scope,
      c.name AS class_name,
      s.name AS section_name,
      s.medium
     FROM exam_scopes sc
     JOIN exams e ON e.id = sc.exam_id
     JOIN teachers t ON t.user_id = ?
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
      AND tca.session_id = e.session_id
      AND tca.class_id = sc.class_id
      AND (sc.section_id IS NULL OR tca.section_id = sc.section_id)
     JOIN classes c ON c.id = sc.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections s ON s.id = tca.section_id
     WHERE sc.exam_id = ?
     ORDER BY c.name, s.name`,
    [userId, examId]
  );
}

export async function getStudentsForScope({ examId, classId, sectionId, medium, name, subjectId = null }) {
  const hasStudentExamSubjects = await supportsStudentExamSubjectsTable();
  const hasSubjectRegistrations = await supportsSubjectRegistrationTables();
  const examSubjectSchema = await getExamSubjectSplitSchemaStatus();
  const hasSubjectOfferingId = examSubjectSchema.hasSubjectOfferingId;
  const params = [classId, sectionId, sectionId, examId];
  const where = [];

  if (medium) {
    where.push("LOWER(sec.medium) = ?");
    params.push(String(medium).trim().toLowerCase());
  }

  if (name) {
    where.push("st.name LIKE ?");
    params.push(`%${String(name).trim()}%`);
  }

  if (hasStudentExamSubjects && !hasSubjectRegistrations && subjectId) {
    where.push(
      `(
        NOT EXISTS (
          SELECT 1
          FROM student_exam_subjects ses_any
          WHERE ses_any.exam_id = e.id
            AND ses_any.student_id = st.id
        )
        OR EXISTS (
          SELECT 1
          FROM student_exam_subjects ses_match
          WHERE ses_match.exam_id = e.id
            AND ses_match.student_id = st.id
            AND ses_match.subject_id = ?
        )
      )`
    );
    params.push(subjectId);
  }

  if (hasSubjectRegistrations && subjectId) {
    where.push(
      `(
        NOT EXISTS (
          SELECT 1
          FROM exam_subjects es_scope
          JOIN subject_offerings so_any
            ON so_any.is_active = TRUE
           AND so_any.class_id = se.class_id
           AND (so_any.section_id IS NULL OR so_any.section_id = se.section_id)
           AND (so_any.stream_id IS NULL OR so_any.stream_id <=> se.stream_id)
           AND (
             ${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NOT NULL AND so_any.id = es_scope.subject_offering_id" : "FALSE"}
             OR (${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NULL AND " : ""}so_any.subject_id = es_scope.subject_id)
           )
          WHERE es_scope.exam_id = e.id
            AND es_scope.subject_id = ?
        )
        OR EXISTS (
          SELECT 1
          FROM exam_subjects es_scope
          JOIN subject_offerings so_required
            ON so_required.is_active = TRUE
           AND so_required.subject_group = 'compulsory'
           AND so_required.class_id = se.class_id
           AND (so_required.section_id IS NULL OR so_required.section_id = se.section_id)
           AND (so_required.stream_id IS NULL OR so_required.stream_id <=> se.stream_id)
           AND (
             ${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NOT NULL AND so_required.id = es_scope.subject_offering_id" : "FALSE"}
             OR (${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NULL AND " : ""}so_required.subject_id = es_scope.subject_id)
           )
          WHERE es_scope.exam_id = e.id
            AND es_scope.subject_id = ?
        )
        OR EXISTS (
          SELECT 1
          FROM exam_subjects es_scope
          JOIN student_subject_registrations ssr
            ON ssr.student_id = st.id
           AND ssr.status = 'active'
          JOIN subject_offerings so_match
            ON so_match.id = ssr.subject_offering_id
           AND so_match.is_active = TRUE
           AND so_match.class_id = se.class_id
           AND (so_match.section_id IS NULL OR so_match.section_id = se.section_id)
           AND (so_match.stream_id IS NULL OR so_match.stream_id <=> se.stream_id)
           AND (
             ${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NOT NULL AND so_match.id = es_scope.subject_offering_id" : "FALSE"}
             OR (${hasSubjectOfferingId ? "es_scope.subject_offering_id IS NULL AND " : ""}so_match.subject_id = es_scope.subject_id)
           )
          WHERE es_scope.exam_id = e.id
            AND es_scope.subject_id = ?
        )
      )`
    );
    params.push(subjectId, subjectId, subjectId);
  }

  const extraWhere = where.length ? `AND ${where.join(" AND ")}` : "";

  return query(
    `SELECT DISTINCT
      st.id AS student_id,
      st.name AS student_name,
      se.roll_number,
      sec.medium
     FROM exams e
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND (sc.section_id IS NULL OR sc.section_id = ?)
     JOIN sections sec ON sec.id = ?
     JOIN student_enrollments se
       ON se.class_id = sc.class_id
      AND se.section_id = sec.id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     WHERE e.id = ?
       ${extraWhere}
     ORDER BY se.roll_number ASC, st.name ASC`,
    params
  );
}

export async function getMarksByExamSubjectStudentIds(examId, subjectId, studentIds) {
  if (!studentIds.length) return [];

  const schema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarksSchema = schema.hasTheoryMarks && schema.hasPracticalMarks;
  const theoryMarksExpr = supportsSplitMarksSchema ? "theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarksSchema ? "practical_marks" : "NULL";

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT
      id AS mark_id,
      student_id,
      marks,
      ${theoryMarksExpr} AS theory_marks,
      ${practicalMarksExpr} AS practical_marks,
      approval_status,
      approved_by,
      approved_at
     FROM marks_entries
     WHERE exam_id = ?
       AND subject_id = ?
       AND student_id IN (${placeholders})`,
    [examId, subjectId, ...studentIds]
  );
}

export async function getComponentMarksByStudentIds(examSubjectId, studentIds) {
  if (!(await supportsExamSubjectComponentsTable()) || !studentIds.length || !examSubjectId) {
    return [];
  }

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT
      ecm.student_id,
      esc.exam_subject_id,
      ecm.exam_subject_component_id AS component_id,
      ecm.marks,
      ecm.theory_marks,
      ecm.practical_marks
     FROM exam_subject_component_marks ecm
     JOIN exam_subject_components esc ON esc.id = ecm.exam_subject_component_id
     WHERE esc.exam_subject_id = ?
       AND ecm.student_id IN (${placeholders})`,
    [examSubjectId, ...studentIds]
  );
}

export async function getPendingApprovalScopes() {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  return query(
    `SELECT
      me.exam_id,
      e.name AS exam_name,
      e.session_id,
      sess.name AS session_name,
      se.class_id,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      se.section_id,
      sec.name AS section_name,
      sec.medium,
      me.subject_id,
      sub.name AS subject_name,
      COUNT(*) AS pending_count,
      MAX(me.id) AS latest_entry_id
     FROM marks_entries me
     JOIN exams e ON e.id = me.exam_id
     LEFT JOIN academic_sessions sess ON sess.id = e.session_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN classes c ON c.id = se.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections sec ON sec.id = se.section_id
     JOIN subjects sub ON sub.id = me.subject_id
     WHERE me.approval_status = 'pending'
     GROUP BY
      me.exam_id,
      e.name,
      e.session_id,
      sess.name,
      se.class_id,
      c.name,
      ${classScopeExpr},
      se.section_id,
      sec.name,
      sec.medium,
      me.subject_id,
      sub.name
     ORDER BY latest_entry_id DESC`
  );
}

export async function getApprovalStatusSummary() {
  const rows = await query(
    `SELECT
      SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN approval_status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_count
     FROM marks_entries`
  );

  return rows[0] || { pending_count: 0, draft_count: 0, approved_count: 0 };
}

export async function upsertMarksDraft(conn, rows) {
  if (!rows.length) return;

  const schema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarksSchema = schema.hasTheoryMarks && schema.hasPracticalMarks;

  if (supportsSplitMarksSchema) {
    const values = rows.map((row) => [
      row.student_id,
      row.exam_id,
      row.subject_id,
      row.marks,
      row.theory_marks ?? null,
      row.practical_marks ?? null,
      row.entered_by,
    ]);

    await conn.query(
      `INSERT INTO marks_entries
       (student_id, exam_id, subject_id, marks, theory_marks, practical_marks, entered_by)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         marks = VALUES(marks),
         theory_marks = VALUES(theory_marks),
         practical_marks = VALUES(practical_marks),
         entered_by = VALUES(entered_by),
         approval_status = CASE
           WHEN approval_status = 'pending' THEN 'pending'
           WHEN approval_status = 'approved'
             AND marks <=> VALUES(marks)
             AND theory_marks <=> VALUES(theory_marks)
             AND practical_marks <=> VALUES(practical_marks)
           THEN 'approved'
           ELSE 'draft'
         END,
         approved_by = CASE
           WHEN approval_status = 'approved'
             AND marks <=> VALUES(marks)
             AND theory_marks <=> VALUES(theory_marks)
             AND practical_marks <=> VALUES(practical_marks)
           THEN approved_by
           ELSE NULL
         END,
         approved_at = CASE
           WHEN approval_status = 'approved'
             AND marks <=> VALUES(marks)
             AND theory_marks <=> VALUES(theory_marks)
             AND practical_marks <=> VALUES(practical_marks)
           THEN approved_at
           ELSE NULL
         END`,
      [values]
    );
    return;
  }

  const values = rows.map((row) => [row.student_id, row.exam_id, row.subject_id, row.marks, row.entered_by]);
  await conn.query(
    `INSERT INTO marks_entries
     (student_id, exam_id, subject_id, marks, entered_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       marks = VALUES(marks),
       entered_by = VALUES(entered_by),
       approval_status = CASE
         WHEN approval_status = 'pending' THEN 'pending'
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN 'approved'
         ELSE 'draft'
       END,
       approved_by = CASE
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN approved_by
         ELSE NULL
       END,
       approved_at = CASE
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN approved_at
         ELSE NULL
       END`,
    [values]
  );
}

export async function upsertComponentMarks(conn, rows) {
  if (!rows.length || !(await supportsExamSubjectComponentsTable())) return;

  const values = rows.map((row) => [
    row.student_id,
    row.component_id,
    row.marks,
    row.theory_marks ?? null,
    row.practical_marks ?? null,
    row.entered_by,
  ]);

  await conn.query(
    `INSERT INTO exam_subject_component_marks
     (student_id, exam_subject_component_id, marks, theory_marks, practical_marks, entered_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       marks = VALUES(marks),
       theory_marks = VALUES(theory_marks),
       practical_marks = VALUES(practical_marks),
       entered_by = VALUES(entered_by)`,
    [values]
  );
}

export async function updateApprovalStatusBySelection(conn, payload) {
  const params = [];
  const setSql = [];

  setSql.push(`me.approval_status = ?`);
  params.push(payload.nextStatus);

  if (payload.nextStatus === "approved") {
    setSql.push(`me.approved_by = ?`);
    params.push(payload.approvedBy);
    setSql.push(`me.approved_at = NOW()`);
  } else {
    setSql.push(`me.approved_by = NULL`);
    setSql.push(`me.approved_at = NULL`);
  }

  const where = [
    `me.exam_id = ?`,
    `me.subject_id = ?`,
    `se.class_id = ?`,
    `se.section_id = ?`,
    `se.status = 'active'`,
  ];

  params.push(payload.examId, payload.subjectId, payload.classId, payload.sectionId);

  if (payload.medium) {
    where.push(`LOWER(sec.medium) = ?`);
    params.push(String(payload.medium).trim().toLowerCase());
  }

  if (Array.isArray(payload.studentIds) && payload.studentIds.length) {
    where.push(`me.student_id IN (${payload.studentIds.map(() => "?").join(",")})`);
    params.push(...payload.studentIds);
  }

  if (Array.isArray(payload.currentStatuses) && payload.currentStatuses.length) {
    where.push(`me.approval_status IN (${payload.currentStatuses.map(() => "?").join(",")})`);
    params.push(...payload.currentStatuses);
  }

  const [result] = await conn.execute(
    `UPDATE marks_entries me
     JOIN student_enrollments se
       ON se.student_id = me.student_id
     JOIN exams e
       ON e.id = me.exam_id
      AND e.session_id = se.session_id
     JOIN sections sec ON sec.id = se.section_id
     SET ${setSql.join(", ")}
     WHERE ${where.join(" AND ")}`,
    params
  );

  return result.affectedRows;
}

function normalizePublicationMedium(medium) {
  const value = String(medium || "").trim().toLowerCase();
  return value || "";
}

export async function getReportPublication(examId, classId, sectionId, medium) {
  if (!(await supportsReportPublicationsTable())) return null;

  const rows = await query(
    `SELECT
       id,
       exam_id,
       class_id,
       section_id,
       medium,
       DATE_FORMAT(published_on, '%Y-%m-%d') AS published_on,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM exam_report_publications
     WHERE exam_id = ?
       AND class_id = ?
       AND section_id = ?
       AND medium <=> ?
     LIMIT 1`,
    [examId, classId, sectionId, normalizePublicationMedium(medium)]
  );

  return rows[0] || null;
}

export async function listPublishedReportScopes(filters = {}) {
  const hasPublicationsTable = await supportsReportPublicationsTable();
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const where = [
    `me.approval_status = 'approved'`,
    `se.status = 'active'`,
  ];
  const params = [];

  if (filters.exam_id) {
    where.push(`e.id = ?`);
    params.push(Number(filters.exam_id));
  }
  if (filters.class_id) {
    where.push(`se.class_id = ?`);
    params.push(Number(filters.class_id));
  }
  if (filters.section_id) {
    where.push(`se.section_id = ?`);
    params.push(Number(filters.section_id));
  }
  if (filters.subject_id) {
    where.push(`sub.id = ?`);
    params.push(Number(filters.subject_id));
  }
  if (filters.class_scope || filters.scope) {
    where.push(`${classScopeExpr} = ?`);
    params.push(String(filters.class_scope || filters.scope).trim().toLowerCase());
  }
  if (filters.medium) {
    where.push(`LOWER(sec.medium) = ?`);
    params.push(String(filters.medium).trim().toLowerCase());
  }

  const publicationJoin = hasPublicationsTable
    ? `LEFT JOIN exam_report_publications erp
         ON erp.exam_id = e.id
        AND erp.class_id = se.class_id
        AND erp.section_id = se.section_id
        AND erp.medium = LOWER(COALESCE(sec.medium, ''))`
    : "";
  const publicationExpr = hasPublicationsTable ? "DATE_FORMAT(erp.published_on, '%Y-%m-%d')" : "NULL";

  return query(
    `SELECT
       e.id AS exam_id,
       e.name AS exam_name,
       e.session_id,
       sess.name AS session_name,
       se.class_id,
       c.name AS class_name,
       ${classScopeExpr} AS class_scope,
       se.section_id,
       sec.name AS section_name,
       sec.medium,
       sub.id AS subject_id,
       sub.name AS subject_name,
       COUNT(*) AS approved_count,
       COUNT(DISTINCT se.student_id) AS student_count,
       ${publicationExpr} AS published_on
     FROM marks_entries me
     JOIN exams e ON e.id = me.exam_id
     JOIN academic_sessions sess ON sess.id = e.session_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
     JOIN classes c ON c.id = se.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections sec ON sec.id = se.section_id
     JOIN subjects sub ON sub.id = me.subject_id
     ${publicationJoin}
     WHERE ${where.join(" AND ")}
     GROUP BY
       e.id,
       e.name,
       e.session_id,
       sess.name,
       se.class_id,
       c.name,
       ${classScopeExpr},
       se.section_id,
       sec.name,
       sec.medium,
       sub.id,
       sub.name,
       ${publicationExpr}
     ORDER BY e.id DESC, c.name, sec.name, sec.medium, sub.name`,
    params
  );
}

export async function listApprovedMarkRecords(filters = {}) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const where = [
    `me.approval_status = 'approved'`,
    `se.status = 'active'`,
  ];
  const params = [];

  if (filters.exam_id) {
    where.push(`e.id = ?`);
    params.push(Number(filters.exam_id));
  }
  if (filters.class_id) {
    where.push(`se.class_id = ?`);
    params.push(Number(filters.class_id));
  }
  if (filters.section_id) {
    where.push(`se.section_id = ?`);
    params.push(Number(filters.section_id));
  }
  if (filters.subject_id) {
    where.push(`sub.id = ?`);
    params.push(Number(filters.subject_id));
  }
  if (filters.class_scope || filters.scope) {
    where.push(`${classScopeExpr} = ?`);
    params.push(String(filters.class_scope || filters.scope).trim().toLowerCase());
  }
  if (filters.medium) {
    where.push(`LOWER(sec.medium) = ?`);
    params.push(String(filters.medium).trim().toLowerCase());
  }
  if (filters.name) {
    where.push(`LOWER(st.name) LIKE ?`);
    params.push(`%${String(filters.name).trim().toLowerCase()}%`);
  }

  return query(
    `SELECT
       e.id AS exam_id,
       e.name AS exam_name,
       e.session_id,
       sess.name AS session_name,
       se.student_id,
       st.name AS student_name,
       se.roll_number,
       se.class_id,
       c.name AS class_name,
       ${classScopeExpr} AS class_scope,
       se.section_id,
       sec.name AS section_name,
       sec.medium,
       sub.id AS subject_id,
       sub.name AS subject_name,
       me.marks,
       me.theory_marks,
       me.practical_marks,
       me.approval_status,
       DATE_FORMAT(me.approved_at, '%Y-%m-%d %H:%i:%s') AS approved_at
     FROM marks_entries me
     JOIN exams e ON e.id = me.exam_id
     JOIN academic_sessions sess ON sess.id = e.session_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
     JOIN students st ON st.id = se.student_id
     JOIN classes c ON c.id = se.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections sec ON sec.id = se.section_id
     JOIN subjects sub ON sub.id = me.subject_id
     WHERE ${where.join(" AND ")}
     ORDER BY e.id DESC, c.name, sec.name, sec.medium, se.roll_number, st.name, sub.name`,
    params
  );
}

export async function upsertReportPublication(payload) {
  const result = await execute(
    `INSERT INTO exam_report_publications
       (exam_id, class_id, section_id, medium, published_on, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       published_on = VALUES(published_on),
       updated_by = VALUES(updated_by)`,
    [
      payload.examId,
      payload.classId,
      payload.sectionId,
      normalizePublicationMedium(payload.medium),
      payload.publishedOn,
      payload.userId,
      payload.userId,
    ]
  );

  return result.affectedRows;
}

export async function countApprovedMarksForReportScope(examId, classId, sectionId, medium) {
  const params = [examId, classId, sectionId];
  const where = [
    `me.exam_id = ?`,
    `se.class_id = ?`,
    `se.section_id = ?`,
    `se.status = 'active'`,
    `me.approval_status = 'approved'`,
  ];

  const normalizedMedium = normalizePublicationMedium(medium);
  if (normalizedMedium) {
    where.push(`LOWER(sec.medium) = ?`);
    params.push(normalizedMedium);
  }

  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM marks_entries me
     JOIN exams e
       ON e.id = me.exam_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
     JOIN sections sec ON sec.id = se.section_id
     WHERE ${where.join(" AND ")}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

export async function getStudentScopeForExam(studentId, examId) {
  const rows = await query(
    `SELECT se.class_id, se.section_id, sec.medium
     FROM exams e
     JOIN student_enrollments se
       ON se.student_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN sections sec ON sec.id = se.section_id
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = se.class_id
      AND (sc.section_id IS NULL OR sc.section_id = se.section_id)
     WHERE e.id = ?
     LIMIT 1`,
    [studentId, examId]
  );
  return rows[0] || null;
}

export async function getStudentFinalReportScope({ studentId, sessionId = null, classId = null, sectionId = null }) {
  const where = [
    `se.student_id = ?`,
    `se.status = 'active'`,
  ];
  const params = [studentId];

  if (sessionId) {
    where.push(`se.session_id = ?`);
    params.push(sessionId);
  }

  if (classId) {
    where.push(`se.class_id = ?`);
    params.push(classId);
  }

  if (sectionId) {
    where.push(`se.section_id = ?`);
    params.push(sectionId);
  }

  const guardianExpr = await guardianNameExpression();
  const rows = await query(
    `SELECT
       se.student_id,
       st.name AS student_name,
       se.roll_number,
       se.session_id,
       sess.name AS session_name,
       se.class_id,
       c.name AS class_name,
       se.section_id,
       sec.name AS section_name,
       sec.medium,
       se.stream_id,
       streams.name AS stream_name,
       guardians.guardian_name
     FROM student_enrollments se
     JOIN students st ON st.id = se.student_id
     LEFT JOIN (
       SELECT
         sp.student_id,
         ${guardianExpr} AS guardian_name
       FROM student_parents sp
       JOIN parents p ON p.id = sp.parent_id
       GROUP BY sp.student_id
     ) guardians ON guardians.student_id = st.id
     JOIN academic_sessions sess ON sess.id = se.session_id
     JOIN classes c ON c.id = se.class_id
     JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN streams ON streams.id = se.stream_id
     WHERE ${where.join(" AND ")}
     ORDER BY se.session_id DESC, se.id DESC
     LIMIT 1`,
    params
  );

  return rows[0] || null;
}

export async function getFinalReportRows({ studentId, sessionId, classId, sectionId, medium, visibleOnly = false }) {
  const hasPublicationsTable = await supportsReportPublicationsTable();
  const hasScopesTable = await supportsScopesTable();
  const hasFinalType = await supportsExamFinalCalculationTypeColumn();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const subjectSchema = await getExamSubjectSplitSchemaStatus();
  const subjectOfferingExpr = subjectSchema.hasSubjectOfferingId ? "es.subject_offering_id" : "NULL";
  const subjectGroupExpr = subjectSchema.hasSubjectOfferingId ? "so.subject_group" : "NULL";
  const subjectGroupOrderExpr = subjectSchema.hasSubjectOfferingId ? "COALESCE(so.subject_group, 'zz')" : "'zz'";
  const subjectOfferingJoin = subjectSchema.hasSubjectOfferingId
    ? "LEFT JOIN subject_offerings so ON so.id = es.subject_offering_id"
    : "";
  const supportsSplitSubjectSchema =
    subjectSchema.hasMarkPattern &&
    subjectSchema.hasTheoryMax &&
    subjectSchema.hasPracticalMax;
  const marksSchema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarksSchema = marksSchema.hasTheoryMarks && marksSchema.hasPracticalMarks;
  const markPatternExpr = supportsSplitSubjectSchema ? "es.mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSubjectSchema ? "es.theory_max" : "NULL";
  const practicalMaxExpr = supportsSplitSubjectSchema ? "es.practical_max" : "NULL";
  const theoryMarksExpr = supportsSplitMarksSchema ? "me.theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarksSchema ? "me.practical_marks" : "NULL";
  const publicationJoin = hasPublicationsTable
    ? `${visibleOnly ? "JOIN" : "LEFT JOIN"} exam_report_publications erp
       ON erp.exam_id = e.id
      AND erp.class_id = se.class_id
      AND erp.section_id = se.section_id
      AND erp.medium = LOWER(COALESCE(sec.medium, ''))`
    : "";
  const publishedOnExpr = hasPublicationsTable ? "DATE_FORMAT(erp.published_on, '%Y-%m-%d')" : "NULL";
  const finalTypeExpr = hasFinalType ? "e.final_calculation_type" : "'display_only'";
  const visibilityClause = visibleOnly && hasPublicationsTable ? "AND erp.published_on <= CURDATE()" : "";

  if (visibleOnly && !hasPublicationsTable) return [];

  return query(
    `SELECT
       st.id AS student_id,
       st.name AS student_name,
       se.roll_number,
       se.session_id,
       sess.name AS session_name,
       se.class_id,
       c.name AS class_name,
       ${classScopeExpr} AS class_scope,
       se.section_id,
       sec.name AS section_name,
       sec.medium,
       streams.name AS stream_name,
       e.id AS exam_id,
       e.name AS exam_name,
       ${finalTypeExpr} AS final_calculation_type,
       ${publishedOnExpr} AS published_on,
       es.subject_id,
       ${subjectOfferingExpr} AS subject_offering_id,
       ${subjectGroupExpr} AS subject_group,
       sub.name AS subject_name,
       es.id AS exam_subject_id,
       ${markPatternExpr} AS mark_pattern,
       ${theoryMaxExpr} AS theory_max,
       ${practicalMaxExpr} AS practical_max,
       es.max_marks,
       me.marks,
       ${theoryMarksExpr} AS theory_marks,
       ${practicalMarksExpr} AS practical_marks,
       me.approval_status
     FROM marks_entries me
     JOIN exams e ON e.id = me.exam_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     JOIN academic_sessions sess ON sess.id = se.session_id
     JOIN classes c ON c.id = se.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN streams ON streams.id = se.stream_id
     JOIN exam_scopes esc
       ON esc.exam_id = e.id
      AND esc.class_id = se.class_id
      AND (esc.section_id IS NULL OR esc.section_id = se.section_id)
     ${publicationJoin}
     JOIN exam_subjects es
       ON es.exam_id = e.id
      AND es.subject_id = me.subject_id
     JOIN subjects sub ON sub.id = es.subject_id
     ${subjectOfferingJoin}
     WHERE me.student_id = ?
       AND se.session_id = ?
       AND se.class_id = ?
       AND se.section_id = ?
       AND LOWER(sec.medium) = ?
       AND me.approval_status = 'approved'
       ${visibilityClause}
     ORDER BY erp.published_on ASC, e.id ASC, ${subjectGroupOrderExpr}, sub.name ASC`,
    [
      studentId,
      sessionId,
      classId,
      sectionId,
      String(medium || "").trim().toLowerCase(),
    ]
  );
}

export async function getStudentReportRows(examId, studentId, onlyApproved = true) {
  const approvalClause = onlyApproved ? `AND me.approval_status = 'approved'` : "";
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const subjectSchema = await getExamSubjectSplitSchemaStatus();
  const supportsSplitSubjectSchema =
    subjectSchema.hasMarkPattern &&
    subjectSchema.hasTheoryMax &&
    subjectSchema.hasTheoryPass &&
    subjectSchema.hasPracticalMax &&
    subjectSchema.hasPracticalPass;
  const marksSchema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarksSchema = marksSchema.hasTheoryMarks && marksSchema.hasPracticalMarks;
  const hasStudentExamSubjects = await supportsStudentExamSubjectsTable();
  const hasSubjectRegistrations = await supportsSubjectRegistrationTables();
  const hasSubjectOfferingId = subjectSchema.hasSubjectOfferingId;
  const guardianExpr = await guardianNameExpression();

  const markPatternExpr = supportsSplitSubjectSchema ? "es.mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSubjectSchema ? "es.theory_max" : "NULL";
  const theoryPassExpr = supportsSplitSubjectSchema ? "es.theory_pass" : "NULL";
  const practicalMaxExpr = supportsSplitSubjectSchema ? "es.practical_max" : "NULL";
  const practicalPassExpr = supportsSplitSubjectSchema ? "es.practical_pass" : "NULL";
  const theoryMarksExpr = supportsSplitMarksSchema ? "me.theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarksSchema ? "me.practical_marks" : "NULL";
  const offeredSubjectMatchSql = (offeringAlias) =>
    hasSubjectOfferingId
      ? `(es.subject_offering_id IS NOT NULL AND ${offeringAlias}.id = es.subject_offering_id)
         OR (es.subject_offering_id IS NULL AND ${offeringAlias}.subject_id = es.subject_id)`
      : `${offeringAlias}.subject_id = es.subject_id`;
  const studentSubjectFilterSql = hasStudentExamSubjects && !hasSubjectRegistrations
    ? `AND (
         NOT EXISTS (
           SELECT 1
           FROM student_exam_subjects ses_any
           WHERE ses_any.exam_id = e.id
             AND ses_any.student_id = st.id
         )
         OR EXISTS (
           SELECT 1
           FROM student_exam_subjects ses_match
           WHERE ses_match.exam_id = e.id
             AND ses_match.student_id = st.id
             AND ses_match.subject_id = es.subject_id
         )
       )`
    : "";
  const registeredSubjectFilterSql = hasSubjectRegistrations
    ? `AND (
         NOT EXISTS (
           SELECT 1
           FROM subject_offerings so_any
           WHERE so_any.is_active = TRUE
             AND so_any.class_id = se.class_id
             AND (so_any.section_id IS NULL OR so_any.section_id = se.section_id)
             AND (so_any.stream_id IS NULL OR so_any.stream_id <=> se.stream_id)
             AND (${offeredSubjectMatchSql("so_any")})
         )
         OR EXISTS (
           SELECT 1
           FROM subject_offerings so_required
           WHERE so_required.is_active = TRUE
             AND so_required.subject_group = 'compulsory'
             AND so_required.class_id = se.class_id
             AND (so_required.section_id IS NULL OR so_required.section_id = se.section_id)
             AND (so_required.stream_id IS NULL OR so_required.stream_id <=> se.stream_id)
             AND (${offeredSubjectMatchSql("so_required")})
         )
         OR EXISTS (
           SELECT 1
           FROM student_subject_registrations ssr
           JOIN subject_offerings so_match ON so_match.id = ssr.subject_offering_id
           WHERE ssr.student_id = st.id
             AND ssr.status = 'active'
             AND so_match.is_active = TRUE
             AND so_match.class_id = se.class_id
             AND (so_match.section_id IS NULL OR so_match.section_id = se.section_id)
             AND (so_match.stream_id IS NULL OR so_match.stream_id <=> se.stream_id)
             AND (${offeredSubjectMatchSql("so_match")})
         )
       )`
    : "";

  return query(
    `SELECT
      st.id AS student_id,
      st.name AS student_name,
      guardians.guardian_name,
      e.id AS exam_id,
      e.name AS exam_name,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      sec.medium,
      se.roll_number,
      es.id AS exam_subject_id,
      sub.name AS subject_name,
      ${markPatternExpr} AS mark_pattern,
      es.max_marks,
      es.pass_marks,
      ${theoryMaxExpr} AS theory_max,
      ${theoryPassExpr} AS theory_pass,
      ${practicalMaxExpr} AS practical_max,
      ${practicalPassExpr} AS practical_pass,
      me.marks,
      ${theoryMarksExpr} AS theory_marks,
      ${practicalMarksExpr} AS practical_marks,
      me.approval_status
     FROM exams e
     JOIN student_enrollments se
       ON se.student_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     LEFT JOIN (
       SELECT
         sp.student_id,
         ${guardianExpr} AS guardian_name
       FROM student_parents sp
       JOIN parents p ON p.id = sp.parent_id
       GROUP BY sp.student_id
     ) guardians ON guardians.student_id = st.id
     JOIN classes c ON c.id = se.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     JOIN sections sec ON sec.id = se.section_id
     JOIN exam_subjects es ON es.exam_id = e.id
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN marks_entries me
       ON me.exam_id = e.id
      AND me.subject_id = es.subject_id
      AND me.student_id = st.id
     WHERE e.id = ?
       AND EXISTS (
         SELECT 1
         FROM exam_scopes sc
         WHERE sc.exam_id = e.id
           AND sc.class_id = se.class_id
           AND (sc.section_id IS NULL OR sc.section_id = se.section_id)
       )
       ${approvalClause}
       ${registeredSubjectFilterSql}
       ${studentSubjectFilterSql}
     ORDER BY sub.name ASC`,
    [studentId, examId]
  );
}
