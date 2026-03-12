import fs from "fs";
import path from "path";
import multer from "multer";

function normalizeCampusType(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "school" || value === "college") return value;
  return "school";
}

function normalizeSectionFolder(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "_");

  if (["head", "headstaff"].includes(value)) return "head";
  if (["teaching", "teachingstaff"].includes(value)) return "teaching";
  if (["non_teaching", "nonteaching", "nonteachingstaff"].includes(value)) return "non-teaching";
  return "head";
}

function getUploadDirectory(req) {
  const campus = normalizeCampusType(req.body?.type || req.params?.campus);
  const section = normalizeSectionFolder(req.body?.section || req.body?.title);
  return path.join("uploads", campus, section);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUploadDirectory(req);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || "staff")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
    cb(null, `${Date.now()}-${safeOriginal}`);
  }
});

function fileFilter(req, file, cb) {
  if (String(file.mimetype || "").startsWith("image/")) {
    cb(null, true);
    return;
  }
  cb(new Error("Only image files are allowed"));
}

const uploader = multer({ storage, fileFilter });

export const uploadStaffPhoto = uploader;
export const uploadSingleStaffPhoto = uploader.single("image");
export const uploadBulkStaffPhotos = uploader.array("images", 100);
