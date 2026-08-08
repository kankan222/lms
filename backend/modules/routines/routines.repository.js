import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

const STREAM_DEDUPE_SQL = "COALESCE(?, 0)";

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function appendFilter(where, params, column, value) {
  if (!hasValue(value)) return;
  where.push(`${column} = ?`);
  params.push(value);
}

export function listTimeSlotTemplates(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "t.session_id", filters.session_id);
  appendFilter(where, params, "t.class_id", filters.class_id);
  appendFilter(where, params, "t.section_id", filters.section_id);
  appendFilter(where, params, "t.medium", filters.medium);
  appendFilter(where, params, "t.stream_id", filters.stream_id);
  appendFilter(where, params, "t.scope_level", filters.scope_level);
  if (filters.include_inactive !== "true") {
    where.push("t.is_active = 1");
  }

  return query(
    `
      SELECT
        t.*,
        s.name AS session_name,
        c.name AS class_name,
        sec.name AS section_name,
        st.name AS stream_name
      FROM routine_time_slot_templates t
      LEFT JOIN academic_sessions s ON s.id = t.session_id
      LEFT JOIN classes c ON c.id = t.class_id
      LEFT JOIN sections sec ON sec.id = t.section_id
      LEFT JOIN streams st ON st.id = t.stream_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.is_active DESC, t.scope_level ASC, t.name ASC, t.id DESC
    `,
    params
  );
}

export function getTimeSlotTemplateById(id) {
  return query(
    `
      SELECT *
      FROM routine_time_slot_templates
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export async function createTimeSlotTemplate(data, slots) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        INSERT INTO routine_time_slot_templates
        (name, scope_level, session_id, class_id, section_id, medium, stream_id, description, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.name,
        data.scope_level,
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.description,
        data.is_active,
        data.created_by,
      ]
    );
    const templateId = result.insertId;
    await replaceTimeSlots(conn, templateId, slots);
    await conn.commit();
    return getTimeSlotTemplateWithSlots(templateId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateTimeSlotTemplate(id, data, slots) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE routine_time_slot_templates
        SET name = ?,
            scope_level = ?,
            session_id = ?,
            class_id = ?,
            section_id = ?,
            medium = ?,
            stream_id = ?,
            description = ?,
            is_active = ?
        WHERE id = ?
      `,
      [
        data.name,
        data.scope_level,
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.description,
        data.is_active,
        id,
      ]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return null;
    }
    if (Array.isArray(slots)) {
      await replaceTimeSlots(conn, id, slots);
    }
    await conn.commit();
    return getTimeSlotTemplateWithSlots(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function replaceTimeSlots(conn, templateId, slots = []) {
  await conn.execute("DELETE FROM routine_time_slots WHERE template_id = ?", [templateId]);
  for (const slot of slots) {
    await conn.execute(
      `
        INSERT INTO routine_time_slots
        (template_id, weekday, period_number, label, start_time, end_time, default_entry_type, is_break, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        templateId,
        slot.weekday,
        slot.period_number,
        slot.label,
        slot.start_time,
        slot.end_time,
        slot.default_entry_type,
        slot.is_break,
        slot.sort_order,
      ]
    );
  }
}

export async function getTimeSlotTemplateWithSlots(id) {
  const template = await getTimeSlotTemplateById(id);
  if (!template) return null;
  const slots = await query(
    `
      SELECT *
      FROM routine_time_slots
      WHERE template_id = ?
      ORDER BY COALESCE(weekday, 0), sort_order, period_number, start_time
    `,
    [id]
  );
  return { ...template, slots };
}

export function listClassRoutineVersions(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "v.session_id", filters.session_id);
  appendFilter(where, params, "v.class_id", filters.class_id);
  appendFilter(where, params, "v.section_id", filters.section_id);
  appendFilter(where, params, "v.medium", filters.medium);
  appendFilter(where, params, "v.stream_id", filters.stream_id);
  appendFilter(where, params, "v.status", filters.status);

  return query(
    `
      SELECT
        v.*,
        ses.name AS session_name,
        c.name AS class_name,
        sec.name AS section_name,
        st.name AS stream_name,
        creator.username AS created_by_name,
        COUNT(e.id) AS entry_count
      FROM class_routine_versions v
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      LEFT JOIN users creator ON creator.id = v.created_by
      LEFT JOIN class_routine_entries e ON e.routine_version_id = v.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY v.id
      ORDER BY v.updated_at DESC, v.id DESC
    `,
    params
  );
}

export function listClassRoutineBoardRows(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "v.session_id", filters.session_id);
  appendFilter(where, params, "v.class_id", filters.class_id);
  appendFilter(where, params, "v.section_id", filters.section_id);
  appendFilter(where, params, "v.medium", filters.medium);
  appendFilter(where, params, "v.stream_id", filters.stream_id);
  if (hasValue(filters.class_scope)) {
    where.push("COALESCE(c.class_scope, 'school') = ?");
    params.push(filters.class_scope);
  }
  if (hasValue(filters.status) && filters.status !== "all") {
    where.push("v.status = ?");
    params.push(filters.status);
  }
  if (hasValue(filters.weekday)) {
    where.push("e.weekday = ?");
    params.push(filters.weekday);
  }

  return query(
    `
      SELECT
        v.id AS routine_version_id,
        v.session_id,
        ses.name AS session_name,
        v.class_id,
        c.name AS class_name,
        c.display_order AS class_display_order,
        COALESCE(c.class_scope, 'school') AS class_scope,
        v.section_id,
        sec.name AS section_name,
        v.medium,
        v.stream_id,
        st.name AS stream_name,
        v.time_slot_template_id,
        v.version_number,
        v.status,
        v.title AS routine_title,
        v.source,
        v.published_at,
        v.updated_at,
        e.id AS entry_id,
        e.weekday,
        e.period_number,
        e.start_time,
        e.end_time,
        e.entry_type,
        e.subject_id,
        sub.name AS subject_name,
        e.activity_id,
        act.name AS activity_name,
        e.title AS entry_title,
        e.room,
        e.notes,
        e.sort_order,
        GROUP_CONCAT(t.id ORDER BY et.teacher_role, t.name SEPARATOR ',') AS teacher_ids,
        GROUP_CONCAT(t.name ORDER BY et.teacher_role, t.name SEPARATOR ', ') AS teacher_names
      FROM class_routine_versions v
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      JOIN class_routine_entries e ON e.routine_version_id = v.id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN marksheet_activities act ON act.id = e.activity_id
      LEFT JOIN class_routine_entry_teachers et ON et.routine_entry_id = e.id
      LEFT JOIN teachers t ON t.id = et.teacher_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY e.id
      ORDER BY
        COALESCE(c.class_scope, 'school') ASC,
        e.weekday ASC,
        COALESCE(c.display_order, c.id) ASC,
        c.id ASC,
        c.name ASC,
        sec.name ASC,
        v.medium ASC,
        st.name ASC,
        e.sort_order ASC,
        e.period_number ASC,
        e.start_time ASC
    `,
    params
  );
}

export function getClassRoutineVersionById(id) {
  return query(
    `
      SELECT
        v.*,
        ses.name AS session_name,
        c.name AS class_name,
        sec.name AS section_name,
        st.name AS stream_name
      FROM class_routine_versions v
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      WHERE v.id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export async function getClassRoutineWithEntries(id) {
  const version = await getClassRoutineVersionById(id);
  if (!version) return null;
  const entries = await getClassRoutineEntries(id);
  return { ...version, entries };
}

export async function getClassRoutineEntries(versionId) {
  const rows = await query(
    `
      SELECT
        e.*,
        sub.name AS subject_name,
        act.name AS activity_name,
        GROUP_CONCAT(t.id ORDER BY et.teacher_role, t.name SEPARATOR ',') AS teacher_ids,
        GROUP_CONCAT(t.name ORDER BY et.teacher_role, t.name SEPARATOR ', ') AS teacher_names
      FROM class_routine_entries e
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN marksheet_activities act ON act.id = e.activity_id
      LEFT JOIN class_routine_entry_teachers et ON et.routine_entry_id = e.id
      LEFT JOIN teachers t ON t.id = et.teacher_id
      WHERE e.routine_version_id = ?
      GROUP BY e.id
      ORDER BY e.weekday, e.sort_order, e.period_number, e.start_time
    `,
    [versionId]
  );

  return rows.map((row) => ({
    ...row,
    teacher_ids: row.teacher_ids
      ? String(row.teacher_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    teacher_names: row.teacher_names || "",
  }));
}

export async function createClassRoutineVersion(data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const versionNumber = await nextClassRoutineVersionNumber(conn, data);
    const [result] = await conn.execute(
      `
        INSERT INTO class_routine_versions
        (session_id, class_id, section_id, medium, stream_id, time_slot_template_id, version_number,
         status, title, source, parent_version_id, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      [
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.time_slot_template_id,
        versionNumber,
        data.title,
        data.source,
        data.parent_version_id,
        data.user_id,
        data.user_id,
      ]
    );
    const versionId = result.insertId;
    await replaceClassRoutineEntries(conn, versionId, entries);
    await conn.commit();
    return getClassRoutineWithEntries(versionId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateClassRoutineDraft(id, data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE class_routine_versions
        SET title = ?,
            time_slot_template_id = ?,
            updated_by = ?
        WHERE id = ? AND status = 'draft'
      `,
      [data.title, data.time_slot_template_id, data.user_id, id]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return null;
    }
    if (Array.isArray(entries)) {
      await replaceClassRoutineEntries(conn, id, entries);
    }
    await conn.commit();
    return getClassRoutineWithEntries(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function nextClassRoutineVersionNumber(conn, data) {
  const [rows] = await conn.execute(
    `
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM class_routine_versions
      WHERE session_id = ?
        AND class_id = ?
        AND section_id = ?
        AND medium = ?
        AND stream_id_dedupe = ${STREAM_DEDUPE_SQL}
    `,
    [data.session_id, data.class_id, data.section_id, data.medium, data.stream_id]
  );
  return Number(rows[0]?.next_version || 1);
}

async function replaceClassRoutineEntries(conn, versionId, entries = []) {
  await conn.execute("DELETE FROM class_routine_entries WHERE routine_version_id = ?", [versionId]);
  for (const entry of entries) {
    await insertClassRoutineEntry(conn, versionId, entry);
  }
}

async function insertClassRoutineEntry(conn, versionId, entry) {
  const [result] = await conn.execute(
    `
      INSERT INTO class_routine_entries
      (routine_version_id, time_slot_id, weekday, period_number, start_time, end_time,
       entry_type, subject_id, activity_id, title, room, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      versionId,
      entry.time_slot_id,
      entry.weekday,
      entry.period_number,
      entry.start_time,
      entry.end_time,
      entry.entry_type,
      entry.subject_id,
      entry.activity_id,
      entry.title,
      entry.room,
      entry.notes,
      entry.sort_order,
    ]
  );
  for (const teacher of entry.teachers || []) {
    await conn.execute(
      `
        INSERT INTO class_routine_entry_teachers
        (routine_entry_id, teacher_id, teacher_role)
        VALUES (?, ?, ?)
      `,
      [result.insertId, teacher.teacher_id, teacher.teacher_role || "primary"]
    );
  }
  return result.insertId;
}

export async function upsertClassRoutineDraftSlot(id, entries, userId) {
  const normalizedEntries = Array.isArray(entries) ? entries : [entries].filter(Boolean);
  const firstEntry = normalizedEntries[0];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [routineRows] = await conn.execute(
      "SELECT id FROM class_routine_versions WHERE id = ? AND status = 'draft' LIMIT 1",
      [id]
    );
    if (!routineRows.length) {
      await conn.rollback();
      return null;
    }
    if (!firstEntry) {
      await conn.rollback();
      return null;
    }
    await conn.execute(
      `
        DELETE FROM class_routine_entries
        WHERE routine_version_id = ?
          AND weekday = ?
          AND period_number = ?
      `,
      [id, firstEntry.weekday, firstEntry.period_number]
    );
    for (const entry of normalizedEntries) {
      await insertClassRoutineEntry(conn, id, entry);
    }
    await conn.execute("UPDATE class_routine_versions SET updated_by = ? WHERE id = ?", [userId, id]);
    await conn.commit();
    return getClassRoutineWithEntries(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createDraftFromClassRoutine(sourceId, userId) {
  const source = await getClassRoutineWithEntries(sourceId);
  if (!source) return null;
  const entries = source.entries.map((entry) => ({
    ...entry,
    teachers: entry.teacher_ids.map((teacherId, index) => ({
      teacher_id: teacherId,
      teacher_role: index === 0 ? "primary" : "co_teacher",
    })),
  }));
  return createClassRoutineVersion(
    {
      session_id: source.session_id,
      class_id: source.class_id,
      section_id: source.section_id,
      medium: source.medium,
      stream_id: source.stream_id,
      time_slot_template_id: source.time_slot_template_id,
      title: source.title,
      source: "manual",
      parent_version_id: source.id,
      user_id: userId,
    },
    entries
  );
}

export async function publishClassRoutineVersion(id, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute("SELECT * FROM class_routine_versions WHERE id = ? FOR UPDATE", [id]);
    const version = rows[0] || null;
    if (!version) {
      await conn.rollback();
      return null;
    }
    await conn.execute(
      `
        UPDATE class_routine_versions
        SET status = 'archived', archived_at = NOW(), updated_by = ?
        WHERE id <> ?
          AND session_id = ?
          AND class_id = ?
          AND section_id = ?
          AND medium = ?
          AND stream_id_dedupe = COALESCE(?, 0)
          AND status = 'published'
      `,
      [userId, id, version.session_id, version.class_id, version.section_id, version.medium, version.stream_id]
    );
    await conn.execute(
      `
        UPDATE class_routine_versions
        SET status = 'published',
            published_at = COALESCE(published_at, NOW()),
            archived_at = NULL,
            updated_by = ?
        WHERE id = ?
      `,
      [userId, id]
    );
    await conn.commit();
    return getClassRoutineWithEntries(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function deleteClassRoutineDraft(id) {
  return query("DELETE FROM class_routine_versions WHERE id = ? AND status = 'draft'", [id]);
}

export function findClassRoutineTeacherConflicts(versionId) {
  return query(
    `
      SELECT
        nt.teacher_id,
        t.name AS teacher_name,
        ne.weekday,
        ne.start_time,
        ne.end_time,
        v.id AS conflicting_version_id,
        cv.class_id AS conflicting_class_id,
        cv.section_id AS conflicting_section_id,
        cc.name AS conflicting_class_name,
        cs.name AS conflicting_section_name
      FROM class_routine_versions nv
      JOIN class_routine_entries ne ON ne.routine_version_id = nv.id
      JOIN class_routine_entry_teachers nt ON nt.routine_entry_id = ne.id
      JOIN class_routine_versions cv
        ON cv.session_id = nv.session_id
       AND cv.status = 'published'
       AND cv.id <> nv.id
       AND NOT (
         cv.class_id = nv.class_id
         AND cv.section_id = nv.section_id
         AND cv.medium = nv.medium
         AND cv.stream_id_dedupe = nv.stream_id_dedupe
       )
      JOIN class_routine_entries ce
        ON ce.routine_version_id = cv.id
       AND ce.weekday = ne.weekday
       AND ne.start_time < ce.end_time
       AND ne.end_time > ce.start_time
      JOIN class_routine_entry_teachers ct
        ON ct.routine_entry_id = ce.id
       AND ct.teacher_id = nt.teacher_id
      JOIN teachers t ON t.id = nt.teacher_id
      JOIN classes cc ON cc.id = cv.class_id
      JOIN sections cs ON cs.id = cv.section_id
      JOIN class_routine_versions v ON v.id = cv.id
      WHERE nv.id = ?
      ORDER BY ne.weekday, ne.start_time, t.name
    `,
    [versionId]
  );
}

export function findInvalidClassRoutineTeacherAssignments(versionId) {
  return query(
    `
      SELECT
        e.id AS entry_id,
        e.subject_id,
        sub.name AS subject_name,
        t.id AS teacher_id,
        t.name AS teacher_name
      FROM class_routine_versions v
      JOIN class_routine_entries e ON e.routine_version_id = v.id
      JOIN class_routine_entry_teachers et ON et.routine_entry_id = e.id
      JOIN teachers t ON t.id = et.teacher_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN teacher_class_assignments ta
        ON ta.teacher_id = et.teacher_id
       AND ta.session_id = v.session_id
       AND ta.class_id = v.class_id
       AND ta.section_id = v.section_id
       AND ta.subject_id = e.subject_id
      WHERE v.id = ?
        AND e.entry_type = 'subject'
        AND ta.id IS NULL
    `,
    [versionId]
  );
}

export function getPublishedClassRoutineForScope(filters) {
  return query(
    `
      SELECT id
      FROM class_routine_versions
      WHERE session_id = ?
        AND class_id = ?
        AND section_id = ?
        AND medium = ?
        AND stream_id_dedupe = COALESCE(?, 0)
        AND status = 'published'
      ORDER BY published_at DESC, id DESC
      LIMIT 1
    `,
    [filters.session_id, filters.class_id, filters.section_id, filters.medium, filters.stream_id]
  ).then((rows) => rows[0] || null);
}

export function getEffectiveSubstitutions(filters = {}) {
  const where = [
    "s.status = 'published'",
    "s.session_id = ?",
    "s.class_id = ?",
    "s.section_id = ?",
    "s.medium = ?",
    "? BETWEEN s.starts_on AND s.ends_on",
  ];
  const params = [filters.session_id, filters.class_id, filters.section_id, filters.medium, filters.date];
  if (hasValue(filters.stream_id)) {
    where.push("(s.stream_id IS NULL OR s.stream_id = ?)");
    params.push(filters.stream_id);
  }

  return query(
    `
      SELECT
        s.*,
        os.name AS original_subject_name,
        rs.name AS replacement_subject_name,
        GROUP_CONCAT(CASE WHEN st.assignment_role = 'replacement' THEN t.id END ORDER BY t.name) AS replacement_teacher_ids,
        GROUP_CONCAT(CASE WHEN st.assignment_role = 'replacement' THEN t.name END ORDER BY t.name SEPARATOR ', ') AS replacement_teacher_names
      FROM routine_substitutions s
      LEFT JOIN subjects os ON os.id = s.original_subject_id
      LEFT JOIN subjects rs ON rs.id = s.replacement_subject_id
      LEFT JOIN routine_substitution_teachers st ON st.substitution_id = s.id
      LEFT JOIN teachers t ON t.id = st.teacher_id
      WHERE ${where.join(" AND ")}
      GROUP BY s.id
      ORDER BY s.start_time, s.period_number, s.id
    `,
    params
  );
}

export function getTeacherByUserId(userId) {
  return query("SELECT id, name FROM teachers WHERE user_id = ? LIMIT 1", [userId]).then((rows) => rows[0] || null);
}

export function getStudentEnrollmentForUser(studentId, userId) {
  return query(
    `
      SELECT
        s.id AS student_id,
        se.session_id,
        se.class_id,
        se.section_id,
        sec.medium,
        se.stream_id
      FROM students s
      JOIN student_enrollments se ON se.student_id = s.id AND se.status = 'active'
      JOIN sections sec ON sec.id = se.section_id
      LEFT JOIN student_parents sp ON sp.student_id = s.id
      LEFT JOIN parents p ON p.id = sp.parent_id
      WHERE s.id = ?
        AND (p.user_id = ? OR ? IN (
          SELECT ur.user_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name IN ('super_admin', 'admin')
        ))
      ORDER BY se.id DESC
      LIMIT 1
    `,
    [studentId, userId, userId]
  ).then((rows) => rows[0] || null);
}

export function getTeacherClassRoutine(userId, filters = {}) {
  const where = ["t.user_id = ?", "v.status = 'published'"];
  const params = [userId];
  appendFilter(where, params, "v.session_id", filters.session_id);
  appendFilter(where, params, "e.weekday", filters.weekday);

  return query(
    `
      SELECT
        v.session_id,
        ses.name AS session_name,
        v.class_id,
        c.name AS class_name,
        v.section_id,
        sec.name AS section_name,
        v.medium,
        v.stream_id,
        st.name AS stream_name,
        e.id AS entry_id,
        e.weekday,
        e.period_number,
        e.start_time,
        e.end_time,
        e.entry_type,
        e.title,
        e.room,
        e.subject_id,
        sub.name AS subject_name
      FROM class_routine_entry_teachers et
      JOIN teachers t ON t.id = et.teacher_id
      JOIN class_routine_entries e ON e.id = et.routine_entry_id
      JOIN class_routine_versions v ON v.id = e.routine_version_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.weekday, e.start_time, c.name, sec.name
    `,
    params
  );
}

export function listExamRoutineVersions(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "v.exam_id", filters.exam_id);
  appendFilter(where, params, "v.session_id", filters.session_id);
  appendFilter(where, params, "v.status", filters.status);
  return query(
    `
      SELECT
        v.*,
        e.name AS exam_name,
        ses.name AS session_name,
        COUNT(re.id) AS entry_count
      FROM exam_routine_versions v
      JOIN exams e ON e.id = v.exam_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      LEFT JOIN exam_routine_entries re ON re.exam_routine_version_id = v.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY v.id
      ORDER BY v.updated_at DESC, v.id DESC
    `,
    params
  );
}

export function getExamRoutineVersionById(id) {
  return query(
    `
      SELECT v.*, e.name AS exam_name, ses.name AS session_name
      FROM exam_routine_versions v
      JOIN exams e ON e.id = v.exam_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      WHERE v.id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export async function getExamRoutineWithEntries(id) {
  const version = await getExamRoutineVersionById(id);
  if (!version) return null;
  const entries = await query(
    `
      SELECT
        e.*,
        c.name AS class_name,
        sec.name AS section_name,
        st.name AS stream_name,
        sub.name AS subject_name,
        GROUP_CONCAT(t.id ORDER BY inv.invigilation_role, t.name SEPARATOR ',') AS invigilator_ids,
        GROUP_CONCAT(t.name ORDER BY inv.invigilation_role, t.name SEPARATOR ', ') AS invigilator_names
      FROM exam_routine_entries e
      JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections sec ON sec.id = e.section_id
      LEFT JOIN streams st ON st.id = e.stream_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN exam_routine_entry_invigilators inv ON inv.exam_routine_entry_id = e.id
      LEFT JOIN teachers t ON t.id = inv.teacher_id
      WHERE e.exam_routine_version_id = ?
      GROUP BY e.id
      ORDER BY e.exam_date, e.start_time, c.name, sec.name
    `,
    [id]
  );
  return {
    ...version,
    entries: entries.map((entry) => ({
      ...entry,
      invigilator_ids: entry.invigilator_ids
        ? String(entry.invigilator_ids).split(",").map((value) => Number(value)).filter(Boolean)
        : [],
    })),
  };
}

export function getExamById(examId) {
  return query("SELECT id, name, session_id FROM exams WHERE id = ? LIMIT 1", [examId]).then((rows) => rows[0] || null);
}

export async function getRoutineImportLookups() {
  const [sessions, classes, sections, streams, subjects, teachers, exams, activities] = await Promise.all([
    query("SELECT id, name FROM academic_sessions"),
    query("SELECT id, name, class_scope, display_order FROM classes ORDER BY COALESCE(display_order, id), id"),
    query("SELECT id, class_id, name, medium FROM sections"),
    query("SELECT id, name FROM streams"),
    query("SELECT id, name, code FROM subjects"),
    query("SELECT id, name, employee_id, email, phone FROM teachers"),
    query("SELECT id, name, session_id FROM exams"),
    query("SELECT id, name FROM marksheet_activities WHERE is_active = TRUE"),
  ]);
  return { sessions, classes, sections, streams, subjects, teachers, exams, activities };
}

export async function createExamRoutineVersion(data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [versionRows] = await conn.execute(
      "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM exam_routine_versions WHERE exam_id = ?",
      [data.exam_id]
    );
    const [result] = await conn.execute(
      `
        INSERT INTO exam_routine_versions
        (exam_id, session_id, title, version_number, status, source, parent_version_id,
         publish_announcement_requested, created_by, updated_by)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      [
        data.exam_id,
        data.session_id,
        data.title,
        Number(versionRows[0]?.next_version || 1),
        data.source,
        data.parent_version_id,
        data.publish_announcement_requested,
        data.user_id,
        data.user_id,
      ]
    );
    await replaceExamRoutineEntries(conn, result.insertId, entries);
    await conn.commit();
    return getExamRoutineWithEntries(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateExamRoutineDraft(id, data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE exam_routine_versions
        SET title = ?, publish_announcement_requested = ?, updated_by = ?
        WHERE id = ? AND status = 'draft'
      `,
      [data.title, data.publish_announcement_requested, data.user_id, id]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return null;
    }
    if (Array.isArray(entries)) {
      await replaceExamRoutineEntries(conn, id, entries);
    }
    await conn.commit();
    return getExamRoutineWithEntries(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createDraftFromExamRoutine(sourceId, userId) {
  const source = await getExamRoutineWithEntries(sourceId);
  if (!source) return null;
  const entries = source.entries.map((entry) => ({
    ...entry,
    invigilators: entry.invigilator_ids.map((teacherId) => ({
      teacher_id: teacherId,
      invigilation_role: "invigilator",
    })),
  }));
  return createExamRoutineVersion(
    {
      exam_id: source.exam_id,
      session_id: source.session_id,
      title: source.title,
      source: "manual",
      parent_version_id: source.id,
      publish_announcement_requested: source.publish_announcement_requested,
      user_id: userId,
    },
    entries
  );
}

export function deleteExamRoutineVersion(id) {
  return query("DELETE FROM exam_routine_versions WHERE id = ? AND status IN ('draft', 'published')", [id]);
}

async function replaceExamRoutineEntries(conn, versionId, entries = []) {
  await conn.execute("DELETE FROM exam_routine_entries WHERE exam_routine_version_id = ?", [versionId]);
  for (const entry of entries) {
    const [result] = await conn.execute(
      `
        INSERT INTO exam_routine_entries
        (exam_routine_version_id, class_id, section_id, medium, stream_id, subject_id,
         exam_subject_id, entry_type, title, exam_date, start_time, end_time, room, instructions, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        versionId,
        entry.class_id,
        entry.section_id,
        entry.medium,
        entry.stream_id,
        entry.subject_id,
        entry.exam_subject_id,
        entry.entry_type,
        entry.title,
        entry.exam_date,
        entry.start_time,
        entry.end_time,
        entry.room,
        entry.instructions,
        entry.sort_order,
      ]
    );
    for (const invigilator of entry.invigilators || []) {
      await conn.execute(
        `
          INSERT INTO exam_routine_entry_invigilators
          (exam_routine_entry_id, teacher_id, invigilation_role)
          VALUES (?, ?, ?)
        `,
        [result.insertId, invigilator.teacher_id, invigilator.invigilation_role || "invigilator"]
      );
    }
  }
}

export async function publishExamRoutineVersion(id, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute("SELECT * FROM exam_routine_versions WHERE id = ? FOR UPDATE", [id]);
    const version = rows[0] || null;
    if (!version) {
      await conn.rollback();
      return null;
    }
    await conn.execute(
      `
        UPDATE exam_routine_versions
        SET status = 'archived', archived_at = NOW(), updated_by = ?
        WHERE id <> ? AND exam_id = ? AND status = 'published'
      `,
      [userId, id, version.exam_id]
    );
    await conn.execute(
      `
        UPDATE exam_routine_versions
        SET status = 'published',
            published_at = COALESCE(published_at, NOW()),
            archived_at = NULL,
            updated_by = ?
        WHERE id = ?
      `,
      [userId, id]
    );
    await conn.commit();
    return getExamRoutineWithEntries(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function findExamRoutineInvigilatorConflicts(versionId) {
  return query(
    `
      SELECT
        inv.teacher_id,
        t.name AS teacher_name,
        e.exam_date,
        e.start_time,
        e.end_time,
        other.id AS conflicting_entry_id,
        other_v.id AS conflicting_version_id
      FROM exam_routine_entries e
      JOIN exam_routine_entry_invigilators inv ON inv.exam_routine_entry_id = e.id
      JOIN teachers t ON t.id = inv.teacher_id
      JOIN exam_routine_versions v ON v.id = e.exam_routine_version_id
      JOIN exam_routine_versions other_v
        ON other_v.status = 'published'
       AND other_v.id <> v.id
       AND other_v.exam_id <> v.exam_id
      JOIN exam_routine_entries other
        ON other.exam_routine_version_id = other_v.id
       AND other.exam_date = e.exam_date
       AND e.start_time < other.end_time
       AND e.end_time > other.start_time
      JOIN exam_routine_entry_invigilators other_inv
        ON other_inv.exam_routine_entry_id = other.id
       AND other_inv.teacher_id = inv.teacher_id
      WHERE v.id = ?
    `,
    [versionId]
  );
}

export function findInvalidExamSubjects(versionId) {
  return query(
    `
      SELECT e.id, e.subject_id, sub.name AS subject_name
      FROM exam_routine_versions v
      JOIN exam_routine_entries e ON e.exam_routine_version_id = v.id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN exam_subjects es ON es.exam_id = v.exam_id AND es.subject_id = e.subject_id
      WHERE v.id = ?
        AND e.entry_type = 'subject'
        AND e.subject_id IS NOT NULL
        AND es.id IS NULL
    `,
    [versionId]
  );
}

export function listSubstitutions(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "s.session_id", filters.session_id);
  appendFilter(where, params, "s.class_id", filters.class_id);
  appendFilter(where, params, "s.section_id", filters.section_id);
  appendFilter(where, params, "s.status", filters.status);
  appendFilter(where, params, "s.starts_on", filters.starts_on);
  appendFilter(where, params, "s.ends_on", filters.ends_on);

  return query(
    `
      SELECT
        s.*,
        c.name AS class_name,
        sec.name AS section_name,
        stn.name AS stream_name,
        os.name AS original_subject_name,
        rs.name AS replacement_subject_name,
        creator.username AS created_by_name,
        updater.username AS updated_by_name,
        GROUP_CONCAT(t.id ORDER BY st.assignment_role, t.name SEPARATOR ',') AS teacher_ids,
        GROUP_CONCAT(st.assignment_role ORDER BY st.assignment_role, t.name SEPARATOR ',') AS teacher_roles,
        GROUP_CONCAT(t.name ORDER BY st.assignment_role, t.name SEPARATOR ', ') AS teacher_names
      FROM routine_substitutions s
      JOIN classes c ON c.id = s.class_id
      JOIN sections sec ON sec.id = s.section_id
      LEFT JOIN streams stn ON stn.id = s.stream_id
      LEFT JOIN subjects os ON os.id = s.original_subject_id
      LEFT JOIN subjects rs ON rs.id = s.replacement_subject_id
      LEFT JOIN users creator ON creator.id = s.created_by
      LEFT JOIN users updater ON updater.id = s.updated_by
      LEFT JOIN routine_substitution_teachers st ON st.substitution_id = s.id
      LEFT JOIN teachers t ON t.id = st.teacher_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY s.id
      ORDER BY s.starts_on DESC, s.start_time ASC, s.id DESC
    `,
    params
  );
}

export function getSubstitutionById(id) {
  return query(
    `
      SELECT
        s.*,
        c.name AS class_name,
        sec.name AS section_name,
        stn.name AS stream_name,
        os.name AS original_subject_name,
        rs.name AS replacement_subject_name,
        creator.username AS created_by_name,
        updater.username AS updated_by_name
      FROM routine_substitutions s
      JOIN classes c ON c.id = s.class_id
      JOIN sections sec ON sec.id = s.section_id
      LEFT JOIN streams stn ON stn.id = s.stream_id
      LEFT JOIN subjects os ON os.id = s.original_subject_id
      LEFT JOIN subjects rs ON rs.id = s.replacement_subject_id
      LEFT JOIN users creator ON creator.id = s.created_by
      LEFT JOIN users updater ON updater.id = s.updated_by
      WHERE s.id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export async function getSubstitutionWithTeachers(id) {
  const substitution = await getSubstitutionById(id);
  if (!substitution) return null;
  const teachers = await query(
    `
      SELECT st.*, t.name AS teacher_name
      FROM routine_substitution_teachers st
      JOIN teachers t ON t.id = st.teacher_id
      WHERE st.substitution_id = ?
      ORDER BY st.assignment_role, t.name
    `,
    [id]
  );
  return { ...substitution, teachers };
}

export async function createSubstitution(data, teachers) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        INSERT INTO routine_substitutions
        (class_routine_entry_id, session_id, class_id, section_id, medium, stream_id,
         weekday, period_number, starts_on, ends_on, start_time, end_time, change_type,
         status, original_subject_id, replacement_subject_id, title, original_room,
         replacement_room, reason, notes, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.class_routine_entry_id,
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.weekday,
        data.period_number,
        data.starts_on,
        data.ends_on,
        data.start_time,
        data.end_time,
        data.change_type,
        data.original_subject_id,
        data.replacement_subject_id,
        data.title,
        data.original_room,
        data.replacement_room,
        data.reason,
        data.notes,
        data.user_id,
        data.user_id,
      ]
    );
    await replaceSubstitutionTeachers(conn, result.insertId, teachers);
    await conn.commit();
    return getSubstitutionWithTeachers(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateSubstitutionDraft(id, data, teachers) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE routine_substitutions
        SET class_routine_entry_id = ?,
            session_id = ?,
            class_id = ?,
            section_id = ?,
            medium = ?,
            stream_id = ?,
            weekday = ?,
            period_number = ?,
            starts_on = ?,
            ends_on = ?,
            start_time = ?,
            end_time = ?,
            change_type = ?,
            original_subject_id = ?,
            replacement_subject_id = ?,
            title = ?,
            original_room = ?,
            replacement_room = ?,
            reason = ?,
            notes = ?,
            updated_by = ?
        WHERE id = ? AND status = 'draft'
      `,
      [
        data.class_routine_entry_id,
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.weekday,
        data.period_number,
        data.starts_on,
        data.ends_on,
        data.start_time,
        data.end_time,
        data.change_type,
        data.original_subject_id,
        data.replacement_subject_id,
        data.title,
        data.original_room,
        data.replacement_room,
        data.reason,
        data.notes,
        data.user_id,
        id,
      ]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return null;
    }
    if (Array.isArray(teachers)) {
      await replaceSubstitutionTeachers(conn, id, teachers);
    }
    await conn.commit();
    return getSubstitutionWithTeachers(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function replaceSubstitutionTeachers(conn, substitutionId, teachers = []) {
  await conn.execute("DELETE FROM routine_substitution_teachers WHERE substitution_id = ?", [substitutionId]);
  for (const teacher of teachers) {
    await conn.execute(
      `
        INSERT INTO routine_substitution_teachers
        (substitution_id, teacher_id, assignment_role)
        VALUES (?, ?, ?)
      `,
      [substitutionId, teacher.teacher_id, teacher.assignment_role || "replacement"]
    );
  }
}

export async function publishSubstitution(id, userId) {
  const result = await query(
    `
      UPDATE routine_substitutions
      SET status = 'published',
          published_at = COALESCE(published_at, NOW()),
          updated_by = ?
      WHERE id = ? AND status = 'draft'
    `,
    [userId, id]
  );
  if (!result.affectedRows) return null;
  return getSubstitutionWithTeachers(id);
}

export async function cancelSubstitution(id, userId) {
  const result = await query(
    `
      UPDATE routine_substitutions
      SET status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, NOW()),
          updated_by = ?
      WHERE id = ?
    `,
    [userId, id]
  );
  if (!result.affectedRows) return null;
  return getSubstitutionWithTeachers(id);
}

export function findSubstitutionTeacherConflicts(substitutionId) {
  return query(
    `
      SELECT
        st.teacher_id,
        t.name AS teacher_name,
        s.starts_on,
        s.ends_on,
        s.start_time,
        s.end_time,
        e.weekday,
        v.id AS conflicting_version_id
      FROM routine_substitutions s
      JOIN routine_substitution_teachers st
        ON st.substitution_id = s.id
       AND st.assignment_role IN ('replacement','additional')
      JOIN teachers t ON t.id = st.teacher_id
      JOIN class_routine_versions v
        ON v.session_id = s.session_id
       AND v.status = 'published'
      JOIN class_routine_entries e
        ON e.routine_version_id = v.id
       AND s.start_time < e.end_time
       AND s.end_time > e.start_time
       AND (s.weekday IS NULL OR e.weekday = s.weekday)
       AND (s.class_routine_entry_id IS NULL OR e.id <> s.class_routine_entry_id)
      JOIN class_routine_entry_teachers et
        ON et.routine_entry_id = e.id
       AND et.teacher_id = st.teacher_id
      WHERE s.id = ?
      ORDER BY t.name, e.weekday, e.start_time
    `,
    [substitutionId]
  );
}

export function findPublishedSubstitutionTeacherConflicts(substitutionId) {
  return query(
    `
      SELECT
        st.teacher_id,
        t.name AS teacher_name,
        other.id AS conflicting_substitution_id,
        other.starts_on,
        other.ends_on,
        other.start_time,
        other.end_time,
        other.change_type,
        c.name AS class_name,
        sec.name AS section_name
      FROM routine_substitutions s
      JOIN routine_substitution_teachers st
        ON st.substitution_id = s.id
       AND st.assignment_role IN ('replacement','additional')
      JOIN teachers t ON t.id = st.teacher_id
      JOIN routine_substitution_teachers other_st
        ON other_st.teacher_id = st.teacher_id
       AND other_st.assignment_role IN ('replacement','additional')
      JOIN routine_substitutions other
        ON other.id = other_st.substitution_id
       AND other.id <> s.id
       AND other.status = 'published'
       AND s.start_time < other.end_time
       AND s.end_time > other.start_time
       AND s.starts_on <= other.ends_on
       AND s.ends_on >= other.starts_on
      JOIN classes c ON c.id = other.class_id
      JOIN sections sec ON sec.id = other.section_id
      WHERE s.id = ?
      ORDER BY t.name, other.starts_on, other.start_time
    `,
    [substitutionId]
  );
}
