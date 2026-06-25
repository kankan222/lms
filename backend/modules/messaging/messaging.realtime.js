const userClients = new Map();
const userPresence = new Map();
const conversationTyping = new Map();

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getPresenceRecord(userId) {
  const key = Number(userId);
  return (
    userPresence.get(key) || {
      online: false,
      last_seen_at: null,
    }
  );
}

function updatePresence(userId, nextRecord) {
  const key = Number(userId);
  const prev = getPresenceRecord(key);
  const next = {
    online: Boolean(nextRecord.online),
    last_seen_at: toIsoString(nextRecord.last_seen_at),
  };

  userPresence.set(key, next);

  if (prev.online !== next.online || prev.last_seen_at !== next.last_seen_at) {
    broadcast("presence:update", {
      user_id: key,
      online: next.online,
      last_seen_at: next.last_seen_at,
    });
  }
}

function broadcast(event, payload) {
  for (const clients of userClients.values()) {
    for (const client of clients) {
      writeEvent(client, event, payload);
    }
  }
}

function ensureClientSet(userId) {
  const key = Number(userId);
  if (!userClients.has(key)) {
    userClients.set(key, new Set());
  }
  return userClients.get(key);
}

export function getUserPresence(userId) {
  const key = Number(userId);
  return {
    user_id: key,
    ...getPresenceRecord(key),
  };
}

export function registerMessagingClient(userId, res) {
  const key = Number(userId);
  const clients = ensureClientSet(key);
  clients.add(res);

  updatePresence(key, {
    online: true,
    last_seen_at: null,
  });

  writeEvent(res, "presence:sync", {
    user_id: key,
    online: true,
    last_seen_at: null,
  });

  const keepAliveId = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25000);

  return () => {
    clearInterval(keepAliveId);

    const currentClients = userClients.get(key);
    if (currentClients) {
      currentClients.delete(res);
      if (currentClients.size === 0) {
        userClients.delete(key);
        updatePresence(key, {
          online: false,
          last_seen_at: new Date(),
        });
      }
    }
  };
}

export function publishConversationEvent(userIds, payload) {
  publishMessagingEvent(userIds, "message:new", payload);
}

export function publishMessagingEvent(userIds, event, payload) {
  const uniqueUserIds = [...new Set((userIds || []).map((value) => Number(value)).filter(Boolean))];

  for (const userId of uniqueUserIds) {
    const clients = userClients.get(userId);
    if (!clients?.size) continue;

    for (const client of clients) {
      writeEvent(client, event, payload);
    }
  }
}

export function setConversationTyping(conversationId, userId, isTyping) {
  const conversationKey = Number(conversationId);
  const userKey = Number(userId);
  if (!conversationTyping.has(conversationKey)) {
    conversationTyping.set(conversationKey, new Map());
  }
  const users = conversationTyping.get(conversationKey);
  if (isTyping) {
    users.set(userKey, Date.now() + 5000);
  } else {
    users.delete(userKey);
  }
  if (!users.size) conversationTyping.delete(conversationKey);
}

export function getConversationTyping(conversationId, excludeUserId) {
  const conversationKey = Number(conversationId);
  const users = conversationTyping.get(conversationKey);
  if (!users) return [];
  const now = Date.now();
  const result = [];
  for (const [userId, expiresAt] of users.entries()) {
    if (expiresAt <= now) {
      users.delete(userId);
    } else if (Number(userId) !== Number(excludeUserId)) {
      result.push(Number(userId));
    }
  }
  if (!users.size) conversationTyping.delete(conversationKey);
  return result;
}
