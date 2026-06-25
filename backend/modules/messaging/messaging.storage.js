import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppError from "../../core/errors/AppError.js";

const driver = String(process.env.MESSAGING_STORAGE_DRIVER || "local").toLowerCase();
const localRoot = path.resolve(
  process.env.MESSAGING_LOCAL_STORAGE_PATH || "private_uploads/messaging"
);

let s3Client;

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "auto";
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new AppError("S3 messaging storage is not fully configured", 500);
  }

  return { bucket, region, endpoint, accessKeyId, secretAccessKey };
}

function getS3Client() {
  if (s3Client) return s3Client;
  const config = getS3Config();
  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle:
      String(process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function resolveLocalPath(objectKey) {
  const target = path.resolve(localRoot, objectKey);
  const relative = path.relative(localRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("Invalid messaging object key", 400);
  }
  return target;
}

export function getMessagingStorageDriver() {
  if (!["local", "s3"].includes(driver)) {
    throw new AppError("Unsupported messaging storage driver", 500);
  }
  return driver;
}

export async function putMessagingObject({ objectKey, body, contentType }) {
  if (getMessagingStorageDriver() === "s3") {
    const config = getS3Config();
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }

  const target = resolveLocalPath(objectKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
}

export async function deleteMessagingObject(objectKey) {
  if (!objectKey) return;

  if (getMessagingStorageDriver() === "s3") {
    const config = getS3Config();
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      })
    );
    return;
  }

  await fs.rm(resolveLocalPath(objectKey), { force: true });
}

export async function createMessagingObjectAccess(objectKey, expiresIn = 300) {
  if (getMessagingStorageDriver() !== "s3") {
    return null;
  }

  const config = getS3Config();
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
    { expiresIn }
  );
}

export function getLocalMessagingObjectPath(objectKey) {
  if (getMessagingStorageDriver() !== "local") return null;
  return resolveLocalPath(objectKey);
}
