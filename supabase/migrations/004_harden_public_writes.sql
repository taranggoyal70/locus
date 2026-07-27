-- Server routes use the service role for analytics and waitlist writes.
-- Anonymous clients should not be able to bypass validation and rate limits
-- by writing to the REST tables directly.
drop policy if exists "events insert only" on events;
drop policy if exists "waitlist insert only" on waitlist;

revoke insert on table events from anon, authenticated;
revoke insert on table waitlist from anon, authenticated;
