import { NextRequest, NextResponse } from "next/server";
import {
  EgressClient,
  EncodedFileOutput,
  S3Upload,
  EncodedFileType,
} from "livekit-server-sdk";

/**
 * POST /api/livekit/egress
 * Start or stop LiveKit Room Composite Egress (recording).
 *
 * Start: Body { action: "start", roomName: string, layout?: "grid" | "speaker" | "single-speaker" }
 * Stop:  Body { action: "stop", egressId: string }
 * List:  Body { action: "list", roomName?: string }
 *
 * Env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 * For recording output: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_REGION (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || "").trim().toLowerCase();

    const host = url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
    const egressClient = new EgressClient(host, apiKey, apiSecret);

    if (action === "stop") {
      const egressId = (body?.egressId || "").trim();
      if (!egressId) {
        return NextResponse.json(
          { error: "egressId is required to stop" },
          { status: 400 }
        );
      }
      const info = await egressClient.stopEgress(egressId);
      return NextResponse.json({
        ok: true,
        egressId: info.egressId,
        status: info.status,
      });
    }

    if (action === "list") {
      const roomName = (body?.roomName || "").trim() || undefined;
      const list = await egressClient.listEgress({ roomName, active: true });
      return NextResponse.json({
        ok: true,
        egresses: list.map((e) => ({
          egressId: e.egressId,
          roomName: e.roomName,
          status: e.status,
        })),
      });
    }

    if (action === "start") {
      const roomName = (body?.roomName || body?.room || "").trim();
      const layout = (body?.layout || "grid").toString().toLowerCase();
      const validLayouts = ["grid", "speaker", "single-speaker", "grid-light", "speaker-light", "single-speaker-light"];
      const egressLayout = validLayouts.includes(layout) ? layout : "grid";

      if (!roomName) {
        return NextResponse.json(
          { error: "roomName is required to start recording" },
          { status: 400 }
        );
      }

      const s3Key = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_ACCESS_KEY;
      const s3Secret = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_S3_SECRET;
      const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET;
      const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || "us-east-1";

      if (!s3Key || !s3Secret || !bucket) {
        return NextResponse.json(
          {
            error:
              "Recording requires S3 config. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET (and optionally AWS_REGION).",
          },
          { status: 503 }
        );
      }

      const filepath = `meet-recordings/${roomName}-{time}`;
      const fileOutput = new EncodedFileOutput({
        filepath,
        fileType: EncodedFileType.MP4,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: s3Key,
            secret: s3Secret,
            bucket,
            region,
          }),
        },
      });

      const info = await egressClient.startRoomCompositeEgress(
        roomName,
        { file: fileOutput },
        { layout: egressLayout }
      );

      return NextResponse.json({
        ok: true,
        egressId: info.egressId,
        status: info.status,
        roomName,
        layout: egressLayout,
      });
    }

    return NextResponse.json(
      { error: "action must be start, stop, or list" },
      { status: 400 }
    );
  } catch (err) {
    console.error("LiveKit egress error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Egress failed: ${message}` },
      { status: 500 }
    );
  }
}
