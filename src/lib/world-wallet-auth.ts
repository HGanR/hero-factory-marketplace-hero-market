/**
 * Wallet-based world edit authentication.
 * Verifies that the signer owns the wallet address via EIP-191 signature.
 * Server-side only (uses viem).
 */
import { recoverAddress, hashMessage } from "viem";
import {
  WORLD_EDIT_MESSAGE_PREFIX,
  WORLD_EDIT_MESSAGE_SUFFIX,
} from "./world-wallet-auth-client";
const MAX_AGE_SEC = 300; // 5 minutes

function normalizeAddress(addr: string | null | undefined): string | null {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.trim().toLowerCase();
  return a.startsWith("0x") && a.length === 42 ? a : null;
}

/**
 * Verify wallet signature for world edit.
 * Message format: "Edit world {worldId} at {timestamp}"
 * Timestamp must be within last 5 minutes.
 */
export function verifyWorldWalletSignature(
  worldId: string,
  address: string,
  message: string,
  signature: string
): boolean {
  const addr = normalizeAddress(address);
  if (!addr) return false;

  if (
    !message.startsWith(WORLD_EDIT_MESSAGE_PREFIX) ||
    !message.includes(WORLD_EDIT_MESSAGE_SUFFIX)
  ) {
    return false;
  }

  const rest = message.slice(WORLD_EDIT_MESSAGE_PREFIX.length);
  const [idPart, tsPart] = rest.split(WORLD_EDIT_MESSAGE_SUFFIX);
  if (idPart !== worldId || !tsPart) return false;

  const ts = parseInt(tsPart, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SEC) return false;

  try {
    const messageHash = hashMessage(message);
    const recovered = recoverAddress({
      hash: messageHash,
      signature: signature as `0x${string}`,
    });
    return normalizeAddress(recovered) === addr;
  } catch {
    return false;
  }
}
