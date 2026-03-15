import express from "express";
import * as controller from "./contact.controller.js";

const router = express.Router();

router.post("/submissions", controller.createContactSubmission);

export default router;