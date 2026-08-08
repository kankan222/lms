import multer from "multer";

const storage = multer.memoryStorage();

export const uploadAnnouncementFile = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});
