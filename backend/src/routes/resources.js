import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { requireSession } from "../middleware/requireSession.js";
import { Group } from "../models/Group.js";
import { Membership } from "../models/Membership.js";
import { Resource } from "../models/Resource.js";

const router = Router();
const resourcePath = "/groups/:groupId/resources";
const maxFileBytes = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes + 1, files: 1, fields: 0 },
}).single("file");

let s3;

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function publicResource(resource) {
  return {
    id: resource.id,
    filename: resource.filename,
    mimeType: resource.mimeType,
    sizeBytes: resource.sizeBytes,
    createdAt: resource.createdAt,
  };
}

async function requireGroupAccess(req, res, next) {
  const { groupId } = req.params;

  if (!mongoose.isObjectIdOrHexString(groupId)) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  const group = await Group.findOne({ _id: groupId, deletedAt: null }).select(
    "ownerId",
  );

  if (!group) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  const isMember =
    group.ownerId.equals(req.user._id) ||
    Boolean(
      await Membership.exists({ groupId: group._id, userId: req.user._id }),
    );

  if (!isMember) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  req.studyGroup = group;
  next();
}

function parseUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return fail(res, 413, "FILE_TOO_LARGE", "Choose a file up to 10 MB.");
    }

    return fail(res, 400, "INVALID_UPLOAD", "Send one file in the file field.");
  });
}

function detectMimeType(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "image/png";
  }

  if (buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) {
    return "image/jpeg";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function getStorage() {
  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.S3_BUCKET?.trim();

  if (!region || !bucket) return null;

  s3 ??= new S3Client({ region });
  return { client: s3, bucket };
}

const groupAccess = [requireSession, requireGroupAccess];

router.get(resourcePath, ...groupAccess, async (req, res) => {
  const resources = await Resource.find({ groupId: req.studyGroup._id }).sort({
    createdAt: -1,
    _id: -1,
  });

  res.json({ resources: resources.map(publicResource) });
});

router.post(resourcePath, ...groupAccess, parseUpload, async (req, res) => {
  const file = req.file;

  if (!file || file.size === 0) {
    return fail(res, 400, "FILE_REQUIRED", "Choose a file to upload.");
  }

  if (file.size > maxFileBytes) {
    return fail(res, 413, "FILE_TOO_LARGE", "Choose a file up to 10 MB.");
  }

  const mimeType = detectMimeType(file.buffer);

  if (!mimeType) {
    return fail(
      res,
      415,
      "UNSUPPORTED_FILE",
      "Upload a PDF, PNG, JPEG, or WebP file.",
    );
  }

  const storage = getStorage();

  if (!storage) {
    return fail(
      res,
      503,
      "STORAGE_UNAVAILABLE",
      "File storage is not configured.",
    );
  }

  const groupId = req.studyGroup._id;
  const objectKey = `studysync/${groupId}/${randomUUID()}`;
  const filename =
    file.originalname
      .replace(/[\x00-\x1f\x7f]/g, "")
      .trim()
      .slice(0, 255) || "resource";

  await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: mimeType,
    }),
  );

  let resource;

  try {
    resource = await Resource.create({
      groupId,
      uploaderId: req.user._id,
      objectKey,
      filename,
      mimeType,
      sizeBytes: file.size,
    });
  } catch (error) {
    try {
      await storage.client.send(
        new DeleteObjectCommand({
          Bucket: storage.bucket,
          Key: objectKey,
        }),
      );
    } catch (cleanupError) {
      console.error("S3 upload cleanup failed", {
        objectKey,
        name: cleanupError.name,
      });
    }

    throw error;
  }

  res.status(201).json({ resource: publicResource(resource) });
});

router.get(
  `${resourcePath}/:resourceId/download`,
  ...groupAccess,
  async (req, res) => {
    const { resourceId } = req.params;

    if (!mongoose.isObjectIdOrHexString(resourceId)) {
      return fail(res, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
    }

    const resource = await Resource.findOne({
      _id: resourceId,
      groupId: req.studyGroup._id,
    });

    if (!resource) {
      return fail(res, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
    }

    const storage = getStorage();

    if (!storage) {
      return fail(
        res,
        503,
        "STORAGE_UNAVAILABLE",
        "File storage is not configured.",
      );
    }

    const safeName = resource.filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
    const command = new GetObjectCommand({
      Bucket: storage.bucket,
      Key: resource.objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    });

    const url = await getSignedUrl(storage.client, command, { expiresIn: 60 });

    res.set("Cache-Control", "no-store");
    return res.redirect(302, url);
  },
);

export default router;
