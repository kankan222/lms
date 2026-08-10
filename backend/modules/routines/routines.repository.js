import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

const STREAM_DEDUPE_SQL = "COALESCE(?, 0)";
let classRoutineApplicabilityPromise;

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function normalizeScopeValue(value, fallback = null) {
  return hasValue(value) ? value : fallback;
}

function packedRoutineScopePredicate(column) {
  return `(${column} = ? OR (v.layout_mode = 'packed_hs' AND ${column} IS NULL))`;
}

async function hasClassRoutineApplicabilitySchema() {
  if (!classRoutineApplicabilityPromise) {
    classRoutineApplicabilityPromise = query(
      `
        SELECT
          SUM(TABLE_NAME = 'class_routine_entry_sections') AS has_sections,
          SUM(TABLE_NAME = 'class_routine_entries' AND COLUMN_NAME = 'applies_medium') AS has_medium
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            TABLE_NAME = 'class_routine_entry_sections'
            OR (TABLE_NAME = 'class_routine_entries' AND COLUMN_NAME = 'applies_medium')
          )
      `
    ).then((rows) => Boolean(Number(rows[0]?.has_sections || 0) && Number(rows[0]?.has_medium || 0)));
  }
  return classRoutineApplicabilityPromise;
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

export function countClassRoutinesUsingTemplate(id) {
  return query(
    `
      SELECT COUNT(*) AS usage_count
      FROM class_routine_versions
      WHERE time_slot_template_id = ?
    `,
    [id]
  ).then((rows) => Number(rows[0]?.usage_count || 0));
}

export function deleteTimeSlotTemplate(id) {
  return query("DELETE FROM routine_time_slot_templates WHERE id = ?", [id]);
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

export function listBreakTimeSlotsForTemplateIds(templateIds = []) {
  const ids = [...new Set(templateIds.map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return Promise.resolve([]);
  const placeholders = ids.map(() => "?").join(",");
  return query(
    `
      SELECT
        id AS time_slot_id,
        template_id,
        weekday,
        period_number,
        label,
        start_time,
        end_time,
        default_entry_type,
        is_break,
        sort_order
      FROM routine_time_slots
      WHERE template_id IN (${placeholders})
        AND (default_entry_type = 'break' OR is_break = 1)
      ORDER BY template_id, COALESCE(weekday, 0), sort_order, period_number, start_time
    `,
    ids
  );
}

export function getClassById(id) {
  return query(
    `
      SELECT id, name, COALESCE(class_scope, 'school') AS class_scope
      FROM classes
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export function listClassRoutineVersions(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "v.session_id", filters.session_id);
  appendFilter(where, params, "v.class_id", filters.class_id);
  if (hasValue(filters.section_id)) {
    where.push(packedRoutineScopePredicate("v.section_id"));
    params.push(filters.section_id);
  }
  if (hasValue(filters.medium)) {
    where.push(packedRoutineScopePredicate("v.medium"));
    params.push(filters.medium);
  }
  appendFilter(where, params, "v.stream_id", filters.stream_id);
  if (filters.status === "current") {
    where.push("v.status IN ('draft', 'published')");
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM class_routine_versions other
        WHERE other.session_id = v.session_id
          AND other.class_id = v.class_id
          AND COALESCE(other.section_id, 0) = COALESCE(v.section_id, 0)
          AND COALESCE(other.medium, '') = COALESCE(v.medium, '')
          AND other.stream_id_dedupe = v.stream_id_dedupe
          AND other.layout_mode = v.layout_mode
          AND other.status IN ('draft', 'published')
          AND (
            CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              < CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
            OR (
              CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              AND COALESCE(other.updated_at, other.created_at, '1000-01-01') > COALESCE(v.updated_at, v.created_at, '1000-01-01')
            )
            OR (
              CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              AND COALESCE(other.updated_at, other.created_at, '1000-01-01') = COALESCE(v.updated_at, v.created_at, '1000-01-01')
              AND other.id > v.id
            )
          )
      )
    `);
  } else if (hasValue(filters.status) && filters.status !== "all") {
    appendFilter(where, params, "v.status", filters.status);
  }

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
      LEFT JOIN sections sec ON sec.id = v.section_id
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
  return listClassRoutineBoardRowsImpl(filters);
}

export async function listClassRoutineBoardRowsImpl(filters = {}) {
  const where = [];
  const params = [];
  const hasApplicability = await hasClassRoutineApplicabilitySchema();
  const hasRoutineVersionFilter = hasValue(filters.routine_version_id);
  appendFilter(where, params, "v.id", filters.routine_version_id);
  if (!hasRoutineVersionFilter) {
    appendFilter(where, params, "v.session_id", filters.session_id);
    appendFilter(where, params, "v.class_id", filters.class_id);
    if (hasValue(filters.section_id)) {
      where.push(packedRoutineScopePredicate("v.section_id"));
      params.push(filters.section_id);
    }
    if (hasValue(filters.medium)) {
      where.push(packedRoutineScopePredicate("v.medium"));
      params.push(filters.medium);
    }
    appendFilter(where, params, "v.stream_id", filters.stream_id);
    if (hasValue(filters.class_scope)) {
      where.push("COALESCE(c.class_scope, 'school') = ?");
      params.push(filters.class_scope);
    }
    if (filters.status === "current") {
      where.push("v.status IN ('draft', 'published')");
      where.push(`
        NOT EXISTS (
          SELECT 1
          FROM class_routine_versions other
          WHERE other.session_id = v.session_id
            AND other.class_id = v.class_id
            AND COALESCE(other.section_id, 0) = COALESCE(v.section_id, 0)
            AND COALESCE(other.medium, '') = COALESCE(v.medium, '')
            AND other.stream_id_dedupe = v.stream_id_dedupe
            AND other.layout_mode = v.layout_mode
            AND other.status IN ('draft', 'published')
            AND (
              CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                < CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              OR (
                CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                  = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                AND COALESCE(other.updated_at, other.created_at, '1000-01-01') > COALESCE(v.updated_at, v.created_at, '1000-01-01')
              )
              OR (
                CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                  = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                AND COALESCE(other.updated_at, other.created_at, '1000-01-01') = COALESCE(v.updated_at, v.created_at, '1000-01-01')
                AND other.id > v.id
              )
            )
        )
      `);
    } else if (hasValue(filters.status) && filters.status !== "all") {
      where.push("v.status = ?");
      params.push(filters.status);
    }
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
        v.layout_mode,
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
        COALESCE(e.start_time, MAX(COALESCE(ts_exact.start_time, ts_day.start_time, ts_all.start_time))) AS start_time,
        COALESCE(e.end_time, MAX(COALESCE(ts_exact.end_time, ts_day.end_time, ts_all.end_time))) AS end_time,
        e.entry_type,
        e.subject_id,
        sub.name AS subject_name,
        e.activity_id,
        act.name AS activity_name,
        ${hasApplicability ? "e.applies_medium" : "NULL"} AS applies_medium,
        e.title AS entry_title,
        e.room,
        e.notes,
        e.sort_order,
        MAX(COALESCE(ts_exact.label, ts_day.label, ts_all.label)) AS slot_label,
        MAX(COALESCE(ts_exact.default_entry_type, ts_day.default_entry_type, ts_all.default_entry_type)) AS slot_default_entry_type,
        GROUP_CONCAT(DISTINCT t.id ORDER BY t.name SEPARATOR ',') AS teacher_ids,
        GROUP_CONCAT(DISTINCT t.user_id ORDER BY t.name SEPARATOR ',') AS teacher_user_ids,
        GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', ') AS teacher_names
        ${hasApplicability ? ", GROUP_CONCAT(DISTINCT es.section_id ORDER BY sec_app.name SEPARATOR ',') AS applies_section_ids" : ", NULL AS applies_section_ids"}
        ${hasApplicability ? ", GROUP_CONCAT(DISTINCT sec_app.name ORDER BY sec_app.name SEPARATOR ', ') AS applies_section_names" : ", NULL AS applies_section_names"}
      FROM class_routine_versions v
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      LEFT JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      JOIN class_routine_entries e ON e.routine_version_id = v.id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN marksheet_activities act ON act.id = e.activity_id
      LEFT JOIN routine_time_slots ts_exact
        ON ts_exact.id = e.time_slot_id
      LEFT JOIN routine_time_slots ts_day
        ON e.time_slot_id IS NULL
       AND ts_day.template_id = v.time_slot_template_id
       AND ts_day.period_number = e.period_number
       AND ts_day.weekday = e.weekday
      LEFT JOIN routine_time_slots ts_all
        ON e.time_slot_id IS NULL
       AND ts_all.template_id = v.time_slot_template_id
       AND ts_all.period_number = e.period_number
       AND ts_all.weekday IS NULL
      LEFT JOIN class_routine_entry_teachers et ON et.routine_entry_id = e.id
      LEFT JOIN teachers t ON t.id = et.teacher_id
      ${hasApplicability ? "LEFT JOIN class_routine_entry_sections es ON es.routine_entry_id = e.id LEFT JOIN sections sec_app ON sec_app.id = es.section_id" : ""}
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
        COALESCE(c.class_scope, 'school') AS class_scope,
        sec.name AS section_name,
        st.name AS stream_name
      FROM class_routine_versions v
      JOIN academic_sessions ses ON ses.id = v.session_id
      JOIN classes c ON c.id = v.class_id
      LEFT JOIN sections sec ON sec.id = v.section_id
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

export async function getCanonicalClassRoutineForScope(scope) {
  const rows = await query(
    `
      SELECT id
      FROM class_routine_versions
      WHERE session_id = ?
        AND class_id = ?
        AND COALESCE(section_id, 0) = COALESCE(?, 0)
        AND COALESCE(medium, '') = COALESCE(?, '')
        AND stream_id_dedupe = ${STREAM_DEDUPE_SQL}
        AND layout_mode = ?
        AND status IN ('published', 'draft')
      ORDER BY
        CASE status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        updated_at DESC,
        id DESC
      LIMIT 1
    `,
    [scope.session_id, scope.class_id, scope.section_id, scope.medium, scope.stream_id, scope.layout_mode || "standard"]
  );
  const routine = rows[0] || null;
  return routine ? getClassRoutineWithEntries(routine.id) : null;
}

export async function getClassRoutineEntries(versionId) {
  const hasApplicability = await hasClassRoutineApplicabilitySchema();
  const rows = await query(
    `
      SELECT
        e.*,
        COALESCE(e.start_time, MAX(COALESCE(ts_exact.start_time, ts_day.start_time, ts_all.start_time))) AS start_time,
        COALESCE(e.end_time, MAX(COALESCE(ts_exact.end_time, ts_day.end_time, ts_all.end_time))) AS end_time,
        ${hasApplicability ? "e.applies_medium" : "NULL"} AS applies_medium,
        sub.name AS subject_name,
        act.name AS activity_name,
        MAX(COALESCE(ts_exact.label, ts_day.label, ts_all.label)) AS slot_label,
        MAX(COALESCE(ts_exact.default_entry_type, ts_day.default_entry_type, ts_all.default_entry_type)) AS slot_default_entry_type,
        GROUP_CONCAT(DISTINCT t.id ORDER BY t.name SEPARATOR ',') AS teacher_ids,
        GROUP_CONCAT(DISTINCT t.user_id ORDER BY t.name SEPARATOR ',') AS teacher_user_ids,
        GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', ') AS teacher_names
        ${hasApplicability ? ", GROUP_CONCAT(DISTINCT es.section_id ORDER BY sec_app.name SEPARATOR ',') AS applies_section_ids" : ", NULL AS applies_section_ids"}
        ${hasApplicability ? ", GROUP_CONCAT(DISTINCT sec_app.name ORDER BY sec_app.name SEPARATOR ', ') AS applies_section_names" : ", NULL AS applies_section_names"}
      FROM class_routine_entries e
      JOIN class_routine_versions v ON v.id = e.routine_version_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LEFT JOIN marksheet_activities act ON act.id = e.activity_id
      LEFT JOIN routine_time_slots ts_exact
        ON ts_exact.id = e.time_slot_id
      LEFT JOIN routine_time_slots ts_day
        ON e.time_slot_id IS NULL
       AND ts_day.template_id = v.time_slot_template_id
       AND ts_day.period_number = e.period_number
       AND ts_day.weekday = e.weekday
      LEFT JOIN routine_time_slots ts_all
        ON e.time_slot_id IS NULL
       AND ts_all.template_id = v.time_slot_template_id
       AND ts_all.period_number = e.period_number
       AND ts_all.weekday IS NULL
      LEFT JOIN class_routine_entry_teachers et ON et.routine_entry_id = e.id
      LEFT JOIN teachers t ON t.id = et.teacher_id
      ${hasApplicability ? "LEFT JOIN class_routine_entry_sections es ON es.routine_entry_id = e.id LEFT JOIN sections sec_app ON sec_app.id = es.section_id" : ""}
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
    teacher_user_ids: row.teacher_user_ids
      ? String(row.teacher_user_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    teacher_names: row.teacher_names || "",
    applies_section_ids: row.applies_section_ids
      ? String(row.applies_section_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    applies_section_names: row.applies_section_names || "",
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
        (session_id, class_id, section_id, medium, stream_id, layout_mode, time_slot_template_id, version_number,
         status, title, source, parent_version_id, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      [
        data.session_id,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.layout_mode || "standard",
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

export async function upsertClassRoutineForScope(data, entries) {
  const existing = await getCanonicalClassRoutineForScope(data);
  if (!existing) {
    return createClassRoutineVersion(data, entries);
  }
  return updateClassRoutineRecord(existing.id, data, entries);
}

export async function updateClassRoutineRecord(id, data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE class_routine_versions
        SET title = ?,
            time_slot_template_id = ?,
            layout_mode = COALESCE(?, layout_mode),
            updated_by = ?
        WHERE id = ?
      `,
      [data.title, data.time_slot_template_id, data.layout_mode || null, data.user_id, id]
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

export const updateClassRoutineDraft = updateClassRoutineRecord;

async function nextClassRoutineVersionNumber(conn, data) {
  const [rows] = await conn.execute(
    `
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM class_routine_versions
      WHERE session_id = ?
        AND class_id = ?
        AND COALESCE(section_id, 0) = COALESCE(?, 0)
        AND COALESCE(medium, '') = COALESCE(?, '')
        AND stream_id_dedupe = ${STREAM_DEDUPE_SQL}
        AND layout_mode = ?
    `,
    [data.session_id, data.class_id, data.section_id, data.medium, data.stream_id, data.layout_mode || "standard"]
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
  const hasApplicability = await hasClassRoutineApplicabilitySchema();
  const [result] = await conn.execute(
    `
      INSERT INTO class_routine_entries
      (routine_version_id, time_slot_id, weekday, period_number, start_time, end_time,
       entry_type, subject_id, activity_id, title, room, notes, sort_order${hasApplicability ? ", applies_medium" : ""})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${hasApplicability ? ", ?" : ""})
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
      ...(hasApplicability ? [entry.applies_medium || null] : []),
    ]
  );
  if (hasApplicability) {
    for (const sectionId of entry.section_ids || []) {
      await conn.execute(
        `
          INSERT IGNORE INTO class_routine_entry_sections
          (routine_entry_id, section_id)
          VALUES (?, ?)
        `,
        [result.insertId, sectionId]
      );
    }
  }
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
      "SELECT id FROM class_routine_versions WHERE id = ? LIMIT 1",
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
  await query("UPDATE class_routine_versions SET updated_by = ? WHERE id = ?", [userId, source.id]);
  return getClassRoutineWithEntries(source.id);
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
          AND COALESCE(section_id, 0) = COALESCE(?, 0)
          AND COALESCE(medium, '') = COALESCE(?, '')
          AND stream_id_dedupe = COALESCE(?, 0)
          AND layout_mode = ?
          AND status = 'published'
      `,
      [userId, id, version.session_id, version.class_id, version.section_id, version.medium, version.stream_id, version.layout_mode || "standard"]
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

export function deleteClassRoutineVersion(id) {
  return query("DELETE FROM class_routine_versions WHERE id = ? AND status IN ('draft', 'published')", [id]);
}

export function findClassRoutineTeacherConflicts(versionId) {
  return query(
    `
      SELECT
        nt.teacher_id,
        t.name AS teacher_name,
        ne.weekday,
        ne.period_number,
        COALESCE(ne.start_time, MAX(COALESCE(nts_exact.start_time, nts_day.start_time, nts_all.start_time))) AS start_time,
        COALESCE(ne.end_time, MAX(COALESCE(nts_exact.end_time, nts_day.end_time, nts_all.end_time))) AS end_time,
        ce.period_number AS conflicting_period_number,
        COALESCE(ce.start_time, MAX(COALESCE(cts_exact.start_time, cts_day.start_time, cts_all.start_time))) AS conflicting_start_time,
        COALESCE(ce.end_time, MAX(COALESCE(cts_exact.end_time, cts_day.end_time, cts_all.end_time))) AS conflicting_end_time,
        ne.id AS entry_id,
        ce.id AS conflicting_entry_id,
        nv.class_id,
        nv.section_id,
        nc.name AS class_name,
        ns.name AS section_name,
        v.id AS conflicting_version_id,
        cv.class_id AS conflicting_class_id,
        cv.section_id AS conflicting_section_id,
        cc.name AS conflicting_class_name,
        cs.name AS conflicting_section_name
      FROM class_routine_versions nv
      JOIN class_routine_entries ne ON ne.routine_version_id = nv.id
      JOIN class_routine_entry_teachers nt ON nt.routine_entry_id = ne.id
      JOIN classes nc ON nc.id = nv.class_id
      LEFT JOIN sections ns ON ns.id = nv.section_id
      LEFT JOIN routine_time_slots nts_exact
        ON nts_exact.id = ne.time_slot_id
      LEFT JOIN routine_time_slots nts_day
        ON ne.time_slot_id IS NULL
       AND nts_day.template_id = nv.time_slot_template_id
       AND nts_day.period_number = ne.period_number
       AND nts_day.weekday = ne.weekday
      LEFT JOIN routine_time_slots nts_all
        ON ne.time_slot_id IS NULL
       AND nts_all.template_id = nv.time_slot_template_id
       AND nts_all.period_number = ne.period_number
       AND nts_all.weekday IS NULL
      JOIN class_routine_versions cv
        ON cv.session_id = nv.session_id
       AND cv.status = 'published'
       AND cv.id <> nv.id
       AND NOT (
         cv.class_id = nv.class_id
         AND COALESCE(cv.section_id, 0) = COALESCE(nv.section_id, 0)
         AND COALESCE(cv.medium, '') = COALESCE(nv.medium, '')
         AND cv.stream_id_dedupe = nv.stream_id_dedupe
       )
      JOIN class_routine_entries ce
        ON ce.routine_version_id = cv.id
       AND ce.weekday = ne.weekday
      LEFT JOIN routine_time_slots cts_exact
        ON cts_exact.id = ce.time_slot_id
      LEFT JOIN routine_time_slots cts_day
        ON ce.time_slot_id IS NULL
       AND cts_day.template_id = cv.time_slot_template_id
       AND cts_day.period_number = ce.period_number
       AND cts_day.weekday = ce.weekday
      LEFT JOIN routine_time_slots cts_all
        ON ce.time_slot_id IS NULL
       AND cts_all.template_id = cv.time_slot_template_id
       AND cts_all.period_number = ce.period_number
       AND cts_all.weekday IS NULL
      JOIN class_routine_entry_teachers ct
        ON ct.routine_entry_id = ce.id
       AND ct.teacher_id = nt.teacher_id
      JOIN teachers t ON t.id = nt.teacher_id
      JOIN classes cc ON cc.id = cv.class_id
      LEFT JOIN sections cs ON cs.id = cv.section_id
      JOIN class_routine_versions v ON v.id = cv.id
      WHERE nv.id = ?
      GROUP BY ne.id, ce.id, nt.teacher_id
      HAVING start_time < conflicting_end_time
         AND end_time > conflicting_start_time
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
       AND (v.section_id IS NULL OR ta.section_id = v.section_id)
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
        AND (section_id = ? OR (layout_mode = 'packed_hs' AND section_id IS NULL))
        AND (medium = ? OR (layout_mode = 'packed_hs' AND medium IS NULL))
        AND (stream_id_dedupe = COALESCE(?, 0) OR (layout_mode = 'packed_hs' AND stream_id IS NULL))
        AND status = 'published'
      ORDER BY
        CASE WHEN section_id = ? THEN 0 ELSE 1 END,
        CASE WHEN medium = ? THEN 0 ELSE 1 END,
        CASE WHEN stream_id_dedupe = COALESCE(?, 0) THEN 0 ELSE 1 END,
        published_at DESC,
        id DESC
      LIMIT 1
    `,
    [filters.session_id, filters.class_id, filters.section_id, filters.medium, filters.stream_id, filters.section_id, filters.medium, filters.stream_id]
  ).then((rows) => rows[0] || null);
}

export async function getRegisteredSubjectIdsForStudent(studentId) {
  const rows = await query(
    `
      SELECT DISTINCT so.subject_id
      FROM student_subject_registrations ssr
      JOIN subject_offerings so ON so.id = ssr.subject_offering_id
      WHERE ssr.student_id = ?
        AND ssr.status IN ('selected', 'approved', 'active')
    `,
    [studentId]
  ).catch(() => []);
  return rows.map((row) => Number(row.subject_id)).filter(Boolean);
}

export function getTeacherByUserId(userId) {
  return query("SELECT id, name FROM teachers WHERE user_id = ? LIMIT 1", [userId]).then((rows) => rows[0] || null);
}

export function getTeacherRoutineAssignmentsByUserId(userId) {
  return query(
    `
      SELECT DISTINCT
        ta.teacher_id,
        ta.session_id,
          ta.class_id,
          ta.section_id,
          ta.subject_id,
          c.class_scope,
          c.name AS class_name,
          sec.name AS section_name,
          sec.medium
      FROM teachers t
      JOIN teacher_class_assignments ta ON ta.teacher_id = t.id
      JOIN classes c ON c.id = ta.class_id
      JOIN sections sec ON sec.id = ta.section_id
      WHERE t.user_id = ?
      ORDER BY ta.session_id DESC, c.name, sec.name
    `,
    [userId]
  );
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
  appendFilter(where, params, "v.class_scope", filters.class_scope);
  appendFilter(where, params, "v.class_id", filters.class_id);
  appendFilter(where, params, "v.section_id", filters.section_id);
  appendFilter(where, params, "v.medium", filters.medium);
  appendFilter(where, params, "v.stream_id", filters.stream_id);
  if (filters.status === "current") {
    where.push("v.status IN ('draft', 'published')");
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM exam_routine_versions other
        WHERE other.exam_id = v.exam_id
          AND other.session_id = v.session_id
          AND COALESCE(other.class_scope, '') = COALESCE(v.class_scope, '')
          AND COALESCE(other.class_id, 0) = COALESCE(v.class_id, 0)
          AND COALESCE(other.section_id, 0) = COALESCE(v.section_id, 0)
          AND COALESCE(other.medium, '') = COALESCE(v.medium, '')
          AND COALESCE(other.stream_id, 0) = COALESCE(v.stream_id, 0)
          AND other.status IN ('draft', 'published')
          AND (
            CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              < CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
            OR (
              CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              AND COALESCE(other.updated_at, other.created_at, '1000-01-01') > COALESCE(v.updated_at, v.created_at, '1000-01-01')
            )
            OR (
              CASE other.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
                = CASE v.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END
              AND COALESCE(other.updated_at, other.created_at, '1000-01-01') = COALESCE(v.updated_at, v.created_at, '1000-01-01')
              AND other.id > v.id
            )
          )
      )
    `);
  } else if (hasValue(filters.status) && filters.status !== "all") {
    appendFilter(where, params, "v.status", filters.status);
  }
  return query(
    `
      SELECT
        v.*,
        MAX(e.name) AS exam_name,
        MAX(ses.name) AS session_name,
        MAX(COALESCE(v.class_scope, cls.class_scope, 'school')) AS class_scope,
        MAX(cls.name) AS class_name,
        MAX(sec.name) AS section_name,
        MAX(st.name) AS stream_name,
        COUNT(re.id) AS entry_count
      FROM exam_routine_versions v
      JOIN exams e ON e.id = v.exam_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      LEFT JOIN classes cls ON cls.id = v.class_id
      LEFT JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
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
      SELECT
        v.*,
        e.name AS exam_name,
        ses.name AS session_name,
        v.class_scope AS class_scope,
        c.name AS class_name,
        sec.name AS section_name,
        st.name AS stream_name
      FROM exam_routine_versions v
      JOIN exams e ON e.id = v.exam_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      LEFT JOIN classes c ON c.id = v.class_id
      LEFT JOIN sections sec ON sec.id = v.section_id
      LEFT JOIN streams st ON st.id = v.stream_id
      WHERE v.id = ?
      LIMIT 1
    `,
    [id]
  ).then((rows) => rows[0] || null);
}

export async function getCanonicalExamRoutineForScope(scope) {
  const rows = await query(
    `
      SELECT id
      FROM exam_routine_versions
      WHERE exam_id = ?
        AND session_id = ?
        AND COALESCE(class_scope, '') = COALESCE(?, '')
        AND COALESCE(class_id, 0) = COALESCE(?, 0)
        AND COALESCE(section_id, 0) = COALESCE(?, 0)
        AND COALESCE(medium, '') = COALESCE(?, '')
        AND COALESCE(stream_id, 0) = COALESCE(?, 0)
        AND status IN ('published', 'draft')
      ORDER BY
        CASE status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        updated_at DESC,
        id DESC
      LIMIT 1
    `,
    [scope.exam_id, scope.session_id, scope.class_scope, scope.class_id, scope.section_id, scope.medium, scope.stream_id]
  );
  const routine = rows[0] || null;
  return routine ? getExamRoutineWithEntries(routine.id) : null;
}

export async function getExamRoutineWithEntries(id) {
  const version = await getExamRoutineVersionById(id);
  if (!version) return null;
  const entries = await query(
    `
      SELECT
        e.*,
        MAX(c.name) AS class_name,
        MAX(COALESCE(c.class_scope, 'school')) AS class_scope,
        MAX(sec.name) AS section_name,
        MAX(st.name) AS stream_name,
        MAX(sub.name) AS subject_name,
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

export function getExamRoutineSubjectEligibility(examId, scope) {
  return query(
    `
      SELECT
        es.id AS exam_subject_id,
        es.subject_id,
        es.subject_offering_id,
        so.id AS offered_subject_offering_id,
        so.subject_id AS offered_subject_id,
        cs.subject_id AS class_subject_id
      FROM exam_subjects es
      LEFT JOIN subject_offerings so
        ON so.is_active = TRUE
       AND so.subject_id = es.subject_id
       AND so.class_id = ?
       AND (? IS NULL OR so.section_id IS NULL OR so.section_id = ?)
       AND (? IS NULL OR so.stream_id IS NULL OR so.stream_id = ?)
      LEFT JOIN class_subjects cs
        ON cs.class_id = ?
       AND cs.subject_id = es.subject_id
      WHERE es.exam_id = ?
    `,
    [scope.class_id, scope.section_id, scope.section_id, scope.stream_id, scope.stream_id, scope.class_id, examId]
  );
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
        (exam_id, session_id, class_scope, class_id, section_id, medium, stream_id,
         title, version_number, status, source, parent_version_id,
         publish_announcement_requested, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      [
        data.exam_id,
        data.session_id,
        data.class_scope,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
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

export async function upsertExamRoutineForScope(data, entries) {
  const existing = await getCanonicalExamRoutineForScope(data);
  if (!existing) {
    return createExamRoutineVersion(data, entries);
  }
  return updateExamRoutineRecord(existing.id, data, entries);
}

export async function updateExamRoutineRecord(id, data, entries) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `
        UPDATE exam_routine_versions
        SET class_scope = ?,
            class_id = ?,
            section_id = ?,
            medium = ?,
            stream_id = ?,
            title = ?,
            publish_announcement_requested = ?,
            updated_by = ?
        WHERE id = ?
      `,
      [
        data.class_scope,
        data.class_id,
        data.section_id,
        data.medium,
        data.stream_id,
        data.title,
        data.publish_announcement_requested,
        data.user_id,
        id,
      ]
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

export const updateExamRoutineDraft = updateExamRoutineRecord;

export async function createDraftFromExamRoutine(sourceId, userId) {
  const source = await getExamRoutineWithEntries(sourceId);
  if (!source) return null;
  await query("UPDATE exam_routine_versions SET updated_by = ? WHERE id = ?", [userId, source.id]);
  return getExamRoutineWithEntries(source.id);
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
        WHERE id <> ?
          AND exam_id = ?
          AND COALESCE(class_scope, '') = COALESCE(?, '')
          AND COALESCE(class_id, 0) = COALESCE(?, 0)
          AND COALESCE(section_id, 0) = COALESCE(?, 0)
          AND COALESCE(medium, '') = COALESCE(?, '')
          AND COALESCE(stream_id, 0) = COALESCE(?, 0)
          AND status = 'published'
      `,
      [userId, id, version.exam_id, version.class_scope, version.class_id, version.section_id, version.medium, version.stream_id]
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

