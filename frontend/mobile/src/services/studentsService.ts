import { api } from "./api";
import * as FileSystem from "expo-file-system/legacy";

export type Student = {
  id: number;
  admission_no?: string;
  name: string;
  phone?: string;
  mobile?: string;
  date_of_admission?: string;
  medium?: string | null;
  class_scope?: "school" | "hs";
  stream_name?: string | null;
  gender?: string;
  dob?: string;
  roll_number?: string | number;
  class_id?: number;
  section_id?: number;
  session_id?: number;
  class?: string;
  section?: string;
  session?: string;
};

export type StudentParent = {
  relationship: "father" | "mother" | string;
  name: string;
  mobile?: string;
  email?: string;
  qualification?: string;
  occupation?: string;
};

export type StudentDetails = {
  id: number;
  admission_no?: string;
  name: string;
  mobile?: string;
  gender?: string;
  dob?: string;
  date_of_admission?: string;
  photo_url?: string | null;
  roll_number?: string | number;
  class_id?: number;
  section_id?: number;
  session_id?: number;
  class_scope?: "school" | "hs";
  stream_id?: number | null;
  stream_name?: string | null;
  class?: string;
  section?: string;
  session?: string;
  parents?: StudentParent[];
};

export type CreateStudentPayload = {
  student: {
    admission_no?: string;
    name: string;
    dob: string;
    gender: string;
    mobile?: string;
    date_of_admission: string;
    photo_url?: string | null;
  };
  enrollment: {
    session_id: number;
    class_id: number;
    section_id: number;
    medium?: string;
    roll_number: string | number;
    stream?: string;
    stream_id?: number | null;
  };
  father?: {
    name?: string;
    mobile?: string;
    email?: string;
    occupation?: string;
    qualification?: string;
  };
  mother?: {
    name?: string;
    mobile?: string;
    email?: string;
    occupation?: string;
    qualification?: string;
  };
};

export async function getStudents(params?: { class_id?: string; section_id?: string }) {
  const response = await api.get<Student[]>("/students", { params });
  return response.data;
}

export async function getStudentById(id: number | string) {
  const response = await api.get<StudentDetails>(`/students/${id}`);
  return response.data;
}

export const getStudent = getStudentById;

export async function createStudent(payload: CreateStudentPayload) {
  const response = await api.post("/students", payload);
  return response.data;
}

export async function updateStudent(
  id: number | string,
  payload: {
    admission_no?: string | null;
    name: string;
    mobile?: string;
    gender: string;
    dob: string;
    date_of_admission?: string;
    photo_url?: string | null;
    session_id?: number;
    class_id?: number;
    section_id?: number;
    roll_number?: string | number;
    stream?: string;
    stream_id?: number | null;
  }
) {
  const response = await api.patch(`/students/${id}`, payload);
  return response.data;
}

export async function deleteStudent(id: number | string) {
  const response = await api.delete(`/students/${id}`);
  return response.data;
}

export async function bulkUploadStudentsCsv(csvText: string) {
  const trimmed = csvText.trim();
  if (!trimmed) {
    throw new Error("CSV content is required.");
  }

  const fileUri = `${FileSystem.cacheDirectory}students-upload-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, trimmed, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    type: "text/csv",
    name: "students-upload.csv",
  } as never);

  const response = await api.post("/students/bulk-upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data as { createdCount?: number; studentIds?: number[] };
}
