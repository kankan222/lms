const notificationClients = new Map();

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerNotificationClient(userId, res) {
  const key = Number(userId);
  const clients = notificationClients.get(key) || new Set();
  clients.add(res);
  notificationClients.set(key, clients);

  writeEvent(res, "notification:ready", {
    ok: true,
    user_id: key,
    connected_at: new Date().toISOString(),
  });

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": ping\n\n");
    }
  }, 25000);

  return () => {
    clearInterval(keepAlive);
    const current = notificationClients.get(key);
    if (!current) return;
    current.delete(res);
    if (!current.size) {
      notificationClients.delete(key);
    }
  };
}

export function publishNotificationEvent(userIds = [], payload = {}) {
  const uniqueIds = [...new Set((userIds || []).map((value) => Number(value)).filter(Boolean))];

  for (const userId of uniqueIds) {
    const clients = notificationClients.get(userId);
    if (!clients?.size) continue;

    for (const client of clients) {
      writeEvent(client, payload.event || "notification:update", payload);
    }
  }
}
