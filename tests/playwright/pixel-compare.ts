import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export type PixelCompareResult = {
  diffPixels: number;
  totalPixels: number;
  ratio: number;
};

/** Compare same-sized PNG buffers; returns diff ratio 0..1 */
export function comparePngBuffers(a: Buffer, b: Buffer): PixelCompareResult {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error(`Size mismatch: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`);
  }
  const diff = Buffer.alloc(imgA.width * imgA.height * 4);
  const diffPixels = pixelmatch(imgA.data, imgB.data, diff, imgA.width, imgA.height, { threshold: 0.15 });
  const totalPixels = imgA.width * imgA.height;
  return { diffPixels, totalPixels, ratio: diffPixels / totalPixels };
}
