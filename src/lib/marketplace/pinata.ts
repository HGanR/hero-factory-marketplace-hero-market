import axios from "axios";
import FormData from "form-data";

/**
 * Pinata IPFS Service
 * Handles uploading NFT metadata and images to IPFS via Pinata
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY || "";
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || "";
const PINATA_JWT = process.env.PINATA_JWT || "";

const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";

/**
 * Upload JSON metadata to IPFS
 */
export async function uploadJSONToIPFS(metadata: {
  name: string;
  description: string;
  image: string;
  attributes?: any[];
  [key: string]: any;
}): Promise<{
  ipfsHash: string;
  ipfsUrl: string;
}> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (PINATA_JWT) {
      headers.Authorization = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
      headers.pinata_api_key = PINATA_API_KEY;
      headers.pinata_secret_api_key = PINATA_SECRET_KEY;
    } else {
      throw new Error("Pinata credentials not configured");
    }

    const response = await axios.post(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, metadata, { headers });

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;

    return {
      ipfsHash,
      ipfsUrl,
    };
  } catch (error) {
    console.error("Pinata JSON upload error:", error);
    throw new Error(`Failed to upload JSON to IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Upload any JSON document to IPFS (generic payload).
 */
export async function uploadArbitraryJSONToIPFS(payload: Record<string, any>): Promise<{
  ipfsHash: string;
  ipfsUrl: string;
}> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (PINATA_JWT) {
      headers.Authorization = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
      headers.pinata_api_key = PINATA_API_KEY;
      headers.pinata_secret_api_key = PINATA_SECRET_KEY;
    } else {
      throw new Error("Pinata credentials not configured");
    }

    const response = await axios.post(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, payload, { headers });
    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;
    return { ipfsHash, ipfsUrl };
  } catch (error) {
    console.error("Pinata arbitrary JSON upload error:", error);
    throw new Error(`Failed to upload JSON to IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Upload file to IPFS
 */
export async function uploadFileToIPFS(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{
  ipfsHash: string;
  ipfsUrl: string;
}> {
  try {
    if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
      throw new Error("Pinata credentials not configured");
    }

    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    });

    const metadata = JSON.stringify({
      name: fileName,
    });
    formData.append("pinataMetadata", metadata);

    const headers: Record<string, string> = {
      ...formData.getHeaders(),
    };
    if (PINATA_JWT) {
      headers.Authorization = `Bearer ${PINATA_JWT}`;
    } else {
      headers.pinata_api_key = PINATA_API_KEY;
      headers.pinata_secret_api_key = PINATA_SECRET_KEY;
    }

    const response = await axios.post(`${PINATA_API_URL}/pinning/pinFileToIPFS`, formData, {
      headers,
      maxBodyLength: Infinity,
    });

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;

    return {
      ipfsHash,
      ipfsUrl,
    };
  } catch (error) {
    console.error("Pinata file upload error:", error);
    throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Upload NFT metadata with image
 * This is a convenience function that uploads both image and metadata
 */
export async function uploadNFTMetadata(params: {
  name: string;
  description: string;
  imageBuffer?: Buffer;
  imageFileName?: string;
  imageUrl?: string;
  attributes?: any[];
  externalUrl?: string;
}): Promise<{
  metadataIpfsHash: string;
  metadataIpfsUrl: string;
  imageIpfsHash?: string;
  imageIpfsUrl?: string;
}> {
  try {
    let imageUrl = params.imageUrl || "";
    let imageIpfsHash: string | undefined;

    // Upload image if buffer is provided
    if (params.imageBuffer && params.imageFileName) {
      const imageUpload = await uploadFileToIPFS(params.imageBuffer, params.imageFileName, "image/png");
      imageUrl = imageUpload.ipfsUrl;
      imageIpfsHash = imageUpload.ipfsHash;
    }

    // Prepare metadata
    const metadata: any = {
      name: params.name,
      description: params.description,
      image: imageUrl,
    };

    if (params.attributes && params.attributes.length > 0) {
      metadata.attributes = params.attributes;
    }

    if (params.externalUrl) {
      metadata.external_url = params.externalUrl;
    }

    // Upload metadata
    const metadataUpload = await uploadJSONToIPFS(metadata);

    return {
      metadataIpfsHash: metadataUpload.ipfsHash,
      metadataIpfsUrl: metadataUpload.ipfsUrl,
      imageIpfsHash,
      imageIpfsUrl: imageUrl,
    };
  } catch (error) {
    console.error("NFT metadata upload error:", error);
    throw new Error(`Failed to upload NFT metadata: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get IPFS URL from hash
 */
export function getIPFSUrl(ipfsHash: string): string {
  return `${PINATA_GATEWAY}/ipfs/${ipfsHash}`;
}

/**
 * Convert IPFS URI to HTTP URL
 */
export function ipfsToHttp(ipfsUri: string): string {
  if (ipfsUri.startsWith("ipfs://")) {
    const hash = ipfsUri.replace("ipfs://", "");
    return `${PINATA_GATEWAY}/ipfs/${hash}`;
  }
  return ipfsUri;
}

/**
 * Test Pinata connection
 */
export async function testPinataConnection(): Promise<boolean> {
  try {
    if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
      return false;
    }

    const response = await axios.get(`${PINATA_API_URL}/data/testAuthentication`, {
      headers: PINATA_JWT
        ? { Authorization: `Bearer ${PINATA_JWT}` }
        : { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_SECRET_KEY },
    });
    return response.status === 200;
  } catch (error) {
    console.error("Pinata connection test failed:", error);
    return false;
  }
}

/**
 * Unpin content from IPFS (optional cleanup)
 */
export async function unpinFromIPFS(ipfsHash: string): Promise<void> {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error("Pinata API credentials not configured");
    }

    await axios.delete(`${PINATA_API_URL}/pinning/unpin/${ipfsHash}`, {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    });
  } catch (error) {
    console.error("Pinata unpin error:", error);
    throw new Error(`Failed to unpin from IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
