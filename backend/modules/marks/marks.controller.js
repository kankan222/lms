import * as service from "./marks.service.js"

export async function submitMarks(req,res,next){
  try{
    const result =
      await service.submitMarks(
        req.body,
        req.user.userId
      );

    res.json({ success:true, data:result });

  }catch(err){ next(err); }
}