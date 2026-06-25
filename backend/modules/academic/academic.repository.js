import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

let sectionReferenceColumnsCache;

function escapeIdentifier(value) {
  return `\`${String(value || "").replace(/`/g, "``")}\``;
}

async function getSectionReferenceColumns(conn) {
  if (Array.isArray(sectionReferenceColumnsCache)) {
    return sectionReferenceColumnsCache;
  }

  const [rows] = await conn.query(
    `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = 'sections'
        AND REFERENCED_COLUMN_NAME = 'id'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `
  );

  sectionReferenceColumnsCache = (rows || [])
    .map((row) => ({
      tableName: String(row?.table_name || "").trim(),
      columnName: String(row?.column_name || "").trim(),
    }))
    .filter((row) => row.tableName && row.columnName && row.tableName !== "sections");

  return sectionReferenceColumnsCache;
}

async function findSectionUsage(conn, sectionId) {
  const references = await getSectionReferenceColumns(conn);

  for (const ref of references) {
    const sql = `
      SELECT 1 AS linked
      FROM ${escapeIdentifier(ref.tableName)}
      WHERE ${escapeIdentifier(ref.columnName)} = ?
      LIMIT 1
    `;
    const [rows] = await conn.query(sql, [sectionId]);
    if (Array.isArray(rows) && rows.length) {
      return ref;
    }
  }

  return null;
}

function sectionIdentityKey(name, medium) {
  return `${String(name || "").trim().toLowerCase()}::${String(medium || "").trim().toLowerCase()}`;
}

export async function createSession(data) {
  const sql = `
    INSERT INTO academic_sessions
    (name, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?)
  `;

  return query(sql, [
    data.name,
    data.startDate,
    data.endDate,
    data.isActive || false,
  ]);
}

export async function getSessions() {
  return query(`
    SELECT * FROM academic_sessions
    ORDER BY start_date DESC
  `);
}
export async function deactivateAllSessions() {
  return query(`UPDATE academic_sessions SET is_active=false`);
}

export async function updateSession(id, data) {
  return query(
    `UPDATE academic_sessions
     SET name = ?, start_date = ?, end_date = ?, is_active = ?
     WHERE id = ?`,
    [data.name, data.startDate, data.endDate, data.isActive || false, id]
  );
}

export async function deleteSession(id) {
  return query(`DELETE FROM academic_sessions WHERE id = ?`, [id]);
}

export async function getStreams() {
  return query(`
    SELECT id, name
    FROM streams
    ORDER BY name ASC, id ASC
  `);
}

export async function createStream(name) {
  return query(
    `INSERT INTO streams (name)
     VALUES (?)`,
    [name]
  );
}

export async function updateStream(id, name) {
  return query(
    `UPDATE streams
     SET name = ?
     WHERE id = ?`,
    [name, id]
  );
}

export async function deleteStream(id) {
  return query(`DELETE FROM streams WHERE id = ?`, [id]);
}
// CLASSES 7 SECTIONS
export async function getClasses(filters = {}) {
  const rawPage = Number(filters.page);
  const rawLimit = Number(filters.limit);
  const hasPagination = Number.isFinite(rawPage) || Number.isFinite(rawLimit);
  const page = Math.max(1, Number.isFinite(rawPage) ? Math.trunc(rawPage) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 30));
  const offset = (page - 1) * limit;

  const rows = await query(`
  SELECT
  c.id,
  c.name,
  c.scope_id,
  COALESCE(sc.code, c.class_scope, 'school') AS class_scope,
  sc.name AS scope_name,
  c.medium,
  IFNULL(GROUP_CONCAT(DISTINCT sec.name ORDER BY sec.name), '') AS sections,
  IFNULL(GROUP_CONCAT(DISTINCT CONCAT(sec.name, ':', sec.medium) ORDER BY sec.name), '') AS section_mediums,
  IFNULL(GROUP_CONCAT(DISTINCT sub.name ORDER BY sub.name), '') AS subjects
FROM classes c
LEFT JOIN scopes sc ON sc.id = c.scope_id
LEFT JOIN sections sec ON sec.class_id = c.id
LEFT JOIN class_subjects cs ON cs.class_id = c.id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.scope_id, COALESCE(sc.code, c.class_scope, 'school'), sc.name, c.medium
ORDER BY c.id
${hasPagination ? `LIMIT ${limit} OFFSET ${offset}` : ""}
  `);

  if (!hasPagination) {
    return rows;
  }

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM classes c
      WHERE c.is_active = TRUE
    `
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
export async function getClassStructure() {
  return query(`
    SELECT
      c.id AS class_id,
      c.name AS class_name,
      c.scope_id AS scope_id,
      COALESCE(sc.code, c.class_scope, 'school') AS class_scope,
      sc.name AS scope_name,
      c.medium AS class_medium,
      s.id AS section_id,
      s.name AS section_name,
      s.medium AS section_medium,
      sub.id AS subject_id,
      sub.name AS subject_name
    FROM classes c
    LEFT JOIN scopes sc ON sc.id = c.scope_id
    LEFT JOIN sections s ON s.class_id = c.id
    LEFT JOIN class_subjects cs ON cs.class_id = c.id
    LEFT JOIN subjects sub ON sub.id = cs.subject_id
    WHERE c.is_active = TRUE
    ORDER BY c.id
  `);
}
export async function listScopes() {
  return query(`
    SELECT id, code, name, is_active
    FROM scopes
    WHERE is_active = TRUE
    ORDER BY id ASC
  `);
}

export async function getScopeByCode(code) {
  const rows = await query(
    `
      SELECT id, code, name
      FROM scopes
      WHERE code = ?
      LIMIT 1
    `,
    [code]
  );
  return rows[0] || null;
}

export async function getScopeById(id) {
  const rows = await query(
    `
      SELECT id, code, name
      FROM scopes
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function createClass(name, scope, sections = [], mediums = []) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const sectionMediums = Array.isArray(sections)
      ? sections.map((s) => String(s?.medium || "").trim()).filter(Boolean)
      : [];
    const explicitMediums = Array.isArray(mediums)
      ? mediums.map((m) => String(m || "").trim()).filter(Boolean)
      : [];
    const mediumValue = [...new Set([...sectionMediums, ...explicitMediums])].join(",");

    const [result] = await conn.query(
      `INSERT INTO classes (name, class_scope, scope_id, medium, is_active) VALUES (?, ?, ?, ?, TRUE)`,
      [name, scope.code, scope.id, mediumValue]
    );

    const classId = result.insertId;

    for (const sec of sections) {
      await conn.query(
        `INSERT INTO sections (class_id, name, medium) VALUES (?, ?, ?)`,
        [classId, sec.name, sec.medium]
      );
    }

    await conn.commit();
    return { id: classId };

  } catch (err) {
    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}
export async function updateClass(id, name, scope, sections = [], mediums = []) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const sectionMediums = Array.isArray(sections)
      ? sections.map((s) => String(s?.medium || "").trim()).filter(Boolean)
      : [];
    const explicitMediums = Array.isArray(mediums)
      ? mediums.map((m) => String(m || "").trim()).filter(Boolean)
      : [];
    const mediumValue = [...new Set([...sectionMediums, ...explicitMediums])].join(",");

    await conn.query(
      `UPDATE classes SET name=?, class_scope=?, scope_id=?, medium=? WHERE id=?`,
      [name, scope.code, scope.id, mediumValue, id]
    );

    const [existingSections] = await conn.query(
      `SELECT id, name, medium FROM sections WHERE class_id=?`,
      [id]
    );
    const existingByIdentity = new Map(
      existingSections.map((s) => [
        sectionIdentityKey(s.name, s.medium),
        { id: s.id, medium: s.medium },
      ])
    );

    const normalizedIncoming = (sections || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        medium: String(s?.medium || "").trim(),
      }))
      .filter((s) => s.name && s.medium);
    const incomingIdentitySet = new Set(normalizedIncoming.map((s) => sectionIdentityKey(s.name, s.medium)));

    for (const existing of existingSections) {
      const key = sectionIdentityKey(existing?.name, existing?.medium);
      if (!key || incomingIdentitySet.has(key)) {
        continue;
      }

      const usage = await findSectionUsage(conn, existing.id);
      if (usage) {
        throw new Error(
          `Cannot remove section "${existing.name}" because it is linked to ${usage.tableName}.${usage.columnName}. Reassign linked records first.`
        );
      }

      await conn.query(`DELETE FROM sections WHERE id=?`, [existing.id]);
      existingByIdentity.delete(key);
    }

    for (const sec of normalizedIncoming) {
      const key = sectionIdentityKey(sec.name, sec.medium);
      const existing = existingByIdentity.get(key);
      if (!existing) {
        const [insertResult] = await conn.query(
          `INSERT INTO sections (class_id, name, medium) VALUES (?, ?, ?)`,
          [id, sec.name, sec.medium]
        );
        existingByIdentity.set(key, { id: insertResult.insertId, medium: sec.medium });
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
export async function deleteClass(id) {
  return query(`UPDATE classes SET is_active = FALSE WHERE id=?`, [id]);
}

export async function createSubject(data) {
  const sql = `
    INSERT INTO subjects (name, code)
    VALUES (?, ?)
  `;

  return query(sql, [data.name, data.code]);
}

export async function getSubjects() {
  return query(`SELECT * FROM subjects`);
}

export async function countSections(classId) {
  const rows = await query(
    `SELECT COUNT(*) as total
     FROM sections
     WHERE class_id=?`,
    [classId],
  );

  return rows[0].total;
}
