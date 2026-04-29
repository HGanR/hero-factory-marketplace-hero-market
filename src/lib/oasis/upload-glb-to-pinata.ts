/**
 * Server-side: upload GLB buffer to Pinata IPFS.
 * Returns ipfs:// CID for durable asset storage.
 * Used by asset generate (mode=register) and register-from-preview.
 */
export async function uploadGlbToPinata(
  buffer: Buffer,
  filename: string,
  metadata?: { source?: string; kind?: string; prompt?: string }
): Promise<{ ipfsHash: string; assetUri: string }> {
  const pinataJwt = (process.env.PINATA_JWT || "").trim();
  if (!pinataJwt) {
    throw new Error("PINATA_JWT not configured");
  }
  if (/\s/.test(pinataJwt) || pinataJwt.startsWith('"') || pinataJwt.startsWith("'")) {
    throw new Error("PINATA_JWT looks malformed");
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: "model/gltf-binary" });
  form.append("file", blob, filename);

  const pinataMetadata = {
    name: filename,
    keyvalues: {
      source: metadata?.source ?? "oasis-asset-gen",
      kind: metadata?.kind ?? "unknown",
      uploadedAt: new Date().toISOString(),
    } as Record<string, string>,
  };
  if (metadata?.prompt) {
    pinataMetadata.keyvalues.prompt = metadata.prompt.slice(0, 200);
  }
  form.append("pinataMetadata", JSON.stringify(pinataMetadata));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
  });

  const json = (await res.json().catch(() => null)) as {
    IpfsHash?: string;
    ipfsHash?: string;
    Hash?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    const msg = json?.error || json?.message || JSON.stringify(json) || res.statusText;
    throw new Error(`Pinata upload failed: ${msg}`);
  }

  const ipfsHash = json?.IpfsHash || json?.ipfsHash || json?.Hash;
  if (!ipfsHash) {
    throw new Error("Pinata upload succeeded but no IpfsHash returned");
  }

  return {
    ipfsHash,
    assetUri: `ipfs://${ipfsHash}`,
  };
}
