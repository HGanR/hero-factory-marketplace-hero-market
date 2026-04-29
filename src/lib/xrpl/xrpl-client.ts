import "server-only";

/**
 * XRPL service singletons (server-side only)
 *
 * Next.js automatically loads `.env*` files; no need to call `dotenv.config()` here.
 */

import { Logger } from "./logger";
import { XRPLTrustLineManager } from "./xrpl-trustline-manager";
import { XRPLIOUIssuer } from "./xrpl-iou-issuer";

// xrpl Client requires a WebSocket endpoint (wss:// or ws://)
export const XRPL_DEFAULT_RPC_URL = "wss://s.altnet.rippletest.net:51233";

export function getXrplEnv() {
  return {
    rpcUrl: process.env.XRPL_RPC_URL || XRPL_DEFAULT_RPC_URL,
    issuerAddress: process.env.XRPL_ISSUER_ADDRESS || "",
    issuerSeed: process.env.XRPL_ISSUER_SEED || "",
    trustAddress: process.env.XRPL_TRUST_ADDRESS || "",
    trustSeed: process.env.XRPL_TRUST_SEED || "",
  };
}

const logger = new Logger("XRPL");

let _trustLineManager: XRPLTrustLineManager | null = null;
let _iouIssuer: XRPLIOUIssuer | null = null;
let _lastKey: string | null = null;

function assertWsUrl(url: string) {
  if (!/^wss?:\/\//.test(url) && !/^wss\+unix:\/\//.test(url) && !/^ws\+unix:\/\//.test(url)) {
    throw new Error(
      `XRPL_RPC_URL must be a WebSocket URL (wss:// or ws://). Got: ${url}`
    );
  }
}

/**
 * Lazy singletons so Next build can import modules without immediately instantiating a websocket client.
 */
export function getTrustLineManager(): XRPLTrustLineManager {
  const env = getXrplEnv();
  assertWsUrl(env.rpcUrl);
  const key = `${env.rpcUrl}`;
  if (!_trustLineManager || _lastKey !== key) {
    _trustLineManager = new XRPLTrustLineManager(env.rpcUrl, logger);
    _lastKey = key;
  }
  return _trustLineManager;
}

export function getIouIssuer(): XRPLIOUIssuer {
  const env = getXrplEnv();
  assertWsUrl(env.rpcUrl);
  const key = `${env.rpcUrl}::${env.issuerSeed}`;
  if (!_iouIssuer || _lastKey !== key) {
    _iouIssuer = new XRPLIOUIssuer(env.rpcUrl, env.issuerSeed, logger);
    _lastKey = key;
  }
  return _iouIssuer;
}


