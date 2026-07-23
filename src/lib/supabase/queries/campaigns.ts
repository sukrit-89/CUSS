import { supabase } from '../client';
import type { Database } from '../database.types';

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];

/**
 * Gets all campaigns for the currently authenticated user.
 */
export async function getCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch campaigns: ${error.message}`);
  }

  return data || [];
}

/**
 * Gets a specific campaign by ID.
 * @param id The campaign UUID
 */
export async function getCampaignById(id: string): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch campaign: ${error.message}`);
  }

  return data;
}

/**
 * Creates a new campaign.
 * @param input The campaign data to insert
 */
export async function createCampaign(input: CampaignInsert): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert(input as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create campaign: ${error.message}`);
  }

  return data;
}

/**
 * Updates an existing campaign.
 * @param id The campaign UUID
 * @param input The fields to update
 */
export async function updateCampaign(id: string, input: CampaignUpdate): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    // @ts-ignore
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update campaign: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a campaign.
 * @param id The campaign UUID
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete campaign: ${error.message}`);
  }
}
