import { NextRequest, NextResponse } from "next/server";
import { updateCallStatus } from "@/lib/twilio/crm-logger";
import { validateTwilioRequest, formDataToParams } from "@/lib/twilio/validate";

/**
 * Twilio Status Callback: call lifecycle (initiated, ringing, answered, completed).
 * Configure in Twilio: Status Callback URL = https://yourdomain.com/api/twilio/voice/status
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
    const status = String(formData.get("CallStatus") ?? "").trim();
    const duration = formData.get("CallDuration");
    const durNum = duration != null ? parseInt(String(duration), 10) : undefined;

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    await updateCallStatus(callSid, status, { duration: !isNaN(durNum ?? NaN) ? durNum : undefined });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Twilio voice status error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
