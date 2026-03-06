import * as service from "./parent.service.js";

export async function createParent(req, res, next) {
  try {

    const result =
      await service.createParent(req.body);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    next(err);
  }
}

export async function getParents(req, res, next) {
  try {

    const data = await service.getParents();

    res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
}