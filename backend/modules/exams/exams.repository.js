import { query } from "../../core/db/query.js";

let supportsScopesTableCache;
let examScopesClassOnlySchemaStatusCache;
let examSubjectSplitSchemaStatusCache;
let marksEntrySplitSchemaStatusCache;
let studentExamSubjectsTableCache;
let subjectRegistrationTablesCache;
let examSubjectComponentsTableCache;
let examFinalCalculationTypeCache;
let examMarksEntryScopeCache;
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

export async function getExamScopesClassOnlySchemaStatus() {
  if (examScopesClassOnlySchemaStatusCache) {
    return examScopesClassOnlySchemaStatusCache;
  }

  const columnRows = await query(
    `
      SELECT
        SUM(COLUMN_NAME = 'section_id') AS has_section_id,
        SUM(COLUMN_NAME = 'section_id' AND IS_NULLABLE = 'YES') AS has_nullable_section_id,
        SUM(COLUMN_NAME = 'section_id_dedupe') AS has_section_id_dedupe
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND COLUMN_NAME IN ('section_id', 'section_id_dedupe')
    `
  );

  const indexRows = await query(
    `
      SELECT
        SUM(INDEX_NAME = 'uniq_exam_scope_class_section' AND NON_UNIQUE = 0) AS has_scope_unique_index,
        SUM(INDEX_NAME = 'uniq_exam_scope' AND NON_UNIQUE = 0) AS has_legacy_unique_index
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_scopes'
        AND INDEX_NAME IN ('uniq_exam_scope_class_section', 'uniq_exam_scope')
    `
  );

  const status = {
    hasSectionId: Number(columnRows[0]?.has_section_id || 0) > 0,
    hasNullableSectionId: Number(columnRows[0]?.has_nullable_section_id || 0) > 0,
    hasSectionIdDedupe: Number(columnRows[0]?.has_section_id_dedupe || 0) > 0,
    hasScopeUniqueIndex: Number(indexRows[0]?.has_scope_unique_index || 0) > 0,
    hasLegacyUniqueIndex: Number(indexRows[0]?.has_legacy_unique_index || 0) > 0,
  };

  examScopesClassOnlySchemaStatusCache = status;
  return status;
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

export async function supportsExamFinalCalculationTypeColumn() {
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

export async function supportsExamMarksEntryScopeColumn() {
  if (typeof examMarksEntryScopeCache === "boolean") {
    return examMarksEntryScopeCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exams'
        AND COLUMN_NAME = 'marks_entry_scope'
    `
  );

  examMarksEntryScopeCache = Number(rows[0]?.total || 0) > 0;
  return examMarksEntryScopeCache;
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

export async function getTeacherProfileByUser(userId) {
  const rows = await query(`SELECT id FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function getParentProfileByUser(userId) {
  const rows = await query(`SELECT id FROM parents WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function isParentOfStudent(userId, studentId) {
  const rows = await query(
    `SELECT 1
     FROM parents p
     JOIN student_parents sp ON sp.parent_id = p.id
     WHERE p.user_id = ? AND sp.student_id = ?
     LIMIT 1`,
    [userId, studentId]
  );
  return rows.length > 0;
}

export async function getActiveSessionId(conn) {
  const [rows] = await conn.execute(
    `SELECT id
     FROM academic_sessions
     WHERE is_active = TRUE
     ORDER BY id DESC
     LIMIT 1`
  );
  return rows[0]?.id || null;
}

export async function createExam(conn, data) {
  const hasFinalType = await supportsExamFinalCalculationTypeColumn();
  const hasMarksEntryScope = await supportsExamMarksEntryScopeColumn();
  const [result] = await conn.execute(
    `INSERT INTO exams
       (name, session_id, class_id, section_id, ${hasFinalType ? "final_calculation_type," : ""} ${hasMarksEntryScope ? "marks_entry_scope," : ""} created_by)
     VALUES (?, ?, ?, ?, ${hasFinalType ? "?," : ""} ${hasMarksEntryScope ? "?," : ""} ?)`,
    [
      data.name,
      data.session_id,
      data.class_id ?? null,
      data.section_id ?? null,
      ...(hasFinalType ? [data.final_calculation_type || "display_only"] : []),
      ...(hasMarksEntryScope ? [data.marks_entry_scope || "subject_assignment"] : []),
      data.created_by,
    ]
  );
  return result.insertId;
}

export async function updateExam(conn, id, data) {
  const hasFinalType = await supportsExamFinalCalculationTypeColumn();
  const hasMarksEntryScope = await supportsExamMarksEntryScopeColumn();
  await conn.execute(
    `UPDATE exams
     SET name = ?, session_id = ?, class_id = ?, section_id = ?
         ${hasFinalType ? ", final_calculation_type = ?" : ""}
         ${hasMarksEntryScope ? ", marks_entry_scope = ?" : ""}
     WHERE id = ?`,
    [
      data.name,
      data.session_id,
      data.class_id ?? null,
      data.section_id ?? null,
      ...(hasFinalType ? [data.final_calculation_type || "display_only"] : []),
      ...(hasMarksEntryScope ? [data.marks_entry_scope || "subject_assignment"] : []),
      id,
    ]
  );
}

export async function deleteExam(conn, id) {
  await conn.execute(`DELETE FROM marks_entries WHERE exam_id = ?`, [id]);
  await conn.execute(`DELETE FROM exams WHERE id = ?`, [id]);
}

export async function replaceExamScopes(conn, examId, scopes) {
  await conn.execute(`DELETE FROM exam_scopes WHERE exam_id = ?`, [examId]);
  if (!scopes.length) return;

  const values = scopes.map((s) => [examId, s.class_id, s.section_id]);
  await conn.query(
    `INSERT INTO exam_scopes (exam_id, class_id, section_id)
     VALUES ?`,
    [values]
  );
}

export async function getExamScopes(examId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  return query(
    `SELECT
      es.id,
      es.exam_id,
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

export async function getExamById(id) {
  const hasScopesTable = await supportsScopesTable();
  const hasFinalType = await supportsExamFinalCalculationTypeColumn();
  const hasMarksEntryScope = await supportsExamMarksEntryScopeColumn();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const finalTypeExpr = hasFinalType ? "e.final_calculation_type" : "'display_only'";
  const marksEntryScopeExpr = hasMarksEntryScope ? "e.marks_entry_scope" : "'subject_assignment'";

  const rows = await query(
    `SELECT
      e.id,
      e.name,
      e.session_id,
      e.class_id,
      e.section_id,
      ${finalTypeExpr} AS final_calculation_type,
      ${marksEntryScopeExpr} AS marks_entry_scope,
      e.created_by,
      ses.name AS session_name,
      ${classScopeExpr} AS class_scope
     FROM exams e
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     LEFT JOIN classes c ON c.id = e.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listExams(filters, userId, isTeacher) {
  const hasScopesTable = await supportsScopesTable();
  const hasFinalType = await supportsExamFinalCalculationTypeColumn();
  const hasMarksEntryScope = await supportsExamMarksEntryScopeColumn();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const finalTypeExpr = hasFinalType ? "e.final_calculation_type" : "'display_only'";
  const marksEntryScopeExpr = hasMarksEntryScope ? "e.marks_entry_scope" : "'subject_assignment'";
  const where = [];
  const params = [];
  let join = `
    LEFT JOIN exam_scopes sc ON sc.exam_id = e.id
    LEFT JOIN classes c ON c.id = sc.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
    LEFT JOIN sections sec ON sec.id = sc.section_id
  `;

  if (isTeacher) {
    join += `
      JOIN teachers t ON t.user_id = ?
      JOIN teacher_class_assignments tca
        ON tca.teacher_id = t.id
       AND tca.session_id = e.session_id
       AND tca.class_id = sc.class_id
       AND (sc.section_id IS NULL OR tca.section_id = sc.section_id)
    `;
    params.push(userId);
  }

  if (filters.session_id) {
    where.push("e.session_id = ?");
    params.push(Number(filters.session_id));
  }
  if (filters.class_id) {
    where.push("sc.class_id = ?");
    params.push(Number(filters.class_id));
  }
  if (filters.section_id) {
    where.push("(sc.section_id = ? OR sc.section_id IS NULL)");
    params.push(Number(filters.section_id));
  }
  if (filters.class_scope || filters.scope) {
    where.push(`${classScopeExpr} = ?`);
    params.push(String(filters.class_scope || filters.scope).trim().toLowerCase());
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ${finalTypeExpr} AS final_calculation_type,
      ${marksEntryScopeExpr} AS marks_entry_scope,
      ses.name AS session_name,
      COALESCE(
        NULLIF(GROUP_CONCAT(DISTINCT ${classScopeExpr} ORDER BY ${classScopeExpr} SEPARATOR ','), ''),
        'school'
      ) AS class_scope
     FROM exams e
     ${join}
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     ${whereSql}
     GROUP BY e.id, e.name, e.session_id, ${finalTypeExpr}, ${marksEntryScopeExpr}, ses.name
     ORDER BY e.id DESC`,
    params
  );
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

  const subjects = await query(
    `SELECT
      es.id AS exam_subject_id,
      es.exam_id,
      es.subject_id,
      ${subjectOfferingExpr} AS subject_offering_id,
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
     WHERE es.exam_id = ?
     ORDER BY sub.name ASC`,
    [examId]
  );

  if (!(await supportsExamSubjectComponentsTable()) || !subjects.length) {
    return subjects.map((subject) => ({ ...subject, components: [] }));
  }

  const examSubjectIds = subjects.map((subject) => Number(subject.exam_subject_id)).filter(Boolean);
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
    id: subject.exam_subject_id,
    components: componentsBySubject.get(Number(subject.exam_subject_id)) || [],
  }));
}

export async function attachUniqueSubjectOfferingIds(conn, scopes, subjects) {
  const schema = await getExamSubjectSplitSchemaStatus();
  if (!schema.hasSubjectOfferingId || !Array.isArray(scopes) || !scopes.length) {
    return subjects;
  }

  const scopeClauses = [];
  const params = [];

  scopes.forEach((scope) => {
    const classId = Number(scope.class_id);
    if (!classId) return;

    const sectionId =
      scope.section_id === null || scope.section_id === undefined || String(scope.section_id).trim() === ""
        ? null
        : Number(scope.section_id);

    scopeClauses.push(
      "(so.class_id = ? AND (so.section_id IS NULL OR ? IS NULL OR so.section_id = ?))"
    );
    params.push(classId, sectionId, sectionId);
  });

  if (!scopeClauses.length) return subjects;

  const resolvedSubjects = [];
  for (const subject of subjects) {
    if (subject.subject_offering_id) {
      resolvedSubjects.push(subject);
      continue;
    }

    const [rows] = await conn.execute(
      `SELECT so.id
       FROM subject_offerings so
       WHERE so.is_active = TRUE
         AND so.subject_id = ?
         AND (${scopeClauses.join(" OR ")})
       GROUP BY so.id
       LIMIT 2`,
      [subject.subject_id, ...params]
    );

    resolvedSubjects.push({
      ...subject,
      subject_offering_id: rows.length === 1 ? Number(rows[0].id) : null,
    });
  }

  return resolvedSubjects;
}

export async function replaceExamSubjects(conn, examId, subjects) {
  await conn.execute(`DELETE FROM exam_subjects WHERE exam_id = ?`, [examId]);
  if (!subjects.length) return;

  const schema = await getExamSubjectSplitSchemaStatus();
  const supportsSplitSchema =
    schema.hasMarkPattern &&
    schema.hasTheoryMax &&
    schema.hasTheoryPass &&
    schema.hasPracticalMax &&
    schema.hasPracticalPass;

  if (supportsSplitSchema) {
    const values = subjects.map((s) => [
      examId,
      s.subject_id,
      ...(schema.hasSubjectOfferingId ? [s.subject_offering_id ?? null] : []),
      s.mark_pattern || "single",
      s.max_marks,
      s.pass_marks,
      s.theory_max ?? null,
      s.theory_pass ?? null,
      s.practical_max ?? null,
      s.practical_pass ?? null,
    ]);

    await conn.query(
      `INSERT INTO exam_subjects
       (
         exam_id,
         subject_id,
         ${schema.hasSubjectOfferingId ? "subject_offering_id," : ""}
         mark_pattern,
         max_marks,
         pass_marks,
         theory_max,
         theory_pass,
         practical_max,
         practical_pass
       )
       VALUES ?`,
      [values]
    );
    await replaceExamSubjectComponents(conn, examId, subjects);
    return;
  }

  const values = subjects.map((s) => [
    examId,
    s.subject_id,
    ...(schema.hasSubjectOfferingId ? [s.subject_offering_id ?? null] : []),
    s.max_marks,
    s.pass_marks,
  ]);
  await conn.query(
    `INSERT INTO exam_subjects (
       exam_id,
       subject_id,
       ${schema.hasSubjectOfferingId ? "subject_offering_id," : ""}
       max_marks,
       pass_marks
     )
     VALUES ?`,
    [values]
  );
  await replaceExamSubjectComponents(conn, examId, subjects);
}

async function replaceExamSubjectComponents(conn, examId, subjects) {
  if (!(await supportsExamSubjectComponentsTable())) return;

  const subjectsWithComponents = subjects.filter(
    (subject) => Array.isArray(subject.components) && subject.components.length
  );
  if (!subjectsWithComponents.length) return;

  const [examSubjectRows] = await conn.execute(
    `SELECT id, subject_id
     FROM exam_subjects
     WHERE exam_id = ?`,
    [examId]
  );
  const examSubjectIdBySubject = new Map(
    examSubjectRows.map((row) => [Number(row.subject_id), Number(row.id)])
  );

  const values = [];
  subjectsWithComponents.forEach((subject) => {
    const examSubjectId = examSubjectIdBySubject.get(Number(subject.subject_id));
    if (!examSubjectId) return;

    subject.components.forEach((component, index) => {
      values.push([
        examSubjectId,
        component.name,
        component.mark_pattern || "split",
        component.max_marks,
        component.pass_marks,
        component.theory_max ?? null,
        component.theory_pass ?? null,
        component.practical_max ?? null,
        component.practical_pass ?? null,
        Number(component.sort_order ?? index),
      ]);
    });
  });

  if (!values.length) return;

  await conn.query(
    `INSERT INTO exam_subject_components
     (
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
     )
     VALUES ?`,
    [values]
  );
}

export async function getStudentExamSubjects(examId) {
  const hasTable = await supportsStudentExamSubjectsTable();
  if (!hasTable) return [];

  return query(
    `SELECT exam_id, student_id, subject_id
     FROM student_exam_subjects
     WHERE exam_id = ?
     ORDER BY student_id ASC, subject_id ASC`,
    [examId]
  );
}

export async function replaceStudentExamSubjects(conn, examId, rows) {
  const hasTable = await supportsStudentExamSubjectsTable();
  if (!hasTable) return;

  await conn.execute(`DELETE FROM student_exam_subjects WHERE exam_id = ?`, [examId]);
  if (!rows.length) return;

  const values = rows.map((row) => [examId, row.student_id, row.subject_id]);
  await conn.query(
    `INSERT INTO student_exam_subjects (exam_id, student_id, subject_id)
     VALUES ?`,
    [values]
  );
}

export async function isTeacherAssignedToExamScope(userId, examId, classId, sectionId, subjectId = null) {
  let subjectClause = "";
  if (subjectId) {
    subjectClause = `AND tca.subject_id = ?`;
  }

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
    subjectId
      ? [userId, classId, sectionId, sectionId, subjectId, examId]
      : [userId, classId, sectionId, sectionId, examId]
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
      tca.subject_id,
      ${classScopeExpr} AS class_scope,
      c.name AS class_name,
      s.name AS section_name
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

export async function getStudentsForScope(examId, classId, sectionId, name = "", subjectId = null) {
  const hasStudentExamSubjects = await supportsStudentExamSubjectsTable();
  const hasSubjectRegistrations = await supportsSubjectRegistrationTables();
  const examSubjectSchema = await getExamSubjectSplitSchemaStatus();
  const hasSubjectOfferingId = examSubjectSchema.hasSubjectOfferingId;

  const params = [classId, sectionId, sectionId, examId];
  const nameSql = name ? `AND st.name LIKE ?` : "";
  const registeredSubjectSql =
    hasSubjectRegistrations && subjectId
      ? `AND (
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
      : "";
  const studentSubjectSql =
    hasStudentExamSubjects && !hasSubjectRegistrations && subjectId
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
               AND ses_match.subject_id = ?
           )
         )`
      : "";

  if (name) params.push(`%${name}%`);
  if (hasSubjectRegistrations && subjectId) params.push(subjectId, subjectId, subjectId);
  if (hasStudentExamSubjects && !hasSubjectRegistrations && subjectId) params.push(subjectId);

  return query(
    `SELECT DISTINCT
      st.id AS student_id,
      st.name AS student_name,
      se.roll_number
     FROM exams e
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND (sc.section_id IS NULL OR sc.section_id = ?)
     JOIN student_enrollments se
       ON se.class_id = sc.class_id
      AND se.section_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     WHERE e.id = ?
       ${nameSql}
       ${registeredSubjectSql}
       ${studentSubjectSql}
     ORDER BY se.roll_number ASC, st.name ASC`,
    params
  );
}

export async function getMarksGrid(examId, classId, sectionId, name = "") {
  const students = await getStudentsForScope(examId, classId, sectionId, name);
  const subjects = await getExamSubjects(examId);
  if (!students.length || !subjects.length) {
    return { students, subjects, marks: [] };
  }

  const marksSchema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarks = marksSchema.hasTheoryMarks && marksSchema.hasPracticalMarks;
  const theoryMarksExpr = supportsSplitMarks ? "theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarks ? "practical_marks" : "NULL";

  const studentIds = students.map((s) => s.student_id);
  const placeholders = studentIds.map(() => "?").join(",");

  const marks = await query(
    `SELECT
      id AS mark_id,
      student_id,
      subject_id,
      marks,
      ${theoryMarksExpr} AS theory_marks,
      ${practicalMarksExpr} AS practical_marks,
      approval_status
     FROM marks_entries
     WHERE exam_id = ?
       AND student_id IN (${placeholders})`,
    [examId, ...studentIds]
  );

  return { students, subjects, marks };
}

export async function getExamSubject(examId, subjectId) {
  const schema = await getExamSubjectSplitSchemaStatus();
  const supportsSplitSchema =
    schema.hasMarkPattern &&
    schema.hasTheoryMax &&
    schema.hasTheoryPass &&
    schema.hasPracticalMax &&
    schema.hasPracticalPass;

  const markPatternExpr = supportsSplitSchema ? "mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSchema ? "theory_max" : "NULL";
  const theoryPassExpr = supportsSplitSchema ? "theory_pass" : "NULL";
  const practicalMaxExpr = supportsSplitSchema ? "practical_max" : "NULL";
  const practicalPassExpr = supportsSplitSchema ? "practical_pass" : "NULL";
  const subjectOfferingExpr = schema.hasSubjectOfferingId ? "subject_offering_id" : "NULL";

  const rows = await query(
    `SELECT
      id,
      exam_id,
      subject_id,
      ${subjectOfferingExpr} AS subject_offering_id,
      ${markPatternExpr} AS mark_pattern,
      max_marks,
      pass_marks,
      ${theoryMaxExpr} AS theory_max,
      ${theoryPassExpr} AS theory_pass,
      ${practicalMaxExpr} AS practical_max,
      ${practicalPassExpr} AS practical_pass
     FROM exam_subjects
     WHERE exam_id = ? AND subject_id = ?
     LIMIT 1`,
    [examId, subjectId]
  );
  return rows[0] || null;
}

export async function upsertMarks(conn, rows) {
  if (!rows.length) return;
  const schema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarks = schema.hasTheoryMarks && schema.hasPracticalMarks;

  if (supportsSplitMarks) {
    const values = rows.map((r) => [
      r.student_id,
      r.exam_id,
      r.subject_id,
      r.marks,
      r.theory_marks ?? null,
      r.practical_marks ?? null,
      r.entered_by,
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
         approval_status = 'draft',
         approved_by = NULL,
         approved_at = NULL`,
      [values]
    );
    return;
  }

  const values = rows.map((r) => [r.student_id, r.exam_id, r.subject_id, r.marks, r.entered_by]);
  await conn.query(
    `INSERT INTO marks_entries
     (student_id, exam_id, subject_id, marks, entered_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       marks = VALUES(marks),
       entered_by = VALUES(entered_by),
       approval_status = 'draft',
       approved_by = NULL,
       approved_at = NULL`,
    [values]
  );
}

export async function getMarkById(markId) {
  const schema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarks = schema.hasTheoryMarks && schema.hasPracticalMarks;
  const theoryMarksExpr = supportsSplitMarks ? "theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarks ? "practical_marks" : "NULL";

  const rows = await query(
    `SELECT
      id,
      student_id,
      exam_id,
      subject_id,
      marks,
      ${theoryMarksExpr} AS theory_marks,
      ${practicalMarksExpr} AS practical_marks,
      entered_by,
      approval_status
     FROM marks_entries
     WHERE id = ?
     LIMIT 1`,
    [markId]
  );
  return rows[0] || null;
}

export async function getStudentScopeForExam(studentId, examId) {
  const rows = await query(
    `SELECT se.class_id, se.section_id
     FROM exams e
     JOIN student_enrollments se
       ON se.student_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
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

export async function updateMarkById(conn, markId, data, enteredBy) {
  const schema = await getMarksEntrySplitSchemaStatus();
  const supportsSplitMarks = schema.hasTheoryMarks && schema.hasPracticalMarks;

  if (supportsSplitMarks) {
    await conn.execute(
      `UPDATE marks_entries
       SET marks = ?,
           theory_marks = ?,
           practical_marks = ?,
           entered_by = ?,
           approval_status = 'draft',
           approved_by = NULL,
           approved_at = NULL
       WHERE id = ?`,
      [data.marks, data.theory_marks ?? null, data.practical_marks ?? null, enteredBy, markId]
    );
    return;
  }

  await conn.execute(
    `UPDATE marks_entries
     SET marks = ?,
         entered_by = ?,
         approval_status = 'draft',
         approved_by = NULL,
         approved_at = NULL
     WHERE id = ?`,
    [data.marks, enteredBy, markId]
  );
}

export async function deleteMarkById(conn, markId) {
  await conn.execute(`DELETE FROM marks_entries WHERE id = ?`, [markId]);
}

export async function approveMarksByExamSubjectScope(conn, examId, subjectId, classId, sectionId, status, approvedBy) {
  const nextStatus = status === "rejected" ? "draft" : status;
  const [result] = await conn.execute(
    `UPDATE marks_entries me
     JOIN student_enrollments se
       ON se.student_id = me.student_id
     JOIN exams e
       ON e.id = me.exam_id
      AND e.session_id = se.session_id
     SET me.approval_status = ?,
         me.approved_by = CASE WHEN ? = 'approved' THEN ? ELSE NULL END,
         me.approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END
     WHERE me.exam_id = ?
       AND me.subject_id = ?
       AND se.class_id = ?
       AND se.section_id = ?
       AND se.status = 'active'
       AND me.approval_status = 'pending'`,
    [nextStatus, nextStatus, approvedBy, nextStatus, examId, subjectId, classId, sectionId]
  );
  return result.affectedRows;
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
      se.roll_number,
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

export async function getUserRoleNames(userId) {
  const rows = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((r) => r.name);
}
