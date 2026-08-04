"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  deleteObject,
  photoKey,
  s3Configured,
  signUpload,
} from "@/lib/s3";

export type UploadTicket =
  | { ok: true; url: string; key: string }
  | { ok: false; error: string };

/**
 * Per-account ceiling. The demo account is public, so without a cap any
 * visitor could fill the bucket; this bounds storage for every account
 * rather than special-casing the demo.
 */
const MAX_PHOTOS_PER_USER = 30;

/**
 * Issues a short-lived presigned PUT so the browser can upload directly to
 * S3. Type and size are validated here, before signing — a signature is a
 * capability, so it must never be minted for something we'd reject later.
 */
export async function createUploadTicket(
  filename: string,
  contentType: string,
  byteSize: number,
): Promise<UploadTicket> {
  const { userId } = await requireOnboarded();

  if (!s3Configured()) {
    return { ok: false, error: "Photo storage isn't configured on this deployment." };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(contentType as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return { ok: false, error: "Only JPEG, PNG or WebP images are supported." };
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Images must be under 8 MB." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("progress_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= MAX_PHOTOS_PER_USER) {
    return {
      ok: false,
      error: `You've reached the ${MAX_PHOTOS_PER_USER} photo limit. Delete one to add another.`,
    };
  }

  const key = photoKey(userId, filename);
  const url = await signUpload(key, contentType, byteSize);
  return { ok: true, url, key };
}

/**
 * Records a completed upload. The key is re-derived against the caller's own
 * id rather than trusted, so a client can't claim an object in someone
 * else's prefix.
 */
export async function confirmUpload(
  key: string,
  contentType: string,
  byteSize: number,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireOnboarded();

  if (!key.startsWith(`users/${userId}/`)) {
    return { ok: false, error: "That upload doesn't belong to you." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("progress_photos").insert({
    user_id: userId,
    s3_key: key,
    content_type: contentType,
    byte_size: byteSize,
    note: note?.slice(0, 200) || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/photos");
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireOnboarded();
  const supabase = await createClient();

  // RLS already scopes this, but fetch first so we know which object to remove
  // from S3 and can confirm ownership explicitly.
  const { data: photo } = await supabase
    .from("progress_photos")
    .select("id, user_id, s3_key")
    .eq("id", id)
    .single();

  if (!photo || photo.user_id !== userId) {
    return { ok: false, error: "Photo not found." };
  }

  const { error } = await supabase.from("progress_photos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Best effort: a row removed but an object left behind is recoverable,
  // the reverse would show a broken image.
  try {
    await deleteObject(photo.s3_key);
  } catch (e) {
    console.error("Failed to delete S3 object", photo.s3_key, e);
  }

  revalidatePath("/photos");
  return { ok: true };
}
