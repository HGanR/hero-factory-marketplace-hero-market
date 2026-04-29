import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const pinataJwt = (process.env.PINATA_JWT || "").trim();
    if (!pinataJwt) {
      return NextResponse.json({ ok: false, error: "PINATA_JWT not configured on server" }, { status: 500 });
    }
    if (
      /\s/.test(pinataJwt) ||
      pinataJwt.startsWith('"') ||
      pinataJwt.startsWith("'") ||
      pinataJwt.endsWith('"') ||
      pinataJwt.endsWith("'")
    ) {
      return NextResponse.json(
        { ok: false, error: "PINATA_JWT looks malformed (remove quotes/whitespace and re-save in Vercel)" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const attributesRaw = String(form.get("attributes") || "").trim();
    const imageUrl = String(form.get("imageUrl") || "").trim();

    if (!file && !imageUrl) {
      return NextResponse.json(
        { ok: false, error: "No file or imageUrl provided (expected FormData field 'file' or 'imageUrl')" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ ok: false, error: "Missing description" }, { status: 400 });
    }

    let attributes: Array<{ trait_type?: string; value?: string | number }> | undefined;
    if (attributesRaw) {
      try {
        const parsed = JSON.parse(attributesRaw);
        if (Array.isArray(parsed)) attributes = parsed;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid attributes JSON" }, { status: 400 });
      }
    }

    let imageIpfsUrl = imageUrl;
    let imageGatewayUrl = imageUrl;

    if (file) {
      const pinataForm = new FormData();
      pinataForm.append("file", file);
      pinataForm.append(
        "pinataMetadata",
        JSON.stringify({
          name: file.name || name,
          keyvalues: {
            uploadedAt: new Date().toISOString(),
            fileType: file.type || "application/octet-stream",
          },
        })
      );

      const mediaRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: pinataForm,
      });
      const mediaJson = (await mediaRes.json().catch(() => null)) as any;
      if (!mediaRes.ok) {
        const msg =
          mediaJson?.error?.details ||
          mediaJson?.error ||
          mediaJson?.message ||
          JSON.stringify(mediaJson) ||
          mediaRes.statusText;
        return NextResponse.json({ ok: false, error: `Pinata upload failed (${mediaRes.status}): ${msg}` }, { status: 500 });
      }
      const mediaHash = mediaJson?.IpfsHash || mediaJson?.ipfsHash || mediaJson?.Hash;
      if (!mediaHash) {
        return NextResponse.json({ ok: false, error: "Pinata upload succeeded but no IpfsHash returned" }, { status: 500 });
      }

      imageIpfsUrl = `ipfs://${mediaHash}`;
      const gatewayBase = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
      imageGatewayUrl = `${gatewayBase}/ipfs/${mediaHash}`;
    }

    // Upload metadata JSON to Pinata
    const metadata = {
      name,
      description,
      image: imageIpfsUrl,
      attributes: attributes || [],
    };

    const metaRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });
    const metaJson = (await metaRes.json().catch(() => null)) as any;
    if (!metaRes.ok) {
      const msg =
        metaJson?.error?.details ||
        metaJson?.error ||
        metaJson?.message ||
        JSON.stringify(metaJson) ||
        metaRes.statusText;
      return NextResponse.json({ ok: false, error: `Pinata metadata upload failed (${metaRes.status}): ${msg}` }, { status: 500 });
    }
    const metaHash = metaJson?.IpfsHash || metaJson?.ipfsHash || metaJson?.Hash;
    if (!metaHash) {
      return NextResponse.json({ ok: false, error: "Pinata metadata upload succeeded but no IpfsHash returned" }, { status: 500 });
    }

    const metadataIpfsUrl = `ipfs://${metaHash}`;
    return NextResponse.json({
      ok: true,
      imageIpfsUrl,
      metadataIpfsUrl,
      imageGatewayUrl,
      metadataGatewayUrl: `${process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"}/ipfs/${metaHash}`,
    });
  } catch (error) {
    console.error("[nft-marketplace/upload] error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: msg || "Upload failed" }, { status: 500 });
  }
}
