import multer from "multer";

const storage = multer.memoryStorage();

export const uploadRoutineFile = multer({
  storage,
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
});
