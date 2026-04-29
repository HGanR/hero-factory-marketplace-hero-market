import { NextRequest, NextResponse } from "next/server";
import { updateCallRecordingUrl } from "@/lib/twilio/crm-logger";
import { validateTwilioRequest, formDataToParams } from "@/lib/twilio/validate";

/**
 * Twilio Recording Status Callback: when a recording is ready.
 * Configure in Twilio recording options: Status Callback = https://yourdomain.com/api/twilio/recording/status
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
    const recordingUrl = String(formData.get("RecordingUrl") ?? "").trim();
    const recordingStatus = String(formData.get("RecordingStatus") ?? "").trim();

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    if (recordingStatus === "completed" && recordingUrl) {
      await updateCallRecordingUrl(callSid, recordingUrl);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio recording status error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
