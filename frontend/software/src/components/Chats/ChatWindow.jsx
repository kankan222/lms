import { useState } from "react";
import { User } from "lucide-react";
import { formatReadableDateTime } from "../../lib/dateTime";
import { resolveServerImageUrl } from "../../lib/serverImage";

function Avatar({ name, imageUrl, online = null, size = "md" }) {
  const resolvedImage = resolveServerImageUrl(imageUrl);
  const borderClass =
    online === null
      ? "border-border"
      : online
        ? "border-emerald-500"
        : "border-red-500";
  const shellSize = size === "sm" ? "size-8" : "size-11";
  const iconSize = size === "sm" ? "size-4" : "size-5";

  return (
    <div className={`relative shrink-0 rounded-full border-2 ${borderClass} p-[2px]`}>
      <div className={`flex ${shellSize} items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground`}>
        {resolvedImage ? (
          <img src={resolvedImage} alt={name || "User"} className="h-full w-full object-cover" />
        ) : (
          <User className={iconSize} />
        )}
      </div>
      {online !== null ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 inline-block size-3 rounded-full border-2 border-card ${
            online ? "bg-emerald-500" : "bg-red-500"
          }`}
          aria-label={online ? "Online" : "Offline"}
        />
      ) : null}
    </div>
  );
}

export default function ChatWindow({ chat, messages = [], currentUserId, onSendMessage }) {
  const [input, setInput] = useState("");

  function statusMeta() {
    if (chat?.type !== "direct") return null;
    return {
      online: Boolean(chat?.online),
      detail: chat?.online
        ? null
        : chat?.last_seen_at
          ? `Last seen ${formatReadableDateTime(chat.last_seen_at)}`
          : null,
    };
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a conversation
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  const presence = statusMeta();
  const orderedMessages = [...messages].reverse();

  return (
    <div className="flex flex-1 flex-col bg-background">

      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={chat.name}
            imageUrl={chat.other_user_image_url}
            online={presence ? presence.online : null}
          />
          <div>
            <h3 className="font-semibold">{chat.name}</h3>
            {presence?.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">{presence.detail}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
        {orderedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              Number(msg.sender_id) === Number(currentUserId) ? "justify-end" : "justify-start"
            }`}
          >
            <div className="flex max-w-sm items-end gap-2">
              {Number(msg.sender_id) === Number(currentUserId) ? null : (
                <Avatar name={msg.sender_name || msg.username} imageUrl={msg.sender_image_url} size="sm" />
              )}
              <div
                className={`
                  rounded-2xl px-4 py-2 text-sm
                  ${
                    Number(msg.sender_id) === Number(currentUserId)
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card text-card-foreground"
                  }
                `}
              >
                {Number(msg.sender_id) === Number(currentUserId) ? null : (
                  <div className="mb-1 text-[11px] font-medium opacity-80">
                    {msg.sender_name || msg.username || "User"}
                  </div>
                )}
                <div>{msg.message}</div>
                <div className="mt-1 text-[10px] opacity-70">
                  {formatReadableDateTime(msg.created_at)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t bg-card p-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border bg-background px-4 py-2 text-foreground outline-hidden transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Send
        </button>
      </div>
    </div>
  );
}
