function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function RecentMessages({ messages = [] }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm h-full">
      <h3 className="font-semibold">Recent Conversations</h3>
      <div className="mt-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
        )}

        {messages.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <p className="font-medium">{item.conversation_name}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{item.last_message || "-"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTime(item.last_message_time)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
