import fs from "node:fs";
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/payments";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const uploadPaymentFile = multer({ storage });
