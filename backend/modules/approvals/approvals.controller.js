import * as service from "./approvals.service.js";


// GET /approvals/pending
export async function getPending(req, res, next) {
  try {

    const data =
      await service.getPendingApprovals();

    res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
}


// POST /approvals/review
export async function review(req, res, next) {
  try {

    const result =
      await service.reviewApproval(
        req.body,
        req.user.userId
      );

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    next(err);
  }
}