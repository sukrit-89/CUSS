// ---------------------------------------------------------------------------
// ReRail — Domain Types
// ---------------------------------------------------------------------------
// All type definitions for campaigns, recipients, and transactions.
// These types mirror the Supabase schema and are used across the entire app.
// ---------------------------------------------------------------------------

import type {
  CampaignStatusValue,
  RecipientStatusValue,
  TxTypeValue,
} from '@/config/constants';

// ── Campaign ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  organizer_id: string;
  name: string;
  token: string;
  issuer: string;
  amount_per_recipient: string;
  total_pool: string;
  deadline: string | null;
  status: CampaignStatusValue;
  treasury_address: string | null;
  registry_contract_id: string | null;
  registry_campaign_id: number | null;
  registry_create_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  token?: string;
  issuer?: string;
  amount_per_recipient: string;
  total_pool: string;
  deadline?: string;
  treasury_address?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatusValue;
  treasury_address?: string;
  deadline?: string;
}

// ── Recipient ────────────────────────────────────────────────────────────────

export interface Recipient {
  id: string;
  campaign_id: string;
  name: string;
  email: string | null;
  wallet_address: string | null;
  amount: string | null;
  claimable_balance_id: string | null;
  claim_link_token: string;
  status: RecipientStatusValue;
  claim_token_hash: string | null;
  registry_status: RecipientStatusValue | null;
  registry_tx_hash: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface CreateRecipientInput {
  campaign_id: string;
  name: string;
  email?: string;
  wallet_address?: string;
  amount?: string;
}

// ── Transaction Log ──────────────────────────────────────────────────────────

export interface TransactionLog {
  id: string;
  recipient_id: string;
  campaign_id: string;
  tx_hash: string;
  tx_type: TxTypeValue;
  stellar_response: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateTransactionInput {
  recipient_id: string;
  campaign_id: string;
  tx_hash: string;
  tx_type: TxTypeValue;
  stellar_response?: Record<string, unknown>;
}

// ── CSV Parsing ──────────────────────────────────────────────────────────────

export interface CSVRecipientRow {
  name: string;
  email?: string;
  wallet_address?: string;
  amount?: string;
}

export interface CSVParseResult {
  valid: CSVRecipientRow[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    message: string;
  }>;
}

// ── Claim Resolution ─────────────────────────────────────────────────────────

export interface ClaimResolveResponse {
  recipient_name: string;
  amount: string;
  token: string;
  status: RecipientStatusValue;
  campaign_name: string;
  deadline: string | null;
  balance_id: string | null;
}

export interface ClaimExecuteRequest {
  signed_inner_tx_xdr: string;
}

export interface ClaimExecuteResponse {
  success: boolean;
  tx_hash: string;
  stellar_explorer_url: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface CampaignStats {
  total_recipients: number;
  claimed_count: number;
  pending_count: number;
  expired_count: number;
  total_distributed: string;
  claim_rate: number;
}
