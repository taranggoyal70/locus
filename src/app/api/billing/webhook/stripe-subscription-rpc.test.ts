import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { describe, it } from "vitest";

const TEST_DATABASE_URL = process.env.STRIPE_SUBSCRIPTION_RPC_TEST_DATABASE_URL;
const describeDatabase = TEST_DATABASE_URL ? describe : describe.skip;

const migration017 = readFileSync(
  new URL("../../../../../supabase/migrations/017_stripe_event_ordering.sql", import.meta.url),
  "utf8",
);

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runPsql(sql: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "psql",
      [TEST_DATABASE_URL!, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`psql exited with ${code}\n${stdout}\n${stderr}`));
    });

    child.stdin.end(sql);
  });
}

describeDatabase("Stripe subscription RPC ordering contract", () => {
  it("executes the guarded subscription writes against Postgres", async () => {
    const suffix = randomUUID().replaceAll("-", "");

    await runPsql(`
      begin;
      set local client_min_messages = warning;

      do $$
      begin
        if to_regrole('anon') is null then
          execute 'create role anon';
        end if;
        if to_regrole('authenticated') is null then
          execute 'create role authenticated';
        end if;
        if to_regrole('service_role') is null then
          execute 'create role service_role';
        end if;
      end
      $$;

      create extension if not exists pgcrypto;

      drop table if exists public.subscriptions cascade;
      create or replace function public.update_updated_at()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql;

      create table public.subscriptions (
        id uuid primary key default gen_random_uuid(),
        user_id text not null unique,
        stripe_customer_id text not null,
        stripe_subscription_id text not null unique,
        plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
        status text not null default 'active' check (status in ('active', 'inactive', 'cancelled')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create trigger subscriptions_updated_at
        before update on public.subscriptions
        for each row execute function public.update_updated_at();

      insert into public.subscriptions (
        user_id,
        stripe_customer_id,
        stripe_subscription_id,
        plan,
        status,
        created_at,
        updated_at
      )
      values (
        ${quoteLiteral(`legacy_${suffix}`)},
        ${quoteLiteral(`cus_legacy_${suffix}`)},
        ${quoteLiteral(`sub_legacy_${suffix}`)},
        'free',
        'cancelled',
        '2025-12-01T12:00:00Z',
        '2026-01-01T12:00:00Z'
      );

      ${migration017}

      do $$
      declare
        v_applied boolean;
        v_plan text;
        v_status text;
        v_subscription_id text;
        v_event_id text;
        v_watermark timestamptz;
      begin
        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_legacy_${suffix}`)},
          'active',
          null,
          ${quoteLiteral(`evt_legacy_stale_${suffix}`)},
          '2020-01-01T00:00:00Z'
        );

        if v_applied is distinct from false then
          raise exception 'legacy stale active event applied';
        end if;

        select plan, status, last_event_created_at
          into v_plan, v_status, v_watermark
        from public.subscriptions
        where user_id = ${quoteLiteral(`legacy_${suffix}`)};

        if v_plan <> 'free' or v_status <> 'cancelled' or v_watermark <> '2026-01-01T12:00:00Z'::timestamptz then
          raise exception 'legacy stale active event changed row';
        end if;

        select applied into v_applied
        from public.upsert_stripe_subscription(
          ${quoteLiteral(`same_active_${suffix}`)},
          ${quoteLiteral(`cus_same_active_${suffix}`)},
          ${quoteLiteral(`sub_same_active_${suffix}`)},
          'pro',
          'active',
          ${quoteLiteral(`evt_same_active_checkout_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from true then
          raise exception 'initial same-second active row not inserted';
        end if;

        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_same_active_${suffix}`)},
          'active',
          null,
          ${quoteLiteral(`evt_same_active_update_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from false then
          raise exception 'equal-second active event applied';
        end if;

        select status, last_event_id into v_status, v_event_id
        from public.subscriptions
        where user_id = ${quoteLiteral(`same_active_${suffix}`)};

        if v_status <> 'active' or v_event_id <> ${quoteLiteral(`evt_same_active_checkout_${suffix}`)} then
          raise exception 'equal-second active event changed row';
        end if;

        select applied into v_applied
        from public.upsert_stripe_subscription(
          ${quoteLiteral(`same_cancel_${suffix}`)},
          ${quoteLiteral(`cus_same_cancel_${suffix}`)},
          ${quoteLiteral(`sub_same_cancel_${suffix}`)},
          'pro',
          'active',
          ${quoteLiteral(`evt_same_cancel_checkout_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from true then
          raise exception 'initial same-second cancel row not inserted';
        end if;

        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_same_cancel_${suffix}`)},
          'cancelled',
          'free',
          ${quoteLiteral(`evt_same_cancel_delete_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from true then
          raise exception 'equal-second cancellation did not apply';
        end if;

        select plan, status into v_plan, v_status
        from public.subscriptions
        where user_id = ${quoteLiteral(`same_cancel_${suffix}`)};

        if v_plan <> 'free' or v_status <> 'cancelled' then
          raise exception 'equal-second cancellation did not revoke access';
        end if;

        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_same_cancel_${suffix}`)},
          'active',
          null,
          ${quoteLiteral(`evt_terminal_active_${suffix}`)},
          '2026-01-01T12:00:01Z'
        );

        if v_applied is distinct from false then
          raise exception 'cancelled row reactivated through apply_stripe_subscription_event';
        end if;

        select plan, status into v_plan, v_status
        from public.subscriptions
        where user_id = ${quoteLiteral(`same_cancel_${suffix}`)};

        if v_plan <> 'free' or v_status <> 'cancelled' then
          raise exception 'terminal cancellation row changed';
        end if;

        select applied into v_applied
        from public.upsert_stripe_subscription(
          ${quoteLiteral(`newer_update_${suffix}`)},
          ${quoteLiteral(`cus_newer_update_${suffix}`)},
          ${quoteLiteral(`sub_newer_update_${suffix}`)},
          'pro',
          'active',
          ${quoteLiteral(`evt_newer_checkout_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from true then
          raise exception 'initial newer update row not inserted';
        end if;

        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_newer_update_${suffix}`)},
          'inactive',
          null,
          ${quoteLiteral(`evt_newer_inactive_${suffix}`)},
          '2026-01-01T12:00:01Z'
        );

        if v_applied is distinct from true then
          raise exception 'genuinely newer update did not apply';
        end if;

        select plan, status into v_plan, v_status
        from public.subscriptions
        where user_id = ${quoteLiteral(`newer_update_${suffix}`)};

        if v_plan <> 'pro' or v_status <> 'inactive' then
          raise exception 'genuinely newer update changed the wrong state';
        end if;

        select applied into v_applied
        from public.upsert_stripe_subscription(
          ${quoteLiteral(`repurchase_${suffix}`)},
          ${quoteLiteral(`cus_repurchase_old_${suffix}`)},
          ${quoteLiteral(`sub_repurchase_old_${suffix}`)},
          'pro',
          'active',
          ${quoteLiteral(`evt_repurchase_checkout_old_${suffix}`)},
          '2026-01-01T12:00:00Z'
        );

        if v_applied is distinct from true then
          raise exception 'initial repurchase row not inserted';
        end if;

        select applied into v_applied
        from public.apply_stripe_subscription_event(
          ${quoteLiteral(`sub_repurchase_old_${suffix}`)},
          'cancelled',
          'free',
          ${quoteLiteral(`evt_repurchase_delete_${suffix}`)},
          '2026-01-01T12:00:01Z'
        );

        if v_applied is distinct from true then
          raise exception 'repurchase setup cancellation did not apply';
        end if;

        select applied into v_applied
        from public.upsert_stripe_subscription(
          ${quoteLiteral(`repurchase_${suffix}`)},
          ${quoteLiteral(`cus_repurchase_new_${suffix}`)},
          ${quoteLiteral(`sub_repurchase_new_${suffix}`)},
          'pro',
          'active',
          ${quoteLiteral(`evt_repurchase_checkout_new_${suffix}`)},
          '2026-01-01T12:00:02Z'
        );

        if v_applied is distinct from true then
          raise exception 'repurchase did not reactivate through upsert';
        end if;

        select stripe_subscription_id, plan, status
          into v_subscription_id, v_plan, v_status
        from public.subscriptions
        where user_id = ${quoteLiteral(`repurchase_${suffix}`)};

        if v_subscription_id <> ${quoteLiteral(`sub_repurchase_new_${suffix}`)}
          or v_plan <> 'pro'
          or v_status <> 'active' then
          raise exception 'repurchase wrote the wrong row state';
        end if;
      end
      $$;

      rollback;
    `);
  });
});
