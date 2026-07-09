import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "./api";
import { ENV } from "../constants/env";
import { useAuthStore } from "../store/authStore";

type ApiEnvelope<T> = {
  success?: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaymentItem = {
  id: number;
  receipt_serial?: string | null;
  student_fee_id: number;
  amount_paid: number;
  remarks: string | null;
  status: string;
  fee_status?: string | null;
  created_at: string;
  payment_date?: string | null;
  fee_type: string;
  fee_mode?: "amount_based" | "status_only" | string | null;
  installment_name?: string | null;
  fee_name?: string | null;
  fee_amount: number;
  student_id: number;
  student_name: string;
  class_name: string;
  stream_id?: number | null;
  stream_name?: string | null;
  section_name: string;
  medium?: string | null;
  class_scope?: "school" | "hs" | string | null;
};

export type StudentFeeOption = {
  id: number;
  fee_type: string;
  fee_mode?: "amount_based" | "status_only" | string | null;
  amount: number;
  status: string;
  installment_name?: string | null;
  fee_name?: string | null;
  due_date?: string | null;
  paid: number;
  remaining: number;
};

export type TransportAssignment = {
  id: number;
  student_id: number;
  session_id?: number | null;
  student_name?: string | null;
  admission_no?: string | null;
  roll_number?: string | number | null;
  class_name?: string | null;
  section_name?: string | null;
  stream_name?: string | null;
  medium?: string | null;
  session_name?: string | null;
  start_month: number;
  start_year: number;
  end_month?: number | null;
  end_year?: number | null;
  monthly_fee: number;
  pending_count?: number;
  status: string;
};

export type TransportDue = {
  id: number;
  student_id?: number;
  student_name?: string | null;
  due_month: number;
  due_year: number;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
};

export type TransportPayment = {
  id: number;
  student_id?: number;
  student_name?: string | null;
  receipt_no?: string | null;
  amount_paid: number;
  payment_method?: string | null;
  covered_months?: string | null;
  remarks?: string | null;
  created_at: string;
};

export type TransportSummary = {
  active_students?: number;
  monthly_expected?: number;
  pending_amount?: number;
  collected_amount?: number;
};

export type TransportStudent = {
  id: number;
  name: string;
  admission_no?: string | null;
  roll_number?: string | number | null;
  session_id?: number | null;
  class_name?: string | null;
  section_name?: string | null;
  stream_name?: string | null;
  medium?: string | null;
};

export type PaymentStudentItem = {
  id: number;
  name: string;
  admission_no?: string | null;
  roll_number?: string | number | null;
  class_id?: number;
  section_id?: number;
  stream_id?: number | null;
  class_name?: string | null;
  stream_name?: string | null;
  class_scope?: "school" | "hs" | string | null;
  section_name?: string | null;
  medium?: string | null;
};

export type PaymentFilters = {
  class_id?: number | string;
  section_id?: number | string;
  stream_id?: number | string;
  student_id?: number | string;
  scope?: string;
  payment_date?: string;
  date_from?: string;
  date_to?: string;
};

export type PaymentListResult = {
  data: PaymentItem[];
  pagination: PaginationMeta | null;
};

export async function getPaymentsList(
  filters: PaymentFilters = {},
  options?: { page?: number; limit?: number }
): Promise<PaymentListResult> {
  const params: Record<string, string | number> = { ...filters };
  if (Number.isFinite(options?.page)) {
    params.page = Number(options?.page);
  }
  if (Number.isFinite(options?.limit)) {
    params.limit = Number(options?.limit);
  }

  const response = await api.get<ApiEnvelope<PaymentItem[]>>("/fees/payments", { params });
  return {
    data: response.data?.data ?? [],
    pagination: response.data?.pagination ?? null,
  };
}

export async function getPayments(filters: PaymentFilters = {}) {
  const result = await getPaymentsList(filters);
  return result.data;
}

export async function downloadAndSharePaymentsCsv(filters: PaymentFilters = {}) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const query = new URLSearchParams();
  if (filters.class_id) query.set("class_id", String(filters.class_id));
  if (filters.section_id) query.set("section_id", String(filters.section_id));
  if (filters.stream_id) query.set("stream_id", String(filters.stream_id));
  if (filters.student_id) query.set("student_id", String(filters.student_id));
  if (filters.scope) query.set("scope", filters.scope);
  if (filters.payment_date) query.set("payment_date", filters.payment_date);
  if (filters.date_from) query.set("date_from", filters.date_from);
  if (filters.date_to) query.set("date_to", filters.date_to);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const fileDate = filters.payment_date || new Date().toISOString().slice(0, 10);
  const url = `${ENV.API_BASE_URL}/fees/payments/export${suffix}`;
  const target = `${FileSystem.cacheDirectory}payments-${fileDate}.csv`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (download.status !== 200) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
    throw new Error("Receipt download failed");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "text/csv",
      dialogTitle: "Payments Export",
      UTI: "public.comma-separated-values-text",
    });
  }

  return download.uri;
}

export async function getStudentFeeOptions(studentId: number | string) {
  const response = await api.get<ApiEnvelope<StudentFeeOption[]>>(`/fees/student-fees/${studentId}`);
  return response.data?.data ?? [];
}

export async function getStudentsForPayment(params: {
  class_id: number | string;
  section_id: number | string;
  stream_id?: number | string;
}) {
  const response = await api.get<ApiEnvelope<PaymentStudentItem[]>>("/fees/students", { params });
  return response.data?.data ?? [];
}

export async function getMyStudentsForFees() {
  const response = await api.get<ApiEnvelope<PaymentStudentItem[]>>("/fees/my-students");
  return response.data?.data ?? [];
}

export async function getMyStudentFeeOptions(studentId: number | string) {
  const response = await api.get<ApiEnvelope<StudentFeeOption[]>>(`/fees/my-student-fees/${studentId}`);
  return response.data?.data ?? [];
}

export async function getMyPayments(params: { student_id: number | string }) {
  const response = await api.get<ApiEnvelope<PaymentItem[]>>("/fees/my-payments", { params });
  return response.data?.data ?? [];
}

export async function createPayment(payload: {
  student_fee_id: number | string;
  amount_paid: number;
  remarks?: string;
}) {
  const response = await api.post("/fees/payment", payload);
  return response.data;
}

export async function updatePayment(
  id: number | string,
  payload: { amount_paid: number; remarks?: string }
) {
  const response = await api.put(`/fees/payment/${id}`, payload);
  return response.data;
}

export async function deletePayment(id: number | string) {
  const response = await api.delete(`/fees/payment/${id}`);
  return response.data;
}

export async function downloadAndShareReceipt(paymentId: number | string, receiptSerial?: string | null) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const url = `${ENV.API_BASE_URL}/fees/receipt/${paymentId}`;
  const receiptLabel = String(receiptSerial || paymentId);
  const target = `${FileSystem.cacheDirectory}receipt-${receiptLabel}.pdf`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "application/pdf",
      dialogTitle: `Receipt ${receiptLabel}`,
      UTI: "com.adobe.pdf",
    });
    return download.uri;
  }

  return download.uri;
}

export async function getTransportAssignments(params: { student_id?: number | string; session_id?: number | string; status?: string } = {}) {
  const response = await api.get<ApiEnvelope<TransportAssignment[]>>("/fees/transport/assignments", { params });
  return response.data?.data ?? [];
}

export async function getTransportSummary() {
  const response = await api.get<ApiEnvelope<TransportSummary>>("/fees/transport/summary");
  return response.data?.data ?? {};
}

export async function searchTransportStudents(params: {
  search?: string;
  session_id?: number | string;
  class_id?: number | string;
  section_id?: number | string;
  stream_id?: number | string;
  medium?: string;
  assigned_only?: string | number;
} = {}) {
  const response = await api.get<ApiEnvelope<TransportStudent[]>>("/fees/transport/students", { params });
  return response.data?.data ?? [];
}

export async function createTransportAssignment(payload: {
  student_id: number | string;
  session_id: number | string;
  start_month: number;
  start_year: number;
  monthly_fee: number;
}) {
  const response = await api.post("/fees/transport/assignments", payload);
  return response.data;
}

export async function endTransportAssignment(
  id: number | string,
  payload: { end_month: number; end_year: number }
) {
  const response = await api.put(`/fees/transport/assignments/${id}/end`, payload);
  return response.data;
}

export async function getTransportDues(params: {
  student_id?: number | string;
  session_id?: number | string;
  status?: string;
  month?: number | string;
  year?: number | string;
} = {}) {
  const response = await api.get<ApiEnvelope<TransportDue[]>>("/fees/transport/dues", { params });
  return response.data?.data ?? [];
}

export async function getTransportPayments(params: { student_id?: number | string; session_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<TransportPayment[]>>("/fees/transport/payments", { params });
  return response.data?.data ?? [];
}

export async function createTransportPayment(payload: {
  due_ids: Array<number | string>;
  amount_paid: number;
  remarks?: string;
}) {
  const response = await api.post("/fees/transport/payments", payload);
  return response.data;
}

export async function updateTransportPayment(
  paymentId: number | string,
  payload: { amount_paid: number; remarks?: string }
) {
  const response = await api.put(`/fees/transport/payments/${paymentId}`, payload);
  return response.data;
}

export async function deleteTransportPayment(paymentId: number | string) {
  const response = await api.delete(`/fees/transport/payments/${paymentId}`);
  return response.data;
}

export async function downloadAndShareTransportReceipt(paymentId: number | string) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const url = `${ENV.API_BASE_URL}/fees/transport/receipt/${paymentId}`;
  const target = `${FileSystem.cacheDirectory}transport-receipt-${paymentId}.pdf`;
  const download = await FileSystem.downloadAsync(url, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (download.status !== 200) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
    throw new Error("Transportation receipt download failed");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "application/pdf",
      dialogTitle: `Transportation Receipt ${paymentId}`,
      UTI: "com.adobe.pdf",
    });
  }

  return download.uri;
}


