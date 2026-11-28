// Email copy for lesson booked and lesson cancelled, for the parent and the tutor.
// All times are shown in Singapore time.
export type Lesson = {
  id: string;
  startsAt: Date;
  minutes: number;
  subject: string;
  level: string;
  childName: string;
  note?: string | null;
  meetingLink?: string | null;
  parentName: string;
  tutorName: string;
};
export type Kind = "booked" | "cancelled";
export type Side = "parent" | "tutor";

const TZ = "Asia/Singapore";
const SITE = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const fDay = new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fTime = new Intl.DateTimeFormat("en-SG", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const t = (d: Date) => fTime.format(d).replace(/\s/g, "").replace(":00", "").toLowerCase();

export const when = (l: Lesson) => {
  const end = new Date(l.startsAt.getTime() + l.minutes * 60000);
  return `${fDay.format(l.startsAt)}, ${t(l.startsAt)} to ${t(end)} (Singapore time)`;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function copy(kind: Kind, side: Side, l: Lesson) {
  const what = `${l.subject} for ${l.childName} (${l.level})`;
  if (kind === "booked") {
    return side === "parent"
      ? {
        subject: `Booked: ${l.subject} with ${l.tutorName}, ${fDay.format(l.startsAt)}`,
        lead: `Your lesson with ${l.tutorName} is booked.`,
        linkLine: l.meetingLink ? "Join the video call at the lesson time:" : `${l.tutorName} will add the video call link before the lesson. You'll find it under Your lessons.`,
      }
      : {
        subject: `New lesson: ${what}, ${fDay.format(l.startsAt)}`,
        lead: `${l.parentName} booked a lesson with you.`,
        linkLine: l.meetingLink ? "Your video call link for this lesson:" : "You haven't added a video call link yet. Add it to your profile so the parent can join.",
      };
  }
  return side === "parent"
    ? {
      subject: `Cancelled: ${l.subject} with ${l.tutorName}, ${fDay.format(l.startsAt)}`,
      lead: `This lesson with ${l.tutorName} is cancelled. You can book another hour any time.`,
      linkLine: "",
    }
    : {
      subject: `Cancelled: ${what}, ${fDay.format(l.startsAt)}`,
      lead: "This lesson is cancelled, and the hour is open for booking again.",
      linkLine: "",
    };
}

export function render(kind: Kind, side: Side, l: Lesson) {
  const c = copy(kind, side, l);
  const rows: [string, string][] = [
    ["When", when(l)],
    ["Lesson", `${l.subject}, ${l.level}`],
    ["Student", l.childName],
    [side === "parent" ? "Tutor" : "Parent", side === "parent" ? l.tutorName : l.parentName],
  ];
  if (l.note && kind === "booked") rows.push(["Note", l.note]);
  const link = kind === "booked" && l.meetingLink ? l.meetingLink : "";
  const manage = SITE ? `${SITE}/book.html` : "";

  const text = [
    c.lead, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    c.linkLine, link, "",
    manage ? `See or cancel your lessons: ${manage}` : "",
    `Lesson reference: ${l.id}`,
  ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#78716c">Student Tutor</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(c.lead)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#78716c;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}
</table>
${c.linkLine ? `<p style="margin:20px 0 8px;font-size:15px">${esc(c.linkLine)}</p>` : ""}
${link ? `<p style="margin:0 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Join video call</a></p>
<p style="margin:0;font-size:13px;color:#78716c;word-break:break-all">${esc(link)}</p>` : ""}
${manage ? `<p style="margin:24px 0 0;font-size:14px"><a href="${esc(manage)}" style="color:#1d4ed8">See or cancel your lessons</a></p>` : ""}
<p style="margin:16px 0 0;font-size:12px;color:#a8a29e">Lesson reference: ${esc(l.id)}</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject: c.subject, html, text };
}

// A calendar file so the lesson lands in Google Calendar, Outlook or Apple Calendar.
export function ics(kind: Kind, l: Lesson, side: Side) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(l.startsAt.getTime() + l.minutes * 60000);
  const fold = (s: string) => s.replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const title = side === "parent" ? `${l.subject} with ${l.tutorName}` : `${l.subject} for ${l.childName}`;
  return {
    filename: "lesson.ics",
    content: [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Student Tutor//Lessons//EN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${l.id}@studenttutor`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(l.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${fold(title)}`,
      `DESCRIPTION:${fold(`${l.subject}, ${l.level}, for ${l.childName}${l.meetingLink ? `\nJoin: ${l.meetingLink}` : ""}`)}`,
      l.meetingLink ? `LOCATION:${fold(l.meetingLink)}` : "LOCATION:Online",
      kind === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "SEQUENCE:" + (kind === "cancelled" ? "1" : "0"),
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n"),
  };
}
