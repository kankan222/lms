import { execute, query } from "../../core/db/query.js";

let teacherClassScopeColumnPromise;
let teacherStaffTypeColumnPromise;
let staffUserIdColumnPromise;
let classClassScopeColumnPromise;
let studentRollNumberColumnPromise;
let studentParentRelationshipColumnPromise;

function hasTeacherClassScopeColumn() {
  if (!teacherClassScopeColumnPromise) {
    teacherClassScopeColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'class_scope'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return teacherClassScopeColumnPromise;
}

function hasTeacherStaffTypeColumn() {
  if (!teacherStaffTypeColumnPromise) {
    teacherStaffTypeColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'staff_type'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return teacherStaffTypeColumnPromise;
}

function hasClassClassScopeColumn() {
  if (!classClassScopeColumnPromise) {
    classClassScopeColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'classes'
          AND COLUMN_NAME = 'class_scope'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return classClassScopeColumnPromise;
}

function hasStudentRollNumberColumn() {
  if (!studentRollNumberColumnPromise) {
    studentRollNumberColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'students'
          AND COLUMN_NAME = 'roll_number'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return studentRollNumberColumnPromise;
}

function hasStudentParentRelationshipColumn() {
  if (!studentParentRelationshipColumnPromise) {
    studentParentRelationshipColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'student_parents'
          AND COLUMN_NAME = 'relationship'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return studentParentRelationshipColumnPromise;
}

async function hasStaffUserIdColumn() {
  if (!staffUserIdColumnPromise) {
    staffUserIdColumnPromise = query(`SHOW COLUMNS FROM staff LIKE 'user_id'`)
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch((err) => {
        staffUserIdColumnPromise = null;
        throw err;
      });
  }

  return staffUserIdColumnPromise;
}

export async function findMember(conversationId, userId) {
  const rows = await query(
    `SELECT 1
     FROM conversation_members
     WHERE conversation_id=? AND user_id=?
     LIMIT 1`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function getDirectConversation(userA, userB) {
  const rows = await query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_members cm1
       ON cm1.conversation_id = c.id AND cm1.user_id = ?
     JOIN conversation_members cm2
       ON cm2.conversation_id = c.id AND cm2.user_id = ?
     WHERE c.type = 'direct'
     ORDER BY c.id DESC
     LIMIT 1`,
    [userA, userB]
  );
  return rows[0];
}

export async function getScopedConversation(type, classId, sectionId) {
  const rows = await query(
    `SELECT id
     FROM conversations
     WHERE type = ?
       AND (class_id <=> ?)
       AND (section_id <=> ?)
     ORDER BY id DESC
     LIMIT 1`,
    [type, classId ?? null, sectionId ?? null]
  );
  return rows[0];
}

export async function getBroadcastConversation(name) {
  const rows = await query(
    `SELECT id
     FROM conversations
     WHERE type = 'broadcast'
       AND name = ?
     ORDER BY id DESC
     LIMIT 1`,
    [name]
  );
  return rows[0];
}

export async function getConversationById(conversationId) {
  const rows = await query(
    `SELECT id, type, name, class_id, section_id, created_by
     FROM conversations
     WHERE id = ?
     LIMIT 1`,
    [conversationId]
  );
  return rows[0] || null;
}

export async function isSuperAdminUser(userId) {
  const rows = await query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND r.name = 'super_admin'
     LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

export async function createConversation(data) {
  const result = await execute(
    `INSERT INTO conversations
     (type, name, class_id, section_id, created_by, created_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.type,
      data.name ?? null,
      data.class_id ?? null,
      data.section_id ?? null,
      data.created_by
    ]
  );
  return result.insertId;
}

export async function addConversationMember(conversationId, userId) {
  await execute(
    `INSERT IGNORE INTO conversation_members
     (conversation_id, user_id, last_read_at, hidden_at)
     VALUES (?, ?, NULL, NULL)`,
    [conversationId, userId]
  );
}

export async function addConversationMembers(conversationId, userIds) {
  for (const uid of userIds) {
    await addConversationMember(conversationId, uid);
  }
}

export async function insertMessage(data) {
  const result = await execute(
    `INSERT INTO messages
     (
       conversation_id,
       sender_id,
       message,
       message_type,
       reply_to_message_id,
       forwarded_from_message_id,
       attachment_url,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.conversation_id,
      data.sender_id,
      data.message || null,
      data.message_type || "text",
      data.reply_to_message_id || null,
      data.forwarded_from_message_id || null,
      data.attachment_url ?? null
    ]
  );
  return result.insertId;
}

export async function updateConversationLastMessage(conversationId) {
  await execute(
    `UPDATE conversations
     SET last_message_at = NOW()
     WHERE id=?`,
    [conversationId]
  );
}

export async function updateConversationName(conversationId, name) {
  await execute(
    `UPDATE conversations
     SET name = ?
     WHERE id = ?`,
    [name, conversationId]
  );
}

export async function getConversationMessages(conversationId, limit, offset, userId) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const hasStaffUserId = await hasStaffUserIdColumn();
  const staffJoin = hasStaffUserId
    ? "LEFT JOIN staff st ON st.user_id = u.id"
    : "LEFT JOIN staff st ON 1 = 0";

  return query(
    `SELECT
      m.id,
      m.conversation_id,
      m.sender_id,
      u.username,
      COALESCE(st.name, t.name, u.username, u.email, u.phone, CONCAT('User #', u.id)) AS sender_name,
      COALESCE(st.image_url, t.photo_url) AS sender_image_url,
      m.message,
      m.message_type,
      m.reply_to_message_id,
      m.forwarded_from_message_id,
      m.attachment_url,
      m.created_at,
      m.edited_at,
      m.deleted_for_everyone_at,
      reply.message AS reply_message,
      reply.message_type AS reply_message_type,
      COALESCE(reply_sender.username, reply_sender.email, reply_sender.phone) AS reply_sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     ${staffJoin}
     LEFT JOIN teachers t ON t.user_id = u.id
     LEFT JOIN messages reply ON reply.id = m.reply_to_message_id
     LEFT JOIN users reply_sender ON reply_sender.id = reply.sender_id
     LEFT JOIN message_hidden_users hidden
       ON hidden.message_id = m.id AND hidden.user_id = ?
     WHERE m.conversation_id=?
       AND hidden.message_id IS NULL
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [userId, conversationId]
  );
}

export async function getUserConversations(userId, filters = {}) {
  const rawPage = Number(filters.page);
  const rawLimit = Number(filters.limit);
  const hasPagination = Number.isFinite(rawPage) || Number.isFinite(rawLimit);
  const page = Math.max(1, Number.isFinite(rawPage) ? Math.trunc(rawPage) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 25));
  const offset = (page - 1) * limit;
  const hasStaffUserId = await hasStaffUserIdColumn();
  const staffJoin = hasStaffUserId
    ? "LEFT JOIN staff st ON st.user_id = u.id"
    : "LEFT JOIN staff st ON 1 = 0";
  const staffNameJoin = hasStaffUserId
    ? "LEFT JOIN staff st ON st.user_id = u.id"
    : "LEFT JOIN staff st ON 1 = 0";

  const baseSql = `SELECT
      c.id,
      c.type,
      CASE
        WHEN c.type = 'direct' THEN COALESCE(
          (
            SELECT COALESCE(st.name, p.name, t.name, u.username, u.email, u.phone, CONCAT('User #', u.id))
            FROM conversation_members other_cm
            JOIN users u ON u.id = other_cm.user_id
            ${staffNameJoin}
            LEFT JOIN parents p ON p.user_id = u.id
            LEFT JOIN teachers t ON t.user_id = u.id
            WHERE other_cm.conversation_id = c.id
              AND other_cm.user_id <> ?
            ORDER BY other_cm.user_id ASC
            LIMIT 1
          ),
          c.name,
          CONCAT('Direct #', c.id)
        )
        ELSE c.name
      END AS name,
      CASE
        WHEN c.type = 'direct' THEN (
          SELECT other_cm.user_id
          FROM conversation_members other_cm
          WHERE other_cm.conversation_id = c.id
            AND other_cm.user_id <> ?
          ORDER BY other_cm.user_id ASC
          LIMIT 1
        )
        ELSE NULL
      END AS other_user_id,
      CASE
        WHEN c.type = 'direct' THEN (
          SELECT COALESCE(st.image_url, t.photo_url)
          FROM conversation_members other_cm
          JOIN users u ON u.id = other_cm.user_id
          ${staffJoin}
          LEFT JOIN teachers t ON t.user_id = u.id
          WHERE other_cm.conversation_id = c.id
            AND other_cm.user_id <> ?
          ORDER BY other_cm.user_id ASC
          LIMIT 1
        )
        ELSE NULL
      END AS other_user_image_url,
      c.class_id,
      c.section_id,
      c.last_message_at,
      (
        SELECT CASE
          WHEN m.deleted_for_everyone_at IS NOT NULL THEN 'Message deleted'
          WHEN m.message IS NOT NULL AND m.message <> '' THEN m.message
          WHEN m.message_type = 'image' THEN 'Photo'
          WHEN m.message_type = 'document' THEN 'File'
          WHEN m.message_type = 'voice' THEN 'Voice message'
          ELSE 'Message'
        END
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT COUNT(*)
        FROM messages m2
        WHERE m2.conversation_id = c.id
          AND m2.created_at > IFNULL(cm.last_read_at, '1970-01-01')
          AND m2.sender_id <> ?
      ) AS unread
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id
    WHERE cm.user_id = ?
      AND cm.hidden_at IS NULL
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`;

  const rows = await query(
    hasPagination ? `${baseSql} LIMIT ${limit} OFFSET ${offset}` : baseSql,
    [userId, userId, userId, userId, userId]
  );

  if (!hasPagination) {
    return rows;
  }

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM conversation_members cm
     WHERE cm.user_id = ?
       AND cm.hidden_at IS NULL`,
    [userId]
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

export async function getConversationMemberUserIds(conversationId) {
  const rows = await query(
    `SELECT user_id
     FROM conversation_members
     WHERE conversation_id = ?`,
    [conversationId]
  );

  return rows.map((row) => Number(row.user_id)).filter(Boolean);
}

export async function markConversationRead(conversationId, userId) {
  await execute(
    `UPDATE conversation_members
     SET last_read_at = NOW()
     WHERE conversation_id=? AND user_id=?`,
    [conversationId, userId]
  );
}

export async function hideConversationForUser(conversationId, userId) {
  await execute(
    `UPDATE conversation_members
     SET hidden_at = NOW()
     WHERE conversation_id = ? AND user_id = ?`,
    [conversationId, userId]
  );
}

export async function unhideConversationForMembers(conversationId) {
  await execute(
    `UPDATE conversation_members
     SET hidden_at = NULL
     WHERE conversation_id = ?`,
    [conversationId]
  );
}

export async function getUnreadCounts(userId) {
  return query(
    `SELECT
      c.id AS conversation_id,
      COUNT(m.id) AS unread
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id
    LEFT JOIN messages m
      ON m.conversation_id = c.id
      AND m.created_at > IFNULL(cm.last_read_at, '1970-01-01')
      AND m.sender_id <> cm.user_id
    WHERE cm.user_id=?
      AND cm.hidden_at IS NULL
    GROUP BY c.id`,
    [userId]
  );
}

export async function getParentTargets() {
  const [hasClassScope, hasStudentRollNumber, hasRelationship] = await Promise.all([
    hasClassClassScopeColumn(),
    hasStudentRollNumberColumn(),
    hasStudentParentRelationshipColumn(),
  ]);

  return query(
    `SELECT
      p.id AS parent_id,
      p.name,
      p.mobile,
      p.email,
      p.user_id,
      st.id AS student_id,
      st.name AS student_name,
      ${hasStudentRollNumber ? "st.roll_number" : "NULL"} AS roll_number,
      ${hasRelationship ? "sp.relationship" : "NULL"} AS relationship,
      e.class_id,
      e.section_id,
      c.name AS class_name,
      ${hasClassScope ? "c.class_scope" : "NULL"} AS class_scope,
      s.name AS section_name,
      s.medium
    FROM parents p
    LEFT JOIN student_parents sp ON sp.parent_id = p.id
    LEFT JOIN students st ON st.id = sp.student_id
    LEFT JOIN student_enrollments e
      ON e.student_id = sp.student_id
      AND e.status = 'active'
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections s ON s.id = e.section_id
    ORDER BY p.name ASC, st.name ASC`
  );
}

export async function getTeacherTargets() {
  const [hasClassScope, hasStaffType] = await Promise.all([
    hasTeacherClassScopeColumn(),
    hasTeacherStaffTypeColumn(),
  ]);

  return query(
    `SELECT
      t.id AS teacher_id,
      t.name,
      t.phone,
      t.email,
      t.user_id,
      ${hasClassScope ? "t.class_scope" : "'school'"} AS class_scope,
      ${hasStaffType ? "t.staff_type" : "'teaching'"} AS staff_type,
      CASE
        WHEN ${hasClassScope ? "t.class_scope" : "'school'"} = 'hs' THEN 'college'
        ELSE 'school'
      END AS type,
      tca.class_id,
      tca.section_id,
      c.name AS class_name,
      c.medium AS class_medium,
      s.name AS section_name,
      s.medium
    FROM teachers t
    LEFT JOIN teacher_class_assignments tca ON tca.teacher_id = t.id
    LEFT JOIN classes c ON c.id = tca.class_id
    LEFT JOIN sections s ON s.id = tca.section_id
    ORDER BY t.name ASC`
  );
}

export async function getClassTargets() {
  const hasClassScope = await hasClassClassScopeColumn();

  return query(
    `SELECT id, name, medium, ${hasClassScope ? "class_scope" : "NULL"} AS class_scope
     FROM classes
     WHERE is_active = TRUE
     ORDER BY id ASC`
  );
}

export async function getSectionTargets() {
  const hasClassScope = await hasClassClassScopeColumn();

  return query(
    `SELECT s.id, s.name, s.class_id, c.name AS class_name, s.medium, ${hasClassScope ? "c.class_scope" : "NULL"} AS class_scope
     FROM sections s
     JOIN classes c ON c.id = s.class_id
     WHERE c.is_active = TRUE
     ORDER BY c.id ASC, s.name ASC`
  );
}

export async function getClassRecipientUsers(classId) {
  return query(
    `SELECT DISTINCT recipient_user_id AS user_id FROM (
      SELECT p.user_id AS recipient_user_id
      FROM student_enrollments e
      JOIN student_parents sp ON sp.student_id = e.student_id
      JOIN parents p ON p.id = sp.parent_id
      WHERE e.class_id = ? AND e.status='active'

      UNION

      SELECT t.user_id AS recipient_user_id
      FROM teacher_class_assignments tca
      JOIN teachers t ON t.id = tca.teacher_id
      WHERE tca.class_id = ?
    ) x
    WHERE recipient_user_id IS NOT NULL`,
    [classId, classId]
  );
}

export async function getSectionRecipientUsers(sectionId) {
  return query(
    `SELECT DISTINCT recipient_user_id AS user_id FROM (
      SELECT p.user_id AS recipient_user_id
      FROM student_enrollments e
      JOIN student_parents sp ON sp.student_id = e.student_id
      JOIN parents p ON p.id = sp.parent_id
      WHERE e.section_id = ? AND e.status='active'

      UNION

      SELECT t.user_id AS recipient_user_id
      FROM teacher_class_assignments tca
      JOIN teachers t ON t.id = tca.teacher_id
      WHERE tca.section_id = ?
    ) x
    WHERE recipient_user_id IS NOT NULL`,
    [sectionId, sectionId]
  );
}

export async function getAllActiveUserRecipients() {
  return query(
    `SELECT id AS user_id
     FROM users
     WHERE status = 'active'`
  );
}

export async function getAllParentRecipientUsers(parentType) {
  const hasClassScope = await hasClassClassScopeColumn();

  if (hasClassScope && parentType === "college") {
    return query(
      `SELECT DISTINCT p.user_id
       FROM parents p
       JOIN student_parents sp ON sp.parent_id = p.id
       JOIN student_enrollments e
         ON e.student_id = sp.student_id
         AND e.status = 'active'
       JOIN classes c ON c.id = e.class_id
       WHERE p.user_id IS NOT NULL
         AND c.class_scope = 'hs'`
    );
  }

  if (hasClassScope && parentType === "school") {
    return query(
      `SELECT DISTINCT p.user_id
       FROM parents p
       JOIN student_parents sp ON sp.parent_id = p.id
       JOIN student_enrollments e
         ON e.student_id = sp.student_id
         AND e.status = 'active'
       JOIN classes c ON c.id = e.class_id
       WHERE p.user_id IS NOT NULL
         AND c.class_scope = 'school'`
    );
  }

  return query(
    `SELECT DISTINCT user_id
     FROM parents
     WHERE user_id IS NOT NULL`
  );
}

export async function getAllTeacherRecipientUsers(filters = {}) {
  const legacyTeacherType = typeof filters === "string" ? filters : filters.teacher_type;
  const teacherScope = filters.teacher_scope || legacyTeacherType || "all";
  const staffType = filters.staff_type || "all";
  const [hasClassScope, hasStaffType] = await Promise.all([
    hasTeacherClassScopeColumn(),
    hasTeacherStaffTypeColumn(),
  ]);
  const where = ["user_id IS NOT NULL"];
  const params = [];

  if (hasClassScope && teacherScope === "college") {
    where.push("class_scope = 'hs'");
  } else if (hasClassScope && teacherScope === "school") {
    where.push("class_scope = 'school'");
  }

  if (hasStaffType && ["teaching", "non_teaching"].includes(staffType)) {
    where.push("staff_type = ?");
    params.push(staffType);
  }

  return query(
    `SELECT DISTINCT user_id
     FROM teachers
     WHERE ${where.join(" AND ")}`,
    params
  );
}

export async function getAllClassRecipientUsers() {
  return query(
    `SELECT DISTINCT recipient_user_id AS user_id FROM (
      SELECT p.user_id AS recipient_user_id
      FROM student_enrollments e
      JOIN student_parents sp ON sp.student_id = e.student_id
      JOIN parents p ON p.id = sp.parent_id
      WHERE e.status = 'active'
        AND e.class_id IS NOT NULL

      UNION

      SELECT t.user_id AS recipient_user_id
      FROM teacher_class_assignments tca
      JOIN teachers t ON t.id = tca.teacher_id
      WHERE tca.class_id IS NOT NULL
    ) x
    WHERE recipient_user_id IS NOT NULL`
  );
}

export async function getAllSectionRecipientUsers() {
  return query(
    `SELECT DISTINCT recipient_user_id AS user_id FROM (
      SELECT p.user_id AS recipient_user_id
      FROM student_enrollments e
      JOIN student_parents sp ON sp.student_id = e.student_id
      JOIN parents p ON p.id = sp.parent_id
      WHERE e.status = 'active'
        AND e.section_id IS NOT NULL

      UNION

      SELECT t.user_id AS recipient_user_id
      FROM teacher_class_assignments tca
      JOIN teachers t ON t.id = tca.teacher_id
      WHERE tca.section_id IS NOT NULL
    ) x
    WHERE recipient_user_id IS NOT NULL`
  );
}

export async function getTeacherByUserId(userId) {
  const [hasClassScope, hasStaffType] = await Promise.all([
    hasTeacherClassScopeColumn(),
    hasTeacherStaffTypeColumn(),
  ]);
  const rows = await query(
    `SELECT
      id,
      user_id,
      ${hasClassScope ? "class_scope" : "'school'"} AS class_scope,
      ${hasStaffType ? "staff_type" : "'teaching'"} AS staff_type
     FROM teachers
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getTeacherVisibleConversationIds({ teacherId, classScope = "school", staffType = "teaching" }) {
  const broadcastNames = ["All Teachers"];
  const staffTypeLabel = staffType === "non_teaching" ? "Non Teaching Staff" : "Teaching Staff";
  if (classScope === "hs") {
    broadcastNames.push("All College Teachers");
    broadcastNames.push("All College Staff");
    broadcastNames.push(`All College ${staffTypeLabel}`);
  } else {
    broadcastNames.push("All School Teachers");
    broadcastNames.push("All School Staff");
    broadcastNames.push(`All School ${staffTypeLabel}`);
  }
  broadcastNames.push("All Staff");
  broadcastNames.push(`All ${staffTypeLabel}`);

  const placeholders = broadcastNames.map(() => "?").join(", ");
  const rows = await query(
    `SELECT DISTINCT conversation_id
     FROM (
       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN conversation_members cm
         ON cm.conversation_id = c.id
        AND cm.user_id = (
          SELECT user_id
          FROM teachers
          WHERE id = ?
          LIMIT 1
        )
       WHERE c.type = 'direct'

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       WHERE c.type = 'broadcast'
         AND c.name IN (${placeholders})

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN teacher_class_assignments tca
         ON tca.teacher_id = ?
        AND c.type = 'class'
        AND c.class_id = tca.class_id

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN teacher_class_assignments tca
         ON tca.teacher_id = ?
        AND c.type = 'section'
        AND c.section_id = tca.section_id
     ) visible`,
    [teacherId, ...broadcastNames, teacherId, teacherId]
  );

  return rows.map((row) => Number(row.conversation_id)).filter(Boolean);
}

export async function getParentVisibleConversationIds(userId) {
  const hasClassScope = await hasClassClassScopeColumn();
  const schoolParentBroadcastSql = hasClassScope
    ? `UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       WHERE c.type = 'broadcast'
         AND c.name = 'All School Parents'
         AND EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           JOIN student_enrollments e
             ON e.student_id = sp.student_id
            AND e.status = 'active'
           JOIN classes cls ON cls.id = e.class_id
           WHERE p.user_id = ?
             AND cls.class_scope = 'school'
         )

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       WHERE c.type = 'broadcast'
         AND c.name = 'All College Parents'
         AND EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           JOIN student_enrollments e
             ON e.student_id = sp.student_id
            AND e.status = 'active'
           JOIN classes cls ON cls.id = e.class_id
           WHERE p.user_id = ?
             AND cls.class_scope = 'hs'
         )`
    : "";

  const params = hasClassScope
    ? [userId, userId, userId, userId, userId, userId]
    : [userId, userId, userId, userId];

  const rows = await query(
    `SELECT DISTINCT conversation_id
     FROM (
       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN conversation_members cm
         ON cm.conversation_id = c.id
        AND cm.user_id = ?
       WHERE c.type = 'direct'

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN parents p
         ON p.user_id = ?
       JOIN student_parents sp
         ON sp.parent_id = p.id
       JOIN student_enrollments e
         ON e.student_id = sp.student_id
        AND e.status = 'active'
       WHERE c.type = 'class'
         AND c.class_id = e.class_id

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       JOIN parents p
         ON p.user_id = ?
       JOIN student_parents sp
         ON sp.parent_id = p.id
       JOIN student_enrollments e
         ON e.student_id = sp.student_id
        AND e.status = 'active'
       WHERE c.type = 'section'
         AND c.section_id = e.section_id

       UNION

       SELECT c.id AS conversation_id
       FROM conversations c
       WHERE c.type = 'broadcast'
         AND c.name = 'All Parents'
         AND EXISTS (
           SELECT 1
           FROM parents p
           JOIN student_parents sp ON sp.parent_id = p.id
           JOIN student_enrollments e
             ON e.student_id = sp.student_id
            AND e.status = 'active'
           WHERE p.user_id = ?
         )

       ${schoolParentBroadcastSql}
     ) visible`,
    params
  );

  return rows.map((row) => Number(row.conversation_id)).filter(Boolean);
}

export async function assertMessagingUserActive(userId) {
  const rows = await query(
    `SELECT 1
     FROM messaging_user_suspensions
     WHERE user_id = ?
       AND lifted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [userId]
  );
  if (rows.length) {
    const error = new Error("Messaging access is suspended");
    error.statusCode = 403;
    throw error;
  }
}

export async function createPendingAttachment(data) {
  const result = await execute(
    `INSERT INTO message_attachments
     (
       uploaded_by,
       category,
       storage_driver,
       object_key,
       thumbnail_key,
       original_name,
       stored_name,
       mime_type,
       file_extension,
       file_size,
       duration_ms,
       width,
       height,
       status,
       created_at,
       purge_after
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))`,
    [
      data.uploadedBy,
      data.category,
      data.storageDriver,
      data.objectKey,
      data.thumbnailKey || null,
      data.originalName,
      data.storedName,
      data.mimeType,
      data.fileExtension,
      data.fileSize,
      data.durationMs || null,
      data.width || null,
      data.height || null,
    ]
  );
  return result.insertId;
}

export async function getAttachmentsByIds(ids, userId, options = {}) {
  const normalized = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(",");
  const allowedStatuses = options.includePending ? "('pending','attached')" : "('attached')";
  return query(
    `SELECT
       id,
       message_id,
       uploaded_by,
       category,
       storage_driver,
       object_key,
       thumbnail_key,
       original_name,
       mime_type,
       file_extension,
       file_size,
       duration_ms,
       width,
       height,
       status,
       created_at
     FROM message_attachments
     WHERE id IN (${placeholders})
       AND uploaded_by = ?
       AND status IN ${allowedStatuses}`,
    [...normalized, userId]
  );
}

export async function attachPendingAttachments(messageId, attachmentIds, userId) {
  const normalized = [...new Set((attachmentIds || []).map(Number).filter(Boolean))];
  if (!normalized.length) return;
  const placeholders = normalized.map(() => "?").join(",");
  const result = await execute(
    `UPDATE message_attachments
     SET message_id = ?,
         status = 'attached',
         attached_at = NOW(),
         purge_after = NULL
     WHERE id IN (${placeholders})
       AND uploaded_by = ?
       AND status = 'pending'
       AND message_id IS NULL`,
    [messageId, ...normalized, userId]
  );
  if (result.affectedRows !== normalized.length) {
    throw new Error("One or more attachments are invalid or already used");
  }
}

export async function getAttachmentsForMessageIds(messageIds) {
  const normalized = [...new Set((messageIds || []).map(Number).filter(Boolean))];
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(",");
  return query(
    `SELECT
       id,
       message_id,
       category,
       original_name,
       mime_type,
       file_extension,
       file_size,
       duration_ms,
       width,
       height,
       status,
       created_at
     FROM message_attachments
     WHERE message_id IN (${placeholders})
       AND status = 'attached'
     ORDER BY id ASC`,
    normalized
  );
}

export async function getAuthorizedAttachment(attachmentId, userId) {
  const rows = await query(
    `SELECT
       a.*,
       CASE
         WHEN a.status = 'pending' OR a.uploaded_by = ? OR cm.user_id IS NOT NULL
           THEN m.conversation_id
         ELSE (
           SELECT forwarded.conversation_id
           FROM messages forwarded
           JOIN conversation_members forwarded_member
             ON forwarded_member.conversation_id = forwarded.conversation_id
            AND forwarded_member.user_id = ?
           WHERE forwarded.forwarded_from_message_id = a.message_id
           LIMIT 1
         )
       END AS conversation_id
     FROM message_attachments a
     LEFT JOIN messages m ON m.id = a.message_id
     LEFT JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id
      AND cm.user_id = ?
     WHERE a.id = ?
       AND (
         (a.status = 'pending' AND a.uploaded_by = ?)
         OR (
           a.status = 'attached'
           AND (
             cm.user_id IS NOT NULL
             OR a.uploaded_by = ?
             OR EXISTS (
               SELECT 1
               FROM messages forwarded
               JOIN conversation_members forwarded_member
                 ON forwarded_member.conversation_id = forwarded.conversation_id
                AND forwarded_member.user_id = ?
               WHERE forwarded.forwarded_from_message_id = a.message_id
             )
           )
         )
       )
     LIMIT 1`,
    [userId, userId, userId, attachmentId, userId, userId, userId]
  );
  return rows[0] || null;
}

export async function getMessageById(messageId) {
  const rows = await query(
    `SELECT m.*, c.type AS conversation_type, c.created_by AS conversation_created_by
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ?
     LIMIT 1`,
    [messageId]
  );
  return rows[0] || null;
}

export async function createMessageStatuses(messageId, conversationId, senderId) {
  await execute(
    `INSERT IGNORE INTO message_status (message_id, user_id, status, updated_at)
     SELECT ?, user_id, 'sent', NOW()
     FROM conversation_members
     WHERE conversation_id = ?
       AND user_id <> ?`,
    [messageId, conversationId, senderId]
  );
}

export async function markMessagesDelivered(conversationId, userId) {
  await execute(
    `UPDATE message_status ms
     JOIN messages m ON m.id = ms.message_id
     SET ms.status = IF(ms.status = 'read', 'read', 'delivered'),
         ms.delivered_at = COALESCE(ms.delivered_at, NOW()),
         ms.updated_at = NOW()
     WHERE m.conversation_id = ?
       AND ms.user_id = ?`,
    [conversationId, userId]
  );
}

export async function markMessagesRead(conversationId, userId) {
  await execute(
    `UPDATE message_status ms
     JOIN messages m ON m.id = ms.message_id
     SET ms.status = 'read',
         ms.delivered_at = COALESCE(ms.delivered_at, NOW()),
         ms.read_at = COALESCE(ms.read_at, NOW()),
         ms.updated_at = NOW()
     WHERE m.conversation_id = ?
       AND ms.user_id = ?`,
    [conversationId, userId]
  );
}

export async function getMessageStatuses(messageIds) {
  const normalized = [...new Set((messageIds || []).map(Number).filter(Boolean))];
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(",");
  return query(
    `SELECT message_id, user_id, status, delivered_at, read_at
     FROM message_status
     WHERE message_id IN (${placeholders})`,
    normalized
  );
}

export async function updateMessageText(messageId, message) {
  await execute(
    `UPDATE messages
     SET message = ?, edited_at = NOW()
     WHERE id = ?`,
    [message, messageId]
  );
}

export async function hideMessageForUser(messageId, userId) {
  await execute(
    `INSERT IGNORE INTO message_hidden_users (message_id, user_id, hidden_at)
     VALUES (?, ?, NOW())`,
    [messageId, userId]
  );
}

export async function deleteMessageForEveryone(messageId, deletedBy) {
  await execute(
    `UPDATE messages
     SET message = NULL,
         deleted_for_everyone_at = NOW(),
         deleted_by = ?
     WHERE id = ?`,
    [deletedBy, messageId]
  );
  await execute(
    `UPDATE message_attachments
     SET status = 'deleted',
         deleted_at = NOW(),
         purge_after = DATE_ADD(NOW(), INTERVAL 30 DAY)
     WHERE message_id = ?
       AND status = 'attached'`,
    [messageId]
  );
}

export async function searchConversationMessages(conversationId, userId, search, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  return query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       COALESCE(u.username, u.email, u.phone) AS sender_name,
       m.message,
       m.message_type,
       m.created_at,
       m.edited_at,
       m.deleted_for_everyone_at
     FROM messages m
     JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id
      AND cm.user_id = ?
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN message_hidden_users hidden
       ON hidden.message_id = m.id AND hidden.user_id = ?
     WHERE m.conversation_id = ?
       AND hidden.message_id IS NULL
       AND m.deleted_for_everyone_at IS NULL
       AND m.message LIKE ?
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit}`,
    [userId, userId, conversationId, `%${search}%`]
  );
}

export async function createMessageReport(data) {
  const result = await execute(
    `INSERT INTO message_reports
     (message_id, reported_by, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, 'open', NOW())`,
    [data.messageId, data.reportedBy, data.reason, data.details || null]
  );
  return result.insertId;
}

export async function listMessageReports(filters = {}) {
  const status = String(filters.status || "").trim();
  return query(
    `SELECT
       mr.*,
       reporter.username AS reporter_name,
       reviewer.username AS reviewer_name,
       m.conversation_id,
       m.sender_id,
       m.message,
       m.message_type
     FROM message_reports mr
     JOIN messages m ON m.id = mr.message_id
     JOIN users reporter ON reporter.id = mr.reported_by
     LEFT JOIN users reviewer ON reviewer.id = mr.reviewed_by
     WHERE (? = '' OR mr.status = ?)
     ORDER BY mr.created_at DESC
     LIMIT 200`,
    [status, status]
  );
}

export async function resolveMessageReport(reportId, reviewerId, status, note) {
  await execute(
    `UPDATE message_reports
     SET status = ?,
         reviewed_by = ?,
         resolution_note = ?,
         reviewed_at = NOW()
     WHERE id = ?`,
    [status, reviewerId, note || null, reportId]
  );
}

export async function setMessagingSuspension(data) {
  await execute(
    `INSERT INTO messaging_user_suspensions
     (user_id, suspended_by, reason, suspended_at, expires_at, lifted_at, lifted_by)
     VALUES (?, ?, ?, NOW(), ?, NULL, NULL)
     ON DUPLICATE KEY UPDATE
       suspended_by = VALUES(suspended_by),
       reason = VALUES(reason),
       suspended_at = NOW(),
       expires_at = VALUES(expires_at),
       lifted_at = NULL,
       lifted_by = NULL`,
    [data.userId, data.suspendedBy, data.reason, data.expiresAt || null]
  );
}

export async function liftMessagingSuspension(userId, liftedBy) {
  await execute(
    `UPDATE messaging_user_suspensions
     SET lifted_at = NOW(), lifted_by = ?
     WHERE user_id = ? AND lifted_at IS NULL`,
    [liftedBy, userId]
  );
}

export async function createMessagingAudit(data) {
  await execute(
    `INSERT INTO messaging_audit_log
     (
       actor_user_id,
       action,
       conversation_id,
       message_id,
       attachment_id,
       target_user_id,
       metadata_json,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.actorUserId || null,
      data.action,
      data.conversationId || null,
      data.messageId || null,
      data.attachmentId || null,
      data.targetUserId || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
}

export async function listMessagingAudit(filters = {}) {
  const conversationId = Number(filters.conversationId) || 0;
  return query(
    `SELECT *
     FROM messaging_audit_log
     WHERE (? = 0 OR conversation_id = ?)
     ORDER BY created_at DESC
     LIMIT 500`,
    [conversationId, conversationId]
  );
}

export async function getConversationExport(conversationId) {
  const conversationRows = await query(
    `SELECT * FROM conversations WHERE id = ? LIMIT 1`,
    [conversationId]
  );
  const messages = await query(
    `SELECT
       m.id,
       m.sender_id,
       COALESCE(u.username, u.email, u.phone) AS sender_name,
       m.message,
       m.message_type,
       m.reply_to_message_id,
       m.forwarded_from_message_id,
       m.created_at,
       m.edited_at,
       m.deleted_for_everyone_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC`,
    [conversationId]
  );
  return { conversation: conversationRows[0] || null, messages };
}

export async function getConversationMembers(conversationId) {
  return query(
    `SELECT
       cm.user_id,
       cm.last_read_at,
       COALESCE(p.name, t.name, u.username, u.email, u.phone) AS name
     FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN parents p ON p.user_id = u.id
     LEFT JOIN teachers t ON t.user_id = u.id
     WHERE cm.conversation_id = ?
     ORDER BY name ASC`,
    [conversationId]
  );
}

export async function removeConversationMember(conversationId, userId) {
  await execute(
    `DELETE FROM conversation_members
     WHERE conversation_id = ? AND user_id = ?`,
    [conversationId, userId]
  );
}

export async function markAttachmentRemoved(attachmentId) {
  await execute(
    `UPDATE message_attachments
     SET status = 'deleted',
         deleted_at = NOW(),
         purge_after = DATE_ADD(NOW(), INTERVAL 30 DAY)
     WHERE id = ? AND status = 'attached'`,
    [attachmentId]
  );
}

export async function getAttachmentById(attachmentId) {
  const rows = await query(
    `SELECT a.*, m.conversation_id
     FROM message_attachments a
     LEFT JOIN messages m ON m.id = a.message_id
     WHERE a.id = ?
     LIMIT 1`,
    [attachmentId]
  );
  return rows[0] || null;
}

export async function listAttachmentsReadyToPurge(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  return query(
    `SELECT id, object_key, thumbnail_key
     FROM message_attachments
     WHERE purge_after IS NOT NULL
       AND purge_after <= NOW()
       AND status IN ('pending','deleted','rejected')
     ORDER BY purge_after ASC
     LIMIT ${safeLimit}`
  );
}

export async function deleteAttachmentRecord(attachmentId) {
  await execute(`DELETE FROM message_attachments WHERE id = ?`, [attachmentId]);
}
