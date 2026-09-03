import { pool } from "../../database/pool.js";
import { execute, query } from "../../core/db/query.js";

function schoolTimezoneOffsetMinutes() {
  const raw = String(process.env.SCHOOL_TIMEZONE_OFFSET || process.env.APP_TIMEZONE_OFFSET || "+05:30").trim();
  const match = raw.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 330;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

function schoolNowSql() {
  const minutes = schoolTimezoneOffsetMinutes();
  if (minutes === 0) return "UTC_TIMESTAMP()";
  return `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${minutes} MINUTE)`;
}

function appendFilter(where, params, column, value) {
  if (value === undefined || value === null || value === "") return;
  where.push(`${column} = ?`);
  params.push(value);
}

export function listCategories() {
  return query(
    `SELECT *
     FROM announcement_categories
     WHERE is_active = 1
     ORDER BY is_system DESC, name`
  );
}

export async function createCategory(data) {
  const result = await execute(
    `INSERT INTO announcement_categories (name, slug, description, is_system, is_active, created_by)
     VALUES (?, ?, ?, 0, 1, ?)`,
    [data.name, data.slug, data.description || null, data.user_id || null]
  );
  return getCategoryById(result.insertId);
}

export function getCategoryById(id) {
  return query("SELECT * FROM announcement_categories WHERE id = ? LIMIT 1", [id]).then((rows) => rows[0] || null);
}

export function getCategoryBySlug(slug) {
  return query("SELECT * FROM announcement_categories WHERE slug = ? LIMIT 1", [slug]).then((rows) => rows[0] || null);
}

export function listHolidayNames(filters = {}) {
  const where = ["is_active = 1"];
  const params = [];
  appendFilter(where, params, "category", filters.category);
  if (filters.q) {
    where.push("name LIKE ?");
    params.push(`%${String(filters.q).trim()}%`);
  }
  const limit = Math.max(1, Math.min(250, Number(filters.limit) || 100));
  return query(
    `SELECT id, name, category, is_active, created_at, updated_at
     FROM announcement_holiday_names
     WHERE ${where.join(" AND ")}
     ORDER BY category, name
     LIMIT ${limit}`,
    params
  );
}

export async function upsertHolidayName(data) {
  await execute(
    `INSERT INTO announcement_holiday_names (name, category, is_active, created_by)
     VALUES (?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [data.name, data.category || "holiday", data.user_id || null]
  );
  return query("SELECT * FROM announcement_holiday_names WHERE name = ? LIMIT 1", [data.name]).then((rows) => rows[0] || null);
}

export function listSmsTemplates(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "status", filters.status);
  appendFilter(where, params, "provider", filters.provider);
  return query(
    `SELECT *
     FROM announcement_sms_templates
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY template_name`,
    params
  );
}

export async function createSmsTemplate(data) {
  const result = await execute(
    `INSERT INTO announcement_sms_templates
     (template_name, dlt_template_id, provider_template_id, header, communication_type, template_content, brand_dlt_id,
      placeholder_style, placeholder_count, placeholder_schema_json, status, provider, creator, registered_on, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.template_name,
      data.dlt_template_id,
      data.provider_template_id || null,
      data.header,
      data.communication_type || null,
      data.template_content,
      data.brand_dlt_id || null,
      data.placeholder_style || "alp",
      data.placeholder_count || 0,
      JSON.stringify(data.placeholder_schema || []),
      data.status || "registered",
      data.provider || "fast2sms",
      data.creator || null,
      data.registered_on || null,
      data.user_id || null,
    ]
  );
  return getSmsTemplateById(result.insertId);
}

export function getSmsTemplateById(id) {
  return query("SELECT * FROM announcement_sms_templates WHERE id = ? LIMIT 1", [id]).then((rows) => rows[0] || null);
}

export async function getSmsTemplateUsage(id) {
  const [announcementRows, jobRows] = await Promise.all([
    query("SELECT COUNT(*) AS count FROM announcements WHERE sms_template_id = ?", [id]),
    query("SELECT COUNT(*) AS count FROM announcement_sms_jobs WHERE sms_template_id = ?", [id]),
  ]);
  return {
    announcements: Number(announcementRows[0]?.count || 0),
    sms_jobs: Number(jobRows[0]?.count || 0),
  };
}

export async function deleteSmsTemplate(id) {
  await execute("DELETE FROM announcement_sms_templates WHERE id = ?", [id]);
}

export async function updateSmsTemplate(id, data) {
  await execute(
    `UPDATE announcement_sms_templates
     SET template_name = ?, dlt_template_id = ?, provider_template_id = ?, header = ?, communication_type = ?,
         template_content = ?, brand_dlt_id = ?, placeholder_style = ?, placeholder_count = ?,
         placeholder_schema_json = ?, status = ?, provider = ?, creator = ?, registered_on = ?
     WHERE id = ?`,
    [
      data.template_name,
      data.dlt_template_id,
      data.provider_template_id || null,
      data.header,
      data.communication_type || null,
      data.template_content,
      data.brand_dlt_id || null,
      data.placeholder_style || "alp",
      data.placeholder_count || 0,
      JSON.stringify(data.placeholder_schema || []),
      data.status || "registered",
      data.provider || "fast2sms",
      data.creator || null,
      data.registered_on || null,
      id,
    ]
  );
  return getSmsTemplateById(id);
}

export async function upsertSmsTemplate(data) {
  await execute(
    `INSERT INTO announcement_sms_templates
     (template_name, dlt_template_id, provider_template_id, header, communication_type, template_content, brand_dlt_id,
      placeholder_style, placeholder_count, placeholder_schema_json, status, provider, creator, registered_on, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       template_name = VALUES(template_name),
       provider_template_id = VALUES(provider_template_id),
       header = VALUES(header),
       communication_type = VALUES(communication_type),
       template_content = VALUES(template_content),
       brand_dlt_id = VALUES(brand_dlt_id),
       placeholder_style = VALUES(placeholder_style),
       placeholder_count = VALUES(placeholder_count),
       placeholder_schema_json = VALUES(placeholder_schema_json),
       status = VALUES(status),
       provider = VALUES(provider),
       creator = VALUES(creator),
       registered_on = VALUES(registered_on),
       updated_at = CURRENT_TIMESTAMP`,
    [
      data.template_name,
      data.dlt_template_id,
      data.provider_template_id || null,
      data.header,
      data.communication_type || null,
      data.template_content,
      data.brand_dlt_id || null,
      data.placeholder_style || "alp",
      data.placeholder_count || 0,
      JSON.stringify(data.placeholder_schema || []),
      data.status || "registered",
      data.provider || "fast2sms",
      data.creator || null,
      data.registered_on || null,
      data.user_id || null,
    ]
  );
  return getSmsTemplateById(
    await query("SELECT id FROM announcement_sms_templates WHERE dlt_template_id = ? LIMIT 1", [data.dlt_template_id])
      .then((rows) => rows[0]?.id)
  );
}

export function listAnnouncements(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "a.status", filters.status);
  appendFilter(where, params, "a.delivery_mode", filters.delivery_mode);
  appendFilter(where, params, "a.category_id", filters.category_id);
  if (filters.published_only) {
    where.push("a.status IN ('published', 'sent')");
    where.push(`(a.expires_at IS NULL OR a.expires_at >= ${schoolNowSql()})`);
  }
  if (!filters.include_archived) {
    where.push("(a.is_current = 1 OR a.status IN ('draft', 'scheduled'))");
  }
  if (filters.visible_mobile) where.push("a.show_in_mobile = 1");
  if (filters.visible_software) where.push("a.show_in_software = 1");
  if (filters.visible_website) where.push("a.show_on_website = 1");

  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 50));
  return query(
    `SELECT a.*, c.name AS category_name, c.slug AS category_slug, st.template_name AS sms_template_name,
            COALESCE(target_stats.target_count, 0) AS target_count,
            target_stats.target_types,
            target_stats.scope_codes,
            target_stats.staff_types
     FROM announcements a
     LEFT JOIN announcement_categories c ON c.id = a.category_id
     LEFT JOIN announcement_sms_templates st ON st.id = a.sms_template_id
     LEFT JOIN (
       SELECT announcement_id,
              COUNT(*) AS target_count,
              GROUP_CONCAT(DISTINCT target_type ORDER BY target_type SEPARATOR ',') AS target_types,
              GROUP_CONCAT(DISTINCT NULLIF(scope_code, '') ORDER BY scope_code SEPARATOR ',') AS scope_codes,
              GROUP_CONCAT(DISTINCT NULLIF(staff_type, '') ORDER BY staff_type SEPARATOR ',') AS staff_types
       FROM announcement_targets
       GROUP BY announcement_id
     ) target_stats ON target_stats.announcement_id = a.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY COALESCE(a.published_at, a.publish_at, a.created_at) DESC, a.id DESC
     LIMIT ${limit}`,
    params
  );
}

function mobileAudienceSql() {
  return `EXISTS (
    SELECT 1
    FROM announcement_targets at
    WHERE at.announcement_id = a.id
      AND (
        at.target_type = 'all'
        OR (at.target_type = 'user' AND at.user_id = ?)
        OR (at.target_type = 'role' AND EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ? AND r.name = at.role_name
        ))
        OR (at.target_type = 'teachers' AND EXISTS (
          SELECT 1
          FROM teachers t
          WHERE t.user_id = ?
            AND (at.scope_code IS NULL OR at.scope_code = t.class_scope)
            AND (at.staff_type IS NULL OR at.staff_type = 'all' OR at.staff_type = t.staff_type)
        ))
        OR (at.target_type IN ('staff', 'accounts') AND EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ? AND r.name = at.target_type
        ))
        OR (at.target_type IN ('parents', 'class', 'section', 'scope') AND EXISTS (
          SELECT 1
          FROM parents p
          JOIN student_parents sp ON sp.parent_id = p.id
          JOIN student_enrollments se ON se.student_id = sp.student_id AND se.status = 'active'
          JOIN classes c ON c.id = se.class_id
          LEFT JOIN sections sec ON sec.id = se.section_id
          WHERE p.user_id = ?
            AND (at.session_id IS NULL OR at.session_id = se.session_id)
            AND (at.class_id IS NULL OR at.class_id = se.class_id)
            AND (at.section_id IS NULL OR at.section_id = se.section_id)
            AND (at.stream_id IS NULL OR at.stream_id = se.stream_id)
            AND (at.medium IS NULL OR at.medium = sec.medium)
            AND (at.scope_code IS NULL OR at.scope_code = c.class_scope)
        ))
      )
  )`;
}

function mobileAudienceParams(userId) {
  return [userId, userId, userId, userId, userId];
}

export function listMobileAnnouncementsForUser(userId, filters = {}) {
  const where = [
    "a.status IN ('published', 'sent')",
    "a.is_current = 1",
    "a.show_in_mobile = 1",
    `(a.expires_at IS NULL OR a.expires_at >= ${schoolNowSql()})`,
    mobileAudienceSql(),
  ];
  const params = mobileAudienceParams(userId);
  appendFilter(where, params, "a.category_id", filters.category_id);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 50));
  return query(
    `SELECT a.id, a.category_id, a.message_type, a.title, a.body, a.delivery_mode, a.status, a.priority,
            a.published_at, a.publish_at, a.expires_at, a.event_start_date, a.event_end_date,
            a.reopen_date, c.name AS category_name, c.slug AS category_slug
     FROM announcements a
     LEFT JOIN announcement_categories c ON c.id = a.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY COALESCE(a.published_at, a.publish_at, a.created_at) DESC, a.id DESC
     LIMIT ${limit}`,
    params
  );
}

export async function getMobileAnnouncementForUser(id, userId) {
  const rows = await query(
    `SELECT a.id, a.category_id, a.message_type, a.title, a.body, a.delivery_mode, a.status, a.priority,
            a.published_at, a.publish_at, a.expires_at, a.event_start_date, a.event_end_date,
            a.reopen_date, c.name AS category_name, c.slug AS category_slug
     FROM announcements a
     LEFT JOIN announcement_categories c ON c.id = a.category_id
     WHERE a.id = ?
       AND a.status IN ('published', 'sent')
       AND a.is_current = 1
       AND a.show_in_mobile = 1
       AND (a.expires_at IS NULL OR a.expires_at >= ${schoolNowSql()})
       AND ${mobileAudienceSql()}
     LIMIT 1`,
    [id, ...mobileAudienceParams(userId)]
  );
  const announcement = rows[0] || null;
  if (!announcement) return null;
  const attachments = await query(
    `SELECT id, file_name, file_url, mime_type, file_size
     FROM announcement_attachments
     WHERE announcement_id = ?
     ORDER BY id`,
    [id]
  );
  return { ...announcement, attachments };
}

export async function getAnnouncementById(id) {
  const rows = await query(
    `SELECT a.*, c.name AS category_name, c.slug AS category_slug, st.template_name AS sms_template_name,
            st.dlt_template_id, st.header AS sms_header, st.template_content AS sms_template_content,
            st.placeholder_schema_json
     FROM announcements a
     LEFT JOIN announcement_categories c ON c.id = a.category_id
     LEFT JOIN announcement_sms_templates st ON st.id = a.sms_template_id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );
  const announcement = rows[0] || null;
  if (!announcement) return null;
  const [targets, attachments, smsJobs] = await Promise.all([
    query("SELECT * FROM announcement_targets WHERE announcement_id = ? ORDER BY id", [id]),
    query("SELECT * FROM announcement_attachments WHERE announcement_id = ? ORDER BY id", [id]),
    query("SELECT * FROM announcement_sms_jobs WHERE announcement_id = ? ORDER BY id DESC", [id]),
  ]);
  return { ...announcement, targets, attachments, sms_jobs: smsJobs };
}

export async function createAnnouncement(data, targets = [], attachments = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO announcements
       (root_announcement_id, version_number, is_current, category_id, message_type, title, body, delivery_mode, status, priority, publish_at, expires_at,
        event_start_date, event_end_date, reopen_date, show_in_software, show_in_mobile,
        show_on_website, create_notification, send_push, sms_template_id, sms_variables_json,
        sms_send_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.root_announcement_id || null,
        data.version_number || 1,
        data.is_current === 0 ? 0 : 1,
        data.category_id || null,
        data.message_type || "custom",
        data.title,
        data.body,
        data.delivery_mode,
        data.status,
        data.priority,
        data.publish_at || null,
        data.expires_at || null,
        data.event_start_date || null,
        data.event_end_date || null,
        data.reopen_date || null,
        data.show_in_software,
        data.show_in_mobile,
        data.show_on_website,
        data.create_notification,
        data.send_push,
        data.sms_template_id || null,
        JSON.stringify(data.sms_variables || {}),
        data.sms_send_at || null,
        data.user_id || null,
        data.user_id || null,
      ]
    );
    if (!data.root_announcement_id) {
      await conn.execute("UPDATE announcements SET root_announcement_id = ? WHERE id = ?", [result.insertId, result.insertId]);
    }
    await replaceTargets(conn, result.insertId, targets);
    await replaceAttachments(conn, result.insertId, attachments, data.user_id);
    await conn.commit();
    return getAnnouncementById(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateAnnouncement(id, data, targets = [], attachments = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `UPDATE announcements
       SET category_id = ?, message_type = ?, title = ?, body = ?, delivery_mode = ?, status = ?, priority = ?,
           publish_at = ?, expires_at = ?, event_start_date = ?, event_end_date = ?, reopen_date = ?,
           show_in_software = ?, show_in_mobile = ?, show_on_website = ?, create_notification = ?,
           send_push = ?, sms_template_id = ?, sms_variables_json = ?, sms_send_at = ?,
           updated_by = ?
       WHERE id = ? AND status IN ('draft', 'scheduled')`,
      [
        data.category_id || null,
        data.message_type || "custom",
        data.title,
        data.body,
        data.delivery_mode,
        data.status,
        data.priority,
        data.publish_at || null,
        data.expires_at || null,
        data.event_start_date || null,
        data.event_end_date || null,
        data.reopen_date || null,
        data.show_in_software,
        data.show_in_mobile,
        data.show_on_website,
        data.create_notification,
        data.send_push,
        data.sms_template_id || null,
        JSON.stringify(data.sms_variables || {}),
        data.sms_send_at || null,
        data.user_id || null,
        id,
      ]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return null;
    }
    await replaceTargets(conn, id, targets);
    await replaceAttachments(conn, id, attachments, data.user_id);
    await conn.commit();
    return getAnnouncementById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createDraftVersionFromAnnouncement(source, data, targets = [], attachments = []) {
  const rootId = source.root_announcement_id || source.id;
  const rows = await query(
    "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM announcements WHERE root_announcement_id = ? OR id = ?",
    [rootId, rootId]
  );
  return createAnnouncement(
    {
      ...data,
      root_announcement_id: rootId,
      version_number: Number(rows[0]?.max_version || 0) + 1,
      is_current: 0,
    },
    targets,
    attachments
  );
}

async function replaceTargets(conn, announcementId, targets = []) {
  await conn.execute("DELETE FROM announcement_targets WHERE announcement_id = ?", [announcementId]);
  for (const target of targets) {
    await conn.execute(
      `INSERT INTO announcement_targets
       (announcement_id, target_type, role_name, user_id, session_id, scope_code, staff_type, class_id,
        section_id, medium, stream_id, include_inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        announcementId,
        target.target_type,
        target.role_name || null,
        target.user_id || null,
        target.session_id || null,
        target.scope_code || null,
        target.staff_type || null,
        target.class_id || null,
        target.section_id || null,
        target.medium || null,
        target.stream_id || null,
        target.include_inactive ? 1 : 0,
      ]
    );
  }
}

async function replaceAttachments(conn, announcementId, attachments = [], userId) {
  await conn.execute("DELETE FROM announcement_attachments WHERE announcement_id = ?", [announcementId]);
  for (const attachment of attachments) {
    await conn.execute(
      `INSERT INTO announcement_attachments
       (announcement_id, file_name, file_url, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        announcementId,
        attachment.file_name,
        attachment.file_url,
        attachment.mime_type || null,
        attachment.file_size || null,
        userId || null,
      ]
    );
  }
}

export async function publishAnnouncement(id, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id, root_announcement_id FROM announcements WHERE id = ? AND status IN ('draft', 'scheduled') LIMIT 1",
      [id]
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return false;
    }
    const rootId = row.root_announcement_id || row.id;
    await conn.execute(
      `UPDATE announcements
       SET is_current = 0, archived_at = COALESCE(archived_at, ${schoolNowSql()}), updated_by = ?
       WHERE (root_announcement_id = ? OR id = ?)
         AND id <> ?
         AND status IN ('published', 'sent')`,
      [userId || null, rootId, rootId, id]
    );
    const [result] = await conn.execute(
      `UPDATE announcements
       SET status = 'published', published_at = ${schoolNowSql()}, is_current = 1, archived_at = NULL, updated_by = ?
       WHERE id = ? AND status IN ('draft', 'scheduled')`,
      [userId || null, id]
    );
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function listDueScheduledAnnouncements(limit = 25) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  return query(
    `SELECT id, created_by, updated_by
     FROM announcements
     WHERE status = 'scheduled'
       AND publish_at IS NOT NULL
       AND publish_at <= ${schoolNowSql()}
     ORDER BY publish_at, id
     LIMIT ${safeLimit}`
  );
}

export async function cancelAnnouncement(id, userId) {
  const result = await execute(
    `UPDATE announcements
     SET status = 'cancelled', cancelled_at = ${schoolNowSql()}, updated_by = ?
     WHERE id = ? AND status IN ('draft', 'scheduled', 'published')`,
    [userId || null, id]
  );
  return result.affectedRows > 0;
}

export async function resolveOnlineUserIds(targets = []) {
  const ids = new Set();
  for (const target of targets) {
    const rows = await resolveUsersForTarget(target);
    for (const row of rows) ids.add(Number(row.user_id));
  }
  return [...ids].filter(Boolean);
}

export async function resolveOnlineRecipients(targets = []) {
  const userIds = await resolveOnlineUserIds(targets);
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => "?").join(",");
  return query(
    `SELECT u.id AS user_id, u.username, u.email, u.phone, u.status,
            GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id IN (${placeholders})
     GROUP BY u.id, u.username, u.email, u.phone, u.status
     ORDER BY u.username, u.id`,
    userIds
  );
}

async function resolveUsersForTarget(target) {
  const activeClause = target.include_inactive ? "" : "AND u.status = 'active'";
  if (target.target_type === "all") {
    return query(`SELECT u.id AS user_id FROM users u WHERE 1=1 ${activeClause}`);
  }
  if (target.target_type === "role" && target.role_name) {
    return query(
      `SELECT DISTINCT u.id AS user_id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = ? ${activeClause}`,
      [target.role_name]
    );
  }
  if (target.target_type === "user" && target.user_id) {
    return query(`SELECT u.id AS user_id FROM users u WHERE u.id = ? ${activeClause}`, [target.user_id]);
  }
  if (target.target_type === "teachers") {
    const where = ["1=1"];
    const params = [];
    if (!target.include_inactive) where.push("u.status = 'active'");
    appendFilter(where, params, "t.class_scope", target.scope_code);
    appendFilter(where, params, "t.staff_type", target.staff_type);
    return query(
      `SELECT DISTINCT u.id AS user_id
       FROM teachers t
       JOIN users u ON u.id = t.user_id
       WHERE ${where.join(" AND ")}`,
      params
    );
  }
  if (["staff", "accounts"].includes(target.target_type)) {
    return resolveUsersForTarget({ ...target, target_type: "role", role_name: target.target_type });
  }
  if (["parents", "class", "section", "scope"].includes(target.target_type)) {
    const where = ["p.user_id IS NOT NULL"];
    const params = [];
    if (!target.include_inactive) where.push("u.status = 'active'");
    appendFilter(where, params, "se.session_id", target.session_id);
    appendFilter(where, params, "se.class_id", target.class_id);
    appendFilter(where, params, "se.section_id", target.section_id);
    appendFilter(where, params, "se.stream_id", target.stream_id);
    appendFilter(where, params, "sec.medium", target.medium);
    appendFilter(where, params, "c.class_scope", target.scope_code);
    return query(
      `SELECT DISTINCT p.user_id
       FROM parents p
       JOIN users u ON u.id = p.user_id
       JOIN student_parents sp ON sp.parent_id = p.id
       JOIN student_enrollments se ON se.student_id = sp.student_id AND se.status = 'active'
       JOIN classes c ON c.id = se.class_id
       LEFT JOIN sections sec ON sec.id = se.section_id
       WHERE ${where.join(" AND ")}`,
      params
    );
  }
  return [];
}

export async function resolveSmsRecipients(targets = []) {
  const byPhone = new Map();
  for (const target of targets) {
    const rows = await resolveSmsForTarget(target);
    for (const row of rows) {
      const phone = String(row.phone || "").replace(/\D/g, "");
      if (phone.length >= 10 && !byPhone.has(phone)) byPhone.set(phone, { ...row, phone });
    }
  }
  return [...byPhone.values()];
}

async function resolveSmsForTarget(target) {
  if (target.target_type === "teachers") {
    const where = ["COALESCE(t.phone, u.phone) IS NOT NULL"];
    const params = [];
    if (!target.include_inactive) where.push("u.status = 'active'");
    appendFilter(where, params, "t.class_scope", target.scope_code);
    appendFilter(where, params, "t.staff_type", target.staff_type);
    return query(
      `SELECT u.id AS user_id, NULL AS student_id, NULL AS parent_id,
              COALESCE(t.phone, u.phone) AS phone, COALESCE(t.name, u.username) AS recipient_name, 'teacher' AS recipient_role
       FROM teachers t
       JOIN users u ON u.id = t.user_id
       WHERE ${where.join(" AND ")}`,
      params
    );
  }
  if (["all", "role", "staff", "accounts", "user"].includes(target.target_type)) {
    const userIds = await resolveUsersForTarget(
      ["staff", "accounts"].includes(target.target_type)
        ? { ...target, target_type: "role", role_name: target.target_type }
        : target
    );
    if (!userIds.length) return [];
    const placeholders = userIds.map(() => "?").join(",");
    return query(
      `SELECT u.id AS user_id, NULL AS student_id, NULL AS parent_id,
              u.phone, u.username AS recipient_name, 'user' AS recipient_role
       FROM users u
       WHERE u.id IN (${placeholders}) AND u.phone IS NOT NULL`,
      userIds.map((row) => row.user_id)
    );
  }
  if (["parents", "class", "section", "scope"].includes(target.target_type)) {
    const where = ["p.mobile IS NOT NULL"];
    const params = [];
    appendFilter(where, params, "se.session_id", target.session_id);
    appendFilter(where, params, "se.class_id", target.class_id);
    appendFilter(where, params, "se.section_id", target.section_id);
    appendFilter(where, params, "se.stream_id", target.stream_id);
    appendFilter(where, params, "sec.medium", target.medium);
    appendFilter(where, params, "c.class_scope", target.scope_code);
    return query(
      `SELECT DISTINCT p.user_id, sp.student_id, p.id AS parent_id,
              p.mobile AS phone, p.name AS recipient_name, 'parent' AS recipient_role
       FROM parents p
       JOIN student_parents sp ON sp.parent_id = p.id
       JOIN student_enrollments se ON se.student_id = sp.student_id AND se.status = 'active'
       JOIN classes c ON c.id = se.class_id
       LEFT JOIN sections sec ON sec.id = se.section_id
       WHERE ${where.join(" AND ")}`,
      params
    );
  }
  return [];
}

export async function createSmsJob(announcement, recipients = [], userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const status = announcement.sms_send_at ? "scheduled" : "queued";
    const [jobResult] = await conn.execute(
      `INSERT INTO announcement_sms_jobs
       (announcement_id, sms_template_id, status, scheduled_at, total_recipients, provider, created_by)
       VALUES (?, ?, ?, ?, ?, 'fast2sms', ?)`,
      [announcement.id, announcement.sms_template_id, status, announcement.sms_send_at || null, recipients.length, userId || null]
    );
    for (const recipient of recipients) {
      await conn.execute(
        `INSERT IGNORE INTO announcement_sms_recipients
         (sms_job_id, announcement_id, user_id, student_id, parent_id, phone, recipient_name, recipient_role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
        [
          jobResult.insertId,
          announcement.id,
          recipient.user_id || null,
          recipient.student_id || null,
          recipient.parent_id || null,
          recipient.phone,
          recipient.recipient_name || null,
          recipient.recipient_role || null,
        ]
      );
    }
    await conn.commit();
    return getSmsJobById(jobResult.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function getSmsJobById(id) {
  return query("SELECT * FROM announcement_sms_jobs WHERE id = ? LIMIT 1", [id]).then((rows) => rows[0] || null);
}

export async function getSmsJobForDispatch(id) {
  const rows = await query(
    `SELECT j.*, a.title, a.body, a.sms_variables_json, a.event_start_date, a.event_end_date, a.reopen_date,
            st.template_name, st.dlt_template_id, st.provider_template_id, st.header, st.brand_dlt_id, st.template_content,
            st.placeholder_count, st.placeholder_schema_json, st.provider AS template_provider
     FROM announcement_sms_jobs j
     JOIN announcements a ON a.id = j.announcement_id
     JOIN announcement_sms_templates st ON st.id = j.sms_template_id
     WHERE j.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export function listSmsJobs(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "j.status", filters.status);
  appendFilter(where, params, "j.announcement_id", filters.announcement_id);
  return query(
    `SELECT j.*,
            a.title AS announcement_title,
            st.template_name,
            COALESCE(stats.queued_count, 0) AS queued_count,
            COALESCE(stats.retrying_count, 0) AS retrying_count,
            COALESCE(stats.sent_recipient_count, 0) AS sent_recipient_count,
            COALESCE(stats.delivered_count, 0) AS delivered_count,
            COALESCE(stats.failed_recipient_count, 0) AS failed_recipient_count,
            COALESCE(stats.undelivered_count, 0) AS undelivered_count,
            COALESCE(stats.stored_recipient_count, 0) AS stored_recipient_count
     FROM announcement_sms_jobs j
     LEFT JOIN announcements a ON a.id = j.announcement_id
     LEFT JOIN announcement_sms_templates st ON st.id = j.sms_template_id
     LEFT JOIN (
       SELECT sms_job_id,
              COUNT(*) AS stored_recipient_count,
              SUM(status = 'queued') AS queued_count,
              SUM(status = 'retrying') AS retrying_count,
              SUM(status = 'sent') AS sent_recipient_count,
              SUM(status = 'delivered') AS delivered_count,
              SUM(status = 'failed') AS failed_recipient_count,
              SUM(status = 'undelivered') AS undelivered_count
       FROM announcement_sms_recipients
       GROUP BY sms_job_id
     ) stats ON stats.sms_job_id = j.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY j.created_at DESC
     LIMIT 100`,
    params
  );
}

export async function listSmsJobRecipients(jobId, filters = {}) {
  const where = ["r.sms_job_id = ?"];
  const params = [jobId];
  appendFilter(where, params, "r.status", filters.status);
  const search = String(filters.q || "").trim();
  if (search) {
    where.push(`(
      r.recipient_name LIKE ?
      OR r.phone LIKE ?
      OR r.provider_status LIKE ?
      OR r.error_message LIKE ?
      OR s.name LIKE ?
      OR c.name LIKE ?
      OR sec.name LIKE ?
      OR se.roll_number LIKE ?
      OR sec.medium LIKE ?
      OR str.name LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 50));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * limit;
  const [rows, totalRows] = await Promise.all([
    query(
      `SELECT r.id, r.sms_job_id, r.announcement_id, r.user_id, r.student_id, r.parent_id, r.phone,
            r.recipient_name, r.recipient_role, r.status, r.provider_message_id, r.provider_status,
            r.attempt_count, r.last_attempt_at, r.delivered_at, r.error_message, r.created_at, r.updated_at,
            s.name AS student_name,
            s.admission_no AS student_admission_no,
            se.roll_number AS student_roll_number,
            c.name AS student_class_name,
            sec.name AS student_section_name,
            sec.medium AS student_medium,
            str.name AS student_stream_name
       FROM announcement_sms_recipients r
       LEFT JOIN students s ON s.id = r.student_id
       LEFT JOIN student_enrollments se ON se.id = (
         SELECT se2.id
         FROM student_enrollments se2
         WHERE se2.student_id = r.student_id
           AND se2.status = 'active'
         ORDER BY se2.id DESC
         LIMIT 1
       )
       LEFT JOIN classes c ON c.id = se.class_id
       LEFT JOIN sections sec ON sec.id = se.section_id
       LEFT JOIN streams str ON str.id = se.stream_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.id
      LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total
       FROM announcement_sms_recipients r
       LEFT JOIN students s ON s.id = r.student_id
       LEFT JOIN student_enrollments se ON se.id = (
         SELECT se2.id
         FROM student_enrollments se2
         WHERE se2.student_id = r.student_id
           AND se2.status = 'active'
         ORDER BY se2.id DESC
         LIMIT 1
       )
       LEFT JOIN classes c ON c.id = se.class_id
       LEFT JOIN sections sec ON sec.id = se.section_id
       LEFT JOIN streams str ON str.id = se.stream_id
       WHERE ${where.join(" AND ")}`,
      params
    ),
  ]);
  return {
    rows,
    total: Number(totalRows[0]?.total || 0),
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(Number(totalRows[0]?.total || 0) / limit)),
  };
}

export async function listDueSmsJobs(limit = 5) {
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 5));
  return query(
    `SELECT id
     FROM announcement_sms_jobs
     WHERE status IN ('queued', 'scheduled')
       AND (scheduled_at IS NULL OR scheduled_at <= ${schoolNowSql()})
     ORDER BY COALESCE(scheduled_at, created_at), id
     LIMIT ${safeLimit}`
  );
}

export async function claimSmsJob(id, force = false) {
  const dueClause = force ? "" : `AND (scheduled_at IS NULL OR scheduled_at <= ${schoolNowSql()})`;
  const result = await execute(
    `UPDATE announcement_sms_jobs
     SET status = 'sending', started_at = COALESCE(started_at, ${schoolNowSql()}), error_message = NULL
     WHERE id = ?
       AND status IN ('queued', 'scheduled')
       ${dueClause}`,
    [id]
  );
  return result.affectedRows > 0;
}

export function listQueuedSmsRecipients(jobId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  return query(
    `SELECT *
     FROM announcement_sms_recipients
     WHERE sms_job_id = ? AND status IN ('queued', 'retrying')
     ORDER BY id
     LIMIT ${safeLimit}`,
    [jobId]
  );
}

export async function markSmsRecipientSent(id, payload = {}) {
  await execute(
    `UPDATE announcement_sms_recipients
     SET status = 'sent', provider_message_id = ?, provider_status = ?,
         attempt_count = attempt_count + 1, last_attempt_at = ${schoolNowSql()}, error_message = NULL
     WHERE id = ?`,
    [
      payload.provider_message_id || null,
      payload.provider_status || "accepted",
      id,
    ]
  );
}

export async function markSmsRecipientFailed(id, errorMessage, retryable = false) {
  await execute(
    `UPDATE announcement_sms_recipients
     SET status = ?, provider_status = 'failed', attempt_count = attempt_count + 1,
         last_attempt_at = ${schoolNowSql()}, error_message = ?
     WHERE id = ?`,
    [retryable ? "retrying" : "failed", String(errorMessage || "Could not send SMS").slice(0, 1000), id]
  );
}

export async function findSmsRecipientsForDeliveryUpdate(filters = {}) {
  const where = [];
  const params = [];
  appendFilter(where, params, "id", filters.recipient_id);
  appendFilter(where, params, "sms_job_id", filters.sms_job_id);
  appendFilter(where, params, "provider_message_id", filters.provider_message_id);
  if (filters.phone) {
    where.push("phone = ?");
    params.push(String(filters.phone).replace(/\D/g, ""));
  }
  if (!where.length) return [];
  return query(
    `SELECT *
     FROM announcement_sms_recipients
     WHERE ${where.join(" AND ")}
     ORDER BY id`,
    params
  );
}

export async function listTrackableSmsRecipients(jobId, limit = 500) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 500));
  return query(
    `SELECT *
     FROM announcement_sms_recipients
     WHERE sms_job_id = ?
       AND status IN ('sent', 'delivered', 'undelivered')
       AND provider_message_id IS NOT NULL
     ORDER BY id
     LIMIT ${safeLimit}`,
    [jobId]
  );
}

export async function updateSmsRecipientDeliveryStatus(id, payload = {}) {
  await execute(
    `UPDATE announcement_sms_recipients
     SET status = ?, provider_status = ?,
         delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(?, ${schoolNowSql()}) ELSE NULL END,
         error_message = ?
     WHERE id = ?`,
    [
      payload.status,
      payload.provider_status || payload.status,
      payload.status,
      payload.delivered_at || null,
      payload.error_message ? String(payload.error_message).slice(0, 1000) : null,
      id,
    ]
  );
}

export async function refreshSmsJobStatus(id, errorMessage = null) {
  const [counts] = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(status IN ('sent', 'delivered')) AS sent,
       SUM(status IN ('failed', 'undelivered')) AS failed,
       SUM(status IN ('queued', 'retrying')) AS pending
     FROM announcement_sms_recipients
     WHERE sms_job_id = ?`,
    [id]
  );
  const total = Number(counts?.total || 0);
  const sent = Number(counts?.sent || 0);
  const failed = Number(counts?.failed || 0);
  const pending = Number(counts?.pending || 0);
  const status = pending > 0
    ? "queued"
    : failed > 0 && sent > 0
      ? "partial_failed"
      : failed > 0
        ? "failed"
        : "sent";
  await execute(
    `UPDATE announcement_sms_jobs
     SET status = ?, sent_count = ?, failed_count = ?,
         completed_at = CASE WHEN ? > 0 THEN NULL ELSE ${schoolNowSql()} END,
         error_message = ?
     WHERE id = ?`,
    [
      status,
      sent,
      failed,
      pending,
      errorMessage ? String(errorMessage).slice(0, 1000) : null,
      id,
    ]
  );
  return getSmsJobById(id);
}

export async function createHolidayFromAnnouncement(announcement, targets = [], userId) {
  const holidayTargets = targets.length ? targets : [{ target_type: "all" }];
  for (const target of holidayTargets) {
    await execute(
      `INSERT INTO holiday_calendar
       (announcement_id, category_id, title, description, starts_on, ends_on, reopen_date,
        scope_type, session_id, class_id, section_id, medium, stream_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        announcement.id,
        announcement.category_id || null,
        announcement.title,
        announcement.body,
        announcement.event_start_date,
        announcement.event_end_date || announcement.event_start_date,
        announcement.reopen_date || null,
        target.target_type === "section" ? "section" : target.target_type === "class" ? "class" : "school_wide",
        target.session_id || null,
        target.class_id || null,
        target.section_id || null,
        target.medium || null,
        target.stream_id || null,
        userId || null,
      ]
    );
  }
}

export function listHolidays(filters = {}) {
  const where = ["is_active = 1"];
  const params = [];
  if (filters.from) {
    where.push("ends_on >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("starts_on <= ?");
    params.push(filters.to);
  }
  appendFilter(where, params, "session_id", filters.session_id);
  appendFilter(where, params, "class_id", filters.class_id);
  appendFilter(where, params, "section_id", filters.section_id);
  return query(
    `SELECT *
     FROM holiday_calendar
     WHERE ${where.join(" AND ")}
     ORDER BY starts_on, title`,
    params
  );
}
