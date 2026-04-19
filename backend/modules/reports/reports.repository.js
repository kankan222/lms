let supportsScopesTableCache;
let examSubjectSplitSchemaStatusCache;
let marksEntrySplitSchemaStatusCache;

async function supportsScopesTable(conn) {
  if (typeof supportsScopesTableCache === "boolean") {
    return supportsScopesTableCache;
  }

  const [rows] = await conn.execute(
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

async function getExamSubjectSplitSchemaStatus(conn) {
  if (examSubjectSplitSchemaStatusCache) {
    return examSubjectSplitSchemaStatusCache;
  }

  const [rows] = await conn.execute(
    `
      SELECT
        SUM(COLUMN_NAME = 'mark_pattern') AS has_mark_pattern,
        SUM(COLUMN_NAME = 'theory_max') AS has_theory_max,
        SUM(COLUMN_NAME = 'theory_pass') AS has_theory_pass,
        SUM(COLUMN_NAME = 'practical_max') AS has_practical_max,
        SUM(COLUMN_NAME = 'practical_pass') AS has_practical_pass
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_subjects'
        AND COLUMN_NAME IN (
          'mark_pattern',
          'theory_max',
          'theory_pass',
          'practical_max',
          'practical_pass'
        )
    `
  );

  examSubjectSplitSchemaStatusCache = {
    hasMarkPattern: Number(rows[0]?.has_mark_pattern || 0) > 0,
    hasTheoryMax: Number(rows[0]?.has_theory_max || 0) > 0,
    hasTheoryPass: Number(rows[0]?.has_theory_pass || 0) > 0,
    hasPracticalMax: Number(rows[0]?.has_practical_max || 0) > 0,
    hasPracticalPass: Number(rows[0]?.has_practical_pass || 0) > 0,
  };

  return examSubjectSplitSchemaStatusCache;
}

async function getMarksEntrySplitSchemaStatus(conn) {
  if (marksEntrySplitSchemaStatusCache) {
    return marksEntrySplitSchemaStatusCache;
  }

  const [rows] = await conn.execute(
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

  marksEntrySplitSchemaStatusCache = {
    hasTheoryMarks: Number(rows[0]?.has_theory_marks || 0) > 0,
    hasPracticalMarks: Number(rows[0]?.has_practical_marks || 0) > 0,
  };

  return marksEntrySplitSchemaStatusCache;
}

export async function getStudentMarks(conn,data){
  const hasScopesTable = await supportsScopesTable(conn);
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const subjectSchema = await getExamSubjectSplitSchemaStatus(conn);
  const supportsSplitSubjectSchema =
    subjectSchema.hasMarkPattern &&
    subjectSchema.hasTheoryMax &&
    subjectSchema.hasTheoryPass &&
    subjectSchema.hasPracticalMax &&
    subjectSchema.hasPracticalPass;
  const marksSchema = await getMarksEntrySplitSchemaStatus(conn);
  const supportsSplitMarksSchema = marksSchema.hasTheoryMarks && marksSchema.hasPracticalMarks;

  const markPatternExpr = supportsSplitSubjectSchema ? "es.mark_pattern" : "'single'";
  const theoryMaxExpr = supportsSplitSubjectSchema ? "es.theory_max" : "NULL";
  const theoryPassExpr = supportsSplitSubjectSchema ? "es.theory_pass" : "NULL";
  const practicalMaxExpr = supportsSplitSubjectSchema ? "es.practical_max" : "NULL";
  const practicalPassExpr = supportsSplitSubjectSchema ? "es.practical_pass" : "NULL";
  const theoryMarksExpr = supportsSplitMarksSchema ? "me.theory_marks" : "NULL";
  const practicalMarksExpr = supportsSplitMarksSchema ? "me.practical_marks" : "NULL";

  const [rows] = await conn.execute(`
    SELECT
      s.id AS student_id,
      s.name AS student_name,
      e.id AS exam_id,
      e.name AS exam_name,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      sec.medium,
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
    FROM marks_entries me
    JOIN students s
      ON s.id = me.student_id
    JOIN exams e
      ON e.id = me.exam_id
    JOIN student_enrollments se
      ON se.student_id = s.id
     AND se.session_id = e.session_id
     AND se.status = 'active'
    JOIN exam_scopes sc
      ON sc.exam_id = e.id
     AND sc.class_id = se.class_id
     AND (sc.section_id IS NULL OR sc.section_id = se.section_id)
    JOIN classes c
      ON c.id = sc.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc_ref ON sc_ref.id = c.scope_id" : ""}
    JOIN sections sec
      ON sec.id = se.section_id
    JOIN exam_subjects es
      ON es.exam_id = e.id
     AND es.subject_id = me.subject_id
    JOIN subjects sub
      ON sub.id = me.subject_id
    WHERE me.student_id = ?
      AND me.exam_id = ?
      AND me.approval_status = 'approved'
    ORDER BY sub.name ASC
  `,[data.studentId,data.examId]);
  return rows;
}
