-- Clear the remaining Supabase advisor warnings without changing authorization semantics.
alter function public.update_updated_at() set search_path = '';

drop policy "users own projects" on public.projects;
create policy "users own projects" on public.projects
  for all using (user_id = (select current_setting('app.user_id', true)));

drop policy "users own api_keys" on public.api_keys;
create policy "users own api_keys" on public.api_keys
  for all using (user_id = (select current_setting('app.user_id', true)));

drop policy "users own subscriptions" on public.subscriptions;
create policy "users own subscriptions" on public.subscriptions
  for all using (user_id = (select current_setting('app.user_id', true)));
