-- Booking and cancellation emails.
-- After any insert, update or delete on public.bookings, post the change to the booking-emails
-- Edge Function (same payload shape as a Supabase Database Webhook). The function decides whether
-- it is a new booking or a cancellation and emails the parent and the tutor.
--
-- Before running, store two secrets in Vault (Dashboard > Project Settings > Vault, or SQL):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/booking-emails', 'booking_emails_url');
--   select vault.create_secret('<long random string>', 'booking_emails_secret');
-- and set the same random string as the function secret BOOKING_EMAILS_SECRET.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_booking_emails()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'booking_emails_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'booking_emails_secret';
  if v_url is null or v_secret is null then
    raise warning 'booking emails: Vault secrets booking_emails_url / booking_emails_secret are missing, no email sent';
    return null;
  end if;

  -- pg_net is asynchronous: the booking commits even if the email call fails.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object(
      'type',       tg_op,
      'table',      tg_table_name,
      'schema',     tg_table_schema,
      'record',     case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    ),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;

revoke all on function public.notify_booking_emails() from public, anon, authenticated;

drop trigger if exists booking_emails on public.bookings;
create trigger booking_emails
  after insert or update or delete on public.bookings
  for each row execute function public.notify_booking_emails();
