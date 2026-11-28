// Decides whether a change on public.bookings is a new booking, a cancellation, or neither.
import type { Kind } from "./templates.ts";

type Row = Record<string, any>;
export type Payload = { type: "INSERT" | "UPDATE" | "DELETE"; table: string; record: Row | null; old_record: Row | null };

// A row counts as cancelled if it was deleted, or if an update set a cancelled status or timestamp.
const isCancelled = (r: Row | null) =>
  !!r && (r.cancelled_at != null || /cancel/i.test(String(r.status ?? "")));

export function classify(p: Payload): { kind: Kind; row: Row } | null {
  if (p.type === "INSERT" && p.record && !isCancelled(p.record)) return { kind: "booked", row: p.record };
  if (p.type === "DELETE" && p.old_record && !isCancelled(p.old_record)) return { kind: "cancelled", row: p.old_record };
  if (p.type === "UPDATE" && p.record && isCancelled(p.record) && !isCancelled(p.old_record)) {
    return { kind: "cancelled", row: p.record };
  }
  return null;
}

