import multer from "multer";
import fs from "node:fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/students";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  }
});

export const uploadStudentFile = multer({ storage });
