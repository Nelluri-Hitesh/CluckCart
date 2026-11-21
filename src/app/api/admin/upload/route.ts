import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { handler, json } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

function detectExt(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export const POST = handler(async (req) => {
  await requireApi(["admin"]);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Choose an image file");
  if (file.size > 4 * 1024 * 1024) throw new AppError("Image must be smaller than 4 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detectExt(buf); // trust the file's bytes, not its name or declared type
  if (!ext) throw new AppError("Only JPG, PNG or WebP images are allowed");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return json({ url: `/api/uploads/${name}` }, 201);
});
