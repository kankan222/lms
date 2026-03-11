import express from "express";
import { listPublicStaff } from "./staff.controller.js";

const router = express.Router();

router.get("/", listPublicStaff);

export default router;
