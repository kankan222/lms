import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "./api";
import { ENV } from "../constants/env";
import { useAuthStore } from "../store/authStore";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type ExamItem = {
  id: number;
  name: string;
  session_id?: number;
  session_name?: string;
};

export type ExamScope = {
  id?: number;
  class_id: number;
  section_id: number;
  class_name?: string;
  section_name?: string;
};

export type ExamSubject = {
  id?: number;
  subject_id: number;
  subject_name?: string;
  max_marks: number;
  pass_marks?: number;
};

export type ExamDetails = ExamItem & {
  scopes: ExamScope[];
  subjects: ExamSubject[];
};

export type StudentReport = {
  exam?: {
    id: number;
    name: string;
    class_name: string;
    section_name: string;
  };
  summary?: {
    percentage: number;
    total_marks?: number;
    obtained_marks?: number;
  };
  subjects?: Array<{
    subject: string;
    marks: number;
    max_marks: number;
    pass_marks?: number;
  }>;
};

export async function getExams() {
  const response = await api.get<ApiEnvelope<ExamItem[]>>("/exams");
  return response.data.data ?? [];
}

export async function getExamById(id: number | string) {
  const response = await api.get<ApiEnvelope<ExamDetails>>(`/exams/${id}`);
  return response.data.data;
}

export async function createExam(payload: {
  name: string;
  scopes: Array<{ class_id: number; section_id: number }>;
  subjects: Array<{ subject_id: number; max_marks: number }>;
  session_id?: number;
}) {
  const response = await api.post("/exams", payload);
  return response.data;
}

export async function updateExam(
  id: number | string,
  payload: {
    name: string;
    scopes: Array<{ class_id: number; section_id: number }>;
    subjects: Array<{ subject_id: number; max_marks: number }>;
    session_id?: number;
  }
) {
  const response = await api.put(`/exams/${id}`, payload);
  return response.data;
}

export async function deleteExam(id: number | string) {
  const response = await api.delete(`/exams/${id}`);
  return response.data;
}

export async function getStudentReport(examId: number | string, studentId: number | string) {
  const response = await api.get<ApiEnvelope<StudentReport>>(`/exams/${examId}/report/${studentId}`);
  return response.data.data;
}

export async function downloadAndShareStudentReport(examId: number | string, studentId: number | string) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const url = `${ENV.API_BASE_URL}/exams/${examId}/report/${studentId}/pdf`;
  const target = `${FileSystem.cacheDirectory}marksheet-exam-${examId}-student-${studentId}.pdf`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType: "application/pdf",
      dialogTitle: `Marksheet ${examId}`,
      UTI: "com.adobe.pdf",
    });
  }

  return download.uri;
}

