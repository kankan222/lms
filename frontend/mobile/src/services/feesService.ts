import { api } from "./api";

type ApiEnvelope<T> = {
  success?: boolean;
  data: T;
  message?: string;
};

export type FeeInstallment = {
  id: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
};

export type FeeStructure = {
  id: number;
  admission_fee: number;
  class_name: string;
  session_name: string;
  installments: FeeInstallment[];
};

export type CreateFeeStructurePayload = {
  class_id: number;
  session_id: number;
  admission_fee: number;
};

export type CreateInstallmentPayload = {
  fee_structure_id: number;
  installment_name: string;
  amount: number;
  due_date?: string | null;
};

export async function getAllFeeStructures() {
  const response = await api.get<ApiEnvelope<FeeStructure[]>>("/fees/structure");
  return response.data?.data ?? [];
}

export async function createFeeStructure(payload: CreateFeeStructurePayload) {
  const response = await api.post("/fees/structure", payload);
  return response.data;
}

export async function updateFeeStructure(id: number | string, payload: Partial<CreateFeeStructurePayload>) {
  const response = await api.put(`/fees/structure/${id}`, payload);
  return response.data;
}

export async function deleteFeeStructure(id: number | string) {
  const response = await api.delete(`/fees/structure/${id}`);
  return response.data;
}

export async function createInstallment(payload: CreateInstallmentPayload) {
  const response = await api.post("/fees/installment", payload);
  return response.data;
}

export async function updateInstallment(id: number | string, payload: Partial<CreateInstallmentPayload>) {
  const response = await api.put(`/fees/installment/${id}`, payload);
  return response.data;
}

export async function deleteInstallment(id: number | string) {
  const response = await api.delete(`/fees/installment/${id}`);
  return response.data;
}
