import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

export async function listRoutes() {
  return query(
    `SELECT r.*,
            COUNT(s.id) AS stop_count
     FROM transport_routes r
     LEFT JOIN transport_stops s ON s.route_id = r.id
     GROUP BY r.id
     ORDER BY r.is_active DESC, r.name ASC`
  );
}

export async function createRoute(data) {
  const [result] = await pool.execute(
    `INSERT INTO transport_routes (name, description, is_active)
     VALUES (?, ?, ?)`,
    [data.name, data.description ?? null, data.is_active ? 1 : 0]
  );
  return result;
}

export async function updateRoute(id, data) {
  const [result] = await pool.execute(
    `UPDATE transport_routes
     SET name = ?, description = ?, is_active = ?
     WHERE id = ?`,
    [data.name, data.description ?? null, data.is_active ? 1 : 0, id]
  );
  return result;
}

export async function getRouteById(id) {
  const rows = await query(
    `SELECT * FROM transport_routes WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listStops(routeId = null) {
  const params = [];
  const where = routeId ? "WHERE s.route_id = ?" : "";
  if (routeId) params.push(routeId);

  return query(
    `SELECT s.*, r.name AS route_name
     FROM transport_stops s
     JOIN transport_routes r ON r.id = s.route_id
     ${where}
     ORDER BY r.name ASC, s.is_active DESC, s.distance_km ASC, s.name ASC`,
    params
  );
}

export async function getStopById(id) {
  const rows = await query(
    `SELECT s.*, r.name AS route_name, r.is_active AS route_is_active
     FROM transport_stops s
     JOIN transport_routes r ON r.id = s.route_id
     WHERE s.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createStop(data) {
  const [result] = await pool.execute(
    `INSERT INTO transport_stops
       (route_id, name, distance_km, monthly_fee, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.route_id,
      data.name,
      data.distance_km ?? null,
      data.monthly_fee,
      data.is_active ? 1 : 0,
    ]
  );
  return result;
}

export async function updateStop(id, data) {
  const [result] = await pool.execute(
    `UPDATE transport_stops
     SET route_id = ?, name = ?, distance_km = ?, monthly_fee = ?, is_active = ?
     WHERE id = ?`,
    [
      data.route_id,
      data.name,
      data.distance_km ?? null,
      data.monthly_fee,
      data.is_active ? 1 : 0,
      id,
    ]
  );
  return result;
}

export async function getSessionById(id) {
  const rows = await query(
    `SELECT id, name, start_date, end_date, is_active
     FROM academic_sessions
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function getStudentById(id) {
  const rows = await query(
    `SELECT s.id, s.name, s.admission_no, se.roll_number,
            c.name AS class_name, sec.name AS section_name, sec.medium,
            ses.id AS session_id, ses.name AS session_name
     FROM students s
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN academic_sessions ses ON ses.id = se.session_id
     WHERE s.id = ?
     ORDER BY se.id DESC
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function searchStudents(filters = {}) {
  const search = filters.search || "";
  const text = String(search || "").trim();
  const params = [];
  const where = ["se.status = 'active'"];
  if (text) {
    where.push(`(
      s.name LIKE ?
      OR s.admission_no LIKE ?
      OR CAST(se.roll_number AS CHAR) LIKE ?
    )`);
    const like = `%${text}%`;
    params.push(like, like, like);
  }
  if (filters.session_id) {
    where.push("se.session_id = ?");
    params.push(filters.session_id);
  }
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
  if (filters.medium) {
    where.push("LOWER(sec.medium) = LOWER(?)");
    params.push(filters.medium);
  }

  return query(
    `SELECT s.id, s.name, s.admission_no, se.roll_number,
            c.name AS class_name, sec.name AS section_name, sec.medium,
            ses.id AS session_id, ses.name AS session_name
     FROM students s
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN academic_sessions ses ON ses.id = se.session_id
     WHERE ${where.join(" AND ")}
     ORDER BY s.name ASC, s.id ASC
     LIMIT 100`,
    params
  );
}

export async function deactivateActiveAssignments(conn, studentId, sessionId) {
  await conn.execute(
    `UPDATE student_transport_assignments
     SET status = 'inactive',
         end_month = COALESCE(end_month, start_month),
         end_year = COALESCE(end_year, start_year)
     WHERE student_id = ?
       AND session_id = ?
       AND status = 'active'`,
    [studentId, sessionId]
  );
}

export async function createAssignment(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO student_transport_assignments
       (student_id, session_id, route_id, stop_id, monthly_fee,
        start_month, start_year, end_month, end_year, status, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      data.student_id,
      data.session_id,
      data.route_id,
      data.stop_id,
      data.monthly_fee,
      data.start_month,
      data.start_year,
      data.end_month ?? null,
      data.end_year ?? null,
      data.remarks ?? null,
      data.created_by ?? null,
    ]
  );
  return result;
}

export async function insertDue(conn, data) {
  await conn.execute(
    `INSERT IGNORE INTO student_transport_fee_dues
       (assignment_id, student_id, session_id, due_month, due_year, amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.assignment_id,
      data.student_id,
      data.session_id,
      data.due_month,
      data.due_year,
      data.amount,
    ]
  );
}

export async function listAssignments(filters = {}) {
  const where = [];
  const params = [];

  if (filters.student_id) {
    where.push("a.student_id = ?");
    params.push(filters.student_id);
  }
  if (filters.session_id) {
    where.push("a.session_id = ?");
    params.push(filters.session_id);
  }
  if (filters.status) {
    where.push("a.status = ?");
    params.push(filters.status);
  }

  return query(
    `SELECT a.*,
            s.name AS student_name,
            s.admission_no,
            ses.name AS session_name,
            COALESCE(r.name, 'Student Specific') AS route_name,
            COALESCE(st.name, 'Direct Fee') AS stop_name,
            st.distance_km,
            c.name AS class_name,
            sec.name AS section_name,
            sec.medium,
            COALESCE(due_map.total_due, 0) AS total_due,
            COALESCE(due_map.total_paid, 0) AS total_paid,
            COALESCE(due_map.pending_count, 0) AS pending_count
     FROM student_transport_assignments a
     JOIN students s ON s.id = a.student_id
     JOIN academic_sessions ses ON ses.id = a.session_id
     LEFT JOIN transport_routes r ON r.id = a.route_id
     LEFT JOIN transport_stops st ON st.id = a.stop_id
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.session_id = a.session_id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN (
       SELECT d.assignment_id,
              SUM(d.amount) AS total_due,
              SUM(COALESCE(pa.paid, 0)) AS total_paid,
              SUM(CASE WHEN d.status <> 'paid' THEN 1 ELSE 0 END) AS pending_count
       FROM student_transport_fee_dues d
       LEFT JOIN (
         SELECT transport_due_id, SUM(amount_applied) AS paid
         FROM transport_payment_allocations
         GROUP BY transport_due_id
       ) pa ON pa.transport_due_id = d.id
       GROUP BY d.assignment_id
     ) due_map ON due_map.assignment_id = a.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.status ASC, s.name ASC, a.id DESC`,
    params
  );
}

export async function endAssignment(id, data) {
  const [result] = await pool.execute(
    `UPDATE student_transport_assignments
     SET status = 'inactive',
         end_month = ?,
         end_year = ?
     WHERE id = ?`,
    [data.end_month, data.end_year, id]
  );
  return result;
}

export async function listDues(filters = {}) {
  const where = [];
  const params = [];

  if (filters.student_id) {
    where.push("d.student_id = ?");
    params.push(filters.student_id);
  }
  if (filters.session_id) {
    where.push("d.session_id = ?");
    params.push(filters.session_id);
  }
  if (filters.status) {
    where.push("d.status = ?");
    params.push(filters.status);
  }
  if (filters.month) {
    where.push("d.due_month = ?");
    params.push(filters.month);
  }
  if (filters.year) {
    where.push("d.due_year = ?");
    params.push(filters.year);
  }
  if (filters.route_id) {
    where.push("a.route_id = ?");
    params.push(filters.route_id);
  }
  if (filters.stop_id) {
    where.push("a.stop_id = ?");
    params.push(filters.stop_id);
  }

  return query(
    `SELECT d.*,
            s.name AS student_name,
            s.admission_no,
            ses.name AS session_name,
            COALESCE(r.name, 'Student Specific') AS route_name,
            COALESCE(st.name, 'Direct Fee') AS stop_name,
            c.name AS class_name,
            sec.name AS section_name,
            sec.medium,
            COALESCE(pa.paid, 0) AS paid,
            (d.amount - COALESCE(pa.paid, 0)) AS remaining
     FROM student_transport_fee_dues d
     JOIN student_transport_assignments a ON a.id = d.assignment_id
     JOIN students s ON s.id = d.student_id
     JOIN academic_sessions ses ON ses.id = d.session_id
     LEFT JOIN transport_routes r ON r.id = a.route_id
     LEFT JOIN transport_stops st ON st.id = a.stop_id
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.session_id = d.session_id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN (
       SELECT transport_due_id, SUM(amount_applied) AS paid
       FROM transport_payment_allocations
       GROUP BY transport_due_id
     ) pa ON pa.transport_due_id = d.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY d.due_year DESC, d.due_month DESC, s.name ASC`,
    params
  );
}

export async function getDuesForPayment(conn, dueIds) {
  const placeholders = dueIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT d.*,
            COALESCE(pa.paid, 0) AS paid,
            (d.amount - COALESCE(pa.paid, 0)) AS remaining
     FROM student_transport_fee_dues d
     LEFT JOIN (
       SELECT transport_due_id, SUM(amount_applied) AS paid
       FROM transport_payment_allocations
       GROUP BY transport_due_id
     ) pa ON pa.transport_due_id = d.id
     WHERE d.id IN (${placeholders})
     FOR UPDATE`,
    dueIds
  );
  return rows;
}

export async function createPayment(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO transport_payments
       (student_id, session_id, amount_paid, payment_method, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.student_id,
      data.session_id,
      data.amount_paid,
      data.payment_method ?? null,
      data.remarks ?? null,
      data.created_by ?? null,
    ]
  );
  return result;
}

export async function createAllocation(conn, data) {
  await conn.execute(
    `INSERT INTO transport_payment_allocations
       (payment_id, transport_due_id, amount_applied)
     VALUES (?, ?, ?)`,
    [data.payment_id, data.transport_due_id, data.amount_applied]
  );
}

export async function updateDueStatus(conn, dueId) {
  await conn.execute(
    `UPDATE student_transport_fee_dues d
     LEFT JOIN (
       SELECT transport_due_id, SUM(amount_applied) AS paid
       FROM transport_payment_allocations
       WHERE transport_due_id = ?
       GROUP BY transport_due_id
     ) pa ON pa.transport_due_id = d.id
     SET d.status = CASE
       WHEN COALESCE(pa.paid, 0) >= d.amount THEN 'paid'
       WHEN COALESCE(pa.paid, 0) > 0 THEN 'partial'
       ELSE 'pending'
     END
     WHERE d.id = ?`,
    [dueId, dueId]
  );
}

export async function createReceipt(conn, paymentId) {
  const receiptNo = `TR-${String(paymentId).padStart(6, "0")}`;
  await conn.execute(
    `INSERT INTO transport_receipts (receipt_no, payment_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE receipt_no = receipt_no`,
    [receiptNo, paymentId]
  );
  return receiptNo;
}

export async function listPayments(filters = {}) {
  const where = [];
  const params = [];

  if (filters.student_id) {
    where.push("p.student_id = ?");
    params.push(filters.student_id);
  }
  if (filters.session_id) {
    where.push("p.session_id = ?");
    params.push(filters.session_id);
  }

  return query(
    `SELECT p.*,
            s.name AS student_name,
            s.admission_no,
            ses.name AS session_name,
            tr.receipt_no,
            GROUP_CONCAT(CONCAT(d.due_month, '/', d.due_year) ORDER BY d.due_year, d.due_month SEPARATOR ', ') AS covered_months
     FROM transport_payments p
     JOIN students s ON s.id = p.student_id
     JOIN academic_sessions ses ON ses.id = p.session_id
     LEFT JOIN transport_receipts tr ON tr.payment_id = p.id
     LEFT JOIN transport_payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_transport_fee_dues d ON d.id = pa.transport_due_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY
       p.id,
       p.student_id,
       p.session_id,
       p.amount_paid,
       p.payment_method,
       p.remarks,
       p.status,
       p.created_by,
       p.created_at,
       p.updated_at,
       s.name,
       s.admission_no,
       ses.name,
       tr.receipt_no
     ORDER BY p.created_at DESC`,
    params
  );
}

export async function getPaymentReceipt(paymentId) {
  const rows = await query(
    `SELECT p.*, tr.receipt_no,
            s.name AS student_name,
            s.admission_no,
            ses.name AS session_name,
            (
              SELECT COALESCE(r.name, 'Student Specific')
              FROM transport_payment_allocations pa
              JOIN student_transport_fee_dues d ON d.id = pa.transport_due_id
              JOIN student_transport_assignments a ON a.id = d.assignment_id
              LEFT JOIN transport_routes r ON r.id = a.route_id
              WHERE pa.payment_id = p.id
              ORDER BY d.due_year ASC, d.due_month ASC
              LIMIT 1
            ) AS route_name,
            (
              SELECT COALESCE(st.name, 'Direct Fee')
              FROM transport_payment_allocations pa
              JOIN student_transport_fee_dues d ON d.id = pa.transport_due_id
              JOIN student_transport_assignments a ON a.id = d.assignment_id
              LEFT JOIN transport_stops st ON st.id = a.stop_id
              WHERE pa.payment_id = p.id
              ORDER BY d.due_year ASC, d.due_month ASC
              LIMIT 1
            ) AS stop_name
     FROM transport_payments p
     JOIN students s ON s.id = p.student_id
     JOIN academic_sessions ses ON ses.id = p.session_id
     LEFT JOIN transport_receipts tr ON tr.payment_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [paymentId]
  );

  const payment = rows[0] || null;
  if (!payment) return null;

  const allocations = await query(
    `SELECT pa.amount_applied,
            d.due_month,
            d.due_year,
            d.amount AS due_amount
     FROM transport_payment_allocations pa
     JOIN student_transport_fee_dues d ON d.id = pa.transport_due_id
     WHERE pa.payment_id = ?
     ORDER BY d.due_year ASC, d.due_month ASC`,
    [paymentId]
  );

  return { ...payment, allocations };
}

export async function getSummary() {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM student_transport_assignments WHERE status = 'active') AS active_students,
       (SELECT COALESCE(SUM(monthly_fee), 0) FROM student_transport_assignments WHERE status = 'active') AS monthly_expected,
       (SELECT COALESCE(SUM(d.amount - COALESCE(pa.paid, 0)), 0)
        FROM student_transport_fee_dues d
        LEFT JOIN (
          SELECT transport_due_id, SUM(amount_applied) AS paid
          FROM transport_payment_allocations
          GROUP BY transport_due_id
        ) pa ON pa.transport_due_id = d.id
        WHERE d.status <> 'paid') AS pending_amount,
       (SELECT COALESCE(SUM(amount_paid), 0)
        FROM transport_payments
        WHERE status = 'approved'
          AND YEAR(created_at) = YEAR(CURDATE())
          AND MONTH(created_at) = MONTH(CURDATE())) AS this_month_collection`
  );
  return rows[0] || {};
}
