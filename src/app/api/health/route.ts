// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const rawIpfsProvider = (process.env.IPFS_PROVIDER || "").trim();
  const ipfsProvider = rawIpfsProvider || "nftstorage";

  const rawToken = process.env.NFT_STORAGE_TOKEN || "";
  const trimmedToken = rawToken.trim();
  const tokenFormatOk =
    !trimmedToken
      ? false
      : !(trimmedToken.startsWith('"') || trimmedToken.startsWith("'") || trimmedToken.endsWith('"') || trimmedToken.endsWith("'")) &&
        !/\s/.test(trimmedToken) &&
        // JWT-like (two dots). Older hex.hex keys will be rejected by current NFT.Storage upload API.
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmedToken);

  const pinataJwt = (process.env.PINATA_JWT || "").trim();
  const pinataJwtOk =
    !!pinataJwt &&
    !(pinataJwt.startsWith('"') || pinataJwt.startsWith("'") || pinataJwt.endsWith('"') || pinataJwt.endsWith("'")) &&
    !/\s/.test(pinataJwt) &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(pinataJwt);

  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? "✅ Set" : "❌ Missing",
    ADMIN_USERNAME: process.env.ADMIN_USERNAME ? "✅ Set" : "❌ Missing",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? "✅ Set" : "❌ Missing",
    JWT_SECRET: process.env.JWT_SECRET ? "✅ Set" : "❌ Missing",
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ? "✅ Set" : "❌ Missing",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? "✅ Set" : "⚠️ Optional (recommended)",
    // Used server-side for IPFS uploads (admin uploads .glb, previews, etc.)
    NFT_STORAGE_TOKEN: process.env.NFT_STORAGE_TOKEN ? "✅ Set" : "❌ Missing",
    // Backward-compat fallback (optional; avoid using for secrets in new deploys)
    NEXT_PUBLIC_NFT_STORAGE_TOKEN: process.env.NEXT_PUBLIC_NFT_STORAGE_TOKEN ? "✅ Set" : "⚠️ Optional (not set)",
    // Alternative IPFS provider (recommended if you can't get a JWT-style NFT.Storage token)
    IPFS_PROVIDER: process.env.IPFS_PROVIDER ? "✅ Set" : "⚠️ Optional (defaulting to nftstorage)",
    PINATA_JWT: process.env.PINATA_JWT ? "✅ Set" : "⚠️ Optional (not set)",
  };

  // Only require server-side NFT_STORAGE_TOKEN (NEXT_PUBLIC_NFT_STORAGE_TOKEN is intentionally optional).
  const requiredKeys: Array<keyof typeof envVars> = [
    "DATABASE_URL",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "JWT_SECRET",
    "NEXT_PUBLIC_APP_NAME",
    // Require provider-specific IPFS token
    ...(ipfsProvider.toLowerCase() === "pinata" ? (["PINATA_JWT"] as const) : (["NFT_STORAGE_TOKEN"] as const)),
  ];
  const allSet = requiredKeys.every((k) => envVars[k] === "✅ Set");

  return NextResponse.json({
    status: allSet ? "healthy" : "missing_env_vars",
    environment: process.env.NODE_ENV,
    environmentVariables: envVars,
    ipfsProvider,
    nftStorageTokenFormat: tokenFormatOk ? "✅ Looks valid" : "⚠️ Looks malformed",
    pinataJwtFormat: pinataJwtOk ? "✅ Looks valid" : "⚠️ Not set / malformed",
    message: allSet 
      ? "All environment variables are set correctly!" 
      : "Some environment variables are missing. Please add them in Vercel Dashboard → Settings → Environment Variables",
  });
}

