import * as service from "./academic.service.js";
export async function createSession(req, res, next) {
  try {
    await service.createSession(req.body);

    res.json({
      success: true,
      message: "Session created",
    });
  } catch (err) {
    next(err);
  }
}

export async function getSessions(req, res, next) {
  try {
    const data = await service.getSessions();

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
// GET 
export async function getClasses(req, res, next) {
  try {
    const data = await service.getClasses();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
export async function getClassStructure(req,res,next){
  try{
    const data = await service.getClassStructure();
    res.json({ success:true, data });
  }catch(err){
    next(err);
  }
}
// POST 
export async function createClass(req, res, next) {
  try {
    await service.createClass(req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateClass(req, res, next) {
  try {
    await service.updateClass(req.params.id, req.body);

    res.json({
      success: true,
      message: "Class and section updated",
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteClass(req, res, next) {
  try {
    await service.deleteClass(req.params.id);

    res.json({
      success: true,
      message: "Class deleted",
    });
  } catch (err) {
    next(err);
  }
}
