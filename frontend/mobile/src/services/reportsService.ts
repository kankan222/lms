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

export type MarksGridFilters = {
  exam_id?: number | string;
  class_id?: number | string;
  section_id?: number | string;
  medium?: string;
  subject_id?: number | string;
  name?: string;
  approval_status?: string;
};

export type MarksGridRow = {
  mark_id?: number | null;
  student_id: number;
  roll_number?: string | number | null;
  student_name: string;
  medium?: string | null;
  marks?: number | null;
  approval_status: string;
  has_entry?: boolean;
};

export type MarksGridData = {
  exam_id: number;
  class_id: number;
  section_id: number;
  subject: {
    id: number;
    name: string;
    max_marks: number;
    pass_marks: number;
  };
  rows: MarksGridRow[];
};

export type StudentReport = {
  student?: {
    id: number;
    name: string;
    roll_number?: string | number | null;
  };
  exam?: {
    id: number;
    name: string;
    class_name: string;
    class_scope?: string;
    section_name: string;
    medium?: string | null;
  };
  summary?: {
    total?: number;
    max_total?: number;
    percentage: number;
  };
  subjects?: Array<{
    subject: string;
    marks: number;
    max_marks: number;
    pass_marks?: number;
  }>;
};

export type LinkedStudent = {
  id: number;
  name: string;
  roll_number?: string | number | null;
  class_name?: string | null;
  section_name?: string | null;
};

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString() ? `?${query.toString()}` : "";
}

async function downloadAuthorizedFile(path: string, fileName: string, mimeType: string, uti: string) {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is not available on this device");
  }

  const target = `${FileSystem.cacheDirectory}${fileName}`;
  const download = await FileSystem.downloadAsync(`${ENV.API_BASE_URL}${path}`, target, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(download.uri, {
      mimeType,
      dialogTitle: fileName,
      UTI: uti,
    });
  }

  return download.uri;
}

export async function getMarksGrid(filters: MarksGridFilters) {
  const response = await api.get<ApiEnvelope<MarksGridData>>(`/marks/grid${buildQuery(filters)}`);
  return response.data.data;
}

export async function saveMarks(payload: {
  exam_id: number | string;
  class_id: number | string;
  section_id: number | string;
  medium?: string;
  subject_id: number | string;
  marks: Array<{ student_id: number | string; marks: string | number }>;
}) {
  const response = await api.post("/marks/save", payload);
  return response.data;
}

export async function submitMarksForApproval(payload: Record<string, unknown>) {
  const response = await api.post("/marks/submit", payload);
  return response.data;
}

export async function approveMarks(payload: Record<string, unknown>) {
  const response = await api.post("/marks/approve", payload);
  return response.data;
}

export async function rejectMarks(payload: Record<string, unknown>) {
  const response = await api.post("/marks/reject", payload);
  return response.data;
}

export async function getStudentReport(examId: number | string, studentId: number | string) {
  const response = await api.get<ApiEnvelope<StudentReport>>(`/marks/reports/${examId}/student/${studentId}`);
  return response.data.data;
}

export async function getMyResults(params: { exam_id?: number | string; student_id?: number | string }) {
  const response = await api.get<ApiEnvelope<StudentReport>>(`/marks/my-results${buildQuery(params)}`);
  return response.data.data;
}

export async function getMyStudents() {
  const response = await api.get<ApiEnvelope<LinkedStudent[]>>("/marks/my-students");
  return response.data.data ?? [];
}

export async function downloadStudentMarksheet(examId: number | string, studentId: number | string) {
  return downloadAuthorizedFile(
    `/marks/reports/${examId}/student/${studentId}/pdf`,
    `marksheet-exam-${examId}-student-${studentId}.pdf`,
    "application/pdf",
    "com.adobe.pdf"
  );
}

export async function downloadMyMarksheet(params: { exam_id?: number | string; student_id?: number | string }) {
  const examId = params.exam_id || "report";
  return downloadAuthorizedFile(
    `/marks/my-results/pdf${buildQuery(params)}`,
    `marksheet-exam-${examId}.pdf`,
    "application/pdf",
    "com.adobe.pdf"
  );
}
