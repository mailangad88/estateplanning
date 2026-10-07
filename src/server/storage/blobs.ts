/**
 * Byte storage for firm agreement PDFs and generated signed copies, on top of the Db (`stored_blobs` in
 * db/schema.sql). Postgres keeps the bytes as base64 text, which costs nothing extra; callers only see
 * putBlob / getBlob, so object storage can replace it later. Rows are insert-only: a key always holds the
 * same bytes, which is what lets a signature record bind to a hash.
 *
 * Reads and writes go through the service-role store after the caller's own policy check: no user role has
 * a database path to these bytes.
 */
import { createHash } from "node:crypto";
import type { Db } from "@/server/db";
import type { StoredBlob } from "@/server/types";

export const MAX_AGREEMENT_PDF_BYTES = 5 * 1024 * 1024;

export const sha256Hex = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

export async function putBlob(
  db: Db,
  input: { key: string; bytes: Uint8Array; contentType: string; createdBy: string; firmId?: string; leadId?: string },
  now = new Date(),
): Promise<StoredBlob> {
  const sha256 = sha256Hex(input.bytes);
  const existing = await db.blobs.get(input.key);
  if (existing) {
    if (existing.sha256 !== sha256) throw new Error("a stored file with this key already holds different bytes");
    return existing;
  }
  return db.blobs.insert({
    id: input.key,
    sha256,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
    data: Buffer.from(input.bytes).toString("base64"),
    firmId: input.firmId,
    leadId: input.leadId,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  });
}

/** The bytes and their hash, checked against the stored hash so a damaged row is never served as the signed document. */
export async function getBlob(db: Db, key: string): Promise<{ blob: StoredBlob; bytes: Buffer } | undefined> {
  const blob = await db.blobs.get(key);
  if (!blob) return undefined;
  const bytes = Buffer.from(blob.data, "base64");
  if (sha256Hex(bytes) !== blob.sha256) throw new Error(`stored file failed its integrity check: ${key}`);
  return { blob, bytes };
}
