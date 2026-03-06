import { query } from "../db/query.js";
export async function teacherOwnsClass(
  teacherId,
  classId,
  sectionId
) {

  const sql = `
    SELECT id
    FROM teacher_class_assignments
    WHERE teacher_id = ?
    AND class_id = ?
    AND section_id = ?
    LIMIT 1
  `;

  const rows = await query(sql, [
    teacherId,
    classId,
    sectionId
  ]);

  return !!rows.length;
}

export function requireOwnership(checkFn) {

  return async (req, res, next) => {
    const allowed = await checkFn(req);

    if (!allowed)
      return res.status(403).json({
        message: "Access denied"
      });

    next();
  };
}