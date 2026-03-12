import { execute, query } from "../../core/db/query.js";

let teacherClassScopeColumnPromise;

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
     (conversation_id, user_id, last_read_at)
     VALUES (?, ?, NULL)`,
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
     (conversation_id, sender_id, message, attachment_url, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [
      data.conversation_id,
      data.sender_id,
      data.message,
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

export async function getConversationMessages(conversationId, limit, offset) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);

  return query(
    `SELECT
      m.id,
      m.conversation_id,
      m.sender_id,
      u.username,
      m.message,
      m.attachment_url,
      m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id=?
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [conversationId]
  );
}

export async function getUserConversations(userId) {
  return query(
    `SELECT
      c.id,
      c.type,
      c.name,
      c.class_id,
      c.section_id,
      c.last_message_at,
      (
        SELECT m.message
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
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [userId, userId]
  );
}

export async function markConversationRead(conversationId, userId) {
  await execute(
    `UPDATE conversation_members
     SET last_read_at = NOW()
     WHERE conversation_id=? AND user_id=?`,
    [conversationId, userId]
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
    GROUP BY c.id`,
    [userId]
  );
}

export async function getParentTargets() {
  return query(
    `SELECT
      p.id AS parent_id,
      p.name,
      p.mobile,
      p.email,
      p.user_id,
      e.class_id,
      e.section_id,
      c.name AS class_name,
      c.class_scope,
      s.name AS section_name,
      s.medium
    FROM parents p
    LEFT JOIN student_parents sp ON sp.parent_id = p.id
    LEFT JOIN student_enrollments e
      ON e.student_id = sp.student_id
      AND e.status = 'active'
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections s ON s.id = e.section_id
    ORDER BY p.name ASC`
  );
}

export async function getTeacherTargets() {
  const hasClassScope = await hasTeacherClassScopeColumn();

  return query(
    `SELECT
      t.id AS teacher_id,
      t.name,
      t.phone,
      t.email,
      t.user_id,
      ${hasClassScope ? "t.class_scope" : "'school'"} AS class_scope,
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
  return query(
    `SELECT id, name, medium, class_scope
     FROM classes
     WHERE is_active = TRUE
     ORDER BY id ASC`
  );
}

export async function getSectionTargets() {
  return query(
    `SELECT s.id, s.name, s.class_id, c.name AS class_name, s.medium, c.class_scope
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

export async function getAllParentRecipientUsers() {
  return query(
    `SELECT DISTINCT user_id
     FROM parents
     WHERE user_id IS NOT NULL`
  );
}

export async function getAllTeacherRecipientUsers(teacherType) {
  const hasClassScope = await hasTeacherClassScopeColumn();

  if (hasClassScope && teacherType === "college") {
    return query(
      `SELECT DISTINCT user_id
       FROM teachers
       WHERE user_id IS NOT NULL
         AND class_scope = 'hs'`
    );
  }

  if (hasClassScope && teacherType === "school") {
    return query(
      `SELECT DISTINCT user_id
       FROM teachers
       WHERE user_id IS NOT NULL
         AND class_scope = 'school'`
    );
  }

  return query(
    `SELECT DISTINCT user_id
     FROM teachers
     WHERE user_id IS NOT NULL`
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
