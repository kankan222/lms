import { useEffect, useRef, useState } from "react";
import {
  File,
  FileImage,
  Flag,
  Forward,
  Mic,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { formatReadableDateTime } from "../../lib/dateTime";
import { resolveServerImageUrl } from "../../lib/serverImage";
import { getAttachmentAccess } from "../../api/messaging.api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

function resolveAccessUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function Avatar({ name, imageUrl, online = null, size = "md" }) {
  const resolvedImage = resolveServerImageUrl(imageUrl);
  const borderClass =
    online === null ? "border-border" : online ? "border-emerald-500" : "border-red-500";
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
        />
      ) : null}
    </div>
  );
}

function Attachment({ attachment, canModerate, onRemove }) {
  const [url, setUrl] = useState("");
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    let active = true;
    getAttachmentAccess(attachment.id)
      .then((response) => {
        if (active) setUrl(resolveAccessUrl(response?.data?.access_url));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attachment.id]);

  if (!url) {
    return <div className="mt-2 text-xs opacity-70">Loading attachment...</div>;
  }

  const removeButton = canModerate ? (
    <button
      type="button"
      className="mt-1 text-[10px] text-destructive underline"
      onClick={() => onRemove(attachment)}
    >
      Remove attachment
    </button>
  ) : null;

  if (attachment.category === "image") {
    return (
      <div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
          <img
            src={url}
            alt={attachment.original_name || "Photo"}
            className="max-h-72 max-w-full rounded-xl object-contain"
          />
        </a>
        {removeButton}
      </div>
    );
  }

  if (attachment.category === "voice") {
    return (
      <div>
        <div className="mt-2 flex min-w-64 items-center gap-2 rounded-lg bg-background/70 p-2 text-foreground">
        <audio ref={audioRef} src={url} controls className="h-9 min-w-0 flex-1" />
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs"
          onClick={() => {
            const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
            setSpeed(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }}
        >
          {speed}x
        </button>
        </div>
        {removeButton}
      </div>
    );
  }

  return (
    <div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center gap-2 rounded-lg border bg-background/70 p-3 text-foreground"
      >
        <File className="size-5" />
        <span className="min-w-0 flex-1 truncate text-xs">{attachment.original_name}</span>
        <span className="text-[10px] opacity-70">
          {Math.ceil(Number(attachment.file_size || 0) / 1024)} KB
        </span>
      </a>
      {removeButton}
    </div>
  );
}

function Receipt({ statuses = [] }) {
  if (!statuses.length) return null;
  const read = statuses.filter((item) => item.status === "read").length;
  const delivered = statuses.filter((item) => ["delivered", "read"].includes(item.status)).length;
  return (
    <span>
      {read === statuses.length
        ? `Read ${read}/${statuses.length}`
        : delivered
          ? `Delivered ${delivered}/${statuses.length}`
          : "Sent"}
    </span>
  );
}

export default function ChatWindow({
  chat,
  messages = [],
  currentUserId,
  conversations = [],
  typingUser,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReportMessage,
  onForwardMessage,
  onSearch,
  onTyping,
  canModerate,
  canSendMessages = true,
  onRemoveAttachment,
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [search, setSearch] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      recorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

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

  const clearMedia = () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setFiles([]);
    setCategory(null);
    setRecordingUrl("");
  };

  const handleSend = async () => {
    if (!canSendMessages) return;
    if (!input.trim() && !files.length) return;
    await onSendMessage({
      message: input.trim(),
      files,
      category,
      reply_to_message_id: replyTo?.id || null,
    });
    setInput("");
    setReplyTo(null);
    clearMedia();
  };

  const selectFiles = (event, nextCategory) => {
    const selected = Array.from(event.target.files || []).slice(0, 5);
    setFiles(selected);
    setCategory(nextCategory);
    setRecordingUrl("");
    event.target.value = "";
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = mimeType === "audio/webm" ? "webm" : "m4a";
      const file = new window.File([blob], `voice-${Date.now()}.${extension}`, {
        type: mimeType,
      });
      setFiles([file]);
      setCategory("voice");
      setRecordingUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const presence = statusMeta();
  const orderedMessages = [...messages].reverse();

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={chat.name}
            imageUrl={chat.other_user_image_url}
            online={presence ? presence.online : null}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{chat.name}</h3>
            {typingUser ? (
              <p className="mt-1 text-xs text-primary">Typing...</p>
            ) : presence?.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">{presence.detail}</p>
            ) : null}
          </div>
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch(search);
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-40 rounded-md border bg-background px-2 py-1.5 text-xs"
            />
            <button type="submit" className="rounded-md p-2 hover:bg-muted">
              <Search className="size-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
        {orderedMessages.map((msg) => {
          const mine = Number(msg.sender_id) === Number(currentUserId);
          const deleted = Boolean(msg.deleted_for_everyone_at);
          return (
            <div key={msg.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="flex max-w-[75%] items-end gap-2">
                {!mine ? (
                  <Avatar name={msg.sender_name || msg.username} imageUrl={msg.sender_image_url} size="sm" />
                ) : null}
                <div>
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "border bg-card text-card-foreground"
                    }`}
                  >
                    {!mine ? (
                      <div className="mb-1 text-[11px] font-medium opacity-80">
                        {msg.sender_name || msg.username || "User"}
                      </div>
                    ) : null}
                    {msg.reply_to_message_id ? (
                      <div className="mb-2 rounded-lg border-l-2 bg-background/20 px-2 py-1 text-xs opacity-80">
                        {msg.reply_sender_name || "Reply"}: {msg.reply_message || msg.reply_message_type}
                      </div>
                    ) : null}
                    {msg.forwarded_from_message_id ? (
                      <div className="mb-1 text-[10px] italic opacity-70">Forwarded</div>
                    ) : null}
                    {deleted ? (
                      <div className="italic opacity-70">This message was deleted</div>
                    ) : (
                      <>
                        {msg.message ? <div className="whitespace-pre-wrap">{msg.message}</div> : null}
                        {(msg.attachments || []).map((attachment) => (
                          <Attachment
                            key={`${msg.id}-${attachment.id}`}
                            attachment={attachment}
                            canModerate={canModerate}
                            onRemove={onRemoveAttachment}
                          />
                        ))}
                      </>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                      {msg.edited_at ? <span>Edited</span> : null}
                      <span>{formatReadableDateTime(msg.created_at)}</span>
                      {mine ? <Receipt statuses={msg.statuses} /> : null}
                    </div>
                  </div>
                  {!deleted && canSendMessages ? (
                    <div className={`mt-1 hidden gap-1 group-hover:flex ${mine ? "justify-end" : ""}`}>
                      <button title="Reply" onClick={() => setReplyTo(msg)}><Reply className="size-3.5" /></button>
                      <button title="Forward" onClick={() => onForwardMessage(msg, conversations)}><Forward className="size-3.5" /></button>
                      {mine && msg.message ? (
                        <button title="Edit" onClick={() => onEditMessage(msg)}><Pencil className="size-3.5" /></button>
                      ) : null}
                      <button title="Delete" onClick={() => onDeleteMessage(msg)}><Trash2 className="size-3.5" /></button>
                      {!mine ? (
                        <button title="Report" onClick={() => onReportMessage(msg)}><Flag className="size-3.5" /></button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t bg-card p-3">
        {!canSendMessages ? (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Parents and teachers can view super admin messages only.
          </div>
        ) : (
          <>
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border-l-4 border-primary bg-muted px-3 py-2 text-xs">
            <span className="truncate">Replying to {replyTo.sender_name || replyTo.username}: {replyTo.message || replyTo.message_type}</span>
            <button onClick={() => setReplyTo(null)}><X className="size-4" /></button>
          </div>
        ) : null}
        {files.length ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-xs">
            {category === "image" ? <FileImage className="size-4" /> : category === "voice" ? <Mic className="size-4" /> : <File className="size-4" />}
            <span className="min-w-0 flex-1 truncate">
              {files.map((item) => item.name).join(", ")}
            </span>
            {recordingUrl ? <audio src={recordingUrl} controls className="h-8 max-w-64" /> : null}
            <button onClick={clearMedia}><X className="size-4" /></button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer rounded-lg p-2 hover:bg-muted" title="Add photos">
            <FileImage className="size-5" />
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.bmp,.tif,.tiff,image/*"
              className="hidden"
              onChange={(event) => selectFiles(event, "image")}
            />
          </label>
          <label className="cursor-pointer rounded-lg p-2 hover:bg-muted" title="Add documents">
            <Paperclip className="size-5" />
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.txt"
              className="hidden"
              onChange={(event) => selectFiles(event, "document")}
            />
          </label>
          <button
            type="button"
            className={`rounded-lg p-2 ${recording ? "bg-destructive text-destructive-foreground" : "hover:bg-muted"}`}
            title={recording ? "Stop recording" : "Record voice note"}
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? <X className="size-5" /> : <Mic className="size-5" />}
          </button>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (chat.type === "direct") {
                onTyping(true);
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => onTyping(false), 1200);
              }
            }}
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-y rounded-lg border bg-background px-4 py-2 text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder="Type a message or add a caption..."
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && !files.length}
            className="rounded-lg bg-primary p-2.5 text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-5" />
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
