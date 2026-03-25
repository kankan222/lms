import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  conversation_id?: number;
  message_id?: number;
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
  message: string;
  attachment_url: string | null;
  created_at: string;
};

export type ParentTarget = {
  parent_id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  user_id: number;
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
    | "all_teachers";
  recipient_user_id?: number;
  class_id?: number;
  section_id?: number;
  teacher_type?: "all" | "school" | "college";
  name?: string;
  message: string;
  attachment_url?: string;
};

export async function getConversations() {
  const response = await api.get<ApiEnvelope<ConversationItem[]>>("/messages/conversations");
  return response.data.data ?? [];
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

export async function markAsRead(conversationId: number) {
  const response = await api.post<ApiEnvelope<unknown>>("/messages/read", {
    conversation_id: conversationId,
  });
  return response.data.success;
}
