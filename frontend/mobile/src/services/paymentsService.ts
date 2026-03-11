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
  fee_type: string;
  fee_amount: number;
  student_id: number;
  student_name: string;
  class_name: string;
  section_name: string;
  medium?: string | null;
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

export type PaymentFilters = {
  class_id?: number | string;
  section_id?: number | string;
  student_id?: number | string;
};

export async function getPayments(filters: PaymentFilters = {}) {
  const response = await api.get<ApiEnvelope<PaymentItem[]>>("/fees/payments", { params: filters });
  return response.data?.data ?? [];
}

export async function getStudentFeeOptions(studentId: number | string) {
  const response = await api.get<ApiEnvelope<StudentFeeOption[]>>(`/fees/student-fees/${studentId}`);
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


