import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { config } from "../config/index.js";

/**
 * Object storage: Cloudflare R2.
 *
 * R2 speaks the S3 API, so the AWS SDK is still the client — but three details
 * differ and each one fails in a way that is hard to read from the error:
 *
 *  1. **`region` must be the literal `"auto"`.** R2 has no regions. A real AWS
 *     region name is accepted by the SDK and then rejected at signing time.
 *  2. **A custom `endpoint` is required**, pointing at the account's R2 host.
 *     Without it the SDK signs for `s3.amazonaws.com` and the request leaves
 *     for the wrong provider entirely.
 *  3. **Uploads are presigned PUT, not presigned POST.** R2 does not implement
 *     S3's `POST Object` form-upload API, so the browser sends the file as a
 *     PUT body rather than as `multipart/form-data` with policy fields. This is
 *     the one change that is not merely configuration — see `createImageUploadUrl`.
 */

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      // Not configurable: R2 rejects anything else at signature verification.
      region: "auto",
      endpoint: config.storage.endpoint,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
      /**
       * R2 addresses buckets by path (`<endpoint>/<bucket>/<key>`), not by
       * virtual host. Left on the SDK default the request would go to
       * `<bucket>.<account>.r2.cloudflarestorage.com`, which does not resolve.
       */
      forcePathStyle: true,
    });
  }
  return client;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Reset the cached client. Test-only. */
export function __resetStorageClient(): void {
  client = null;
}

/**
 * A presigned PUT URL for a creator's task image.
 *
 * Returns the same `{ url, fields, key }` shape the presigned-POST version did,
 * with `fields` reduced to `{ key }`. Keeping the shape means the API contract
 * and the frontend's error handling do not have to change in the same commit as
 * the storage provider — the browser just sends a PUT with the file as the body
 * instead of assembling a form.
 *
 * The key uses a UUID rather than the old `Math.random()`, which could collide
 * and let one upload silently overwrite another.
 */
export async function createImageUploadUrl(userId: number, contentType = "image/jpeg") {
  const key = `dojo/${userId}/${randomUUID()}/image.jpg`;

  const url = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );

  return {
    url,
    key,
    fields: { key },
    /**
     * Enforced by the browser before sending and by the composer before
     * accepting the result. R2 cannot enforce it at upload time the way an S3
     * POST policy's `content-length-range` condition could, so this is
     * advertised rather than guaranteed — noted so the limit is not mistaken
     * for a server-side control.
     */
    maxBytes: MAX_UPLOAD_BYTES,
    /** Where the object will be readable once the PUT succeeds. */
    publicUrl: `${config.storage.publicUrl}${key}`,
  };
}

/** Absolute public URL for a stored object key. Passes absolute URLs through unchanged. */
export function toCdnUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${config.storage.publicUrl}${imageUrl}`;
}
