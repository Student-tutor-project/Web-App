// The one place that talks to the email provider. Swap this file to change provider.
// Resend HTTPS API (Edge Functions block SMTP ports 25 and 587, so we use HTTPS).
export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  ics?: { filename: string; content: string };
};

const API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "Student Tutor <onboarding@resend.dev>";
const REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? undefined;

export async function sendMail(m: Mail): Promise<void> {
  if (!API_KEY) throw new Error("RESEND_API_KEY is not set");
  const body: Record<string, unknown> = {
    from: FROM,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
  };
  if (REPLY_TO) body.reply_to = REPLY_TO;
  if (m.ics) {
    body.attachments = [{
      filename: m.ics.filename,
      content: btoa(unescape(encodeURIComponent(m.ics.content))),
      content_type: "text/calendar; charset=utf-8; method=PUBLISH",
    }];
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
