import * as repo from "./messaging.repository.js";
import { getUserPresence, publishConversationEvent } from "./messaging.realtime.js";

function normalizeActor(actor) {
  if (typeof actor === "number") {
    return { userId: actor, roles: [] };
  }

  return {
    userId: Number(actor?.userId || actor?.id),
    roles: Array.isArray(actor?.roles) ? actor.roles : [],
  };
}

async function canInitiateConversation(actor) {
  if (actor.roles.includes("super_admin")) {
    return true;
  }

  return repo.isSuperAdminUser(actor.userId);
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

function uniqueUserIds(rows) {
  return [...new Set((rows || []).map((row) => Number(row.user_id)).filter(Boolean))];
}

async function syncTeacherMemberships(userId) {
  const teacher = await repo.getTeacherByUserId(userId);
  if (!teacher?.id) return;

  const conversationIds = await repo.getTeacherVisibleConversationIds({
    teacherId: teacher.id,
    classScope: teacher.class_scope || "school"
  });

  for (const conversationId of conversationIds) {
    await repo.addConversationMember(conversationId, userId);
  }
}

export async function sendMessage(data, actorInput) {
  const actor = normalizeActor(actorInput);
  const senderUserId = actor.userId;

  if (!senderUserId) {
    throw new Error("Sender is required");
  }

  if (!data?.message || !String(data.message).trim()) {
    throw new Error("Message is required");
  }

  let conversationId = data.conversation_id ? Number(data.conversation_id) : null;

  if (!conversationId) {
    const allowInitiation = await canInitiateConversation(actor);
    if (!allowInitiation) {
      throw new Error("Only super admin can start new conversations");
    }

    const targetType = data.target_type;

    if (!targetType) {
      throw new Error("target_type is required for new conversation");
    }

    if (["direct", "parent", "teacher"].includes(targetType)) {
      const recipientUserId = Number(data.recipient_user_id);
      if (!recipientUserId) throw new Error("recipient_user_id is required");
      conversationId = await getOrCreateDirectConversation(senderUserId, recipientUserId);
    } else if (targetType === "class") {
      const classId = Number(data.class_id);
      if (!classId) throw new Error("class_id is required");

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
    } else if (targetType === "section") {
      const sectionId = Number(data.section_id);
      if (!sectionId) throw new Error("section_id is required");

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
    } else if (targetType === "all_sections") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || "All Sections"
      );

      const recipients = await repo.getAllSectionRecipientUsers();
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else if (targetType === "all_parents") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name || "All Parents"
      );

      const recipients = await repo.getAllParentRecipientUsers();
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else if (targetType === "all_teachers") {
      conversationId = await getOrCreateBroadcastConversation(
        senderUserId,
        data.name ||
          (data.teacher_type === "college"
            ? "All College Teachers"
            : data.teacher_type === "school"
              ? "All School Teachers"
              : "All Teachers")
      );

      const recipients = await repo.getAllTeacherRecipientUsers(data.teacher_type);
      await repo.addConversationMembers(conversationId, uniqueUserIds(recipients));
    } else {
      throw new Error("Unsupported target_type");
    }
  }

  const isMember = await repo.findMember(conversationId, senderUserId);
  if (!isMember) {
    throw new Error("You are not allowed to reply in this conversation");
  }

  const allowInitiation = await canInitiateConversation(actor);
  if (!allowInitiation) {
    const conversation = await repo.getConversationById(conversationId);
    if (!conversation?.id) {
      throw new Error("Conversation not found");
    }

    const adminOwned = await repo.isSuperAdminUser(conversation.created_by);
    if (!adminOwned) {
      throw new Error("You can only reply to conversations started by super admin");
    }
  }

  const messageId = await repo.insertMessage({
    conversation_id: conversationId,
    sender_id: senderUserId,
    message: data.message,
    attachment_url: data.attachment_url || null
  });

  await repo.updateConversationLastMessage(conversationId);

  const memberUserIds = await repo.getConversationMemberUserIds(conversationId);
  publishConversationEvent(memberUserIds, {
    conversation_id: conversationId,
    message_id: messageId,
    sender_id: senderUserId,
  });

  return {
    conversation_id: conversationId,
    message_id: messageId
  };
}

export async function fetchMessages(conversationId, page = 1, limit = 30) {
  const offset = (page - 1) * limit;
  return repo.getConversationMessages(conversationId, limit, offset);
}

export async function fetchUserConversations(userId) {
  await syncTeacherMemberships(userId);
  const rows = await repo.getUserConversations(userId);

  return rows.map((row) => {
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
}

export async function markRead(conversationId, userId) {
  await repo.markConversationRead(conversationId, userId);
}

export async function unreadCounts(userId) {
  return repo.getUnreadCounts(userId);
}

export async function getTargets() {
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
      { key: "all_teachers", label: "All Teachers" }
    ]
  };
}
