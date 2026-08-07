import { supabase } from '../client';
import type { Database } from '../database.types';

type RecipientRow = Database['public']['Tables']['recipients']['Row'];
type RecipientInsert = Database['public']['Tables']['recipients']['Insert'];
type RecipientUpdate = Database['public']['Tables']['recipients']['Update'];

export type RecipientWithCampaign = RecipientRow & {
  campaigns: {
    name: string;
    deadline: string | null;
  } | null;
};

/**
 * Gets all recipients for a given campaign.
 * @param campaignId The campaign UUID
 */
export async function getRecipientsByCampaign(campaignId: string): Promise<RecipientRow[]> {
  const { data, error } = await supabase
    .from('recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch recipients: ${error.message}`);
  }

  return data || [];
}

/**
 * Gets recipients for several campaigns in one round trip.
 *
 * The dashboard needs cross-campaign aggregates, and issuing one request per
 * campaign does not scale past a handful of rows.
 */
export async function getRecipientsForCampaigns(
  campaignIds: string[],
): Promise<RecipientRow[]> {
  if (campaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from('recipients')
    .select('*')
    .in('campaign_id', campaignIds);

  if (error) {
    throw new Error(`Failed to fetch recipients: ${error.message}`);
  }

  return data || [];
}

/**
 * Gets a recipient by their unique claim link token.
 * @param token The claim link token
 */
export async function getRecipientByClaimToken(token: string): Promise<RecipientRow> {
  const { data, error } = await supabase
    .from('recipients')
    .select('*')
    .eq('claim_link_token', token)
    .single();

  if (error) {
    throw new Error(`Failed to fetch recipient by token: ${error.message}`);
  }

  return data;
}

/**
 * Gets a recipient by token, including associated campaign details.
 * @param token The claim link token
 */
export async function getRecipientWithCampaign(token: string): Promise<RecipientWithCampaign> {
  const { data, error } = await supabase
    .from('recipients')
    .select('*, campaigns(name, deadline)')
    .eq('claim_link_token', token)
    .single();

  if (error) {
    throw new Error(`Failed to fetch recipient with campaign: ${error.message}`);
  }

  return data as unknown as RecipientWithCampaign;
}

/**
 * Bulk inserts multiple recipients.
 * @param inputs Array of recipient data to insert
 */
export async function createRecipients(inputs: RecipientInsert[]): Promise<RecipientRow[]> {
  const { data, error } = await supabase
    .from('recipients')
    .insert(inputs as any)
    .select();

  if (error) {
    throw new Error(`Failed to create recipients: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates a single recipient.
 * @param id The recipient UUID
 * @param input The fields to update
 */
export async function updateRecipient(id: string, input: RecipientUpdate): Promise<RecipientRow> {
  const { data, error } = await supabase
    .from('recipients')
    // @ts-ignore
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update recipient: ${error.message}`);
  }

  return data;
}

/**
 * Stores the on-chain claimable balance ID for a recipient.
 * @param id The recipient UUID
 * @param claimableBalanceId Stellar claimable balance ID
 */
export async function updateRecipientClaimableBalance(
  id: string,
  claimableBalanceId: string,
): Promise<RecipientRow> {
  return updateRecipient(id, { claimable_balance_id: claimableBalanceId });
}

/**
 * Stores claimable balance IDs after the organizer submits creation txs.
 * The caller is responsible for mapping IDs from Stellar effects to recipients.
 */
export async function updateRecipientClaimableBalances(
  updates: Array<{ id: string; claimableBalanceId: string }>,
): Promise<RecipientRow[]> {
  const rows: RecipientRow[] = [];

  for (const update of updates) {
    rows.push(await updateRecipientClaimableBalance(update.id, update.claimableBalanceId));
  }

  return rows;
}

/**
 * Updates a recipient's status.
 * @param id The recipient UUID
 * @param status The new status
 * @param claimedAt Optional timestamp of when it was claimed
 */
export async function updateRecipientStatus(
  id: string,
  status: RecipientRow['status'],
  claimedAt?: string
): Promise<RecipientRow> {
  const input: RecipientUpdate = { status };
  if (claimedAt !== undefined) {
    input.claimed_at = claimedAt;
  }
  
  return updateRecipient(id, input);
}
