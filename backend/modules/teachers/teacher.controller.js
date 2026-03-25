import * as service from "./teacher.service.js";

/* ------------------ TEACHERS ------------------ */

export async function createTeacher(req, res, next) {
  try {
    const photo_url = req.file ? `/uploads/teachers/${req.file.filename}` : null;
      const data = {
      employee_id: req.body.employee_id,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      class_scope: req.body.class_scope,
      password: req.body.password,
      photo_url,
    };
    const result = await service.createTeacher(data);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getTeachers(req, res, next) {
  try {
    const teachers = await service.getTeachersForActor({
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data: teachers });
  } catch (err) {
    next(err);
  }
}

export async function getTeacherById(req, res, next) {
  try {
    const teacher = await service.getTeacherForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data: teacher });
  } catch (err) {
    next(err);
  }
}

export async function updateTeacher(req, res, next) {
  try {
    const photo_url = req.file ? `/uploads/teachers/${req.file.filename}` : undefined;
    await service.updateTeacher(req.params.id, {
      employee_id: req.body.employee_id,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      class_scope: req.body.class_scope,
      photo_url,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeacher(req, res, next) {
  try {
    await service.deleteTeacher(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------ TEACHER ASSIGNMENTS ------------------ */

export async function assignTeacher(req, res, next) {
  try {
    console.log("Controller", req.body, res)
    await service.assignTeacher({
      teacherId: req.params.id,
      ...req.body
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function removeAssignment(req, res, next) {
  try {
    await service.removeAssignment(req.params.assignmentId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req, res, next) {
  try {
    const data = await service.getTeacherAssignmentsForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/* ------------------ ATTENDANCE DEVICES ------------------ */

export async function createAttendanceDevice(req, res, next) {
  try {
    const device = await service.createAttendanceDevice(req.body);
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceDevices(req, res, next) {
  try {
    const devices = await service.getAttendanceDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

/* ------------------ ATTENDANCE LOGS (DEVICE INPUT) ------------------ */

export async function logTeacherAttendance(req, res, next) {
  try {
    const result = await service.logTeacherAttendance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* ------------------ DAILY ATTENDANCE ------------------ */

export async function getTeacherAttendance(req, res, next) {
  try {
    const data = await service.getTeacherAttendanceForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
export async function getAllTeacherAttendance(req,res,next){

  try{

    const data =
      await service.getAllTeacherAttendanceForActor({
        actorUserId: req.user?.userId,
        actorPermissions: req.user?.permissions || [],
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });

    res.json({
      success:true,
      data
    });

  }catch(err){
    next(err);
  }

}
export async function generateDailyAttendance(req, res, next) {
  try {
    const result = await service.generateDailyAttendance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
