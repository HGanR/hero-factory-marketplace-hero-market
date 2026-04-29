import { NextRequest, NextResponse } from "next/server";
import { logInboundCall } from "@/lib/twilio/crm-logger";
import { validateTwilioRequest, formDataToParams } from "@/lib/twilio/validate";

/**
 * Twilio Voice webhook: Inbound call.
 * Configure this URL in Twilio console: https://yourdomain.com/api/twilio/voice/inbound
 *
 * Flow:
 * 1. Validate signature (when TWILIO_AUTH_TOKEN is set)
 * 2. Log call to CRM (conversation, call_log, message)
 * 3. Return TwiML to answer and route to AI agent (future) or simple greeting
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const params = formDataToParams(formData);

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers.get("x-twilio-signature") ?? undefined;
    const url = req.url?.split("?")[0] ?? "";
    if (authToken && signature && !validateTwilioRequest(authToken, signature, url, params)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const payload = {
      CallSid: String(formData.get("CallSid") ?? ""),
      From: String(formData.get("From") ?? ""),
      To: String(formData.get("To") ?? ""),
      CallStatus: String(formData.get("CallStatus") ?? "ringing"),
      Direction: String(formData.get("Direction") ?? "inbound"),
    };

    if (!payload.CallSid || !payload.From || !payload.To) {
      console.warn("Twilio inbound: missing CallSid/From/To", payload);
      return twimlResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we could not process your call. Goodbye.</Say><Hangup/></Response>`
      );
    }

    await logInboundCall(payload);

    // TODO: Route to AI voice agent (Twilio <Stream>, Vapi, or similar)
    // For now return a simple greeting and hangup
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Your call has been received and logged. A team member will follow up shortly. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return twimlResponse(twiml);
  } catch (err) {
    console.error("Twilio voice inbound error:", err);
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>We're sorry, something went wrong. Please try again later.</Say><Hangup/></Response>`);
  }
}

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
