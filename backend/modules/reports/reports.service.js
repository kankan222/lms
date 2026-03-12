import { pool } from "../../database/pool.js";
import * as repo from "./reports.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function generateReport(data){

  const conn = await pool.getConnection();

  try{

    const marks =
      await repo.getStudentMarks(conn,data);

    if(!marks.length)
      throw new AppError("No approved marks",404);

    const total = marks.reduce((sum, row) => sum + Number(row.marks || 0), 0);
    const maxMarks = marks.reduce((sum, row) => sum + Number(row.max_marks || 0), 0);
    const percentage = maxMarks ? (total / maxMarks) * 100 : 0;

    const grade = calculateGrade(percentage);
    const classScope = String(marks[0].class_scope || "school").trim().toLowerCase();

    return {
      student:{
        id: marks[0].student_id,
        name: marks[0].student_name,
        roll_number: marks[0].roll_number ?? "-"
      },
      exam:{
        id: marks[0].exam_id,
        name: marks[0].exam_name,
        class_name: marks[0].class_name,
        class_scope: classScope,
        section_name: marks[0].section_name,
        medium: marks[0].medium,
      },
      subjects:marks.map(m=>({
        subject: m.subject_name,
        marks: Number(m.marks || 0),
        max_marks: Number(m.max_marks || 0),
        pass_marks: Number(m.pass_marks || 0),
      })),
      summary: {
        total,
        max_total: maxMarks,
        percentage: Number(percentage.toFixed(2)),
      },
      total,
      percentage: Number(percentage.toFixed(2)),
      grade,
    };

  }finally{
    conn.release();
  }
}

//GRADE LOGIC
function calculateGrade(p){

  if(p>=90) return "A+";
  if(p>=80) return "A";
  if(p>=70) return "B";
  if(p>=60) return "C";
  if(p>=50) return "D";
  return "F";
}
