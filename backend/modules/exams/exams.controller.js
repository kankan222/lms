import * as service from "./exams.service.js";

export async function createExam(req,res,next){
  try{
    const result =
      await service.createExam(req.body);
    res.json({ success:true, data:result });

  }catch(err){ next(err); }
}
export async function getExam(req, res, next) {
  try {

    const sessionId = req.query.sessionId;

    const data = await service.getExam(sessionId);

    res.json({ success: true, data });

  } catch (err) {
    next(err);
  }
}