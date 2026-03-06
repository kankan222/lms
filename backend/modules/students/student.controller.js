import * as service from "./student.service.js";


export async function getStudents(req,res,next){
  try{

    const students = await service.getStudents();

    res.json({
      success:true,
      data:students
    });

  }catch(err){
    next(err)
  }
}

export async function createStudent(req, res, next) {
  try {

    const data = {
      admissionNo: req.body.admission_no,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      dob: req.body.dob,
      gender: req.body.gender,
      classId: req.body.classId,
      sectionId: req.body.sectionId,
      sessionId: req.body.sessionId,
      rollNumber: req.body.rollNumber,
      status: req.body.status
    };

    const result = await service.createStudent(data);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    next(err);
  }
}


export async function updateStudent(req, res, next) {

  try {

    const { id } = req.params;

    const data = {
      admissionNo: req.body.admission_no,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      dob: req.body.dob,
      gender: req.body.gender,
      classId: req.body.classId,
      sectionId: req.body.sectionId,
      sessionId: req.body.sessionId,
      rollNumber: req.body.rollNumber,
      status: req.body.status
    };

    await service.updateStudent(id, data);

    res.json({ success: true });

  } catch (err) {
    next(err);
  }

}


export async function deleteStudent(req,res,next){

  try{

    const {id} = req.params;

    await service.deleteStudent(id);

    res.json({
      success:true
    });

  }catch(err){
    next(err)
  }
}

export async function getStudentsByClassSection(req, res) {

  const { class_id, section, session_id } = req.query;

  const students = await studentService.getStudentsByClassSection(
    class_id,
    section,
    session_id
  );

  res.json(students);
}