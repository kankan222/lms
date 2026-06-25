import multer from "multer";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const uploadMessageFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: MAX_FILE_SIZE,
  },
}).array("files", 5);
