import { supabase } from '../client';
import type { Database } from '../database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];

/**
 * Gets all transactions for a given campaign.
 * @param campaignId The campaign UUID
 */
export async function getTransactionsByCampaign(campaignId: string): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions by campaign: ${error.message}`);
  }

  return data || [];
}

/**
 * Gets all transactions for a specific recipient.
 * @param recipientId The recipient UUID
 */
export async function getTransactionsByRecipient(recipientId: string): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions by recipient: ${error.message}`);
  }

  return data || [];
}

/**
 * Creates a new transaction record.
 * @param input The transaction data to insert
 */
export async function createTransaction(input: TransactionInsert): Promise<TransactionRow> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(input as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create transaction: ${error.message}`);
  }

  return data;
}
