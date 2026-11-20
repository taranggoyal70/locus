-- What a hosted Supabase database provides before any of this chain runs, stated
-- so the chain replays on any PostgreSQL 15+ (Neon in production, PGlite in tests).
--
-- 1. The API roles. Later migrations grant to and revoke from anon, authenticated
--    and service_role, and 004 asserts the result. Locus no longer serves a
--    PostgREST API, so nothing logs in as these roles; they stay as NOLOGIN roles
--    so the grants and the assertions mean exactly what they meant on Supabase
--    and a rebuilt database matches the one the data came from.
-- 2. pgcrypto in the `extensions` schema. Functions call extensions.digest() with
--    an empty search_path, so the schema name is part of their contract.
--
-- Idempotent: on a database that already has these, it changes nothing.

do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = api_role) then
      execute format('create role %I nologin', api_role);
    end if;
  end loop;
end
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
