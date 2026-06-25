import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

let subjectOfferingsTablePromise;
let studentSubjectRegistrationsTablePromise;

function normalizeNullableId(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function hasTable(tableName) {
  return query(
    `
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName],
  ).then((rows) => rows.length > 0);
}

export function supportsSubjectOfferingsTable() {
  if (!subjectOfferingsTablePromise) {
    subjectOfferingsTablePromise = hasTable("subject_offerings");
  }

  return subjectOfferingsTablePromise;
}

export function supportsStudentSubjectRegistrationsTable() {
  if (!studentSubjectRegistrationsTablePromise) {
    studentSubjectRegistrationsTablePromise = hasTable("student_subject_registrations");
  }

  return studentSubjectRegistrationsTablePromise;
}
// CREATE SUBJECT
export async function createSubject(name, code) {
  const sql = `
    INSERT INTO subjects (name, code)
    VALUES (?, ?)
  `;

  const result = await query(sql, [name, code]);

  return { id: result.insertId };
}

// GET ALL SUBJECTS
export async function getSubjects() {
  return query(`
    SELECT
      id,
      name,
      code
    FROM subjects
  ORDER BY name
  `);
}

// UPDATE SUBJECT
export async function updateSubject(id, name, code) {
  return query(
    `UPDATE subjects
     SET name = ?, code = ?
     WHERE id = ?`,
    [name, code, id],
  );
}

let subjectIsActiveColumnPromise;

function hasSubjectIsActiveColumn() {
  if (!subjectIsActiveColumnPromise) {
    subjectIsActiveColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'subjects'
          AND COLUMN_NAME = 'is_active'
        LIMIT 1
      `,
    ).then((rows) => rows.length > 0);
  }

  return subjectIsActiveColumnPromise;
}

// DELETE SUBJECT
export async function deleteSubject(id) {
  const hasIsActive = await hasSubjectIsActiveColumn();

  if (hasIsActive) {
    return query(
      `UPDATE subjects
       SET is_active = FALSE
       WHERE id = ?`,
      [id],
    );
  }

  return query(`DELETE FROM subjects WHERE id = ?`, [id]);
}

export async function assignSubjects(classId, subjectIds, subjectGroups = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM class_subjects WHERE class_id = ?`, [
      classId,
    ]);

    for (const subjectId of subjectIds) {
      await conn.query(
        `INSERT INTO class_subjects (class_id, subject_id)
         VALUES (?, ?)`,
        [classId, subjectId],
      );
    }

    if (await supportsSubjectOfferingsTable()) {
      await conn.query(
        `UPDATE subject_offerings
         SET is_active = FALSE
         WHERE class_id = ?
           AND section_id IS NULL
           AND stream_id IS NULL`,
        [classId],
      );

      for (const subjectId of subjectIds) {
        const subjectGroup = ["compulsory", "elective", "optional"].includes(subjectGroups?.[subjectId])
          ? subjectGroups[subjectId]
          : "compulsory";

        await conn.query(
          `INSERT INTO subject_offerings
           (class_id, section_id, stream_id, subject_id, subject_group, is_active)
           VALUES (?, NULL, NULL, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE
             subject_group = VALUES(subject_group),
             is_active = TRUE`,
          [classId, subjectId, subjectGroup],
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
export async function getClassSubjects(classId) {
  return query(
    `SELECT
        s.id,
        s.name,
        s.code
     FROM class_subjects cs
     JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.class_id = ?
     ORDER BY s.name`,
    [classId],
  );
}

export async function getSubjectsByTeacher(conn, teacherId) {
  const [rows] = await conn.execute(
    `
    SELECT DISTINCT s.id, s.name
    FROM teacher_class_assignments tca
    JOIN subjects s ON s.id = tca.subject_id
    WHERE tca.teacher_id = ?
  `,
    [teacherId],
  );

  return rows;
}

export async function getSubjectOfferings(filters = {}) {
  if (!(await supportsSubjectOfferingsTable())) {
    return [];
  }

  const where = ["so.is_active = TRUE"];
  const params = [];
  const classId = normalizeNullableId(filters.classId ?? filters.class_id);
  const sectionId = normalizeNullableId(filters.sectionId ?? filters.section_id);
  const streamId = normalizeNullableId(filters.streamId ?? filters.stream_id);

  if (classId) {
    where.push("so.class_id = ?");
    params.push(classId);
  }

  if (sectionId) {
    where.push("(so.section_id = ? OR so.section_id IS NULL)");
    params.push(sectionId);
  }

  if (streamId) {
    where.push("(so.stream_id = ? OR so.stream_id IS NULL)");
    params.push(streamId);
  }

  return query(
    `SELECT
      so.id,
      so.class_id,
      c.name AS class_name,
      so.section_id,
      sec.name AS section_name,
      so.stream_id,
      str.name AS stream_name,
      so.subject_id,
      sub.name AS subject_name,
      sub.code AS subject_code,
      so.subject_group,
      so.is_active
     FROM subject_offerings so
     JOIN classes c ON c.id = so.class_id
     LEFT JOIN sections sec ON sec.id = so.section_id
     LEFT JOIN streams str ON str.id = so.stream_id
     JOIN subjects sub ON sub.id = so.subject_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.id, so.section_id IS NULL DESC, sec.name, str.name, sub.name`,
    params,
  );
}

export async function replaceSubjectOfferings(scope, offerings) {
  if (!(await supportsSubjectOfferingsTable())) {
    return { skipped: true };
  }

  const classId = normalizeNullableId(scope.classId ?? scope.class_id);
  const sectionId = normalizeNullableId(scope.sectionId ?? scope.section_id);
  const streamId = normalizeNullableId(scope.streamId ?? scope.stream_id);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE subject_offerings
       SET is_active = FALSE
       WHERE class_id = ?
         AND section_id <=> ?
         AND stream_id <=> ?`,
      [classId, sectionId, streamId],
    );

    for (const offering of offerings) {
      const subjectId = normalizeNullableId(offering.subjectId ?? offering.subject_id);
      const subjectGroup = ["compulsory", "elective", "optional"].includes(offering.subject_group)
        ? offering.subject_group
        : "compulsory";

      await conn.execute(
        `INSERT INTO subject_offerings
         (class_id, section_id, stream_id, subject_id, subject_group, is_active)
         VALUES (?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           subject_group = VALUES(subject_group),
           is_active = TRUE`,
        [classId, sectionId, streamId, subjectId, subjectGroup],
      );
    }

    await conn.commit();
    return { skipped: false };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getActiveStudentEnrollment(studentId) {
  const rows = await query(
    `SELECT
      se.student_id,
      se.class_id,
      se.section_id,
      se.stream_id,
      se.session_id,
      st.name AS student_name,
      c.name AS class_name,
      sec.name AS section_name,
      str.name AS stream_name
     FROM student_enrollments se
     JOIN students st ON st.id = se.student_id
     JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN streams str ON str.id = se.stream_id
     WHERE se.student_id = ?
       AND se.status = 'active'
     ORDER BY se.id DESC
     LIMIT 1`,
    [studentId],
  );

  return rows[0] || null;
}

export async function getStudentSubjectRegistrations(studentId) {
  if (
    !(await supportsSubjectOfferingsTable()) ||
    !(await supportsStudentSubjectRegistrationsTable())
  ) {
    return { enrollment: null, offerings: [] };
  }

  const enrollment = await getActiveStudentEnrollment(studentId);
  if (!enrollment) {
    return { enrollment: null, offerings: [] };
  }

  const offerings = await query(
    `SELECT
      so.id,
      so.class_id,
      so.section_id,
      so.stream_id,
      so.subject_id,
      sub.name AS subject_name,
      sub.code AS subject_code,
      so.subject_group,
      ssr.id AS registration_id,
      ssr.status AS registration_status,
      CASE
        WHEN so.subject_group = 'compulsory' THEN TRUE
        ELSE FALSE
      END AS auto_required
     FROM subject_offerings so
     JOIN subjects sub ON sub.id = so.subject_id
     LEFT JOIN student_subject_registrations ssr
       ON ssr.subject_offering_id = so.id
      AND ssr.student_id = ?
      AND ssr.status = 'active'
     WHERE so.is_active = TRUE
       AND so.class_id = ?
       AND (so.section_id IS NULL OR so.section_id = ?)
       AND (so.stream_id IS NULL OR so.stream_id <=> ?)
     ORDER BY
       FIELD(so.subject_group, 'compulsory', 'elective', 'optional'),
       sub.name`,
    [studentId, enrollment.class_id, enrollment.section_id, enrollment.stream_id],
  );

  return { enrollment, offerings };
}

export async function replaceStudentSubjectRegistrations(studentId, offeringIds) {
  if (
    !(await supportsSubjectOfferingsTable()) ||
    !(await supportsStudentSubjectRegistrationsTable())
  ) {
    return { skipped: true };
  }

  const enrollment = await getActiveStudentEnrollment(studentId);
  if (!enrollment) {
    return { skipped: false, updated: 0 };
  }

  const normalizedOfferingIds = [
    ...new Set(
      offeringIds
        .map((id) => normalizeNullableId(id))
        .filter(Boolean),
    ),
  ];

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [requiredRows] = await conn.execute(
      `SELECT id
       FROM subject_offerings
       WHERE is_active = TRUE
         AND subject_group = 'compulsory'
         AND class_id = ?
         AND (section_id IS NULL OR section_id = ?)
         AND (stream_id IS NULL OR stream_id <=> ?)`,
      [enrollment.class_id, enrollment.section_id, enrollment.stream_id],
    );

    const finalOfferingIds = [
      ...new Set([
        ...normalizedOfferingIds,
        ...requiredRows.map((row) => Number(row.id)).filter(Boolean),
      ]),
    ];

    const [scopeRows] = await conn.execute(
      `SELECT id
       FROM subject_offerings
       WHERE class_id = ?
         AND (section_id IS NULL OR section_id = ?)
         AND (stream_id IS NULL OR stream_id <=> ?)`,
      [enrollment.class_id, enrollment.section_id, enrollment.stream_id],
    );
    const scopeOfferingIds = scopeRows.map((row) => Number(row.id)).filter(Boolean);

    if (scopeOfferingIds.length) {
      await conn.query(
        `DELETE FROM student_subject_registrations
         WHERE student_id = ?
           AND subject_offering_id IN (${scopeOfferingIds.map(() => "?").join(",")})`,
        [studentId, ...scopeOfferingIds],
      );
    }

    for (const offeringId of finalOfferingIds) {
      await conn.execute(
        `INSERT INTO student_subject_registrations
         (student_id, subject_offering_id, status)
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [studentId, offeringId],
      );
    }

    await conn.commit();
    return { skipped: false, updated: finalOfferingIds.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


