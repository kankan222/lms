import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type RoutineEntryType = "class" | "break" | "activity" | "free";

export type RoutineEntry = {
  entry_id?: number;
  id?: number;
  weekday?: number | string | null;
  period_number?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  entry_type?: RoutineEntryType | string | null;
  session_id?: number | string | null;
  title?: string | null;
  subject_name?: string | null;
  teacher_name?: string | null;
  teacher_names?: string | null;
  room?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  medium?: string | null;
  stream_name?: string | null;
  is_substitution?: boolean | number;
  substitution_title?: string | null;
};

export type ExamRoutineEntry = {
  id?: number;
  routine_id?: number;
  routine_title?: string | null;
  exam_name?: string | null;
  session_name?: string | null;
  class_id?: number | string | null;
  section_id?: number | string | null;
  class_name?: string | null;
  section_name?: string | null;
  medium?: string | null;
  stream_name?: string | null;
  subject_name?: string | null;
  title?: string | null;
  entry_type?: "subject" | "activity" | string | null;
  exam_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  room?: string | null;
  instructions?: string | null;
  invigilator_names?: string | null;
};

export type ExamRoutineSummary = {
  id: number;
  exam_id?: number;
  session_id?: number;
  title?: string | null;
  status?: string | null;
  version_number?: number;
  exam_name?: string | null;
  session_name?: string | null;
  entry_count?: number | string;
};

export type ExamRoutineDetails = ExamRoutineSummary & {
  entries?: ExamRoutineEntry[];
};

export type StudentRoutineResponse = {
  date?: string;
  routine?: RoutineEntry[];
  substitutions?: RoutineEntry[];
};

export type TeacherRoutineParams = {
  date?: string;
  weekday?: number;
};

export async function getMyTeacherRoutine(params: TeacherRoutineParams = {}) {
  const response = await api.get<ApiEnvelope<RoutineEntry[]>>("/routines/teacher/me", { params });
  return response.data.data ?? [];
}

export async function getStudentRoutine(studentId: number | string, params: { date?: string } = {}) {
  const response = await api.get<ApiEnvelope<StudentRoutineResponse>>(`/routines/students/${studentId}`, { params });
  return response.data.data ?? { routine: [], substitutions: [], date: params.date };
}

export async function getExamRoutines(params: { status?: string; session_id?: number | string; exam_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<ExamRoutineSummary[]>>("/routines/exam-routines", { params });
  return response.data.data ?? [];
}

export async function getExamRoutineById(id: number | string) {
  const response = await api.get<ApiEnvelope<ExamRoutineDetails>>(`/routines/exam-routines/${id}`);
  return response.data.data;
}
