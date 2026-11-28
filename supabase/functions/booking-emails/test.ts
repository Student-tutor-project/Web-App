// deno test --allow-env supabase/functions/booking-emails/test.ts
import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { classify } from "./classify.ts";
import { ics, render, when } from "./templates.ts";

const row = { id: "b1", parent_id: "p", tutor_id: "t", starts_at: "2026-12-01T08:00:00Z", minutes: 60, subject: "Maths", level: "Primary 5", child_name: "Mei" };

Deno.test("insert is a booking", () => assertEquals(classify({ type: "INSERT", table: "bookings", record: row, old_record: null })?.kind, "booked"));
Deno.test("delete is a cancellation", () => assertEquals(classify({ type: "DELETE", table: "bookings", record: null, old_record: row })?.kind, "cancelled"));
Deno.test("status change to cancelled is a cancellation", () =>
  assertEquals(classify({ type: "UPDATE", table: "bookings", record: { ...row, status: "cancelled" }, old_record: { ...row, status: "booked" } })?.kind, "cancelled"));
Deno.test("other updates send nothing", () => {
  assertEquals(classify({ type: "UPDATE", table: "bookings", record: { ...row, note: "x" }, old_record: row }), null);
  assertEquals(classify({ type: "UPDATE", table: "bookings", record: { ...row, cancelled_at: "now" }, old_record: { ...row, cancelled_at: "now" } }), null);
});

const lesson = { id: "b1", startsAt: new Date(row.starts_at), minutes: 60, subject: "Maths", level: "Primary 5", childName: "Mei",
  meetingLink: "https://meet.google.com/abc-defg-hij", parentName: "Mrs Tan", tutorName: "Ryan" };

Deno.test("time is in Singapore time", () => assertEquals(when(lesson), "Tuesday, 1 December, 4pm to 5pm (Singapore time)"));
Deno.test("booked email carries time and link", () => {
  const m = render("booked", "parent", lesson);
  assertMatch(m.subject, /^Booked: Maths with Ryan/);
  assertMatch(m.text, /4pm to 5pm/);
  assertMatch(m.html, /meet\.google\.com\/abc-defg-hij/);
});
Deno.test("tutor email escapes html", () => {
  const m = render("booked", "tutor", { ...lesson, childName: "<b>x</b>" });
  assertEquals(m.html.includes("<b>x</b>"), false);
});
Deno.test("cancel email has no join link", () => assertEquals(render("cancelled", "parent", lesson).html.includes("Join video call"), false));
Deno.test("ics times are UTC", () => assertMatch(ics("booked", lesson, "parent").content, /DTSTART:20261201T080000Z/));
