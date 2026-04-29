// lib/storage.ts
import { NFTStorage } from "nft.storage";

type IpfsProvider = "nftstorage" | "pinata";

function getIpfsProvider(): IpfsProvider {
  const raw = (process.env.IPFS_PROVIDER || "").trim().toLowerCase();
  if (raw === "nftstorage" || raw === "pinata") return raw as IpfsProvider;
  // Auto-prefer pinata if configured (avoids NFT.Storage token issues when you're using Pinata).
  if ((process.env.PINATA_JWT || "").trim()) return "pinata";
  return "nftstorage";
}

function getNftStorageToken(): string {
  // Server-only secret preferred. Keep backward-compatible fallback for existing deploys.
  const raw = process.env.NFT_STORAGE_TOKEN || process.env.NEXT_PUBLIC_NFT_STORAGE_TOKEN || "";
  const token = raw.trim();
  if (!token) throw new Error("Missing NFT_STORAGE_TOKEN");

  // Common Vercel copy/paste issues
  if (token.startsWith('"') || token.startsWith("'") || token.endsWith('"') || token.endsWith("'")) {
    throw new Error(
      "NFT_STORAGE_TOKEN looks quoted. Paste the raw token value without surrounding quotes."
    );
  }
  if (/\s/.test(token)) {
    throw new Error(
      "NFT_STORAGE_TOKEN contains whitespace/newlines. Re-copy the token (no spaces) and re-save in Vercel."
    );
  }

  // NFT.Storage currently expects a JWT-like bearer token (two dots).
  // Older "hex.hex" style keys may exist in the wild, but they fail against the current upload API
  // with: ERROR_MALFORMED_TOKEN ("API Key is malformed or failed to parse.")
  const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  const hexDotLike = /^[a-f0-9]{8,}\.[a-f0-9]{16,}$/i.test(token);

  if (hexDotLike && !jwtLike) {
    throw new Error(
      "NFT_STORAGE_TOKEN looks like a legacy NFT.Storage key (hex.hex). The current NFT.Storage upload API expects a JWT-like token (typically starts with 'eyJ' and has 2 dots: a.b.c). " +
        "Please generate a new API key/token from the current NFT.Storage dashboard and update NFT_STORAGE_TOKEN in Vercel."
    );
  }

  if (!jwtLike) {
    throw new Error(
      "NFT_STORAGE_TOKEN appears malformed. Re-copy the token from the NFT.Storage dashboard and paste it into Vercel → Environment Variables (no quotes/spaces). " +
        "Create/copy a new token from the NFT.Storage dashboard and paste it into Vercel → Environment Variables."
    );
  }

  return token;
}

function getPinataJwt(): string {
  const raw = process.env.PINATA_JWT || "";
  const token = raw.trim();
  if (!token) {
    throw new Error(
      "Missing PINATA_JWT. Set IPFS_PROVIDER=pinata and add PINATA_JWT in Vercel → Environment Variables."
    );
  }
  if (token.startsWith('"') || token.startsWith("'") || token.endsWith('"') || token.endsWith("'")) {
    throw new Error("PINATA_JWT looks quoted. Paste the raw token value without surrounding quotes.");
  }
  if (/\s/.test(token)) {
    throw new Error("PINATA_JWT contains whitespace/newlines. Re-copy the token (no spaces) and re-save in Vercel.");
  }
  // Pinata JWTs are JWT-like bearer tokens.
  const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  if (!jwtLike) {
    throw new Error(
      "PINATA_JWT appears malformed. Pinata JWTs are typically JWT-like tokens with 2 dots (a.b.c)."
    );
  }
  return token;
}

/**
 * Upload a single asset as an NFT.Storage "image" and return ipfs://.../metadata.json
 */
export async function uploadToIPFS(opts: {
  name: string;
  description: string;
  file: File | Blob; // Use the browser's File/Blob
}) {
  const provider = getIpfsProvider();
  if (provider !== "nftstorage") {
    throw new Error(
      `uploadToIPFS(metadata) is only implemented for IPFS_PROVIDER=nftstorage in this build (current: ${provider}).`
    );
  }
  const token = getNftStorageToken();
  const client = new NFTStorage({ token });

  // If it's already a File, keep the name/type; if it's a Blob, give defaults.
  const asFile =
    "name" in opts.file
      ? (opts.file as File)
      : new File([opts.file], "image.png", { type: "image/png" });

  const metadata = await client.store({
    name: opts.name,
    description: opts.description,
    image: asFile,
  });

  return metadata.url; // ipfs://<CID>/metadata.json
}

/**
 * Upload an arbitrary file/blob directly (PDFs, images, etc) and return ipfs://<CID>
 * Useful for document uploads (no NFT metadata wrapper).
 */
export async function uploadBlobToIPFS(file: File | Blob) {
  const provider = getIpfsProvider();
  if (provider === "pinata") {
    // Use Pinata "pinFileToIPFS" endpoint (works well for images, glb, etc).
    // https://docs.pinata.cloud/api-reference/endpoint/pin-file-to-ipfs
    const jwt = getPinataJwt();
    const form = new FormData();
    const asFile =
      "name" in (file as any)
        ? (file as File)
        : new File([file], "upload.bin", { type: (file as any)?.type || "application/octet-stream" });
    form.append("file", asFile);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      const msg = json?.error?.details || json?.error || json?.message || JSON.stringify(json) || res.statusText;
      throw new Error(`Pinata upload failed (${res.status}): ${msg}`);
    }
    const cid = json?.IpfsHash || json?.ipfsHash || json?.Hash;
    if (!cid) throw new Error("Pinata upload succeeded but no CID was returned.");
    return `ipfs://${cid}`;
  }

  // Default: NFT.Storage SDK (classic upload).
  const token = getNftStorageToken();
  const client = new NFTStorage({ token });
  const cid = await client.storeBlob(file);
  return `ipfs://${cid}`;
}

/** Turn ipfs://... into a public gateway URL */
export function toGateway(ipfsUri: string) {
  return ipfsUri.replace("ipfs://", "https://nftstorage.link/ipfs/");
}

