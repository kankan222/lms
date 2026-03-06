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

    // totals
    const total = marks.reduce(
      (sum,m)=>sum + Number(m.marks),
      0
    );

    const maxMarks = marks.length * 100;
    const percentage =
      (total / maxMarks) * 100;

    const grade = calculateGrade(percentage);

    return {
      student:{
        id:marks[0].student_id,
        name:`${marks[0].first_name} ${marks[0].last_name}`
      },
      exam:marks[0].exam,
      subjects:marks.map(m=>({
        subject:m.subject,
        marks:m.marks
      })),
      total,
      percentage:Number(percentage.toFixed(2)),
      grade
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