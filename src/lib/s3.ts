import "server-only";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3 access for progress photos.
 *
 * The bucket is private. Nothing is ever served from it directly — the app
 * mints short-lived presigned URLs so the browser can PUT an upload and GET
 * a view, and the credentials never leave the server.
 */

const BUCKET = process.env.S3_PHOTOS_BUCKET;
const REGION = process.env.AWS_REGION ?? "us-east-1";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function s3Configured(): boolean {
  return Boolean(
    BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
  );
}

let cached: S3Client | null = null;
function client(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cached;
}

/**
 * Object keys are always prefixed with the owner's user id. Combined with the
 * RLS policy on progress_photos, that means one user's key can never be
 * guessed into another user's namespace.
 */
export function photoKey(userId: string, filename: string): string {
  const ext = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[0] ?? ".jpg";
  return `users/${userId}/${crypto.randomUUID()}${ext}`;
}

/** Presigned PUT so the browser uploads straight to S3, not through Vercel. */
export async function signUpload(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      // Signing the length stops a client from presenting a small file for
      // signing and then uploading something far larger.
      ContentLength: contentLength,
    }),
    { expiresIn: 60 },
  );
}

/** Presigned GET, short-lived so a copied URL doesn't stay live. */
export async function signView(key: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 300 },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
