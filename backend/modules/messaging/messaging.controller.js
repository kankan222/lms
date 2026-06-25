import * as service from "./messaging.service.js";
import * as mediaService from "./messaging.media.service.js";
import { registerMessagingClient } from "./messaging.realtime.js";

export async function sendMessage(req, res, next) {
  try {
    const result = await service.sendMessage(req.body, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req, res, next) {
  try {
    const conversationId = Number(req.params.conversationId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 30));

    const messages = await service.fetchMessages(conversationId, req.user, page, limit);
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

export async function getConversations(req, res, next) {
  try {
    const userId = req.user.userId;
    const filters = {};
    if (req.query.page !== undefined) filters.page = req.query.page;
    if (req.query.limit !== undefined) filters.limit = req.query.limit;

    const data = await service.fetchUserConversations(userId, filters);
    if (data && typeof data === "object" && Array.isArray(data.data)) {
      return res.json({ success: true, data: data.data, pagination: data.pagination || null });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.userId;
    const { conversation_id } = req.body;
    await service.markRead(conversation_id, userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function unreadMessages(req, res, next) {
  try {
    const userId = req.user.userId;
    const data = await service.unreadCounts(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTargets(req, res, next) {
  try {
    const data = await service.getTargets();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export function streamMessages(req, res) {
  if (!req.user?.permissions?.includes("messages.view")) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unregister = registerMessagingClient(req.user.userId, res);

  req.on("close", () => {
    unregister();
    res.end();
  });
}

export async function uploadAttachments(req, res, next) {
  try {
    const data = await mediaService.uploadAttachments(req.files, req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttachmentAccess(req, res, next) {
  try {
    const access = await mediaService.getAttachmentAccess(
      Number(req.params.attachmentId),
      req.user.userId,
      req.query.variant
    );
    res.json({
      success: true,
      data: {
        ...access.attachment,
        access_url:
          access.signedUrl ||
          `/api/v1/message-media/${access.attachment.id}?token=${encodeURIComponent(
            mediaService.createLocalMediaToken(access)
          )}`,
        expires_in: 300,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function streamAttachment(req, res, next) {
  try {
    const access = await mediaService.getAttachmentAccess(
      Number(req.params.attachmentId),
      req.user.userId,
      req.query.variant
    );
    if (access.signedUrl) {
      return res.redirect(302, access.signedUrl);
    }
    res.type(access.mimeType);
    return res.sendFile(access.localPath);
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req, res, next) {
  try {
    const data = await service.editMessage(req.params.messageId, req.body.message, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const data = await service.deleteMessage(
      req.params.messageId,
      req.body.mode,
      req.user
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function searchMessages(req, res, next) {
  try {
    const data = await service.searchMessages(
      Number(req.params.conversationId),
      req.query.q,
      req.user,
      req.query.limit
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function typing(req, res, next) {
  try {
    const data = await service.publishTyping(
      Number(req.params.conversationId),
      req.body.is_typing,
      req.user
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTyping(req, res, next) {
  try {
    const data = await service.getTyping(Number(req.params.conversationId), req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function reportMessage(req, res, next) {
  try {
    const data = await service.reportMessage(req.params.messageId, req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listReports(req, res, next) {
  try {
    const data = await service.listReports(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resolveReport(req, res, next) {
  try {
    const data = await service.resolveReport(req.params.reportId, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req, res, next) {
  try {
    const data = await service.suspendUser(req.params.userId, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function unsuspendUser(req, res, next) {
  try {
    const data = await service.unsuspendUser(req.params.userId, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAudit(req, res, next) {
  try {
    const data = await service.getAudit(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportConversation(req, res, next) {
  try {
    const data = await service.exportConversation(Number(req.params.conversationId));
    const format = String(req.query.format || "json").toLowerCase();
    if (format === "csv") {
      const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = [
        ["id", "sender_id", "sender_name", "type", "message", "created_at"],
        ...data.messages.map((message) => [
          message.id,
          message.sender_id,
          message.sender_name,
          message.message_type,
          message.message,
          message.created_at,
        ]),
      ];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="conversation-${req.params.conversationId}.csv"`
      );
      return res.send(rows.map((row) => row.map(escape).join(",")).join("\n"));
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="conversation-${req.params.conversationId}.json"`
    );
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listConversationMembers(req, res, next) {
  try {
    const data = await service.listConversationMembers(Number(req.params.conversationId));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addConversationMember(req, res, next) {
  try {
    const data = await service.addConversationMember(
      Number(req.params.conversationId),
      req.body.user_id,
      req.user
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function removeConversationMember(req, res, next) {
  try {
    const data = await service.removeConversationMember(
      Number(req.params.conversationId),
      Number(req.params.userId),
      req.user
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function removeAttachment(req, res, next) {
  try {
    const data = await service.removeAttachment(Number(req.params.attachmentId), req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
