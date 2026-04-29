import fs from "fs/promises";
import path from "path";

export async function writeExhibitFile(opts: { fileHash: string; ext: string; bytes: Buffer }) {
  const dir = path.join(process.cwd(), "uploads", "exhibits");
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${opts.fileHash}.${opts.ext}`;
  const storagePath = path.join(dir, fileName);
  await fs.writeFile(storagePath, opts.bytes);

  return { storagePath, fileName };
}
