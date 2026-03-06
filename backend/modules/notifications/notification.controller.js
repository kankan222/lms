import * as service from "./notification.service.js";

export async function myNotifications(req,res,next){
  try{
    const data =
      await service.getMyNotifications(req.user.userId);

    res.json({ success:true, data });
  }catch(err){ next(err); }
}

export async function markRead(req,res,next){
  try{
    const result =
      await service.markNotification(req.params.id);

    res.json({ success:true, data:result });
  }catch(err){ next(err); }
}