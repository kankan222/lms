import path from "node:path";
import { v4 as uuid } from "uuid";
import { fileTypeFromBuffer } from "file-type";
import { parseBuffer } from "music-metadata";
import sharp from "sharp";
import jwt from "jsonwebtoken";
import AppError from "../../core/errors/AppError.js";
import * as repo from "./messaging.repository.js";
import {
  createMessagingObjectAccess,
  deleteMessagingObject,
  getLocalMessagingObjectPath,
  getMessagingStorageDriver,
  putMessagingObject,
} from "./messaging.storage.js";

const MB = 1024 * 1024;
const MAX_BY_CATEGORY = {
  image: 10 * MB,
  document: 25 * MB,
  voice: 20 * MB,
};

const ALLOWED_EXTENSIONS = {
  image: new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp", "tif", "tiff"]),
  document: new Set(["pdf", "docx", "xlsx", "csv", "txt"]),
  voice: new Set(["m4a", "aac", "mp3", "webm"]),
};

const ALLOWED_MIME = {
  image: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/bmp",
    "image/tiff",
  ]),
  document: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
  ]),
  voice: new Set([
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/webm",
  ]),
};

function normalizeCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (!Object.hasOwn(ALLOWED_EXTENSIONS, category)) {
    throw new AppError("Attachment category must be image, document, or voice", 400);
  }
  return category;
}

function normalizeExtension(fileName) {
  return path.extname(String(fileName || "")).slice(1).toLowerCase();
}

function safeOriginalName(fileName) {
  return path.basename(String(fileName || "attachment")).slice(0, 255);
}

async function detectFile(file, category, extension) {
  const detected = await fileTypeFromBuffer(file.buffer);
  const declaredMime = String(file.mimetype || "").toLowerCase();
  let detectedMime = detected?.mime || declaredMime;
  let detectedExtension = detected?.ext || extension;

  if (category === "document" && ["csv", "txt"].includes(extension)) {
    detectedMime = extension === "csv" ? "text/csv" : "text/plain";
    detectedExtension = extension;
  }

  if (
    category === "document" &&
    ["docx", "xlsx"].includes(extension) &&
    detectedMime === "application/zip"
  ) {
    detectedMime =
      extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    detectedExtension = extension;
  }

  if (!ALLOWED_EXTENSIONS[category].has(extension)) {
    throw new AppError(`Unsupported ${category} file extension`, 400);
  }
  if (!ALLOWED_MIME[category].has(declaredMime) && !ALLOWED_MIME[category].has(detectedMime)) {
    throw new AppError(`Unsupported ${category} MIME type`, 400);
  }
  if (
    detectedExtension &&
    !ALLOWED_EXTENSIONS[category].has(detectedExtension) &&
    !(category === "voice" && detectedExtension === "mp4")
  ) {
    throw new AppError("File signature does not match an allowed format", 400);
  }

  return { detectedMime, detectedExtension };
}

function buildObjectKey(extension) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${uuid()}.${extension}`;
}

async function prepareImage(buffer) {
  let image;
  try {
    image = sharp(buffer, { animated: true }).rotate();
    const metadata = await image.metadata();
    const main = await image
      .clone()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumbnail = await image
      .clone()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    return {
      main,
      thumbnail,
      mimeType: "image/webp",
      extension: "webp",
      width: metadata.width || null,
      height: metadata.height || null,
    };
  } catch {
    throw new AppError("The image could not be decoded", 400);
  }
}

async function getVoiceDuration(buffer, mimeType) {
  try {
    const metadata = await parseBuffer(buffer, { mimeType });
    const durationMs = Math.round(Number(metadata.format.duration || 0) * 1000);
    if (!durationMs) throw new Error("Missing duration");
    if (durationMs > 10 * 60 * 1000) {
      throw new AppError("Voice notes cannot exceed 10 minutes", 400);
    }
    return durationMs;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("The voice note duration could not be verified", 400);
  }
}

export async function uploadAttachments(files, data, actor) {
  const category = normalizeCategory(data.category);
  const userId = Number(actor?.userId);
  if (!userId) throw new AppError("Unauthorized", 401);
  if (!Array.isArray(files) || !files.length) {
    throw new AppError("At least one file is required", 400);
  }
  if (category === "voice" && files.length !== 1) {
    throw new AppError("A voice message must contain exactly one recording", 400);
  }

  await repo.assertMessagingUserActive(userId);

  const uploaded = [];
  const storedObjects = [];
  try {
    for (const file of files) {
      if (file.size > MAX_BY_CATEGORY[category]) {
        throw new AppError(`${category} file exceeds the allowed size`, 413);
      }

      const extension = normalizeExtension(file.originalname);
      const detected = await detectFile(file, category, extension);
      let mainBuffer = file.buffer;
      let thumbnailBuffer = null;
      let storedExtension = extension;
      let storedMime = detected.detectedMime;
      let width = null;
      let height = null;
      let durationMs = null;

      if (category === "image") {
        const processed = await prepareImage(file.buffer);
        mainBuffer = processed.main;
        thumbnailBuffer = processed.thumbnail;
        storedExtension = processed.extension;
        storedMime = processed.mimeType;
        width = processed.width;
        height = processed.height;
      } else if (category === "voice") {
        durationMs = await getVoiceDuration(file.buffer, detected.detectedMime);
      }

      const objectKey = buildObjectKey(storedExtension);
      const thumbnailKey = thumbnailBuffer ? buildObjectKey("webp") : null;

      await putMessagingObject({
        objectKey,
        body: mainBuffer,
        contentType: storedMime,
      });
      storedObjects.push(objectKey);
      if (thumbnailKey) {
        await putMessagingObject({
          objectKey: thumbnailKey,
          body: thumbnailBuffer,
          contentType: "image/webp",
        });
        storedObjects.push(thumbnailKey);
      }

      const attachmentId = await repo.createPendingAttachment({
        uploadedBy: userId,
        category,
        storageDriver: getMessagingStorageDriver(),
        objectKey,
        thumbnailKey,
        originalName: safeOriginalName(file.originalname),
        storedName: path.basename(objectKey),
        mimeType: storedMime,
        fileExtension: storedExtension,
        fileSize: mainBuffer.length,
        durationMs,
        width,
        height,
      });

      uploaded.push({ id: attachmentId, objectKey, thumbnailKey });
    }
  } catch (err) {
    await Promise.all(storedObjects.map((objectKey) => deleteMessagingObject(objectKey)));
    throw err;
  }

  return repo.getAttachmentsByIds(
    uploaded.map((item) => item.id),
    userId,
    { includePending: true }
  );
}

export async function getAttachmentAccess(attachmentId, userId, variant = "original") {
  const attachment = await repo.getAuthorizedAttachment(attachmentId, userId);
  if (!attachment) throw new AppError("Attachment not found", 404);

  const useThumbnail = variant === "thumbnail" && attachment.thumbnail_key;
  const objectKey = useThumbnail ? attachment.thumbnail_key : attachment.object_key;
  const signedUrl = await createMessagingObjectAccess(objectKey);

  return {
    attachment,
    objectKey,
    signedUrl,
    localPath: getLocalMessagingObjectPath(objectKey),
    mimeType: useThumbnail ? "image/webp" : attachment.mime_type,
  };
}

export function createLocalMediaToken(access, expiresInSeconds = 300) {
  if (!access.localPath) return null;
  return jwt.sign(
    {
      purpose: "messaging-media",
      attachmentId: Number(access.attachment.id),
      objectKey: access.objectKey,
      mimeType: access.mimeType,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: expiresInSeconds }
  );
}

export function verifyLocalMediaToken(token, attachmentId) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError("Media link is invalid or expired", 401);
  }
  if (
    payload?.purpose !== "messaging-media" ||
    Number(payload.attachmentId) !== Number(attachmentId)
  ) {
    throw new AppError("Media link is invalid", 401);
  }
  return {
    localPath: getLocalMessagingObjectPath(payload.objectKey),
    mimeType: payload.mimeType || "application/octet-stream",
  };
}

export async function purgeExpiredAttachments(limit = 100) {
  const attachments = await repo.listAttachmentsReadyToPurge(limit);
  let purged = 0;
  for (const attachment of attachments) {
    try {
      await deleteMessagingObject(attachment.object_key);
      await deleteMessagingObject(attachment.thumbnail_key);
      await repo.deleteAttachmentRecord(attachment.id);
      purged += 1;
    } catch (err) {
      console.error("Messaging attachment purge failed:", attachment.id, err);
    }
  }
  return { purged };
}
