import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isGlbOrGltf(filename: string) {
  const n = (filename || "").toLowerCase();
  return n.endsWith(".glb") || n.endsWith(".gltf");
}

export async function POST(req: NextRequest) {
  try {
    const pinataJwt = (process.env.PINATA_JWT || "").trim();
    if (!pinataJwt) {
      return NextResponse.json({ success: false, error: "PINATA_JWT not configured on server" }, { status: 500 });
    }
    if (/\s/.test(pinataJwt) || pinataJwt.startsWith('"') || pinataJwt.startsWith("'") || pinataJwt.endsWith('"') || pinataJwt.endsWith("'")) {
      return NextResponse.json(
        { success: false, error: "PINATA_JWT looks malformed (remove quotes/whitespace and re-save in Vercel)" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const walletAddressRaw = form.get("walletAddress");
    const walletAddress =
      typeof walletAddressRaw === "string" ? walletAddressRaw.trim() : walletAddressRaw ? String(walletAddressRaw).trim() : "";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided (expected FormData field 'file')" }, { status: 400 });
    }
    if (!isGlbOrGltf(file.name)) {
      return NextResponse.json({ success: false, error: "Only .glb and .gltf files are supported" }, { status: 400 });
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File too large. Maximum 100MB." }, { status: 400 });
    }

    // Pinata expects multipart/form-data.
    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const metadata = {
      name: file.name,
      keyvalues: {
        uploadedBy: walletAddress || "unknown",
        uploadedAt: new Date().toISOString(),
        fileType: "glb-model",
      },
    };
    pinataForm.append("pinataMetadata", JSON.stringify(metadata));

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: pinataForm,
    });

    const json = (await pinataRes.json().catch(() => null)) as any;
    if (!pinataRes.ok) {
      const msg = json?.error?.details || json?.error || json?.message || JSON.stringify(json) || pinataRes.statusText;
      return NextResponse.json({ success: false, error: `Pinata upload failed (${pinataRes.status}): ${msg}` }, { status: pinataRes.status });
    }

    const ipfsHash = json?.IpfsHash || json?.ipfsHash || json?.Hash;
    if (!ipfsHash) {
      return NextResponse.json({ success: false, error: "Pinata upload succeeded but no IpfsHash returned" }, { status: 500 });
    }

    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    return NextResponse.json({
      success: true,
      ipfsHash,
      ipfsUrl,
      fileName: file.name,
      fileSize: file.size,
      uploadedBy: walletAddress || null,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[upload-to-pinata] error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg || "Upload failed" }, { status: 500 });
  }
}





