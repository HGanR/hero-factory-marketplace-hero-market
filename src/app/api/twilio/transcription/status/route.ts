import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { validateTwilioRequest, formDataToParams } from "@/lib/twilio/validate";

/**
 * Twilio Transcription Status Callback: when transcription is ready.
 * Configure in Twilio: TranscriptionCallback = https://yourdomain.com/api/twilio/transcription/status
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const params = formDataToParams(formData);
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers.get("x-twilio-signature") ?? undefined;
    const url = req.url?.split("?")[0] ?? "";
    if (authToken && signature && !validateTwilioRequest(authToken, signature, url, params)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callSid = String(formData.get("CallSid") ?? "").trim();
    const transcriptionText = String(formData.get("TranscriptionText") ?? "").trim();
    const transcriptionStatus = String(formData.get("TranscriptionStatus") ?? "").trim();

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    if (transcriptionStatus === "completed" && transcriptionText) {
      await ensureCrmTables();
      const db = await getDb();
      await db.execute(sql`
        UPDATE crm_call_logs SET transcript = ${transcriptionText}, updatedAt = NOW() WHERE twilioCallSid = ${callSid}
      `);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio transcription status error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
