# Supabase

Only the booking emails live here so far. Tables, RLS and the `book_slot` / `cancel_booking`
functions are still only in the dashboard (project `jyznsezzathcxoutpglt`).

## Booking and cancellation emails

When a parent books a lesson, or either side cancels one, the parent and the tutor each get an
email with the lesson time in Singapore time, the subject, level and student, the video call link
(for bookings), a link back to `book.html`, and a calendar file (`lesson.ics`).

How it works: a trigger on `public.bookings` (`migrations/20261128000000_booking_emails.sql`) posts
every insert, update and delete to the `booking-emails` Edge Function through `pg_net`. The function
treats an insert as a booking, and a delete, or an update that sets `status` to cancelled or fills
`cancelled_at`, as a cancellation. Other updates send nothing. Emails go out through Resend
(`functions/booking-emails/send.ts`, the only provider-specific file).

### Setup (once)

1. **Resend:** sign up, add and verify your domain (DNS records), and create an API key.
   Until a domain is verified, Resend only delivers to your own address.
2. **Function secrets** (Dashboard > Edge Functions > Secrets, or `supabase secrets set`):
   - `RESEND_API_KEY` = the Resend key
   - `EMAIL_FROM` = for example `Student Tutor <lessons@yourdomain.sg>`
   - `EMAIL_REPLY_TO` = optional, where replies should go
   - `SITE_URL` = the live site, for example `https://yoursite.vercel.app`
   - `BOOKING_EMAILS_SECRET` = a long random string
3. **Deploy the function:** `supabase functions deploy booking-emails` (JWT check is off in
   `config.toml`; the shared secret header protects it instead).
4. **Vault secrets** (SQL editor):
   ```sql
   select vault.create_secret('https://jyznsezzathcxoutpglt.supabase.co/functions/v1/booking-emails', 'booking_emails_url');
   select vault.create_secret('<same random string as BOOKING_EMAILS_SECRET>', 'booking_emails_secret');
   ```
5. **Run the migration** in the SQL editor, or `supabase db push`.

Test: book and cancel a lesson on `book.html` with two accounts you own, then check
Edge Functions > booking-emails > Logs.

Optional: the same Resend account can be Supabase Auth's SMTP sender (Authentication > Emails >
SMTP: host `smtp.resend.com`, port 465, user `resend`, password = the API key), which replaces the
rate-limited built-in sender for sign-up confirmations.

### Tests

```bash
deno test --allow-env supabase/functions/booking-emails/test.ts
```
