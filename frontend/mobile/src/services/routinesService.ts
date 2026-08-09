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
  routine_version_id?: number;
  weekday?: number | string | null;
  weekday_label?: string | null;
  period_number?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  entry_type?: RoutineEntryType | string | null;
  session_id?: number | string | null;
  session_name?: string | null;
  title?: string | null;
  subject_name?: string | null;
  activity_name?: string | null;
  applies_medium?: string | null;
  applies_section_ids?: number[];
  applies_section_names?: string | null;
  teacher_name?: string | null;
  teacher_names?: string | null;
  room?: string | null;
  notes?: string | null;
  slot_label?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  medium?: string | null;
  stream_name?: string | null;
  class_scope?: string | null;
  class_scope_label?: string | null;
  layout_mode?: "standard" | "packed_hs" | string | null;
};

export type ClassRoutineBoardRoutine = {
  routine_version_id: number;
  session_id: number;
  session_name?: string | null;
  class_id: number;
  class_name: string;
  class_scope?: string | null;
  class_scope_label?: string | null;
  layout_mode?: "standard" | "packed_hs" | string | null;
  section_id?: number | null;
  section_name: string;
  medium?: string | null;
  stream_id?: number | null;
  stream_name?: string | null;
  title?: string | null;
  status?: string | null;
  published_at?: string | null;
  entries: RoutineEntry[];
};

export type ClassRoutineBoardDay = {
  weekday: number;
  label: string;
  routines: ClassRoutineBoardRoutine[];
};

export type ClassRoutineBoardScope = {
  class_scope: string;
  scope_label: string;
  weekdays: ClassRoutineBoardDay[];
};

export type ClassRoutineBoardResponse = {
  weekdays: Array<{ weekday: number; label: string }>;
  scopes: ClassRoutineBoardScope[];
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
  applies_medium?: string | null;
  applies_section_ids?: number[];
  applies_section_names?: string | null;
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
  routine?: RoutineEntry[] | { entries?: RoutineEntry[] };
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
  return response.data.data ?? { routine: [], date: params.date };
}

export async function getClassRoutineBoard(params: { status?: string; weekday?: number | string; session_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<ClassRoutineBoardResponse>>("/routines/class-routines/board", { params });
  return response.data.data ?? { weekdays: [], scopes: [] };
}

export async function getExamRoutines(params: { status?: string; session_id?: number | string; exam_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<ExamRoutineSummary[]>>("/routines/exam-routines", { params });
  return response.data.data ?? [];
}

export async function getExamRoutineById(id: number | string) {
  const response = await api.get<ApiEnvelope<ExamRoutineDetails>>(`/routines/exam-routines/${id}`);
  return response.data.data;
}
