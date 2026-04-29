export function toBigIntLE(buf: Buffer): bigint {
  const reversed = Buffer.from(buf);
  reversed.reverse();
  const hex = reversed.toString("hex");
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

export function toBigIntBE(buf: Buffer): bigint {
  const hex = buf.toString("hex");
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

export function toBufferLE(num: bigint, width: number): Buffer {
  const hex = num.toString(16);
  const buffer = Buffer.from(hex.padStart(width * 2, "0").slice(0, width * 2), "hex");
  buffer.reverse();
  return buffer;
}

export function toBufferBE(num: bigint, width: number): Buffer {
  const hex = num.toString(16);
  return Buffer.from(hex.padStart(width * 2, "0").slice(0, width * 2), "hex");
}
