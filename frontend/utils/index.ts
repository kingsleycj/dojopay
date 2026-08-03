export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://dojopay-backend.onrender.com";

/**
 * Public base URL for task images.
 *
 * Storage moved from AWS S3 + CloudFront to Cloudflare R2. The old variable is
 * still read so a frontend deploy does not break between shipping this and
 * updating the environment — delete that fallback once `NEXT_PUBLIC_CDN_URL` is
 * set everywhere.
 *
 * Kept normalised with a trailing slash so `${CDN_URL}${key}` is always a valid
 * URL no matter how the variable was typed.
 */
function normaliseCdnUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export const CDN_URL = normaliseCdnUrl(
  process.env.NEXT_PUBLIC_CDN_URL ||
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL ||
    "https://d1vs1llhujzng9.cloudfront.net/",
);

/** @deprecated Use `CDN_URL`. Retained so existing imports keep compiling. */
export const CLOUDFRONT_URL = CDN_URL;
