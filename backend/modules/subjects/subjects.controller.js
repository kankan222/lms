import * as service from "./subjects.service.js";

// CREATE
export async function createSubject(req, res) {
  const result = await service.createSubject(req.body);

  res.json({
    success: true,
    data: result,
  });
}

// GET ALL
export async function getSubjects(req, res) {
  const data = await service.getSubjects();

  res.json({
    success: true,
    data,
  });
}

// UPDATE
export async function updateSubject(req, res) {
  const { id } = req.params;

  await service.updateSubject(id, req.body);

  res.json({
    success: true,
  });
}

// DELETE
export async function deleteSubject(req, res) {
  const { id } = req.params;

  await service.deleteSubject(id);

  res.json({
    success: true,
  });
}
export async function assignSubject(req, res, next) {
  try {

    const { classId, subjectIds } = req.body;

    if (!classId) {
      throw new Error("classId is required");
    }

    if (!Array.isArray(subjectIds)) {
      throw new Error("subjectIds must be an array");
    }
    await service.assignSubjects(classId, subjectIds);

    res.json({ success: true });

  } catch (err) {
    next(err);
  }
}
export async function getClassSubjects(req, res, next) {
  try {
    const data = await service.getClassSubjects(req.params.classId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
