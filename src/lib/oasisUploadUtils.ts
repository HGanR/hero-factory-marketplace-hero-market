/**
 * GLB Upload Utilities (client-safe)
 * - File validation
 * - File picker helper
 * - Drag/drop helper
 * - Optional File -> dataURL for local previews
 *
 * NOTE: Do NOT put Pinata/NFT.Storage secrets in client code.
 * Uploads should be performed server-side via API routes.
 */
export function isModelFile(file: File): boolean {
  const name = (file?.name || "").toLowerCase();
  const type = (file?.type || "").toLowerCase();
  return (
    name.endsWith(".glb") ||
    name.endsWith(".gltf") ||
    type === "model/gltf-binary" ||
    type === "model/gltf+json"
  );
}

export function openFilePicker(inputElement: HTMLInputElement | null) {
  if (!inputElement) return;
  // Modern Chromium supports showPicker(); fallback to click() for Safari/Firefox.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyInput = inputElement as any;
    if (typeof anyInput.showPicker === "function") {
      anyInput.showPicker();
      return;
    }
  } catch {
    // ignore
  }
  inputElement.click();
}

export function pickFirstFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer?.files || dataTransfer.files.length === 0) return null;
  return dataTransfer.files[0] ?? null;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload GLB/GLTF to Pinata via our server API.
 * The server holds PINATA_JWT; the client never sees it.
 */
export async function uploadToPinata(
  file: File,
  walletAddress: string
): Promise<{ success: boolean; ipfsHash?: string; ipfsUrl?: string; error?: string }> {
  try {
    if (!isModelFile(file)) {
      return { success: false, error: "Invalid file type. Please upload a .glb or .gltf file." };
    }
    if (file.size > 100 * 1024 * 1024) {
      return { success: false, error: "File too large. Maximum 100MB." };
    }
    if (!walletAddress?.trim()) {
      return { success: false, error: "Wallet address required for upload." };
    }

    const form = new FormData();
    form.append("file", file);
    form.append("walletAddress", walletAddress.trim());

    const res = await fetch("/api/upload-to-pinata", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return { success: false, error: data?.error || `Upload failed (${res.status})` };
    }
    if (!data?.success) return { success: false, error: data?.error || "Upload failed" };
    return { success: true, ipfsHash: data.ipfsHash, ipfsUrl: data.ipfsUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg || "Upload failed" };
  }
}

export function validateWalletConnection(
  address: string | undefined,
  isConnected: boolean
): { valid: boolean; message?: string } {
  if (!isConnected) return { valid: false, message: "Please connect your wallet first" };
  if (!address) return { valid: false, message: "Wallet address not found" };
  return { valid: true };
}


