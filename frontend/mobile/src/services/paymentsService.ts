import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "./api";
import { ENV } from "../constants/env";
import { useAuthStore } from "../store/authStore";

type ApiEnvelope<T> = {
  success?: boolean;
  data: T;
  message?: string;
};

export type PaymentItem = {
  id: number;
  student_fee_id: number;
  amount_paid: number;
  remarks: string | null;
  status: string;
  fee_status?: string | null;
  created_at: string;
  payment_date?: string | null;
  fee_type: string;
  fee_amount: number;
  student_id: number;
  student_name: string;
  class_name: string;
  section_name: string;
  medium?: string | null;
  class_scope?: "school" | "hs" | string | null;
};

export type StudentFeeOption = {
  id: number;
  fee_type: string;
  amount: number;
  status: string;
  installment_name?: string | null;
  due_date?: string | null;
  paid: number;
  remaining: number;
};

export type PaymentStudentItem = {
  id: number;
  name: string;
  admission_no?: string | null;
  roll_number?: string | number | null;
  class_id?: number;
  section_id?: number;
  class_name?: string | null;
  section_name?: string | null;
  medium?: string | null;
};

export type PaymentFilters = {
  class_id?: number | string;
  section_id?: number | string;
  student_id?: number | string;
  scope?: string;
  payment_date?: string;
  date_from?: string;
  date_to?: string;
};

export async function getPayments(filters: PaymentFilters = {}) {
  const response = await api.get<ApiEnvelope<PaymentItem[]>>("/fees/payments", { params: filters });
  return response.data?.data ?? [];
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

export async function getStudentsForPayment(params: { class_id: number | string; section_id: number | string }) {
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

export async function downloadAndShareReceipt(paymentId: number | string) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const url = `${ENV.API_BASE_URL}/fees/receipt/${paymentId}`;
  const target = `${FileSystem.cacheDirectory}receipt-${paymentId}.pdf`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "application/pdf",
      dialogTitle: `Receipt ${paymentId}`,
      UTI: "com.adobe.pdf",
    });
    return download.uri;
  }

  return download.uri;
}


