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
AND p.status='approved'
WHERE sf.enrollment_id=?
GROUP BY sf.id
  `;

  const rows = await execute(sql, [enrollmentId]);

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
    data.status ?? "pending",
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
  SELECT p.id, s.first_name, s.last_name, p.amount_paid
  FROM payments p
  JOIN student_fees sf ON p.student_fee_id = sf.id
  JOIN student_enrollments e ON sf.enrollment_id = e.id
  JOIN students s ON e.student_id = s.id
  WHERE p.status='pending'
  `;

  const rows = await execute(sql);

  return rows;
}
export async function getStructureByEnrollment(enrollmentId) {
  const sql = `
    SELECT fs.*
    FROM student_enrollments e
    JOIN fee_structures fs
    ON fs.class_id = e.class_id
    AND fs.session_id = e.session_id
    WHERE e.id = ?
  `;
  const rows = await query(sql, [enrollmentId]);
  return rows[0];
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
    p.created_at,
    s.first_name,
    s.last_name,
    c.name AS class_name
  FROM payments p
  JOIN student_fees sf ON p.student_fee_id = sf.id
  JOIN student_enrollments e ON sf.enrollment_id = e.id
  JOIN students s ON e.student_id = s.id
  JOIN classes c ON e.class_id = c.id
  WHERE p.id = ?
  `;

  const rows = await query(sql,[paymentId]);
  return rows[0];
}