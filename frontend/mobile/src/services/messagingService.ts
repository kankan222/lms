import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  conversation_id?: number;
  message_id?: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ConversationItem = {
  id: number;
  type: "direct" | "class" | "section" | "broadcast";
  name: string | null;
  class_id: number | null;
  section_id: number | null;
  other_user_id?: number | null;
  other_user_image_url?: string | null;
  last_message_at: string | null;
  last_message: string | null;
  unread: number;
  allow_parent_reply?: number | boolean | null;
  allow_teacher_reply?: number | boolean | null;
  online?: boolean;
  last_seen_at?: string | null;
};

export type MessageItem = {
  id: number;
  conversation_id: number;
  sender_id: number;
  username: string;
  sender_name?: string | null;
  sender_image_url?: string | null;
  message: string | null;
  message_type?: "text" | "image" | "document" | "voice";
  reply_to_message_id?: number | null;
  forwarded_from_message_id?: number | null;
  reply_message?: string | null;
  reply_message_type?: string | null;
  reply_sender_name?: string | null;
  attachment_url: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_for_everyone_at?: string | null;
  attachments?: MessageAttachment[];
  statuses?: MessageStatus[];
};

export type MessageAttachment = {
  id: number;
  message_id: number;
  category: "image" | "document" | "voice";
  original_name: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
  forwarded?: boolean;
};

export type MessageStatus = {
  message_id: number;
  user_id: number;
  status: "sent" | "delivered" | "read";
  delivered_at?: string | null;
  read_at?: string | null;
};

export type ParentTarget = {
  parent_id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  user_id: number;
  student_id?: number | null;
  student_name?: string | null;
  roll_number?: string | number | null;
  relationship?: string | null;
  class_id: number | null;
  section_id: number | null;
  class_name: string | null;
  section_name: string | null;
  medium?: string | null;
  class_scope?: string | null;
};

export type TeacherTarget = {
  teacher_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  user_id: number;
  class_id: number | null;
  section_id: number | null;
  class_name: string | null;
  section_name: string | null;
  medium?: string | null;
  class_medium?: string | null;
  class_scope?: string | null;
  type?: "school" | "college";
  staff_type?: "teaching" | "non_teaching" | string | null;
};

export type ClassTarget = {
  id: number;
  name: string;
  medium?: string | null;
  class_scope?: string | null;
};

export type SectionTarget = {
  id: number;
  name: string;
  class_id: number;
  class_name: string;
  medium?: string | null;
  class_scope?: string | null;
};

export type BroadcastTarget = {
  key: "broadcast" | "all_classes" | "all_sections" | "all_parents" | "all_teachers";
  label: string;
};

export type MessagingTargets = {
  parents: ParentTarget[];
  teachers: TeacherTarget[];
  classes: ClassTarget[];
  sections: SectionTarget[];
  broadcast_targets: BroadcastTarget[];
};

export type ConversationListResponse = {
  data: ConversationItem[];
  pagination: PaginationMeta | null;
};

export type SendMessagePayload = {
  conversation_id?: number;
  target_type?:
    | "direct"
    | "parent"
    | "teacher"
    | "class"
    | "section"
    | "broadcast"
    | "all_classes"
    | "all_sections"
    | "all_parents"
    | "all_teachers"
    | "admin";
  recipient_user_id?: number;
  class_id?: number;
  section_id?: number;
  teacher_type?: "all" | "school" | "college";
  teacher_scope?: "all" | "school" | "college";
  staff_type?: "all" | "teaching" | "non_teaching";
  parent_type?: "all" | "school" | "college";
  name?: string;
  message?: string;
  attachment_ids?: number[];
  reply_to_message_id?: number;
  forwarded_from_message_id?: number;
};

export type UploadAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

export async function getConversations(params: { page?: number; limit?: number } = {}) {
  const response = await api.get<ApiEnvelope<ConversationItem[]> & { pagination?: PaginationMeta }>(
    "/messages/conversations",
    { params },
  );
  return {
    data: response.data.data ?? [],
    pagination: response.data.pagination ?? null,
  } as ConversationListResponse;
}

export async function getMessages(conversationId: number, page = 1, limit = 30) {
  const response = await api.get<ApiEnvelope<MessageItem[]>>(`/messages/${conversationId}`, {
    params: { page, limit },
  });
  return response.data.data ?? [];
}

export async function getTargets() {
  const response = await api.get<ApiEnvelope<MessagingTargets>>("/messages/targets");
  return (
    response.data.data ?? {
      parents: [],
      teachers: [],
      classes: [],
      sections: [],
      broadcast_targets: [],
    }
  );
}

export async function sendMessage(payload: SendMessagePayload) {
  const response = await api.post<ApiEnvelope<unknown>>("/messages", payload);
  return {
    conversation_id: response.data.conversation_id ?? null,
    message_id: response.data.message_id ?? null,
  };
}

export async function uploadMessageAttachments(
  assets: UploadAsset[],
  category: "image" | "document" | "voice",
) {
  const body = new FormData();
  body.append("category", category);
  for (const asset of assets) {
    body.append(
      "files",
      {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
      } as unknown as Blob,
    );
  }
  const response = await api.post<ApiEnvelope<MessageAttachment[]>>("/messages/attachments", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data ?? [];
}

export async function getAttachmentAccess(attachmentId: number, variant = "original") {
  const response = await api.get<ApiEnvelope<MessageAttachment & { access_url: string; expires_in: number }>>(
    `/messages/attachments/${attachmentId}/access`,
    { params: { variant } },
  );
  return response.data.data;
}

export async function editMessage(messageId: number, message: string) {
  await api.patch(`/messages/messages/${messageId}`, { message });
}

export async function deleteMessage(messageId: number, mode: "self" | "everyone") {
  await api.delete(`/messages/messages/${messageId}`, { data: { mode } });
}

export async function deleteConversation(conversationId: number) {
  await api.delete(`/messages/conversations/${conversationId}`);
}

export async function updateConversation(conversationId: number, payload: { name: string }) {
  const response = await api.patch<ApiEnvelope<ConversationItem>>(`/messages/conversations/${conversationId}`, payload);
  return response.data.data;
}

export async function reportMessage(messageId: number, reason: string, details = "") {
  await api.post(`/messages/messages/${messageId}/report`, { reason, details });
}

export async function searchMessages(conversationId: number, query: string) {
  const response = await api.get<ApiEnvelope<MessageItem[]>>(
    `/messages/conversations/${conversationId}/search`,
    { params: { q: query } },
  );
  return response.data.data ?? [];
}

export async function sendTyping(conversationId: number, isTyping: boolean) {
  await api.post(`/messages/conversations/${conversationId}/typing`, {
    is_typing: isTyping,
  });
}

export async function getTyping(conversationId: number) {
  const response = await api.get<ApiEnvelope<{ user_ids: number[] }>>(
    `/messages/conversations/${conversationId}/typing`,
  );
  return response.data.data?.user_ids ?? [];
}

export async function getUnreadMessageTotal() {
  const response = await api.get<ApiEnvelope<Array<{ conversation_id: number; unread: number }>>>("/messages/unread/count");
  const rows = response.data.data ?? [];
  return rows.reduce((sum, row) => sum + Number(row.unread || 0), 0);
}

export async function markAsRead(conversationId: number) {
  const response = await api.post<ApiEnvelope<unknown>>("/messages/read", {
    conversation_id: conversationId,
  });
  return response.data.success;
}
