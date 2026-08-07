import { createClient } from '@supabase/supabase-js';
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BASE_FEE = '1000';
const TX_TIMEOUT_SECONDS = 180;

function getStringBodyValue(body: any, key: string): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function accountExists(server: any, publicKey: string): Promise<boolean> {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (err: any) {
    if (err?.response?.status === 404) return false;
    throw err;
  }
}

/**
 * Activates a recipient's Stellar account and opens its USDC trustline, with
 * ReRail sponsoring both reserves.
 *
 * This is state 2 of the claim flow. Without it the recipient is told to go
 * find XLM themselves, which contradicts the whole "no XLM required" promise.
 *
 * Two signatures are needed: the fee payer sponsors and pays, and the recipient
 * authorises `changeTrust` and `endSponsoringFutureReserves` on their own new
 * account. So the route is two-phase:
 *
 *   POST (no body)            → returns the unsigned XDR for the recipient
 *   POST { signed_tx_xdr }    → validates, counter-signs, submits
 *
 * The fee payer's reserve stays locked until the account is merged away, so
 * this is real money per recipient — hence the attempt cap.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const signedTxXdr = getStringBodyValue(req.body, 'signed_tx_xdr');

  if (!token || !UUID_V4_RE.test(token)) {
    return res.status(400).json({ error: 'Valid claim token is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const feePayerSecret = process.env.FEE_PAYER_SECRET || '';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const horizonUrl =
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const usdcIssuer =
    process.env.STELLAR_USDC_ISSUER ||
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const usdcCode = process.env.STELLAR_USDC_CODE || 'USDC';

  if (!supabaseUrl || !supabaseKey || !feePayerSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const server = new Horizon.Server(horizonUrl);
  const feePayer = Keypair.fromSecret(feePayerSecret);
  const usdc = new Asset(usdcCode, usdcIssuer);

  try {
    const { data: recipient, error } = await supabase
      .from('recipients')
      .select('id, campaign_id, wallet_address, status')
      .eq('claim_link_token', token)
      .single();

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (recipient.status !== 'pending') {
      return res.status(400).json({ error: 'Claim already executed or invalid status' });
    }

    const walletAddress = recipient.wallet_address;

    if (!walletAddress || !StrKey.isValidEd25519PublicKey(walletAddress)) {
      return res.status(409).json({ error: 'Recipient wallet address is missing or invalid' });
    }

    if (await accountExists(server, walletAddress)) {
      return res.status(409).json({ error: 'This account is already active on the network' });
    }

    // ── Phase 1: hand the recipient something to sign ───────────────────────
    if (!signedTxXdr) {
      const sponsorAccount = await server.loadAccount(feePayer.publicKey());

      const tx = new TransactionBuilder(sponsorAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.beginSponsoringFutureReserves({
            sponsoredId: walletAddress,
            source: feePayer.publicKey(),
          }),
        )
        // Sponsored creation, so the recipient needs no starting balance of
        // their own — the sponsor holds the reserve.
        .addOperation(
          Operation.createAccount({
            destination: walletAddress,
            startingBalance: '0',
            source: feePayer.publicKey(),
          }),
        )
        .addOperation(Operation.changeTrust({ asset: usdc, source: walletAddress }))
        .addOperation(
          Operation.endSponsoringFutureReserves({ source: walletAddress }),
        )
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build();

      return res.status(200).json({
        unsigned_tx_xdr: tx.toXDR(),
        wallet_address: walletAddress,
      });
    }

    // ── Phase 2: validate what came back, then co-sign and submit ───────────
    const tx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as any;
    const operations = tx.operations ?? [];

    if (tx.source !== feePayer.publicKey()) {
      return res.status(400).json({ error: 'Transaction source must be the ReRail fee payer' });
    }

    const expected = [
      'beginSponsoringFutureReserves',
      'createAccount',
      'changeTrust',
      'endSponsoringFutureReserves',
    ];

    if (
      operations.length !== expected.length ||
      operations.some((op: any, index: number) => op?.type !== expected[index])
    ) {
      return res.status(400).json({
        error: 'Transaction must be the unmodified account sponsorship built by ReRail',
      });
    }

    const [begin, create, trust, end] = operations;

    // Every field the recipient could have tampered with to make ReRail pay
    // for something other than activating this one account.
    if (begin.sponsoredId !== walletAddress) {
      return res.status(400).json({ error: 'Sponsored account does not match this claim link' });
    }

    if (create.destination !== walletAddress || parseFloat(create.startingBalance) !== 0) {
      return res.status(400).json({ error: 'Account creation does not match this claim link' });
    }

    if (
      trust.source !== walletAddress ||
      trust.line?.getCode?.() !== usdcCode ||
      trust.line?.getIssuer?.() !== usdcIssuer
    ) {
      return res.status(400).json({ error: 'Trustline asset must be the campaign USDC asset' });
    }

    if (end.source !== walletAddress) {
      return res.status(400).json({ error: 'Sponsorship must end on the recipient account' });
    }

    // ── Burn an attempt before spending the fee payer's reserve ─────────────
    const { data: lockRows, error: lockError } = await supabase.rpc('begin_gasless_op', {
      p_token: token,
      p_kind: 'sponsor',
    });

    if (lockError) {
      return res.status(500).json({ error: 'Failed to record the sponsorship attempt' });
    }

    if (!(Array.isArray(lockRows) ? lockRows[0] : lockRows)) {
      return res.status(429).json({
        error: 'This link has used all of its activation attempts. Contact the organizer.',
      });
    }

    tx.sign(feePayer);

    const submitResult = await server.submitTransaction(tx);

    if (!submitResult.successful) {
      return res
        .status(500)
        .json({ error: 'Transaction submission failed', details: submitResult });
    }

    await supabase.from('transactions').insert({
      recipient_id: recipient.id,
      campaign_id: recipient.campaign_id,
      tx_hash: submitResult.hash,
      tx_type: 'sponsor_account',
    });

    // Deliberately does not touch recipient status — activating an account is a
    // prerequisite, not a claim.
    return res.status(200).json({
      success: true,
      hash: submitResult.hash,
      tx_hash: submitResult.hash,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
