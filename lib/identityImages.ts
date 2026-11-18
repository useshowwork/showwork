import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { deleteObject, publicUrlFor, putIdentityImage } from "@/lib/r2";
import { IDENTITY_IMAGE_CROP_SIZE, IDENTITY_IMAGE_MAX_BYTES, IDENTITY_IMAGE_MAX_PIXELS, IDENTITY_IMAGE_TYPES } from "@/lib/identityImageLimits";

export async function updateIdentityImage(
  request: Request,
  prefix: string,
  currentUrl: string | null,
  save: (url: string | null) => Promise<boolean>,
) {
  let key: string | undefined;
  if (request.method !== "DELETE") {
    const type = request.headers.get("content-type");
    if (!type || !IDENTITY_IMAGE_TYPES.includes(type) || !request.body) {
      return NextResponse.json({ error: "Choose a JPG, PNG or WebP image." }, { status: 415 });
    }
    if (Number(request.headers.get("content-length")) > IDENTITY_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let image: Buffer;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > IDENTITY_IMAGE_MAX_BYTES) {
          await reader.cancel().catch(() => undefined);
          return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });
        }
        chunks.push(value);
      }
      const input = sharp(Buffer.concat(chunks), { limitInputPixels: IDENTITY_IMAGE_MAX_PIXELS });
      const { format } = await input.metadata();
      if (format !== "jpeg" && format !== "png" && format !== "webp") {
        return NextResponse.json({ error: "Choose a JPG, PNG or WebP image." }, { status: 415 });
      }
      image = await input.rotate().resize(IDENTITY_IMAGE_CROP_SIZE, IDENTITY_IMAGE_CROP_SIZE, { fit: "cover" }).webp({ quality: 86 }).toBuffer();
    } catch {
      return NextResponse.json({ error: "This image couldn't be read. Try another JPG, PNG or WebP." }, { status: 400 });
    } finally {
      reader.releaseLock();
    }

    key = prefix + randomUUID() + ".webp";
    try {
      await putIdentityImage(key, image);
    } catch (error) {
      console.error("Identity image upload failed", error);
      return NextResponse.json({ error: "Couldn't upload the image. Try again." }, { status: 503 });
    }
  }

  const imageUrl = key ? publicUrlFor(key) : null;
  try {
    if (!await save(imageUrl)) {
      if (key) await removeStoredImage(key);
      return NextResponse.json({ error: "The image changed. Refresh and try again." }, { status: 409 });
    }
  } catch (error) {
    console.error("Identity image save failed", error);
    return NextResponse.json({ error: "Couldn't save the image. Refresh and try again." }, { status: 503 });
  }

  const publicPrefix = publicUrlFor(prefix);
  if (currentUrl?.startsWith(publicPrefix)) {
    const oldKey = currentUrl.slice(publicPrefix.length);
    if (/^[0-9a-f-]{36}\.webp$/.test(oldKey)) await removeStoredImage(prefix + oldKey);
  }
  return NextResponse.json({ imageUrl });
}

async function removeStoredImage(key: string) {
  try {
    await deleteObject(key);
  } catch (error) {
    console.warn("Identity image cleanup failed", error);
  }
}
