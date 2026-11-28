// booking-emails: emails the parent and the tutor when a lesson is booked or cancelled.
// Called by a database trigger on public.bookings (see supabase/migrations/*_booking_emails.sql)
// with the Database Webhook payload: { type, table, record, old_record }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendMail } from "./send.ts";
import { classify, type Payload } from "./classify.ts";
import { ics, type Lesson, render, type Side } from "./templates.ts";

type Row = Record<string, any>;

const SECRET = Deno.env.get("BOOKING_EMAILS_SECRET") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function userOf(id: string) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) throw new Error(`No user ${id}: ${error?.message}`);
  const u = data.user;
  return { email: u.email ?? "", name: String(u.user_metadata?.name ?? u.user_metadata?.full_name ?? "") };
}

async function lessonOf(row: Row) {
  const [parent, tutor, prof, priv] = await Promise.all([
    userOf(row.parent_id),
    userOf(row.tutor_id),
    admin.from("tutor_profiles").select("display_name").eq("id", row.tutor_id).maybeSingle(),
    row.meeting_link ? Promise.resolve({ data: null }) : admin.from("tutor_private").select("meeting_link").eq("id", row.tutor_id).maybeSingle(),
  ]);
  const lesson: Lesson = {
    id: String(row.id),
    startsAt: new Date(row.starts_at),
    minutes: Number(row.minutes ?? 60),
    subject: String(row.subject ?? "Lesson"),
    level: String(row.level ?? ""),
    childName: String(row.child_name ?? "your child"),
    note: row.note ?? null,
    meetingLink: row.meeting_link ?? (priv as any)?.data?.meeting_link ?? null,
    parentName: String(row.parent_name || parent.name || "A parent"),
    tutorName: String((prof as any)?.data?.display_name || tutor.name || "your tutor"),
  };
  return { lesson, to: { parent: parent.email, tutor: tutor.email } as Record<Side, string> };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-webhook-secret") !== SECRET) return new Response("Unauthorized", { status: 401 });

  let p: Payload;
  try { p = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (p.table !== "bookings") return Response.json({ skipped: "not bookings" });

  const ev = classify(p);
  if (!ev) return Response.json({ skipped: "no booking or cancellation" });
  // no emails for lessons that already ended (for example, clean-up deletes)
  if (ev.kind === "cancelled" && new Date(ev.row.starts_at).getTime() < Date.now()) {
    return Response.json({ skipped: "lesson in the past" });
  }

  try {
    const { lesson, to } = await lessonOf(ev.row);
    const results = await Promise.allSettled((["parent", "tutor"] as Side[]).map(async (side) => {
      if (!to[side]) throw new Error(`no email for ${side}`);
      const m = render(ev.kind, side, lesson);
      await sendMail({ to: to[side], ...m, ics: ics(ev.kind, lesson, side) });
      return side;
    }));
    const failed = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
    if (failed.length) console.error("booking-emails", ev.kind, lesson.id, failed);
    return Response.json({ kind: ev.kind, sent: results.filter((r) => r.status === "fulfilled").length, failed }, {
      status: failed.length === 2 ? 502 : 200,
    });
  } catch (e) {
    console.error("booking-emails", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
