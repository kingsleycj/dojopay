import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";
import { config } from "../config/index.js";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return client;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Presigned POST for a creator's task image.
 *
 * The key uses a UUID rather than the old `Math.random()`, which could collide
 * and let one upload silently overwrite another.
 */
export async function createImageUploadUrl(userId: number) {
  const key = `dojo/${userId}/${randomUUID()}/image.jpg`;

  const { url, fields } = await createPresignedPost(getClient(), {
    Bucket: config.s3.bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 0, MAX_UPLOAD_BYTES],
      ["starts-with", "$Content-Type", "image/"],
    ],
    Fields: { success_action_status: "201" },
    Expires: 3600,
  });

  return { url, fields, key };
}

/** Absolute CDN URL for a stored object key. Passes through absolute URLs unchanged. */
export function toCdnUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${config.s3.cloudfrontUrl}${imageUrl}`;
}
