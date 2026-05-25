import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import {
  describeExecutiveTranscribeHintFailure,
  executiveVoiceSttNotConfiguredMessage,
  pickExecutiveVoiceTranscribeBackendWithHint,
} from "@/lib/voices/executive-voice-transcribe-routing";
import { openaiSttTranscribe } from "@/lib/voices/openai-stt-client";
import { selfHostedSttTranscribe } from "@/lib/voices/self-hosted-stt-client";

export const dynamic = "force-dynamic";

function parseSttPreference(raw: unknown): "" | "openai" | "self_hosted_stt" {
  const t = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (t === "openai") return "openai";
  if (t === "self_hosted_stt" || t === "self_hosted") return "self_hosted_stt";
  return "";
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const hint = parseSttPreference(form.get("sttPreference"));
    const backend = pickExecutiveVoiceTranscribeBackendWithHint(hint);
    if (!backend) {
      const message = hint ? describeExecutiveTranscribeHintFailure(hint) : executiveVoiceSttNotConfiguredMessage();
      return NextResponse.json(
        { error: "STT_NOT_CONFIGURED", message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json(
        { error: "MISSING_AUDIO", message: 'Expected multipart field "audio" with a non-empty blob.' },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const langRaw = form.get("language");
    const language = typeof langRaw === "string" && langRaw.trim() ? langRaw.trim().slice(0, 32) : undefined;

    const buf = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type?.trim() || "application/octet-stream";
    const filename =
      audio instanceof File && audio.name?.trim() ? audio.name.trim().slice(0, 200) : "clip.webm";

    if (backend === "openai") {
      const out = await openaiSttTranscribe({ audio: buf, filename, mimeType, language });
      return NextResponse.json(
        {
          transcript: out.transcript,
          confidence: out.confidence,
          provider: out.provider,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const out = await selfHostedSttTranscribe({ audio: buf, filename, mimeType, language });
    return NextResponse.json(
      {
        transcript: out.transcript,
        confidence: out.confidence ?? null,
        provider: "self_hosted_stt",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "TRANSCRIBE_FAILED", message: msg }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
