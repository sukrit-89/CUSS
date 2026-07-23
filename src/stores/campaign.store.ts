import { create } from 'zustand';
import type { Campaign, Recipient } from '@/features/campaigns/types/campaign.types';
import { CampaignService } from '@/features/campaigns/services/campaign.service';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import { createRecipients } from '@/lib/supabase/queries/recipients';
import { parseRecipientsCSV } from '@/features/campaigns/utils/csv-parser';
import type { Database } from '@/lib/supabase/database.types';

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];

interface CampaignState {
  campaigns: CampaignRow[];
  activeCampaign: CampaignRow | null;
  recipients: Campaign extends never ? never : Recipient[];
  isLoading: boolean;
  error: string | null;
  fetchCampaigns: () => Promise<void>;
  createCampaign: (input: CampaignInsert) => Promise<CampaignRow>;
  selectCampaign: (id: string) => Promise<void>;
  uploadRecipients: (campaignId: string, file: File) => Promise<void>;
  refreshRecipients: (campaignId: string) => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  activeCampaign: null,
  recipients: [],
  isLoading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ isLoading: true, error: null });
    try {
      const campaigns = await CampaignService.fetchCampaigns();
      set({ campaigns, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  createCampaign: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const newCampaign = await CampaignService.createNewCampaign(input);
      set((state) => ({
        campaigns: [newCampaign, ...state.campaigns],
        isLoading: false,
      }));
      return newCampaign;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  selectCampaign: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await CampaignService.fetchCampaignDetail(id);
      set({
        activeCampaign: detail.campaign,
        recipients: detail.recipients as unknown as Recipient[],
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({
        error: message,
        isLoading: false,
        activeCampaign: null,
        recipients: [],
      });
    }
  },

  uploadRecipients: async (campaignId, file) => {
    set({ isLoading: true, error: null });
    try {
      const text = await file.text();
      const parseResult = parseRecipientsCSV(text);

      if (parseResult.errors.length > 0) {
        const firstError = parseResult.errors[0];
        throw new Error(
          `CSV parsing failed at row ${firstError.row}: ${firstError.message}`,
        );
      }

      // Map parsed rows to recipient insert format
      const inserts = parseResult.valid.map((row) => ({
        campaign_id: campaignId,
        name: row.name,
        email: row.email ?? null,
        wallet_address: row.wallet_address ?? null,
        amount: row.amount ?? null,
      }));

      await createRecipients(inserts);
      await get().refreshRecipients(campaignId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  refreshRecipients: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const recipients = await getRecipientsByCampaign(campaignId);
      set({ recipients: recipients as unknown as Recipient[], isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },
}));