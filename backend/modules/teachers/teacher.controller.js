import * as service from "./teacher.service.js";

export async function createTeacher(req,res,next){
  try{
    const result = await service.createTeacher(req.body);
    res.json({ success:true, data:result });
  }catch(err){ next(err); }
}
export async function getTeachers(req,res,next){
  try{
    const teachers = await service.getTeachers();
    res.json({success:true,data:teachers});
  }catch(err){ next(err) }
}

export async function updateTeacher(req,res,next){
  try{
    await service.updateTeacher(req.params.id,req.body);
    res.json({success:true});
  }catch(err){ next(err) }
}

export async function deleteTeacher(req,res,next){
  try{
    await service.deleteTeacher(req.params.id);
    res.json({success:true});
  }catch(err){ next(err) }
}
export async function assignTeacher(req,res,next){
  try{
    await service.assignTeacher({
      teacherId: req.params.id,
      ...req.body
    });

    res.json({ success:true });
  }catch(err){ next(err); }
}

export async function getAssignments(req,res,next){
  try{
    const data =
      await service.getTeacherAssignments(req.params.id);

    res.json({ success:true, data });
  }catch(err){ next(err); }
}