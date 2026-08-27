import { createClient } from '@supabase/supabase-js';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateEmailHtml(params: {
  recipientName: string;
  campaignName: string;
  amount: string;
  assetCode: string;
  claimUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Payout is Ready — ReRail</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080808; color: #ffffff; margin: 0; padding: 40px 20px; }
    .container { max-width: 500px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 32px; backdrop-filter: blur(12px); }
    .logo { font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .badge { display: inline-block; background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); font-size: 12px; padding: 4px 12px; border-radius: 99px; margin-bottom: 16px; font-weight: 500; }
    h1 { font-size: 24px; font-weight: 600; margin: 0 0 8px 0; color: #ffffff; }
    p { font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.6); margin: 0 0 24px 0; }
    .amount-card { background: rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255, 255, 255, 0.08); }
    .amount { font-size: 36px; font-weight: 700; color: #ffffff; font-family: monospace; }
    .asset { font-size: 14px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }
    .btn { display: block; width: 100%; background: #ffffff; color: #000000; text-align: center; font-weight: 600; padding: 14px 0; border-radius: 99px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15); }
    .footer { font-size: 12px; color: rgba(255, 255, 255, 0.3); text-align: center; margin-top: 24px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✦ ReRail</div>
    <div class="badge">${params.campaignName}</div>
    <h1>Hi ${params.recipientName},</h1>
    <p>You have been sent a gasless payout. No XLM or transaction fees are required — click below to claim directly to your wallet.</p>
    <div class="amount-card">
      <div class="amount">${params.amount} ${params.assetCode}</div>
      <div class="asset">Instant Stellar Claimable Balance</div>
    </div>
    <a href="${params.claimUrl}" class="btn">Claim Payout Now →</a>
    <div class="footer">
      Powered by ReRail Gasless Settlement Protocol on Stellar.<br>
      If you did not expect this payment, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send claim notification emails to campaign recipients.
 *
 * Supports Resend API (via RESEND_API_KEY) or standard notification logging fallback.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { campaignId, recipientId, baseUrl } = req.body || {};

  if (!campaignId || !UUID_V4_RE.test(campaignId)) {
    return res.status(400).json({ error: 'Valid campaignId is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, token, amount_per_recipient')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    let query = supabase
      .from('recipients')
      .select('id, name, email, amount, claim_link_token')
      .eq('campaign_id', campaignId)
      .not('email', 'is', null);

    if (recipientId) {
      query = query.eq('id', recipientId);
    }

    const { data: recipients, error: recipientsError } = await query;

    if (recipientsError) {
      return res.status(500).json({ error: 'Failed to fetch recipients' });
    }

    const validRecipients = (recipients || []).filter(
      (r) => r.email && r.email.trim().length > 0 && r.email.includes('@'),
    );

    if (validRecipients.length === 0) {
      return res.status(400).json({ error: 'No recipients with valid email addresses found' });
    }

    const domain = baseUrl || process.env.VITE_CLAIM_LINK_BASE_URL || 'https://cuss-pink.vercel.app';
    const resendApiKey = process.env.RESEND_API_KEY;

    // Standard Resend onboarding sender unless a verified domain from address is configured
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const formattedFrom = fromAddress.includes('<')
      ? fromAddress
      : `ReRail Payouts <${fromAddress}>`;

    const results: Array<{
      recipientId: string;
      email: string;
      success: boolean;
      simulated?: boolean;
      error?: string;
    }> = [];

    for (const recipient of validRecipients) {
      const claimUrl = `${domain}/claim/${recipient.claim_link_token}`;
      const amount = recipient.amount || campaign.amount_per_recipient;
      const html = generateEmailHtml({
        recipientName: recipient.name,
        campaignName: campaign.name,
        amount,
        assetCode: campaign.token,
        claimUrl,
      });

      if (resendApiKey) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: formattedFrom,
              to: [recipient.email],
              subject: `You received ${amount} ${campaign.token} — ReRail Payout`,
              html,
            }),
          });

          const resendData = (await resendRes.json().catch(() => null)) as any;

          if (resendRes.ok) {
            results.push({
              recipientId: recipient.id,
              email: recipient.email!,
              success: true,
            });
          } else {
            results.push({
              recipientId: recipient.id,
              email: recipient.email!,
              success: false,
              error: resendData?.message || `Resend HTTP ${resendRes.status}`,
            });
          }
        } catch (err: any) {
          results.push({
            recipientId: recipient.id,
            email: recipient.email!,
            success: false,
            error: err?.message || 'Network error contacting email provider',
          });
        }
      } else {
        // Fallback preview mode when no provider key is configured
        results.push({
          recipientId: recipient.id,
          email: recipient.email!,
          success: true,
          simulated: true,
        });
      }
    }

    const sentCount = results.filter((r) => r.success).length;

    return res.status(200).json({
      success: sentCount > 0,
      sent: sentCount,
      total: validRecipients.length,
      simulated: !resendApiKey,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
