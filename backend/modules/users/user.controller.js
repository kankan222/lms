import * as service from "./user.service.js";

export async function changePassword(req, res, next) {

  try {

    const result =
      await service.changePassword({
        userId: req.body.user_id,
        currentPassword: req.body.current_password,
        newPassword: req.body.new_password
      });

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    next(err);
  }

}


export async function adminResetPassword(req,res,next){

  try{

    const result =
      await service.adminResetPassword({
        userId: req.body.user_id,
        newPassword: req.body.new_password
      });

    res.json({ success:true, data: result });

  }catch(err){
    next(err);
  }

}

export async function listUsers(req, res, next) {
  try {
    const result = await service.listUsers(req.query || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const result = await service.updateUserStatus({
      userId: req.params.id,
      status: req.body?.status,
      actorUserId: req.user?.userId
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
