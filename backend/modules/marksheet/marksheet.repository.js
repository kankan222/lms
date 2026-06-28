import { execute, query } from "../../core/db/query.js";

let activityClassScopesSupported = null;

export function scopeKeyForClassName(className) {
  const value = String(className || "").trim().toUpperCase();
  if (["NURSERY", "LKG", "UKG"].includes(value)) return "nursery_ukg";
  if (["I", "II", "III", "IV", "V"].includes(value)) return "i_v";
  if (["VI", "VII"].includes(value)) return "vi_vii";
  if (value === "VIII") return "viii";
  if (value === "IX") return "ix";
  if (value === "X") return "x";
  return null;
}

export async function supportsActivityClassScopes() {
  if (activityClassScopesSupported !== null) return activityClassScopesSupported;

  try {
    const rows = await query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'marksheet_activities'
         AND COLUMN_NAME IN ('class_id', 'section_id')`
    );
    activityClassScopesSupported = Number(rows?.[0]?.count || 0) === 2;
  } catch {
    activityClassScopesSupported = false;
  }

  return activityClassScopesSupported;
}

export async function listGradeSettings(scaleType = null) {
  const where = [];
  const params = [];
  if (scaleType) {
    where.push("scale_type = ?");
    params.push(scaleType);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query(
    `SELECT id, scale_type, grade_label, qualitative_value, min_value, max_value,
            mark_value, sort_order, is_active
     FROM marksheet_grade_settings
     ${whereSql}
     ORDER BY scale_type, sort_order, min_value DESC`,
    params
  );
}

export async function createGradeSetting(data) {
  const result = await execute(
    `INSERT INTO marksheet_grade_settings
       (scale_type, grade_label, qualitative_value, min_value, max_value, mark_value, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.scale_type,
      data.grade_label,
      data.qualitative_value || null,
      data.min_value,
      data.max_value,
      data.mark_value ?? null,
      data.sort_order || 0,
      data.is_active === false ? 0 : 1,
    ]
  );
  return result.insertId;
}

export async function updateGradeSetting(id, data) {
  await execute(
    `UPDATE marksheet_grade_settings
     SET scale_type = ?, grade_label = ?, qualitative_value = ?, min_value = ?,
         max_value = ?, mark_value = ?, sort_order = ?, is_active = ?
     WHERE id = ?`,
    [
      data.scale_type,
      data.grade_label,
      data.qualitative_value || null,
      data.min_value,
      data.max_value,
      data.mark_value ?? null,
      data.sort_order || 0,
      data.is_active === false ? 0 : 1,
      id,
    ]
  );
}

export async function deleteGradeSetting(id) {
  await execute(`DELETE FROM marksheet_grade_settings WHERE id = ?`, [id]);
}

export async function listActivities(filters = {}) {
  const hasClassScopes = await supportsActivityClassScopes();
  const where = [];
  const params = [];
  const scopeKey = filters.scope_key || null;
  const classId = Number(filters.class_id || filters.classId || 0) || null;
  const sectionId = Number(filters.section_id || filters.sectionId || 0) || null;

  if (scopeKey) {
    where.push("ma.scope_key = ?");
    params.push(scopeKey);
  }
  if (hasClassScopes && classId) {
    where.push("(ma.class_id = ? OR ma.class_id IS NULL)");
    params.push(classId);
  }
  if (hasClassScopes && sectionId) {
    where.push("(ma.section_id = ? OR ma.section_id IS NULL)");
    params.push(sectionId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  if (!hasClassScopes) {
    return query(
      `SELECT
         ma.id,
         ma.name,
         ma.scope_key,
         NULL AS class_id,
         NULL AS class_name,
         NULL AS section_id,
         NULL AS section_name,
         NULL AS section_medium,
         ma.sort_order,
         ma.max_marks,
         ma.is_active
       FROM marksheet_activities ma
       ${whereSql}
       ORDER BY ma.scope_key, ma.sort_order, ma.name`,
      params
    );
  }

  return query(
    `SELECT
       ma.id,
       ma.name,
       ma.scope_key,
       ma.class_id,
       c.name AS class_name,
       ma.section_id,
       sec.name AS section_name,
       sec.medium AS section_medium,
       ma.sort_order,
       ma.max_marks,
       ma.is_active
     FROM marksheet_activities ma
     LEFT JOIN classes c ON c.id = ma.class_id
     LEFT JOIN sections sec ON sec.id = ma.section_id
     ${whereSql}
     ORDER BY ma.class_id IS NULL DESC, c.name, ma.section_id IS NULL DESC, sec.name, ma.scope_key, ma.sort_order, ma.name`,
    params
  );
}

export async function createActivity(data) {
  const hasClassScopes = await supportsActivityClassScopes();

  if (!hasClassScopes) {
    const result = await execute(
      `INSERT INTO marksheet_activities (name, scope_key, sort_order, max_marks, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.name,
        data.scope_key || "i_v",
        data.sort_order || 0,
        data.max_marks || 10,
        data.is_active === false ? 0 : 1,
      ]
    );
    return result.insertId;
  }

  const result = await execute(
    `INSERT INTO marksheet_activities (name, scope_key, class_id, section_id, sort_order, max_marks, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.scope_key || null,
      data.class_id || null,
      data.section_id || null,
      data.sort_order || 0,
      data.max_marks || 10,
      data.is_active === false ? 0 : 1,
    ]
  );
  return result.insertId;
}

export async function updateActivity(id, data) {
  const hasClassScopes = await supportsActivityClassScopes();

  if (!hasClassScopes) {
    await execute(
      `UPDATE marksheet_activities
       SET name = ?, scope_key = ?, sort_order = ?, max_marks = ?, is_active = ?
       WHERE id = ?`,
      [
        data.name,
        data.scope_key || "i_v",
        data.sort_order || 0,
        data.max_marks || 10,
        data.is_active === false ? 0 : 1,
        id,
      ]
    );
    return;
  }

  await execute(
    `UPDATE marksheet_activities
     SET name = ?, scope_key = ?, class_id = ?, section_id = ?, sort_order = ?, max_marks = ?, is_active = ?
     WHERE id = ?`,
    [
      data.name,
      data.scope_key || null,
      data.class_id || null,
      data.section_id || null,
      data.sort_order || 0,
      data.max_marks || 10,
      data.is_active === false ? 0 : 1,
      id,
    ]
  );
}

export async function deleteActivity(id) {
  await execute(`DELETE FROM marksheet_activities WHERE id = ?`, [id]);
}

export async function getClassById(classId) {
  const rows = await query(`SELECT id, name FROM classes WHERE id = ? LIMIT 1`, [classId]);
  return rows[0] || null;
}

export async function getActivityMarkGrid({ sessionId, classId, sectionId }) {
  const cls = await getClassById(classId);
  const scopeKey = scopeKeyForClassName(cls?.name);
  const hasClassScopes = await supportsActivityClassScopes();

  const activitiesQuery = hasClassScopes
    ? query(
        `SELECT id, name, scope_key, class_id, section_id, sort_order, max_marks, is_active
         FROM marksheet_activities
         WHERE is_active = TRUE
           AND (
             (class_id IS NULL AND section_id IS NULL AND scope_key IS NULL)
             OR (class_id = ? AND (section_id IS NULL OR section_id = ?))
             OR (class_id IS NULL AND section_id IS NULL AND scope_key = ?)
           )
         ORDER BY class_id IS NULL DESC, section_id IS NULL DESC, sort_order, name`,
        [classId, sectionId, scopeKey]
      )
    : query(
        `SELECT
           id,
           name,
           scope_key,
           NULL AS class_id,
           NULL AS section_id,
           sort_order,
           max_marks,
           is_active
         FROM marksheet_activities
         WHERE is_active = TRUE
           AND scope_key = ?
         ORDER BY sort_order, name`,
        [scopeKey]
      );

  const [activities, students] = await Promise.all([
    activitiesQuery,
    query(
      `SELECT
         se.student_id,
         st.name AS student_name,
         se.roll_number,
         mam.activity_id,
         mam.marks
       FROM student_enrollments se
       JOIN students st ON st.id = se.student_id
       LEFT JOIN marksheet_activity_marks mam
         ON mam.student_id = se.student_id
        AND mam.session_id = se.session_id
        AND mam.class_id = se.class_id
        AND mam.section_id = se.section_id
       WHERE se.session_id = ?
         AND se.class_id = ?
         AND se.section_id = ?
         AND se.status = 'active'
       ORDER BY se.roll_number, st.name`,
      [sessionId, classId, sectionId]
    ),
  ]);

  const studentMap = new Map();
  students.forEach((row) => {
    const key = Number(row.student_id);
    if (!studentMap.has(key)) {
      studentMap.set(key, {
        student_id: key,
        student_name: row.student_name,
        roll_number: row.roll_number,
        marks: {},
      });
    }
    if (row.activity_id) {
      studentMap.get(key).marks[Number(row.activity_id)] = row.marks;
    }
  });

  return { scope_key: scopeKey, activities, students: [...studentMap.values()] };
}

export async function saveActivityMarks({ activityId, sessionId, classId, sectionId, rows, userId }) {
  for (const row of rows) {
    await execute(
      `INSERT INTO marksheet_activity_marks
         (activity_id, student_id, session_id, class_id, section_id, marks, entered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         marks = VALUES(marks),
         entered_by = VALUES(entered_by),
         updated_at = CURRENT_TIMESTAMP`,
      [activityId, row.student_id, sessionId, classId, sectionId, row.marks, userId]
    );
  }
}

export async function getStudentActivityRows({ studentId, sessionId, classId, sectionId, className }) {
  const scopeKey = scopeKeyForClassName(className);
  const hasClassScopes = await supportsActivityClassScopes();

  if (!hasClassScopes) {
    return query(
      `SELECT
         ma.id AS activity_id,
         ma.name,
         ma.scope_key,
         NULL AS class_id,
         NULL AS section_id,
         ma.sort_order,
         ma.max_marks,
         mam.marks
       FROM marksheet_activities ma
       LEFT JOIN marksheet_activity_marks mam
         ON mam.activity_id = ma.id
        AND mam.student_id = ?
        AND mam.session_id = ?
        AND mam.class_id = ?
        AND mam.section_id = ?
       WHERE ma.is_active = TRUE
         AND ma.scope_key = ?
       ORDER BY ma.sort_order, ma.name`,
      [studentId, sessionId, classId, sectionId, scopeKey]
    );
  }

  return query(
    `SELECT
       ma.id AS activity_id,
       ma.name,
       ma.scope_key,
       ma.class_id,
       ma.section_id,
       ma.sort_order,
       ma.max_marks,
       mam.marks
     FROM marksheet_activities ma
     LEFT JOIN marksheet_activity_marks mam
       ON mam.activity_id = ma.id
      AND mam.student_id = ?
      AND mam.session_id = ?
      AND mam.class_id = ?
      AND mam.section_id = ?
     WHERE ma.is_active = TRUE
       AND (
         (ma.class_id IS NULL AND ma.section_id IS NULL AND ma.scope_key IS NULL)
         OR (ma.class_id = ? AND (ma.section_id IS NULL OR ma.section_id = ?))
         OR (ma.class_id IS NULL AND ma.section_id IS NULL AND ma.scope_key = ?)
       )
     ORDER BY ma.class_id IS NULL DESC, ma.section_id IS NULL DESC, ma.sort_order, ma.name`,
    [studentId, sessionId, classId, sectionId, classId, sectionId, scopeKey]
  );
}
