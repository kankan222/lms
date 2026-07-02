import { query, execute } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

let supportsFeeStructuresStreamIdCache;
let supportsScopesTableCache;
let feeStructuresStreamSchemaStatusCache;

export async function supportsFeeStructuresStreamId() {
  if (typeof supportsFeeStructuresStreamIdCache === "boolean") {
    return supportsFeeStructuresStreamIdCache;
  }

  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'fee_structures'
        AND COLUMN_NAME = 'stream_id'
    `
  );

  supportsFeeStructuresStreamIdCache = Number(rows[0]?.total || 0) > 0;
  return supportsFeeStructuresStreamIdCache;
}

export async function getFeeStructuresStreamSchemaStatus() {
  if (feeStructuresStreamSchemaStatusCache) {
    return feeStructuresStreamSchemaStatusCache;
  }

  const columnRows = await query(
    `
      SELECT
        SUM(COLUMN_NAME = 'stream_id') AS has_stream_id,
        SUM(COLUMN_NAME = 'stream_id_dedupe') AS has_stream_id_dedupe
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'fee_structures'
        AND COLUMN_NAME IN ('stream_id', 'stream_id_dedupe')
    `
  );

  const indexRows = await query(
    `
      SELECT
        SUM(INDEX_NAME = 'unique_class_session_stream' AND NON_UNIQUE = 0) AS has_unique_class_session_stream,
        SUM(INDEX_NAME = 'unique_class_session' AND NON_UNIQUE = 0) AS has_legacy_unique_class_session
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'fee_structures'
        AND INDEX_NAME IN ('unique_class_session_stream', 'unique_class_session')
    `
  );

  const status = {
    hasStreamId: Number(columnRows[0]?.has_stream_id || 0) > 0,
    hasStreamIdDedupe: Number(columnRows[0]?.has_stream_id_dedupe || 0) > 0,
    hasUniqueClassSessionStream: Number(indexRows[0]?.has_unique_class_session_stream || 0) > 0,
    hasLegacyUniqueClassSession: Number(indexRows[0]?.has_legacy_unique_class_session || 0) > 0,
  };

  feeStructuresStreamSchemaStatusCache = status;
  return status;
}

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

function buildClassScopeExpression(hasScopesTable, classAlias = "c", scopeAlias = "sc") {
  if (hasScopesTable) {
    return `COALESCE(${scopeAlias}.code, ${classAlias}.class_scope, 'school')`;
  }

  return `COALESCE(${classAlias}.class_scope, 'school')`;
}

export async function insertFeeStructure(data, conn) {
  const hasStreamId = await supportsFeeStructuresStreamId();

  const sql = hasStreamId
    ? `
      INSERT INTO fee_structures
      (class_id, session_id, stream_id, admission_fee)
      VALUES (?,?,?,?)
    `
    : `
      INSERT INTO fee_structures
      (class_id, session_id, admission_fee)
      VALUES (?,?,?)
    `;

  const params = hasStreamId
    ? [data.class_id, data.session_id, data.stream_id ?? null, data.admission_fee]
    : [data.class_id, data.session_id, data.admission_fee];

  const result = await execute(sql, params);

  return result;
}

export async function getLegacyHsNullStreamStructure(classId, sessionId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const rows = await query(
    `
      SELECT fs.id, fs.class_id, fs.session_id, fs.stream_id, fs.admission_fee
      FROM fee_structures fs
      JOIN classes c ON c.id = fs.class_id
      ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
      WHERE fs.class_id = ?
        AND fs.session_id = ?
        AND fs.stream_id IS NULL
        AND ${classScopeExpr} = 'hs'
      LIMIT 1
    `,
    [classId, sessionId]
  );

  return rows[0] || null;
}

export async function assignLegacyStructureToStream(structureId, streamId, admissionFee = null) {
  const params = [streamId];
  const admissionSetSql = Number.isFinite(Number(admissionFee))
    ? ", admission_fee = ?"
    : "";

  if (admissionSetSql) {
    params.push(Number(admissionFee));
  }

  params.push(structureId);

  return execute(
    `
      UPDATE fee_structures
      SET stream_id = ? ${admissionSetSql}
      WHERE id = ?
        AND stream_id IS NULL
    `,
    params
  );
}

export async function getFeeStructure(classId, sessionId, streamId = null) {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const sql = hasStreamId
    ? `
  SELECT
    fs.*,
    ${classScopeExpr} AS class_scope,
    st.name AS stream_name
  FROM fee_structures fs
  JOIN classes c ON c.id = fs.class_id
  ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
  LEFT JOIN streams st ON st.id = fs.stream_id
  WHERE class_id = ?
  AND session_id = ?
  AND (stream_id <=> ?)
  `
    : `
  SELECT
    fs.*,
    NULL AS stream_id,
    ${classScopeExpr} AS class_scope,
    NULL AS stream_name
  FROM fee_structures fs
  JOIN classes c ON c.id = fs.class_id
  ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
  WHERE class_id = ?
  AND session_id = ?
  `;

  const rows = await query(sql, hasStreamId ? [classId, sessionId, streamId] : [classId, sessionId]);

  return rows[0];
}
export async function getAllFeeStructures() {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const sql = hasStreamId
    ? `
    SELECT
      fs.id,
      fs.class_id,
      fs.session_id,
      fs.stream_id,
      fs.admission_fee,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      s.name AS session_name,
      st.name AS stream_name
    FROM fee_structures fs
    JOIN classes c ON fs.class_id = c.id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN academic_sessions s ON fs.session_id = s.id
    LEFT JOIN streams st ON st.id = fs.stream_id
    ORDER BY c.name, st.name, s.name
  `
    : `
    SELECT
      fs.id,
      fs.class_id,
      fs.session_id,
      NULL AS stream_id,
      fs.admission_fee,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      s.name AS session_name,
      NULL AS stream_name
    FROM fee_structures fs
    JOIN classes c ON fs.class_id = c.id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN academic_sessions s ON fs.session_id = s.id
    ORDER BY c.name, s.name
  `;

  const rows = await query(sql);

  return rows;
}
export async function insertInstallment(data) {

  const sql = `
  INSERT INTO fee_installments
  (fee_structure_id, installment_name, amount, due_date)
  VALUES (?,?,?,?)
  `;

  const result = await execute(sql, [
    data.fee_structure_id,
    data.installment_name,
    data.amount,
    data.due_date
  ]);

  return result;
}

export async function getInstallmentById(id) {
  const rows = await query(
    `SELECT id, fee_structure_id, installment_name, amount, due_date
     FROM fee_installments
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function updateFeeStructure(id, data) {
  const hasStreamId = await supportsFeeStructuresStreamId();

  const sql = hasStreamId
    ? `
      UPDATE fee_structures
      SET class_id = ?, session_id = ?, stream_id = ?, admission_fee = ?
      WHERE id = ?
    `
    : `
      UPDATE fee_structures
      SET class_id = ?, session_id = ?, admission_fee = ?
      WHERE id = ?
    `;

  const params = hasStreamId
    ? [data.class_id, data.session_id, data.stream_id ?? null, data.admission_fee, id]
    : [data.class_id, data.session_id, data.admission_fee, id];

  return execute(sql, params);
}

export async function deleteFeeStructure(id) {
  return execute(`DELETE FROM fee_structures WHERE id = ?`, [id]);
}

export async function updateInstallment(id, data) {
  const sql = `
    UPDATE fee_installments
    SET installment_name = ?, amount = ?, due_date = ?
    WHERE id = ?
  `;
  return execute(sql, [data.installment_name, data.amount, data.due_date ?? null, id]);
}

export async function deleteInstallment(id) {
  return execute(`DELETE FROM fee_installments WHERE id = ?`, [id]);
}
export async function insertAdmissionFee(enrollmentId, amount) {

  const sql = `
  INSERT INTO student_fees
  (enrollment_id, fee_type, amount)
  VALUES (?,?,?)
  `;

  return execute(sql, [enrollmentId, "admission", amount]);
}
export async function insertStudentInstallment(enrollmentId, installmentId, amount) {

  const sql = `
  INSERT INTO student_fees
  (enrollment_id, installment_id, fee_type, amount)
  VALUES (?,?,?,?)
  `;

  return execute(sql, [
    enrollmentId,
    installmentId,
    "installment",
    amount
  ]);
}

export async function getStudentFeeSyncRows(enrollmentId) {
  const sql = `
    SELECT
      sf.id,
      sf.enrollment_id,
      sf.installment_id,
      sf.fee_type,
      sf.amount,
      sf.status,
      COALESCE(SUM(p.amount_paid), 0) AS paid
    FROM student_fees sf
    LEFT JOIN payments p
      ON p.student_fee_id = sf.id
    WHERE sf.enrollment_id = ?
    GROUP BY sf.id, sf.enrollment_id, sf.installment_id, sf.fee_type, sf.amount, sf.status
  `;

  return query(sql, [enrollmentId]);
}

export async function updateStudentFeeAmount(studentFeeId, amount) {
  return execute(
    `UPDATE student_fees SET amount = ? WHERE id = ?`,
    [amount, studentFeeId]
  );
}

export async function deleteStudentFee(studentFeeId) {
  return execute(`DELETE FROM student_fees WHERE id = ?`, [studentFeeId]);
}

export async function deleteUnpaidStudentFeesForInstallment(installmentId) {
  return execute(
    `
      DELETE sf
      FROM student_fees sf
      LEFT JOIN (
        SELECT student_fee_id, COALESCE(SUM(amount_paid), 0) AS paid
        FROM payments
        GROUP BY student_fee_id
      ) paid_map
        ON paid_map.student_fee_id = sf.id
      WHERE sf.installment_id = ?
        AND COALESCE(paid_map.paid, 0) = 0
    `,
    [installmentId]
  );
}

export async function deleteUnpaidStudentFeesForStructure(structureId) {
  const hasStreamId = await supportsFeeStructuresStreamId();
  return execute(
    hasStreamId
      ? `
      DELETE sf
      FROM student_fees sf
      JOIN student_enrollments se
        ON se.id = sf.enrollment_id
      JOIN fee_structures fs
        ON fs.class_id = se.class_id
       AND fs.session_id = se.session_id
       AND fs.stream_id <=> se.stream_id
      LEFT JOIN (
        SELECT student_fee_id, COALESCE(SUM(amount_paid), 0) AS paid
        FROM payments
        GROUP BY student_fee_id
      ) paid_map
        ON paid_map.student_fee_id = sf.id
      WHERE fs.id = ?
        AND COALESCE(paid_map.paid, 0) = 0
    `
      : `
      DELETE sf
      FROM student_fees sf
      JOIN student_enrollments se
        ON se.id = sf.enrollment_id
      JOIN fee_structures fs
        ON fs.class_id = se.class_id
       AND fs.session_id = se.session_id
      LEFT JOIN (
        SELECT student_fee_id, COALESCE(SUM(amount_paid), 0) AS paid
        FROM payments
        GROUP BY student_fee_id
      ) paid_map
        ON paid_map.student_fee_id = sf.id
      WHERE fs.id = ?
        AND COALESCE(paid_map.paid, 0) = 0
    `,
    [structureId]
  );
}
export async function getStudentLedger(enrollmentId) {

  const sql = `
SELECT
sf.id,
sf.fee_type,
fi.installment_name,
sf.amount,
COALESCE(SUM(p.amount_paid),0) paid,
(sf.amount - COALESCE(SUM(p.amount_paid),0)) remaining
FROM student_fees sf
LEFT JOIN fee_installments fi
ON sf.installment_id = fi.id
LEFT JOIN payments p
ON sf.id = p.student_fee_id
WHERE sf.enrollment_id=?
GROUP BY sf.id
  `;

  const rows = await query(sql, [enrollmentId]);

  return rows;
}
export async function insertPayment(data) {

  const sql = `
  INSERT INTO payments
  (student_fee_id, amount_paid, remarks, status, created_by)
  VALUES (?,?,?,?,?)
  `;

  const params = [
    data.student_fee_id ?? null,
    data.amount_paid ?? 0,
    data.remarks ?? null,
    "approved",
    data.created_by ?? null
  ];

  const result = await execute(sql, params);
  const paymentId = Number(result?.insertId || 0);
  if (paymentId > 0) {
    await execute(
      `UPDATE payments
       SET receipt_serial = CONCAT('PAY-', LPAD(id, 6, '0'))
       WHERE id = ? AND receipt_serial IS NULL`,
      [paymentId]
    );
  }
  return result;
}
export async function approvePayment(paymentId, adminId) {

  const sql = `
  UPDATE payments
  SET status='approved',
  approved_by=?,
  approved_at=NOW()
  WHERE id=?
  `;

  return execute(sql, [adminId, paymentId]);
}
export async function getPendingPayments() {

  const sql = `
  SELECT p.id, s.name, p.amount_paid
  FROM payments p
  JOIN student_fees sf ON p.student_fee_id = sf.id
  JOIN student_enrollments e ON sf.enrollment_id = e.id
  JOIN students s ON e.student_id = s.id
  WHERE p.status='pending'
  `;

  const rows = await query(sql);

  return rows;
}
export async function getActiveEnrollmentByStudent(studentId) {
  const sql = `
    SELECT id, class_id, section_id, session_id
    FROM student_enrollments
    WHERE student_id = ?
      AND status = 'active'
    ORDER BY id DESC
    LIMIT 1
  `;
  const rows = await query(sql, [studentId]);
  return rows[0];
}

export async function getParentStudentIdsByUser(userId) {
  const rows = await query(
    `SELECT DISTINCT sp.student_id
     FROM parents p
     JOIN student_parents sp ON sp.parent_id = p.id
     WHERE p.user_id = ?`,
    [userId]
  );
  return rows.map((row) => Number(row.student_id));
}

export async function getFeeStructureById(id) {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const rows = await query(
    hasStreamId
      ? `SELECT id, class_id, session_id, stream_id, admission_fee
     FROM fee_structures
     WHERE id = ?
     LIMIT 1`
      : `SELECT id, class_id, session_id, NULL AS stream_id, admission_fee
     FROM fee_structures
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function countStudentFees(enrollmentId) {
  const sql = `
    SELECT COUNT(*) AS total
    FROM student_fees
    WHERE enrollment_id = ?
  `;
  const rows = await query(sql, [enrollmentId]);
  return Number(rows[0]?.total || 0);
}

export async function getStudentFeeOptions(enrollmentId) {
  const sql = `
    SELECT
      sf.id,
      sf.fee_type,
      sf.amount,
      sf.status,
      fi.installment_name,
      fi.due_date,
      COALESCE(SUM(p.amount_paid), 0) AS paid,
      (sf.amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining
    FROM student_fees sf
    LEFT JOIN fee_installments fi
      ON sf.installment_id = fi.id
    LEFT JOIN payments p
      ON p.student_fee_id = sf.id
    WHERE sf.enrollment_id = ?
    GROUP BY sf.id, sf.fee_type, sf.amount, sf.status, fi.installment_name, fi.due_date
    HAVING remaining > 0
    ORDER BY fi.due_date IS NULL DESC, fi.due_date ASC, sf.id ASC
  `;
  return query(sql, [enrollmentId]);
}

export async function findStudentFeesForPaymentImport(filters = {}) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const where = ["se.status = 'active'"];
  const params = [];

  if (filters.session_id) {
    where.push("se.session_id = ?");
    params.push(filters.session_id);
  } else if (filters.session_name) {
    where.push("LOWER(acs.name) = LOWER(?)");
    params.push(filters.session_name);
  }

  if (filters.class_id) {
    where.push("se.class_id = ?");
    params.push(filters.class_id);
  } else if (filters.class_name) {
    where.push("LOWER(c.name) = LOWER(?)");
    params.push(filters.class_name);
  }

  if (filters.section_id) {
    where.push("se.section_id = ?");
    params.push(filters.section_id);
  } else if (filters.section_name) {
    where.push("LOWER(sec.name) = LOWER(?)");
    params.push(filters.section_name);
  }

  if (filters.stream_id) {
    where.push("se.stream_id = ?");
    params.push(filters.stream_id);
  } else if (filters.stream_name) {
    where.push("LOWER(str.name) = LOWER(?)");
    params.push(filters.stream_name);
  }

  if (filters.admission_no) {
    where.push("LOWER(s.admission_no) = LOWER(?)");
    params.push(filters.admission_no);
  }

  if (filters.student_name) {
    where.push("LOWER(s.name) = LOWER(?)");
    params.push(filters.student_name);
  }

  if (filters.roll_number) {
    where.push("LOWER(se.roll_number) = LOWER(?)");
    params.push(filters.roll_number);
  }

  if (filters.fee_type) {
    where.push("sf.fee_type = ?");
    params.push(filters.fee_type);
  }

  if (filters.installment_name) {
    where.push("LOWER(fi.installment_name) = LOWER(?)");
    params.push(filters.installment_name);
  }

  const sql = `
    SELECT
      sf.id,
      sf.enrollment_id,
      sf.fee_type,
      sf.amount,
      sf.status,
      fi.installment_name,
      s.id AS student_id,
      s.name AS student_name,
      s.admission_no,
      se.roll_number,
      se.class_id,
      se.section_id,
      se.session_id,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      acs.name AS session_name,
      str.name AS stream_name,
      COALESCE(SUM(p.amount_paid), 0) AS paid,
      (sf.amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining
    FROM student_fees sf
    JOIN student_enrollments se ON se.id = sf.enrollment_id
    JOIN students s ON s.id = se.student_id
    JOIN classes c ON c.id = se.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN sections sec ON sec.id = se.section_id
    JOIN academic_sessions acs ON acs.id = se.session_id
    LEFT JOIN streams str ON str.id = se.stream_id
    LEFT JOIN fee_installments fi ON fi.id = sf.installment_id
    LEFT JOIN payments p ON p.student_fee_id = sf.id
    WHERE ${where.join(" AND ")}
    GROUP BY
      sf.id,
      sf.enrollment_id,
      sf.fee_type,
      sf.amount,
      sf.status,
      fi.installment_name,
      s.id,
      s.name,
      s.admission_no,
      se.roll_number,
      se.class_id,
      se.section_id,
      se.session_id,
      c.name,
      sec.name,
      acs.name,
      str.name
    HAVING remaining > 0
    ORDER BY sf.id ASC
  `;

  return query(sql, params);
}

export async function getStudentsByIds(studentIds) {
  if (!studentIds.length) return [];

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
     WHERE s.id IN (${studentIds.map(() => "?").join(",")})
     ORDER BY s.name ASC`,
    studentIds
  );
}

export async function getStudentsForPayment(filters = {}) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const where = ["se.status = 'active'"];
  const params = [];

  if (filters.class_id) {
    where.push("se.class_id = ?");
    params.push(filters.class_id);
  }

  if (filters.section_id) {
    where.push("se.section_id = ?");
    params.push(filters.section_id);
  }

  if (filters.stream_id) {
    where.push("se.stream_id = ?");
    params.push(filters.stream_id);
  }

  if (filters.teacher_user_id) {
    where.push(`EXISTS (
      SELECT 1
      FROM teachers t
      JOIN teacher_class_assignments tca ON tca.teacher_id = t.id
      WHERE t.user_id = ?
        AND tca.class_id = se.class_id
        AND tca.section_id = se.section_id
        AND tca.session_id = se.session_id
    )`);
    params.push(filters.teacher_user_id);
  }

  const sql = `
    SELECT
      s.id,
      s.name,
      s.admission_no,
      se.roll_number,
      se.class_id,
      se.section_id,
      se.stream_id,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      sec.medium,
      str.name AS stream_name
    FROM students s
    JOIN student_enrollments se
      ON se.student_id = s.id
    JOIN classes c
      ON c.id = se.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN sections sec
      ON sec.id = se.section_id
    LEFT JOIN streams str
      ON str.id = se.stream_id
    WHERE ${where.join(" AND ")}
    ORDER BY s.name ASC, s.id ASC
  `;

  return query(sql, params);
}

export async function getStructureByEnrollment(enrollmentId) {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const sql = hasStreamId
    ? `
    SELECT
      fs.*,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      ses.name AS session_name,
      st.name AS stream_name
    FROM student_enrollments e
    JOIN fee_structures fs
    ON fs.class_id = e.class_id
    AND fs.session_id = e.session_id
    AND fs.stream_id <=> e.stream_id
    JOIN classes c ON c.id = e.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN academic_sessions ses ON ses.id = e.session_id
    LEFT JOIN streams st ON st.id = e.stream_id
    WHERE e.id = ?
  `
    : `
    SELECT
      fs.*,
      NULL AS stream_id,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      ses.name AS session_name,
      st.name AS stream_name
    FROM student_enrollments e
    JOIN fee_structures fs
    ON fs.class_id = e.class_id
    AND fs.session_id = e.session_id
    JOIN classes c ON c.id = e.class_id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    JOIN academic_sessions ses ON ses.id = e.session_id
    LEFT JOIN streams st ON st.id = e.stream_id
    WHERE e.id = ?
      AND ${classScopeExpr} <> 'hs'
  `;
  const rows = await query(sql, [enrollmentId]);
  return rows[0];
}

export async function getActiveEnrollmentIdsForStructure(structureId) {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const rows = await query(
    hasStreamId
      ? `
      SELECT se.id
      FROM student_enrollments se
      JOIN fee_structures fs
        ON fs.class_id = se.class_id
       AND fs.session_id = se.session_id
       AND fs.stream_id <=> se.stream_id
      WHERE fs.id = ?
        AND se.status = 'active'
    `
      : `
      SELECT se.id
      FROM student_enrollments se
      JOIN fee_structures fs
        ON fs.class_id = se.class_id
       AND fs.session_id = se.session_id
      WHERE fs.id = ?
        AND se.status = 'active'
    `,
    [structureId]
  );

  return rows.map((row) => Number(row.id));
}

export async function getEnrollmentSummary(enrollmentId) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const rows = await query(
    `SELECT
      e.id,
      e.class_id,
      e.session_id,
      e.stream_id,
      c.name AS class_name,
      ${classScopeExpr} AS class_scope,
      ses.name AS session_name,
      st.name AS stream_name
     FROM student_enrollments e
     JOIN classes c ON c.id = e.class_id
     ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
     JOIN academic_sessions ses ON ses.id = e.session_id
     LEFT JOIN streams st ON st.id = e.stream_id
     WHERE e.id = ?
     LIMIT 1`,
    [enrollmentId]
  );
  return rows[0] || null;
}
export async function getInstallments(structureId) {
  const sql = `
    SELECT *
    FROM fee_installments
    WHERE fee_structure_id = ?
  `;
  return query(sql, [structureId]);
}
export async function getStudentFeeId(paymentId) {
  const sql = `
    SELECT student_fee_id
    FROM payments
    WHERE id = ?
  `;
  const rows = await query(sql, [paymentId]);
  return rows[0]?.student_fee_id;
}
export async function updateFeeStatus(studentFeeId) {
  const sql = `
    UPDATE student_fees
    SET status = 'paid'
    WHERE id = ?
  `;
  return execute(sql, [studentFeeId]);
}

export async function getAllFeeStructuresWithInstallments() {
  const hasStreamId = await supportsFeeStructuresStreamId();
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const sql = hasStreamId
    ? `
  SELECT
    fs.id AS structure_id,
    fs.class_id,
    fs.session_id,
    fs.stream_id,
    fs.admission_fee,
    c.name AS class_name,
    ${classScopeExpr} AS class_scope,
    s.name AS session_name,
    st.name AS stream_name,
    fi.id AS installment_id,
    fi.installment_name,
    fi.amount,
    fi.due_date
  FROM fee_structures fs
  JOIN classes c ON fs.class_id = c.id
  ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
  JOIN academic_sessions s ON fs.session_id = s.id
  LEFT JOIN streams st ON fs.stream_id = st.id
  LEFT JOIN fee_installments fi
  ON fi.fee_structure_id = fs.id
  ORDER BY c.name, st.name, s.name, fi.installment_name
  `
    : `
  SELECT
    fs.id AS structure_id,
    fs.class_id,
    fs.session_id,
    NULL AS stream_id,
    fs.admission_fee,
    c.name AS class_name,
    ${classScopeExpr} AS class_scope,
    s.name AS session_name,
    NULL AS stream_name,
    fi.id AS installment_id,
    fi.installment_name,
    fi.amount,
    fi.due_date
  FROM fee_structures fs
  JOIN classes c ON fs.class_id = c.id
  ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
  JOIN academic_sessions s ON fs.session_id = s.id
  LEFT JOIN fee_installments fi
  ON fi.fee_structure_id = fs.id
  ORDER BY c.name, s.name, fi.installment_name
  `;

  const rows = await query(sql);

  const map = {};

  for (const row of rows) {

    if (!map[row.structure_id]) {
      map[row.structure_id] = {
        id: row.structure_id,
        class_id: row.class_id,
        session_id: row.session_id,
        stream_id: row.stream_id,
        admission_fee: row.admission_fee,
        class_name: row.class_name,
        class_scope: row.class_scope,
        session_name: row.session_name,
        stream_name: row.stream_name,
        installments: []
      };
    }

    if (row.installment_id) {
      map[row.structure_id].installments.push({
        id: row.installment_id,
        installment_name: row.installment_name,
        amount: row.amount,
        due_date: row.due_date
      });
    }
  }

  return Object.values(map);
}

export async function getClassById(id) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const rows = await query(
    `SELECT
      c.id,
      ${classScopeExpr} AS class_scope
     FROM classes c
     ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function getStreamById(id) {
  const rows = await query(
    `SELECT id, name
     FROM streams
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
export async function getPaymentReceipt(paymentId){
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);

  const sql = `
  SELECT
    p.id,
    COALESCE(p.receipt_serial, CONCAT('PAY-', LPAD(p.id, 6, '0'))) AS receipt_serial,
    p.amount_paid,
    p.remarks,
    p.status,
    p.created_at,
    s.id AS student_id,
    s.name,
    s.admission_no,
    c.name AS class_name
    ,e.roll_number
    ,e.session_id
    ,ses.name AS session_name
    ,e.stream_id
    ,st.name AS stream_name
    ,${classScopeExpr} AS class_scope
    ,sec.name AS section_name
    ,sec.medium AS medium
    ,sf.fee_type
    ,sf.status AS fee_status
    ,sf.amount AS fee_amount
    ,fi.installment_name
    ,(sf.amount - COALESCE((
      SELECT SUM(pp.amount_paid)
      FROM payments pp
      WHERE pp.student_fee_id = sf.id
    ),0)) AS remaining_amount
  FROM payments p
  JOIN student_fees sf ON p.student_fee_id = sf.id
  JOIN student_enrollments e ON sf.enrollment_id = e.id
  JOIN students s ON e.student_id = s.id
  JOIN classes c ON e.class_id = c.id
  ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
  LEFT JOIN streams st ON st.id = e.stream_id
  LEFT JOIN academic_sessions ses ON ses.id = e.session_id
  JOIN sections sec ON e.section_id = sec.id
  LEFT JOIN fee_installments fi ON sf.installment_id = fi.id
  WHERE p.id = ?
  `;

  const rows = await query(sql,[paymentId]);
  return rows[0];
}

function buildPaymentsWhereClause(filters = {}, classScopeExpr = "COALESCE(c.class_scope, 'school')") {
  const where = [];
  const params = [];

  if (filters.class_id) {
    where.push("e.class_id = ?");
    params.push(filters.class_id);
  }
  if (filters.section_id) {
    where.push("e.section_id = ?");
    params.push(filters.section_id);
  }
  if (filters.student_id) {
    where.push("s.id = ?");
    params.push(filters.student_id);
  }
  if (filters.scope) {
    where.push(`${classScopeExpr} = ?`);
    params.push(filters.scope);
  }
  if (filters.stream_id) {
    where.push("e.stream_id = ?");
    params.push(filters.stream_id);
  }
  if (filters.date_from) {
    where.push("DATE(p.created_at) >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push("DATE(p.created_at) <= ?");
    params.push(filters.date_to);
  }
  if (filters.teacher_user_id) {
    where.push(`EXISTS (
      SELECT 1
      FROM teachers t
      JOIN teacher_class_assignments tca ON tca.teacher_id = t.id
      WHERE t.user_id = ?
        AND tca.class_id = e.class_id
        AND tca.section_id = e.section_id
        AND tca.session_id = e.session_id
    )`);
    params.push(filters.teacher_user_id);
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function buildPaymentsBaseSql(hasScopesTable, whereClause = "") {
  return `
    FROM payments p
    JOIN student_fees sf ON p.student_fee_id = sf.id
    JOIN student_enrollments e ON sf.enrollment_id = e.id
    JOIN students s ON e.student_id = s.id
    JOIN classes c ON e.class_id = c.id
    ${hasScopesTable ? "LEFT JOIN scopes sc ON sc.id = c.scope_id" : ""}
    LEFT JOIN streams st ON st.id = e.stream_id
    JOIN sections sec ON e.section_id = sec.id
    ${whereClause}
  `;
}

export async function getPayments(filters = {}) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const { whereClause, params } = buildPaymentsWhereClause(filters, classScopeExpr);

  const sql = `
    SELECT
      p.id,
      COALESCE(p.receipt_serial, CONCAT('PAY-', LPAD(p.id, 6, '0'))) AS receipt_serial,
      p.student_fee_id,
      p.amount_paid,
      p.remarks,
      p.status,
      p.created_at,
      sf.fee_type,
      sf.amount AS fee_amount,
      sf.status AS fee_status,
      s.id AS student_id,
      s.name AS student_name,
      c.name AS class_name,
      e.stream_id,
      st.name AS stream_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      sec.medium AS medium,
      DATE(p.created_at) AS payment_date
    ${buildPaymentsBaseSql(hasScopesTable, whereClause)}
    ORDER BY p.created_at DESC
  `;

  return query(sql, params);
}

export async function getPaymentsPaginated(filters = {}, options = {}) {
  const hasScopesTable = await supportsScopesTable();
  const classScopeExpr = buildClassScopeExpression(hasScopesTable);
  const { whereClause, params } = buildPaymentsWhereClause(filters, classScopeExpr);
  const page = Math.max(1, Number.isFinite(Number(options.page)) ? Math.trunc(Number(options.page)) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(Number(options.limit)) ? Math.trunc(Number(options.limit)) : 30));
  const offset = (page - 1) * limit;

  const sql = `
    SELECT
      p.id,
      COALESCE(p.receipt_serial, CONCAT('PAY-', LPAD(p.id, 6, '0'))) AS receipt_serial,
      p.student_fee_id,
      p.amount_paid,
      p.remarks,
      p.status,
      p.created_at,
      sf.fee_type,
      sf.amount AS fee_amount,
      sf.status AS fee_status,
      s.id AS student_id,
      s.name AS student_name,
      c.name AS class_name,
      e.stream_id,
      st.name AS stream_name,
      ${classScopeExpr} AS class_scope,
      sec.name AS section_name,
      sec.medium AS medium,
      DATE(p.created_at) AS payment_date
    ${buildPaymentsBaseSql(hasScopesTable, whereClause)}
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await query(sql, params);
  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      ${buildPaymentsBaseSql(hasScopesTable, whereClause)}
    `,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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

export async function getEnrollmentByStudentFeeId(studentFeeId) {
  const rows = await query(
    `SELECT
      e.id,
      e.class_id,
      e.section_id,
      e.session_id
     FROM student_fees sf
     JOIN student_enrollments e ON e.id = sf.enrollment_id
     WHERE sf.id = ?
     LIMIT 1`,
    [studentFeeId]
  );
  return rows[0] || null;
}

export async function getEnrollmentByPaymentId(paymentId) {
  const rows = await query(
    `SELECT
      e.id,
      e.class_id,
      e.section_id,
      e.session_id
     FROM payments p
     JOIN student_fees sf ON sf.id = p.student_fee_id
     JOIN student_enrollments e ON e.id = sf.enrollment_id
     WHERE p.id = ?
     LIMIT 1`,
    [paymentId]
  );
  return rows[0] || null;
}

export async function isTeacherAssignedToScope(userId, classId, sectionId, sessionId) {
  const rows = await query(
    `SELECT 1
     FROM teachers t
     JOIN teacher_class_assignments tca ON tca.teacher_id = t.id
     WHERE t.user_id = ?
       AND tca.class_id = ?
       AND tca.section_id = ?
       AND tca.session_id = ?
     LIMIT 1`,
    [userId, classId, sectionId, sessionId]
  );
  return rows.length > 0;
}

export async function getPaymentById(paymentId) {
  const sql = `SELECT * FROM payments WHERE id = ?`;
  const rows = await query(sql, [paymentId]);
  return rows[0];
}

export async function updatePayment(paymentId, data) {
  const sql = `
    UPDATE payments
    SET amount_paid = ?, remarks = ?, status = ?
    WHERE id = ?
  `;
  return execute(sql, [
    data.amount_paid,
    data.remarks ?? null,
    "approved",
    paymentId
  ]);
}

export async function deletePayment(paymentId) {
  return execute(`DELETE FROM payments WHERE id = ?`, [paymentId]);
}

export async function recalculateStudentFeeStatus(studentFeeId) {
  const row = await query(
    `
    SELECT
      sf.id,
      sf.amount,
      COALESCE(SUM(p.amount_paid), 0) AS paid
    FROM student_fees sf
    LEFT JOIN payments p
      ON p.student_fee_id = sf.id
    WHERE sf.id = ?
    GROUP BY sf.id, sf.amount
    `,
    [studentFeeId]
  );

  if (!row[0]) return;

  const total = Number(row[0].amount || 0);
  const paid = Number(row[0].paid || 0);

  let status = "pending";
  if (paid >= total && total > 0) status = "paid";
  else if (paid > 0) status = "partial";

  await execute(
    `UPDATE student_fees SET status = ? WHERE id = ?`,
    [status, studentFeeId]
  );
}
