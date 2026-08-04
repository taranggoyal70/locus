do $$
begin
  if to_regclass('public.github_connections') is null then
    raise exception 'Required table public.github_connections is missing';
  end if;
end
$$;

-- Controlled alpha supports public repositories only. Stored broad OAuth tokens
-- are therefore unnecessary secret material and must not remain recoverable.
delete from public.github_connections;

drop policy if exists "users own github_connections" on public.github_connections;
revoke all on table public.github_connections from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.github_connections limit 1) then
    raise exception 'Legacy GitHub connection secrets were not fully removed';
  end if;
end
$$;
