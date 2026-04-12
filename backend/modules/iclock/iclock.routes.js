import express from "express";
import * as controller from "./iclock.controller.js";

const router = express.Router();

router.get("/cdata2", controller.pollDevice);

router.post(
  "/cdata2",
  express.raw({ type: "application/octet-stream", limit: "5mb" }),
  controller.receiveDevicePacket
);

export default router;
