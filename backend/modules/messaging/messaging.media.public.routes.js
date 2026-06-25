import express from "express";
import * as mediaService from "./messaging.media.service.js";

const router = express.Router();

router.get("/:attachmentId", (req, res, next) => {
  try {
    const access = mediaService.verifyLocalMediaToken(
      String(req.query.token || ""),
      Number(req.params.attachmentId)
    );
    res.type(access.mimeType);
    res.sendFile(access.localPath);
  } catch (err) {
    next(err);
  }
});

export default router;
