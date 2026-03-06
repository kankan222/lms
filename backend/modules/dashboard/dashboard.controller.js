import * as service from "./dashboard.service.js";

export async function parentDashboard(req,res,next){
  try{

    const data =
      await service.parentDashboard(req.user.userId);

    res.json({ success:true, data });

  }catch(err){ next(err); }
}