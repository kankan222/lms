import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

export type AccountProfile = {
  id: number;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  created_at?: string;
  roles?: string[];
  name?: string;
};

export type UserListItem = {
  id: number;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  created_at?: string;
  roles?: string;
  teacher_name?: string | null;
  parent_name?: string | null;
  parent_classes?: string | null;
  parent_sections?: string | null;
};

export type UsersListResponse = {
  data: UserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString() ? `?${query.toString()}` : "";
}

export async function getMyAccount() {
  const response = await api.get<ApiEnvelope<AccountProfile>>("/users/me");
  return response.data.data;
}

export async function changeMyPassword(payload: { current_password: string; new_password: string }) {
  const response = await api.post("/users/me/change-password", payload);
  return response.data;
}

export async function getUsers(params: {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  class_id?: string | number;
  section_id?: string | number;
  search?: string;
} = {}) {
  const response = await api.get<ApiEnvelope<UserListItem[]>>(`/users${buildQuery(params)}`);
  return {
    data: response.data.data ?? [],
    pagination: response.data.pagination ?? {
      page: 1,
      limit: Number(params.limit || 5),
      total: 0,
      totalPages: 1,
    },
  } as UsersListResponse;
}

export async function updateUserStatus(userId: number | string, status: string) {
  const response = await api.patch(`/users/${userId}/status`, { status });
  return response.data;
}

export async function getUserRoles() {
  const response = await api.get<ApiEnvelope<Array<{ id?: number; name: string }>>>("/users/roles");
  return response.data.data ?? [];
}

export async function getPermissions() {
  const response = await api.get<ApiEnvelope<Array<{ id?: number; name: string }>>>("/users/permissions");
  return response.data.data ?? [];
}

export async function createUser(payload: {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  password: string;
  status: string;
  roles: string[];
}) {
  const response = await api.post("/users", payload);
  return response.data;
}

export async function adminResetPassword(payload: {
  user_id: number | string;
  new_password: string;
}) {
  const response = await api.post("/users/admin-reset-password", payload);
  return response.data;
}

export async function getUserPermissions(userId: number | string) {
  const response = await api.get<ApiEnvelope<Array<{ id?: number; name: string }>>>(`/users/${userId}/permissions`);
  return response.data.data ?? [];
}

export async function grantUserPermissions(userId: number | string, permissions: string[]) {
  const response = await api.post(`/users/${userId}/permissions`, { permissions });
  return response.data;
}
