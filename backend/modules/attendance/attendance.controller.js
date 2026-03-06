import * as service from "./attendance.service.js";

export async function takeAttendance(req,res,next){
  try{

    const result =
      await service.takeAttendance(
        req.body,
        req.user.userId
      );

    res.json({ success:true, data:result });

  }catch(err){ next(err); }
}