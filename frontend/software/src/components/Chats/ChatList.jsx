import { User } from "lucide-react";
import { formatReadableDateTime } from "../../lib/dateTime";
import { resolveServerImageUrl } from "../../lib/serverImage";

function Avatar({ name, imageUrl, online = null }) {
  const resolvedImage = resolveServerImageUrl(imageUrl);
  const borderClass =
    online === null
      ? "border-border"
      : online
        ? "border-emerald-500"
        : "border-red-500";

  return (
    <div className={`relative shrink-0 rounded-full border-2 ${borderClass} p-[2px]`}>
      <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {resolvedImage ? (
          <img src={resolvedImage} alt={name || "User"} className="h-full w-full object-cover" />
        ) : (
          <User className="size-5" />
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

export default function ChatList({
  conversations,
  activeChatId,
  onSelect,
  onNewChat
}) {
  function statusMeta(conversation) {
    if (conversation?.type !== "direct") return null;
    return {
      online: Boolean(conversation?.online),
      detail: conversation?.online
        ? null
        : conversation?.last_seen_at
          ? `Last seen ${formatReadableDateTime(conversation.last_seen_at)}`
          : null,
    };
  }

  return (
    <div className="flex w-80 flex-col border-r bg-card">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-semibold">Chats</h2>
        {onNewChat ? (
          <button
            onClick={onNewChat}
            className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            New
          </button>
        ) : null}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const presence = statusMeta(conv);

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`
                cursor-pointer border-b p-4 transition-colors hover:bg-muted/60
                ${activeChatId === conv.id ? "bg-accent text-accent-foreground" : ""}
              `}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={conv.name}
                  imageUrl={conv.other_user_image_url}
                  online={presence ? presence.online : null}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{conv.name || `${conv.type} #${conv.id}`}</p>
                  {presence?.detail ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">{presence.detail}</p>
                  ) : null}
                  <p className="truncate text-xs text-muted-foreground">
                    {conv.last_message || "No messages yet"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
