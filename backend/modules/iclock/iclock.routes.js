import express from "express";
import * as controller from "./iclock.controller.js";

const router = express.Router();
const rawDeviceBody = express.raw({ type: () => true, limit: "5mb" });

router.get(["/cdata", "/cdata2"], controller.pollDevice);

router.post(
  ["/cdata", "/cdata2"],
  rawDeviceBody,
  controller.receiveDevicePacket
);

export default router;
