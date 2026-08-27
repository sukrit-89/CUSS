-- =============================================================================
-- ReRail — Supabase Database Schema
-- =============================================================================
-- This file documents the complete database schema required by ReRail.
-- Run this against a fresh Supabase project to recreate the data layer.
--
-- Prerequisites:
--   1. A Supabase project with Auth enabled (email + Google OAuth)
--   2. The `uuid-ossp` extension (enabled by default on Supabase)
-- =============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.campaigns (
  id                      uuid primary key default uuid_generate_v4(),
  organizer_id            uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  token                   text not null default 'USDC',
  issuer                  text not null,
  amount_per_recipient    text not null,
  total_pool              text not null,
  deadline                timestamptz,
  status                  text not null default 'draft'
                            check (status in ('draft', 'active', 'completed', 'expired')),
  treasury_address        text,
  registry_contract_id    text,
  registry_campaign_id    bigint,
  registry_create_tx_hash text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.recipients (
  id                      uuid primary key default uuid_generate_v4(),
  campaign_id             uuid not null references public.campaigns(id) on delete cascade,
  name                    text not null,
  email                   text,
  wallet_address          text,
  amount                  text,
  claimable_balance_id    text,
  claim_link_token        uuid not null default uuid_generate_v4(),
  claim_token_hash        text,
  registry_status         text check (registry_status in ('pending', 'funded', 'claimed', 'expired')),
  registry_tx_hash        text,
  status                  text not null default 'pending'
                            check (status in ('pending', 'claiming', 'claimed', 'expired')),
  claim_attempts          integer not null default 0,
  last_claim_attempt_at   timestamptz,
  claimed_at              timestamptz,
  created_at              timestamptz not null default now()
);

create table public.transactions (
  id                      uuid primary key default uuid_generate_v4(),
  recipient_id            uuid not null references public.recipients(id) on delete cascade,
  campaign_id             uuid not null references public.campaigns(id) on delete cascade,
  tx_hash                 text not null,
  tx_type                 text not null
                            check (tx_type in ('create_balance', 'claim', 'reclaim', 'sponsor_account')),
  stellar_response        jsonb,
  created_at              timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index idx_campaigns_organizer   on public.campaigns(organizer_id);
create index idx_recipients_campaign   on public.recipients(campaign_id);
create index idx_recipients_token      on public.recipients(claim_link_token);
create index idx_recipients_status     on public.recipients(status);
create index idx_transactions_campaign on public.transactions(campaign_id);

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.campaigns    enable row level security;
alter table public.recipients   enable row level security;
alter table public.transactions enable row level security;

-- Campaigns: organizers can read/write their own campaigns.
create policy "Organizers can manage own campaigns"
  on public.campaigns for all
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

-- Recipients: accessible through campaign ownership.
create policy "Organizers can manage recipients of own campaigns"
  on public.recipients for all
  using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = recipients.campaign_id
        and campaigns.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns
      where campaigns.id = recipients.campaign_id
        and campaigns.organizer_id = auth.uid()
    )
  );

-- Transactions: read-only through campaign ownership.
create policy "Organizers can read transactions of own campaigns"
  on public.transactions for select
  using (
    exists (
      select 1 from public.campaigns
      where campaigns.id = transactions.campaign_id
        and campaigns.organizer_id = auth.uid()
    )
  );

-- Transactions: insert through campaign ownership (for client-side reclaim logging).
create policy "Organizers can insert transactions for own campaigns"
  on public.transactions for insert
  with check (
    exists (
      select 1 from public.campaigns
      where campaigns.id = transactions.campaign_id
        and campaigns.organizer_id = auth.uid()
    )
  );

-- ── RPCs (PostgreSQL Functions) ─────────────────────────────────────────────

-- begin_claim: atomically locks a recipient row for claiming.
-- Returns the locked row if successful, empty set if already locked/claimed/exhausted.
create or replace function public.begin_claim(p_token uuid)
returns setof public.recipients
language plpgsql
security definer
as $$
begin
  return query
    update public.recipients
    set
      status = 'claiming',
      claim_attempts = claim_attempts + 1,
      last_claim_attempt_at = now()
    where claim_link_token = p_token
      and status = 'pending'
      and claim_attempts < 5
    returning *;
end;
$$;

-- release_claim: returns a locked recipient to pending (on failure).
-- The attempt counter is NOT rolled back, so repeated failures still exhaust the budget.
create or replace function public.release_claim(p_recipient_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.recipients
  set status = 'pending'
  where id = p_recipient_id
    and status = 'claiming';
end;
$$;

-- begin_gasless_op: rate-limits fee-spending operations (sponsor, trustline).
-- Returns the recipient row if an attempt is available, empty set otherwise.
create or replace function public.begin_gasless_op(p_token uuid, p_kind text)
returns setof public.recipients
language plpgsql
security definer
as $$
begin
  -- Reuses the claim_attempts counter for simplicity.
  -- In production, consider separate counters per operation kind.
  return query
    update public.recipients
    set
      claim_attempts = claim_attempts + 1,
      last_claim_attempt_at = now()
    where claim_link_token = p_token
      and status = 'pending'
      and claim_attempts < 10
    returning *;
end;
$$;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime on recipients so the organizer dashboard updates live.

alter publication supabase_realtime add table public.recipients;
