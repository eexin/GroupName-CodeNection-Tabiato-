/** Browser-only image helpers, shared by photo upload and trip covers. */

export const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** HEIC → JPEG, then shrink to 2048px. Runs AFTER EXIF has been read, because this strips it. */
export async function prepareImage(file: File, maxEdge = 2048): Promise<{ blob: Blob; width: number; height: number }> {
  let source: Blob = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    source = Array.isArray(out) ? out[0] : out;
  }
  const bmp = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  return { blob, width, height };
}

