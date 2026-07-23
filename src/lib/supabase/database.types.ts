export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    Tables: {
      campaigns: {
        Row: {
          id: string;
          organizer_id: string;
          name: string;
          token: string;
          issuer: string;
          amount_per_recipient: string;
          total_pool: string;
          deadline: string | null;
          status: 'draft' | 'active' | 'completed' | 'expired';
          treasury_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          name: string;
          token?: string;
          issuer: string;
          amount_per_recipient: string;
          total_pool: string;
          deadline?: string | null;
          status?: 'draft' | 'active' | 'completed' | 'expired';
          treasury_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          name?: string;
          token?: string;
          issuer?: string;
          amount_per_recipient?: string;
          total_pool?: string;
          deadline?: string | null;
          status?: 'draft' | 'active' | 'completed' | 'expired';
          treasury_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipients: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          email: string | null;
          wallet_address: string | null;
          amount: string | null;
          claimable_balance_id: string | null;
          claim_link_token: string;
          status: 'pending' | 'claimed' | 'expired';
          claimed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          name: string;
          email?: string | null;
          wallet_address?: string | null;
          amount?: string | null;
          claimable_balance_id?: string | null;
          claim_link_token?: string;
          status?: 'pending' | 'claimed' | 'expired';
          claimed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          name?: string;
          email?: string | null;
          wallet_address?: string | null;
          amount?: string | null;
          claimable_balance_id?: string | null;
          claim_link_token?: string;
          status?: 'pending' | 'claimed' | 'expired';
          claimed_at?: string | null;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          recipient_id: string;
          campaign_id: string;
          tx_hash: string;
          tx_type: 'create_balance' | 'claim' | 'reclaim' | 'sponsor_account';
          stellar_response: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          campaign_id: string;
          tx_hash: string;
          tx_type: 'create_balance' | 'claim' | 'reclaim' | 'sponsor_account';
          stellar_response?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          campaign_id?: string;
          tx_hash?: string;
          tx_type?: 'create_balance' | 'claim' | 'reclaim' | 'sponsor_account';
          stellar_response?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
    };
  };
}
