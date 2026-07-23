import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
} from '@/lib/supabase/queries/campaigns';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import type { Database } from '@/lib/supabase/database.types';

type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
type CampaignRow = Database['public']['Tables']['campaigns']['Row'];

/**
 * Service class for Campaign management.
 */
export class CampaignService {
  /**
   * Fetches all campaigns for the current user.
   */
  static async fetchCampaigns(): Promise<CampaignRow[]> {
    return getCampaigns();
  }

  /**
   * Fetches full details for a campaign, including recipients and stats.
   * @param id The campaign ID
   */
  static async fetchCampaignDetail(id: string) {
    const [campaign, recipients] = await Promise.all([
      getCampaignById(id),
      getRecipientsByCampaign(id),
    ]);

    const stats = this.getCampaignStats(recipients);

    return {
      campaign,
      recipients,
      stats,
    };
  }

  /**
   * Creates a new campaign.
   * @param input Campaign data to insert
   */
  static async createNewCampaign(input: CampaignInsert): Promise<CampaignRow> {
    return createCampaign(input);
  }

  /**
   * Updates a campaign's status.
   * @param id The campaign ID
   * @param status The new status
   */
  static async updateCampaignStatus(
    id: string,
    status: CampaignRow['status']
  ): Promise<CampaignRow> {
    return updateCampaign(id, { status });
  }

  /**
   * Computes statistics for a campaign from its recipients.
   * @param recipients The campaign recipients
   */
  static getCampaignStats(
    recipients: Database['public']['Tables']['recipients']['Row'][]
  ) {
    const totalRecipients = recipients.length;
    let claimedCount = 0;

    for (const recipient of recipients) {
      if (recipient.status === 'claimed') {
        claimedCount++;
      }
    }

    const pendingCount = totalRecipients - claimedCount;

    return {
      totalRecipients,
      claimedCount,
      pendingCount,
    };
  }
}
