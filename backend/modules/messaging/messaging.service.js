import * as repo from "./messaging.repository.js";
import {
  getUserPresence,
  getConversationTyping,
  publishConversationEvent,
  publishMessagingEvent,
  setConversationTyping,
} from "./messaging.realtime.js";
import * as notificationService from "../notifications/notification.service.js";
import AppError from "../../core/errors/AppError.js";

const MESSAGE_CHANGE_WINDOW_MS = 60 * 60 * 1000;

function normalizeTeacherScope(value) {
  if (value === "college" || value === "hs") return "college";
  if (value === "school") return "school";
  return "all";
}

function normalizeRoleName(role) {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function normalizeStaffType(value) {
  return value === "non_teaching" ? "non_teaching" : value === "teaching" ? "teaching" : "all";
}

function teacherBroadcastName({ teacher_scope, teacher_type, staff_type } = {}) {
  const scope = normalizeTeacherScope(teacher_scope || teacher_type);
  const type = normalizeStaffType(staff_type);
  const scopeLabel = scope === "college" ? "College" : scope === "school" ? "School" : "";
  const typeLabel = type === "non_teaching" ? "Non Teaching Staff" : type === "teaching" ? "Teaching Staff" : "Staff";
  return ["All", scopeLabel, typeLabel].filter(Boolean).join(" ");
}

function normalizeActor(actor) {
  const roles = Array.isArray(actor?.roles)
    ? actor.roles.map(normalizeRoleName)
    : [];
  if (typeof actor === "number") {
    return { userId: actor, roles: [], permissions: [] };
  }

  return {
    userId: Number(actor?.userId || actor?.id),
    roles,
    permissions: Array.isArray(actor?.permissions) ? actor.permissions : [],
  };
}

async function canInitiateConversation(actor) {
  if (actor.roles.includes("super_admin")) {
    return true;
  }

  return repo.isSuperAdminUser(actor.userId);
}

function isParentOrTeacher(actor) {
  return actor.roles.includes("parent") || actor.roles.includes("teacher");
}

function hasPrivilegedMessagingRole(actor) {
  return actor.roles.some((role) =>
    ["super_admin", "admin", "accounts", "staff"].includes(role)
  );
}

function hasAdminMessagingRole(actor) {
  return actor.roles.some((role) =>
    ["super_admin", "admin", "accounts"].includes(role)
  );
}

function requiresScopedConversationVisibility(actor) {
  return isParentOrTeacher(actor) && !hasAdminMessagingRole(actor);
}

function assertCanSendMessages(actor) {
  if (actor.roles.includes("super_admin")) return;
  if (isParentOrTeacher(actor)) {
    throw new AppError("Parents and teachers can only view super admin messages", 403);
  }
}

function assertCanManageMessages(actor) {
  if (actor.roles.includes("super_admin")) return;
  if (!isParentOrTeacher(actor) && hasPrivilegedMessagingRole(actor)) return;
  throw new AppError("You are not allowed to manage messages", 403);
}

function actorCanReplyInConversation(actor, conversation) {
  if (!requiresScopedConversationVisibility(actor)) return true;
  if (conversation.type === "direct") return true;
  if (conversation.type === "broadcast") return false;
  if (actor.roles.includes("parent") && Number(conversation.allow_parent_reply) === 1) return true;
  if (actor.roles.includes("teacher") && Number(conversation.allow_teacher_reply) === 1) return true;
  return false;
}

export async function getScopedVisibleConversationIdSet(actorInput) {
  const actor = normalizeActor(actorInput);
  const ids = new Set();

  if (actor.roles.includes("teacher")) {
    const teacher = await repo.getTeacherByUserId(actor.userId);
    if (teacher?.id) {
      const teacherIds = await repo.getTeacherVisibleConversationIds({
        teacherId: teacher.id,
        classScope: teacher.class_scope || "school",
        staffType: teacher.staff_type || "teaching",
      });
      for (const id of teacherIds) ids.add(Number(id));
    }
  }

  if (actor.roles.includes("parent")) {
    const parentIds = await repo.getParentVisibleConversationIds(actor.userId);
    for (const id of parentIds) ids.add(Number(id));
  }

  return ids;
}

async function canViewConversation(actor, conversationId) {
  if (!(await repo.findMember(conversationId, actor.userId))) {
    return false;
  }
  if (!requiresScopedConversationVisibility(actor)) {
    return true;
  }

  const visibleIds = await getScopedVisibleConversationIdSet(actor);
  return visibleIds.has(Number(conversationId));
}

export async function assertCanViewConversation(actorInput, conversationId) {
  const actor = normalizeActor(actorInput);
  if (!(await canViewConversation(actor, conversationId))) {
    throw new AppError("Conversation not found", 404);
  }
}

async function getOrCreateDirectConversation(senderId, recipientUserId) {
  const existing = await repo.getDirectConversation(senderId, recipientUserId);
  if (existing?.id) return existing.id;

  const conversationId = await repo.createConversation({
    type: "direct",
    name: null,
    created_by: senderId
  });

  await repo.addConversationMembers(conversationId, [senderId, recipientUserId]);
  return conversationId;
}

async function getOrCreateScopedConversation(senderId, type, classId, sectionId, name) {
  const existing = await repo.getScopedConversation(type, classId, sectionId);
  if (existing?.id) return existing.id;

  const conversationId = await repo.createConversation({
    type,
    name,
    class_id: classId,
    section_id: sectionId,
    created_by: senderId
  });

  await repo.addConversationMember(conversationId, senderId);
  return conversationId;
}

async function getOrCreateBroadcastConversation(senderId, name) {
  const existing = await repo.getBroadcastConversation(name);
  if (existing?.id) return existing.id;

  const conversationId = await repo.createConversation({
    type: "broadcast",
    name,
    created_by: senderId
  });

  await repo.addConversationMember(conversationId, senderId);
  return conversationId;
}

async function getOrCreateAdminConversation(senderId) {
  const admin = await repo.getAdminRecipientUser();
  if (!admin?.user_id) {
    throw new AppError("No admin recipient is available", 404);
  }

  return getOrCreateDirectConversation(senderId, Number(admin.user_id));
}

function uniqueUserIds(rows) {
  return [...new Set((rows || []).map((row) => Number(row.user_id)).filter(Boolean))];
}

function messageNotificationPreview(message) {
  const messageType = String(message?.message_type || "text");
  if (messageType === "image") return "Sent a photo";
  if (messageType === "document") return "Sent a file";
  if (messageType === "voice") return "Sent a voice message";
  return String(message?.message || "").slice(0, 120);
}

async function syncTeacherMemberships(userId) {
  const teacher = await repo.getTeacherByUserId(userId);
  if (!teacher?.id) return;

  const conversationIds = await repo.getTeacherVisibleConversationIds({
    teacherId: teacher.id,
    classScope: teacher.class_scope || "school",
    staffType: teacher.staff_type || "teaching"
  });

  for (const conversationId of conversationIds) {
    await repo.addConversationMember(conversationId, userId);
  }
}

export async function sendMessage(data, actorInput, options = {}) {
  const actor = normalizeActor(actorInput);
  const senderUserId = actor.userId;

  if (!senderUserId) {
    throw new AppError("Sender is required", 400);
  }

  await repo.assertMessagingUserActive(senderUserId);

  const messageText = String(data?.message || "").trim();
  const attachmentIds = [...new Set((data?.attachment_ids || []).map(Number).filter(Boolean))];
  const forwardedFromMessageId = Number(data?.forwarded_from_message_id) || null;
  const replyToMessageId = Number(data?.reply_to_message_id) || null;

  if (!messageText && !attachmentIds.length && !forwardedFromMessageId) {
    throw new AppError("Message, attachment, or forwarded message is required", 400);
  }

  if (attachmentIds.length > 5) {
    throw new AppError("A message can contain at most five attachments", 400);
  }

  let conversationId = data.conversation_id ? Number(data.conversation_id) : null;

  if (!conversationId) {
    const targetType = data.target_type;
    const isAdminTarget = targetType === "admin";
    const allowInitiation = isAdminTarget
      ? isParentOrTeacher(actor) || hasPrivilegedMessagingRole(actor)
      : await canInitiateConversation(actor);
    if (!allowInitiation) {
      throw new AppError("Only super admin can start new conversations", 403);
    }

    if (!targetType) {
      throw new AppError("target_type is required for new conversation", 400);
    }

    if (targetType === "admin") {
      conversationId = await getOrCreateAdminConversation(senderUserId);
    } else if (["direct", "parent", "teacher"].includes(targetType)) {
      const recipientUserId = Number(data.recipient_user_id);
      if (!recipientUserId) throw new AppError("recipient_user_id is required", 400);
      conversationId = await getOrCreateDirectConversation(senderUserId, recipientUserId);
    } else if (targetType === "class") {
      const classId = Number(data.class_id);
      if (!classId) throw new AppError("class_id is required", 400);

      conversationId = await getOrCreateScopedConversation(
        senderUserId,
        "class",
        classId,
        null,
        data.name || `Class ${classId}`
      );

      const recipients = await repo.getClassRecipientUsers(classId);
      await repo.addConversationMembers(
        conversationId,
        recipients.map((r) => r.user_id)
      );
      await repo.removeTeacherMembersFromConversation(conversationId);
    } else if (targetType === "section") {
      const sectionId = Number(data.section_id);
      if (!sectionId) throw new AppError("section_id is required", 400);

      conversationId = await getOrCreateScopedConversation(
        senderUserId,
        "section",
        null,
        sectionId,
        data.name || `Section ${sectionId}`
      );

      const recipients = await repo.getSectionRecipientUsers(sectionId);
      await repo.addConversationMembers(
        conversationId,
        recipients.map((r) => r.user_id)
      );
      await repo.removeTeacherMembersFromConversation(conversationId);
    } else if (targetType === "broadcast") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || "All Users"
      );

      const recipients = await repo.getAllActiveUserRecipients();
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else if (targetType === "all_classes") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || "All Classes"
      );

      const recipients = await repo.getAllClassRecipientUsers();
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
      await repo.removeTeacherMembersFromConversation(conversationId);
    } else if (targetType === "all_sections") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || "All Sections"
      );

      const recipients = await repo.getAllSectionRecipientUsers();
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
      await repo.removeTeacherMembersFromConversation(conversationId);
    } else if (targetType === "all_parents") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name ||
          (data.parent_type === "college"
            ? "All College Parents"
            : data.parent_type === "school"
              ? "All School Parents"
              : "All Parents")
      );

      const recipients = await repo.getAllParentRecipientUsers(data.parent_type);
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else if (targetType === "all_teachers") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || teacherBroadcastName(data)
      );

      const recipients = await repo.getAllTeacherRecipientUsers({
        teacher_scope: normalizeTeacherScope(data.teacher_scope || data.teacher_type),
        staff_type: normalizeStaffType(data.staff_type),
      });
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else {
      throw new AppError("Unsupported target_type", 400);
    }
  }

  const isMember = await repo.findMember(conversationId, senderUserId);
  if (!isMember) {
    throw new AppError("You are not allowed to reply in this conversation", 403);
  }

  const conversation = await repo.getConversationById(conversationId);
  if (!conversation?.id) {
    throw new AppError("Conversation not found", 404);
  }

  if (!actorCanReplyInConversation(actor, conversation)) {
    throw new AppError("Replies are not enabled for this conversation", 403);
  }

  if (requiresScopedConversationVisibility(actor) && conversation.type === "direct") {
    const hasPrivilegedMember = await repo.conversationHasPrivilegedMember(conversationId);
    if (!hasPrivilegedMember) {
      throw new AppError("Parents and teachers can only message admin", 403);
    }
  }

  let attachments = [];
  if (attachmentIds.length) {
    attachments = await repo.getAttachmentsByIds(attachmentIds, senderUserId, {
      includePending: true,
    });
    if (attachments.length !== attachmentIds.length) {
      throw new AppError("One or more attachments are invalid", 400);
    }
    const categories = new Set(attachments.map((item) => item.category));
    if (categories.size !== 1) {
      throw new AppError("Photos and documents cannot be mixed in one message", 400);
    }
    if (categories.has("voice") && attachments.length !== 1) {
      throw new AppError("A voice message must contain one recording", 400);
    }
  }

  if (replyToMessageId) {
    const replyMessage = await repo.getMessageById(replyToMessageId);
    if (!replyMessage || Number(replyMessage.conversation_id) !== Number(conversationId)) {
      throw new AppError("Reply target must belong to the same conversation", 400);
    }
  }

  let forwardedMessage = null;
  if (forwardedFromMessageId) {
    forwardedMessage = await repo.getMessageById(forwardedFromMessageId);
    if (!forwardedMessage) throw new AppError("Forwarded message not found", 404);
    const canAccessForwarded = await repo.findMember(
      forwardedMessage.conversation_id,
      senderUserId
    );
    if (!canAccessForwarded) {
      throw new AppError("You cannot forward this message", 403);
    }
  }

  const messageType =
    attachments[0]?.category ||
    forwardedMessage?.message_type ||
    "text";

  const messageId = await repo.insertMessage({
    conversation_id: conversationId,
    sender_id: senderUserId,
    message: messageText || forwardedMessage?.message || null,
    message_type: messageType,
    reply_to_message_id: replyToMessageId,
    forwarded_from_message_id: forwardedFromMessageId,
    attachment_url: null,
  });

  await repo.attachPendingAttachments(messageId, attachmentIds, senderUserId);
  await repo.createMessageStatuses(messageId, conversationId, senderUserId);
  await repo.unhideConversationForMembers(conversationId);
  await repo.updateConversationLastMessage(conversationId);

  const memberUserIds = await repo.getConversationMemberUserIds(conversationId);
  publishConversationEvent(memberUserIds, {
    conversation_id: conversationId,
    message_id: messageId,
    sender_id: senderUserId,
  });

  const recipients = memberUserIds.filter((userId) => Number(userId) !== senderUserId);
  const preview = messageNotificationPreview({ message_type: messageType, message: messageText });

  if (recipients.length && !options.suppressNotification) {
    notificationService
      .notify({
        userIds: recipients,
        category: "message",
        type: "message",
        entityType: "message",
        entityId: messageId,
        title: conversation.name || "New message",
        body: preview,
        deepLink: `app://messages/conversations/${conversationId}`,
        actionUrl: `/messages?conversation_id=${conversationId}`,
      })
      .catch(() => {});
  }

  await repo.createMessagingAudit({
    actorUserId: senderUserId,
    action: forwardedFromMessageId ? "message.forwarded" : "message.sent",
    conversationId,
    messageId,
    metadata: { messageType, attachmentCount: attachments.length },
  });

  return {
    conversation_id: conversationId,
    message_id: messageId
  };
}

export async function fetchMessages(conversationId, actorInput, page = 1, limit = 30) {
  const actor = normalizeActor(actorInput);
  await assertCanViewConversation(actor, conversationId);
  const offset = (page - 1) * limit;
  await repo.markMessagesDelivered(conversationId, actor.userId);
  const rows = await repo.getConversationMessages(
    conversationId,
    limit,
    offset,
    actor.userId
  );
  const messageIds = rows.map((row) => Number(row.id));
  const forwardedIds = rows.map((row) => Number(row.forwarded_from_message_id)).filter(Boolean);
  const [attachments, forwardedAttachments, statuses] = await Promise.all([
    repo.getAttachmentsForMessageIds(messageIds),
    repo.getAttachmentsForMessageIds(forwardedIds),
    repo.getMessageStatuses(messageIds),
  ]);

  const attachmentMap = new Map();
  for (const attachment of attachments) {
    const key = Number(attachment.message_id);
    if (!attachmentMap.has(key)) attachmentMap.set(key, []);
    attachmentMap.get(key).push(attachment);
  }
  for (const attachment of forwardedAttachments) {
    const forwardedRows = rows.filter(
      (row) => Number(row.forwarded_from_message_id) === Number(attachment.message_id)
    );
    for (const row of forwardedRows) {
      if (!attachmentMap.has(Number(row.id))) attachmentMap.set(Number(row.id), []);
      attachmentMap.get(Number(row.id)).push({
        ...attachment,
        forwarded: true,
      });
    }
  }

  const statusMap = new Map();
  for (const status of statuses) {
    const key = Number(status.message_id);
    if (!statusMap.has(key)) statusMap.set(key, []);
    statusMap.get(key).push(status);
  }

  return rows.map((row) => ({
    ...row,
    message: row.deleted_for_everyone_at ? null : row.message,
    attachments: row.deleted_for_everyone_at
      ? []
      : attachmentMap.get(Number(row.id)) || [],
    statuses: statusMap.get(Number(row.id)) || [],
  }));
}

export async function fetchUserConversations(actorInput, filters = {}) {
  const actor = normalizeActor(actorInput);
  const userId = actor.userId;
  await repo.assertMessagingUserActive(userId);
  await syncTeacherMemberships(userId);
  const scopedVisibility = requiresScopedConversationVisibility(actor);
  const rawPage = Number(filters.page);
  const rawLimit = Number(filters.limit);
  const hasPagination = Number.isFinite(rawPage) || Number.isFinite(rawLimit);
  const page = Math.max(1, Number.isFinite(rawPage) ? Math.trunc(rawPage) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 25));
  const payload = await repo.getUserConversations(userId, scopedVisibility ? {} : filters);
  const rows = Array.isArray(payload) ? payload : payload?.data || [];
  const visibleIds = scopedVisibility
    ? await getScopedVisibleConversationIdSet(actor)
    : null;
  const visibleRows = visibleIds
    ? rows.filter((row) => visibleIds.has(Number(row.id)))
    : rows;
  const pageRows = scopedVisibility && hasPagination
    ? visibleRows.slice((page - 1) * limit, page * limit)
    : visibleRows;

  const mappedRows = pageRows.map((row) => {
    if (row.type !== "direct" || !row.other_user_id) {
      return row;
    }

    const presence = getUserPresence(row.other_user_id);
    return {
      ...row,
      other_user_id: Number(row.other_user_id),
      online: presence.online,
      last_seen_at: presence.last_seen_at,
    };
  });

  if (Array.isArray(payload) && !(scopedVisibility && hasPagination)) {
    return mappedRows;
  }

  return {
    data: mappedRows,
    pagination: scopedVisibility && hasPagination
      ? {
          page,
          limit,
          total: visibleRows.length,
          totalPages: Math.ceil(visibleRows.length / limit),
        }
      : payload?.pagination || null,
  };
}

export async function markRead(conversationId, actorInput) {
  const actor = normalizeActor(actorInput);
  const userId = actor.userId;
  await assertCanViewConversation(actor, conversationId);
  await repo.markConversationRead(conversationId, userId);
  await repo.markMessagesRead(conversationId, userId);
  const memberUserIds = await repo.getConversationMemberUserIds(conversationId);
  publishMessagingEvent(memberUserIds, "message:read", {
    conversation_id: Number(conversationId),
    user_id: Number(userId),
  });
}

export async function deleteConversationForMe(conversationId, actorInput) {
  const actor = normalizeActor(actorInput);
  await assertCanViewConversation(actor, conversationId);

  await repo.hideConversationForUser(conversationId, actor.userId);
  await notificationService.deleteMessageNotificationsForConversation({
    conversationId,
    userIds: [actor.userId],
  });
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "conversation.deleted_for_self",
    conversationId,
  });
  return { deleted: true, mode: "self" };
}

export async function updateConversation(conversationId, body, actorInput) {
  const actor = normalizeActor(actorInput);
  assertCanManageMessages(actor);

  const conversation = await repo.getConversationById(conversationId);
  if (!conversation?.id) {
    throw new AppError("Conversation not found", 404);
  }
  if (conversation.type === "direct") {
    throw new AppError("Direct conversation names cannot be edited", 400);
  }

  const name = String(body?.name || "").trim();
  if (!name) {
    throw new AppError("Conversation name is required", 400);
  }
  if (name.length > 120) {
    throw new AppError("Conversation name must be 120 characters or less", 400);
  }

  const allowParentReply = body?.allow_parent_reply === undefined
    ? Number(conversation.allow_parent_reply) === 1
    : body?.allow_parent_reply === true || body?.allow_parent_reply === 1 || body?.allow_parent_reply === "1";
  const allowTeacherReply = body?.allow_teacher_reply === undefined
    ? Number(conversation.allow_teacher_reply) === 1
    : body?.allow_teacher_reply === true || body?.allow_teacher_reply === 1 || body?.allow_teacher_reply === "1";

  await repo.updateConversationName(conversationId, name);
  await repo.updateConversationSettings(conversationId, {
    allow_parent_reply: conversation.type === "broadcast" ? false : allowParentReply,
    allow_teacher_reply: conversation.type === "broadcast" ? false : allowTeacherReply,
  });
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "conversation.updated",
    conversationId,
    metadata: {
      name,
      allow_parent_reply: conversation.type === "broadcast" ? false : allowParentReply,
      allow_teacher_reply: conversation.type === "broadcast" ? false : allowTeacherReply,
    },
  });

  return {
    ...conversation,
    name,
    allow_parent_reply: conversation.type === "broadcast" ? 0 : allowParentReply ? 1 : 0,
    allow_teacher_reply: conversation.type === "broadcast" ? 0 : allowTeacherReply ? 1 : 0,
  };
}

export async function unreadCounts(actorInput) {
  const actor = normalizeActor(actorInput);
  const rows = await repo.getUnreadCounts(actor.userId);
  if (!requiresScopedConversationVisibility(actor)) {
    return rows;
  }

  const visibleIds = await getScopedVisibleConversationIdSet(actor);
  return rows.filter((row) => visibleIds.has(Number(row.conversation_id)));
}

export async function getTargets(actorInput) {
  const actor = normalizeActor(actorInput);
  assertCanSendMessages(actor);
  const [parents, teachers, classes, sections] = await Promise.all([
    repo.getParentTargets(),
    repo.getTeacherTargets(),
    repo.getClassTargets(),
    repo.getSectionTargets()
  ]);

  return {
    parents,
    teachers,
    classes,
    sections,
    broadcast_targets: [
      { key: "broadcast", label: "All Users" },
      { key: "all_classes", label: "All Classes" },
      { key: "all_sections", label: "All Sections" },
      { key: "all_parents", label: "All Parents" },
      { key: "all_teachers", label: "All Staff" }
    ]
  };
}

export async function editMessage(messageId, message, actorInput) {
  const actor = normalizeActor(actorInput);
  assertCanSendMessages(actor);
  await repo.assertMessagingUserActive(actor.userId);
  const existing = await repo.getMessageById(messageId);
  if (!existing) throw new AppError("Message not found", 404);
  if (Number(existing.sender_id) !== actor.userId) {
    throw new AppError("Only the sender can edit this message", 403);
  }
  if (existing.deleted_for_everyone_at) {
    throw new AppError("Deleted messages cannot be edited", 400);
  }
  if (Date.now() - new Date(existing.created_at).getTime() > MESSAGE_CHANGE_WINDOW_MS) {
    throw new AppError("Messages can only be edited within one hour", 400);
  }
  const normalized = String(message || "").trim();
  if (!normalized) throw new AppError("Message text is required", 400);

  await repo.updateMessageText(messageId, normalized);
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "message.edited",
    conversationId: existing.conversation_id,
    messageId,
  });
  const memberUserIds = await repo.getConversationMemberUserIds(existing.conversation_id);
  publishMessagingEvent(memberUserIds, "message:updated", {
    conversation_id: existing.conversation_id,
    message_id: Number(messageId),
  });
  return { updated: true };
}

export async function deleteMessage(messageId, mode, actorInput) {
  const actor = normalizeActor(actorInput);
  const existing = await repo.getMessageById(messageId);
  if (!existing) throw new AppError("Message not found", 404);
  await assertCanViewConversation(actor, existing.conversation_id);

  if (mode === "self") {
    await repo.hideMessageForUser(messageId, actor.userId);
    await notificationService.deleteMessageNotificationsForMessage({
      messageId,
      conversationId: existing.conversation_id,
      legacyBody: messageNotificationPreview(existing),
      userIds: [actor.userId],
    });
    await repo.createMessagingAudit({
      actorUserId: actor.userId,
      action: "message.deleted_for_self",
      conversationId: existing.conversation_id,
      messageId,
    });
    return { deleted: true, mode: "self" };
  }

  if (mode !== "everyone") {
    throw new AppError("Delete mode must be self or everyone", 400);
  }

  const isModerator = await canInitiateConversation(actor);
  const isSender = Number(existing.sender_id) === actor.userId;
  if (!isSender && !isModerator) {
    throw new AppError("You cannot delete this message for everyone", 403);
  }
  if (
    isSender &&
    !isModerator &&
    Date.now() - new Date(existing.created_at).getTime() > MESSAGE_CHANGE_WINDOW_MS
  ) {
    throw new AppError("Messages can only be deleted for everyone within one hour", 400);
  }

  await repo.deleteMessageForEveryone(messageId, actor.userId);
  const memberUserIds = await repo.getConversationMemberUserIds(existing.conversation_id);
  await notificationService.deleteMessageNotificationsForMessage({
    messageId,
    conversationId: existing.conversation_id,
    legacyBody: messageNotificationPreview(existing),
    userIds: memberUserIds,
  });
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: isModerator && !isSender ? "message.moderator_removed" : "message.deleted_for_everyone",
    conversationId: existing.conversation_id,
    messageId,
  });
  publishMessagingEvent(memberUserIds, "message:deleted", {
    conversation_id: existing.conversation_id,
    message_id: Number(messageId),
  });
  return { deleted: true, mode: "everyone" };
}

export async function searchMessages(conversationId, search, actorInput, limit) {
  const actor = normalizeActor(actorInput);
  const normalized = String(search || "").trim();
  if (!normalized) return [];
  await assertCanViewConversation(actor, conversationId);
  return repo.searchConversationMessages(
    conversationId,
    actor.userId,
    normalized,
    limit
  );
}

export async function publishTyping(conversationId, isTyping, actorInput) {
  const actor = normalizeActor(actorInput);
  const conversation = await repo.getConversationById(conversationId);
  if (!conversation || conversation.type !== "direct") {
    throw new AppError("Typing indicators are only available in direct conversations", 400);
  }
  await assertCanViewConversation(actor, conversationId);
  if (!actorCanReplyInConversation(actor, conversation)) {
    throw new AppError("Replies are not enabled for this conversation", 403);
  }
  if (requiresScopedConversationVisibility(actor)) {
    const hasPrivilegedMember = await repo.conversationHasPrivilegedMember(conversationId);
    if (!hasPrivilegedMember) {
      throw new AppError("Parents and teachers can only message admin", 403);
    }
  }
  const members = await repo.getConversationMemberUserIds(conversationId);
  setConversationTyping(conversationId, actor.userId, Boolean(isTyping));
  publishMessagingEvent(
    members.filter((id) => Number(id) !== actor.userId),
    "typing:update",
    {
      conversation_id: Number(conversationId),
      user_id: actor.userId,
      is_typing: Boolean(isTyping),
    }
  );
  return { published: true };
}

export async function getTyping(conversationId, actorInput) {
  const actor = normalizeActor(actorInput);
  const conversation = await repo.getConversationById(conversationId);
  if (!conversation || conversation.type !== "direct") return { user_ids: [] };
  await assertCanViewConversation(actor, conversationId);
  return {
    user_ids: getConversationTyping(conversationId, actor.userId),
  };
}

export async function reportMessage(messageId, data, actorInput) {
  const actor = normalizeActor(actorInput);
  const message = await repo.getMessageById(messageId);
  if (!message) {
    throw new AppError("Message not found", 404);
  }
  await assertCanViewConversation(actor, message.conversation_id);
  const reason = String(data.reason || "").trim();
  if (!reason) throw new AppError("Report reason is required", 400);
  const reportId = await repo.createMessageReport({
    messageId,
    reportedBy: actor.userId,
    reason,
    details: String(data.details || "").trim() || null,
  });
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "message.reported",
    conversationId: message.conversation_id,
    messageId,
    metadata: { reportId, reason },
  });
  return { report_id: reportId };
}

export async function listReports(filters) {
  return repo.listMessageReports(filters);
}

export async function resolveReport(reportId, data, actorInput) {
  const actor = normalizeActor(actorInput);
  const status = String(data.status || "").trim();
  if (!["reviewing", "resolved", "dismissed"].includes(status)) {
    throw new AppError("Invalid report status", 400);
  }
  await repo.resolveMessageReport(
    reportId,
    actor.userId,
    status,
    String(data.note || "").trim() || null
  );
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "report.updated",
    metadata: { reportId: Number(reportId), status },
  });
  return { updated: true };
}

export async function suspendUser(userId, data, actorInput) {
  const actor = normalizeActor(actorInput);
  const targetUserId = Number(userId);
  if (!targetUserId) throw new AppError("User is required", 400);
  const reason = String(data.reason || "").trim();
  if (!reason) throw new AppError("Suspension reason is required", 400);
  await repo.setMessagingSuspension({
    userId: targetUserId,
    suspendedBy: actor.userId,
    reason,
    expiresAt: data.expires_at || null,
  });
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "user.suspended",
    targetUserId,
    metadata: { reason, expiresAt: data.expires_at || null },
  });
  return { suspended: true };
}

export async function unsuspendUser(userId, actorInput) {
  const actor = normalizeActor(actorInput);
  const targetUserId = Number(userId);
  await repo.liftMessagingSuspension(targetUserId, actor.userId);
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "user.unsuspended",
    targetUserId,
  });
  return { suspended: false };
}

export async function getAudit(filters) {
  return repo.listMessagingAudit(filters);
}

export async function exportConversation(conversationId) {
  const data = await repo.getConversationExport(conversationId);
  if (!data.conversation) throw new AppError("Conversation not found", 404);
  const attachments = await repo.getAttachmentsForMessageIds(
    data.messages.map((message) => message.id)
  );
  return { ...data, attachments };
}

export async function listConversationMembers(conversationId) {
  const conversation = await repo.getConversationById(conversationId);
  if (!conversation) throw new AppError("Conversation not found", 404);
  return repo.getConversationMembers(conversationId);
}

export async function addConversationMember(conversationId, userId, actorInput) {
  const actor = normalizeActor(actorInput);
  const conversation = await repo.getConversationById(conversationId);
  if (!conversation) throw new AppError("Conversation not found", 404);
  if (conversation.type === "direct") {
    throw new AppError("Direct conversation membership cannot be changed", 400);
  }
  const targetUserId = Number(userId);
  if (!targetUserId) throw new AppError("User is required", 400);
  await repo.addConversationMember(conversationId, targetUserId);
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "conversation.member_added",
    conversationId,
    targetUserId,
  });
  return repo.getConversationMembers(conversationId);
}

export async function removeConversationMember(conversationId, userId, actorInput) {
  const actor = normalizeActor(actorInput);
  const conversation = await repo.getConversationById(conversationId);
  if (!conversation) throw new AppError("Conversation not found", 404);
  const targetUserId = Number(userId);
  if (Number(conversation.created_by) === targetUserId) {
    throw new AppError("The conversation owner cannot be removed", 400);
  }
  await repo.removeConversationMember(conversationId, targetUserId);
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "conversation.member_removed",
    conversationId,
    targetUserId,
  });
  return repo.getConversationMembers(conversationId);
}

export async function removeAttachment(attachmentId, actorInput) {
  const actor = normalizeActor(actorInput);
  const attachment = await repo.getAttachmentById(attachmentId);
  if (!attachment) throw new AppError("Attachment not found", 404);
  await repo.markAttachmentRemoved(attachmentId);
  await repo.createMessagingAudit({
    actorUserId: actor.userId,
    action: "attachment.removed",
    conversationId: attachment.conversation_id,
    messageId: attachment.message_id,
    attachmentId: Number(attachmentId),
  });
  if (attachment.conversation_id) {
    const members = await repo.getConversationMemberUserIds(attachment.conversation_id);
    publishMessagingEvent(members, "message:updated", {
      conversation_id: attachment.conversation_id,
      message_id: attachment.message_id,
    });
  }
  return { removed: true };
}
