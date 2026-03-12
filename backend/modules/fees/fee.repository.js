import { query, execute } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

export async function insertFeeStructure(data, conn) {

  const sql = `
    INSERT INTO fee_structures
    (class_id, session_id, admission_fee)
    VALUES (?,?,?)
  `;

  const result = await execute(sql, [
    data.class_id,
    data.session_id,
    data.admission_fee
  ]);

  return result;
}
export async function getFeeStructure(classId, sessionId) {

  const sql = `
  SELECT *
  FROM fee_structures
  WHERE class_id = ?
  AND session_id = ?
  `;

  const rows = await query(sql, [classId, sessionId]);

  return rows[0];
}
export async function getAllFeeStructures() {

  const sql = `
    SELECT
      fs.id,
      fs.admission_fee,
      c.name AS class_name,
      s.name AS session_name
    FROM fee_structures fs
    JOIN classes c ON fs.class_id = c.id
    JOIN academic_sessions s ON fs.session_id = s.id
    ORDER BY c.name
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
  const sql = `
    UPDATE fee_structures
    SET class_id = ?, session_id = ?, admission_fee = ?
    WHERE id = ?
  `;
  return execute(sql, [data.class_id, data.session_id, data.admission_fee, id]);
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

  return execute(sql, params);
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

export async function getFeeStructureById(id) {
  const rows = await query(
    `SELECT id, class_id, session_id, admission_fee
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
export async function getStructureByEnrollment(enrollmentId) {
  const sql = `
    SELECT
      fs.*,
      c.name AS class_name,
      ses.name AS session_name
    FROM student_enrollments e
    JOIN fee_structures fs
    ON fs.class_id = e.class_id
    AND fs.session_id = e.session_id
    JOIN classes c ON c.id = e.class_id
    JOIN academic_sessions ses ON ses.id = e.session_id
    WHERE e.id = ?
  `;
  const rows = await query(sql, [enrollmentId]);
  return rows[0];
}

export async function getEnrollmentSummary(enrollmentId) {
  const rows = await query(
    `SELECT
      e.id,
      e.class_id,
      e.session_id,
      c.name AS class_name,
      ses.name AS session_name
     FROM student_enrollments e
     JOIN classes c ON c.id = e.class_id
     JOIN academic_sessions ses ON ses.id = e.session_id
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

  const sql = `
  SELECT
    fs.id AS structure_id,
    fs.admission_fee,
    c.name AS class_name,
    s.name AS session_name,
    fi.id AS installment_id,
    fi.installment_name,
    fi.amount,
    fi.due_date
  FROM fee_structures fs
  JOIN classes c ON fs.class_id = c.id
  JOIN academic_sessions s ON fs.session_id = s.id
  LEFT JOIN fee_installments fi
  ON fi.fee_structure_id = fs.id
  ORDER BY c.name, fi.installment_name
  `;

  const rows = await query(sql);

  const map = {};

  for (const row of rows) {

    if (!map[row.structure_id]) {
      map[row.structure_id] = {
        id: row.structure_id,
        admission_fee: row.admission_fee,
        class_name: row.class_name,
        session_name: row.session_name,
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
export async function getPaymentReceipt(paymentId){

  const sql = `
  SELECT
    p.id,
    p.amount_paid,
    p.remarks,
    p.status,
    p.created_at,
    s.name,
    c.name AS class_name
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
  JOIN sections sec ON e.section_id = sec.id
  LEFT JOIN fee_installments fi ON sf.installment_id = fi.id
  WHERE p.id = ?
  `;

  const rows = await query(sql,[paymentId]);
  return rows[0];
}

export async function getPayments(filters = {}) {
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
    where.push("c.class_scope = ?");
    params.push(filters.scope);
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

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      p.id,
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
      c.class_scope,
      sec.name AS section_name,
      sec.medium AS medium,
      DATE(p.created_at) AS payment_date
    FROM payments p
    JOIN student_fees sf ON p.student_fee_id = sf.id
    JOIN student_enrollments e ON sf.enrollment_id = e.id
    JOIN students s ON e.student_id = s.id
    JOIN classes c ON e.class_id = c.id
    JOIN sections sec ON e.section_id = sec.id
    ${whereClause}
    ORDER BY p.created_at DESC
  `;

  return query(sql, params);
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
