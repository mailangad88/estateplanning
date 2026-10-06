import { applySmsInbound, verifyTwilio } from "@/server/notify/twilioInbound";
import { getDb } from "@/server/runtime";

const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * Twilio inbound-message webhook. Set TWILIO_WEBHOOK_URL to the exact public URL configured in Twilio when the
 * app sits behind a proxy (the signature covers the URL as Twilio saw it). Always answers empty TwiML.
 */
export async function POST(request: Request) {
  const params = new URLSearchParams(await request.text());
  const url = process.env.TWILIO_WEBHOOK_URL || request.url;
  if (!verifyTwilio(url, params, request.headers.get("x-twilio-signature"), process.env.TWILIO_AUTH_TOKEN)) {
    return new Response("unauthorized", { status: 403 });
  }
  await applySmsInbound(await getDb(), params.get("From") ?? "", params.get("Body") ?? "");
  return new Response(TWIML, { status: 200, headers: { "content-type": "text/xml" } });
}
