import { createHash } from 'node:crypto';
import {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  Networks,
  rpc,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

/** Inclusion fee for contract invocations; simulation adds the resource fee. */
const SOROBAN_INCLUSION_FEE = '1000000';
const TX_TIMEOUT_SECONDS = 30;

export function isRegistryConfigured(): boolean {
  return Boolean(
    process.env.RERAIL_REGISTRY_CONTRACT_ID && process.env.REGISTRY_ADMIN_SECRET
  );
}

/** SHA-256 of a claim token, hex-encoded — matches the frontend's hashing. */
export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Strips the 4-byte type discriminant from a Horizon claimable balance ID,
 * leaving the 32-byte hash the registry stores.
 */
export function balanceIdToHash(balanceId: string): string {
  const hash = balanceId.length === 72 ? balanceId.slice(8) : balanceId;

  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new Error(`Unexpected claimable balance ID format: ${balanceId}`);
  }

  return hash;
}

function hashToScVal(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
}

/**
 * Invokes a registry function with the admin key and waits for it to close.
 *
 * The admin may only write bookkeeping — `mark_balance_created` and
 * `record_claim` record what the Stellar ledger already did. It cannot move
 * funds, create campaigns, or change who is allowed to claim.
 */
async function invokeAsAdmin(functionName: string, args: xdr.ScVal[]): Promise<string> {
  const contractId = process.env.RERAIL_REGISTRY_CONTRACT_ID || '';
  const adminSecret = process.env.REGISTRY_ADMIN_SECRET || '';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const rpcUrl =
    process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

  const admin = Keypair.fromSecret(adminSecret);
  const server = new rpc.Server(rpcUrl);
  const account = await server.getAccount(admin.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: SOROBAN_INCLUSION_FEE,
    networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(functionName, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(admin);

  const sendResponse = await server.sendTransaction(prepared);

  if (sendResponse.status === 'ERROR' || sendResponse.status === 'DUPLICATE') {
    throw new Error(`Registry ${functionName} rejected: ${sendResponse.status}`);
  }

  let result = await server.getTransaction(sendResponse.hash);
  const deadline = Date.now() + TX_TIMEOUT_SECONDS * 1000;

  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) {
      throw new Error(`Registry ${functionName} timed out.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await server.getTransaction(sendResponse.hash);
  }

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Registry ${functionName} failed: ${result.status}`);
  }

  return sendResponse.hash;
}

export async function recordBalanceCreated(
  registryCampaignId: number,
  recipientAddress: string,
  balanceId: string
): Promise<string> {
  const admin = Keypair.fromSecret(process.env.REGISTRY_ADMIN_SECRET || '');

  return invokeAsAdmin('mark_balance_created', [
    new Address(admin.publicKey()).toScVal(),
    nativeToScVal(BigInt(registryCampaignId), { type: 'u64' }),
    new Address(recipientAddress).toScVal(),
    hashToScVal(balanceIdToHash(balanceId)),
  ]);
}

export async function recordClaim(
  registryCampaignId: number,
  recipientAddress: string,
  txHash: string
): Promise<string> {
  const admin = Keypair.fromSecret(process.env.REGISTRY_ADMIN_SECRET || '');

  return invokeAsAdmin('record_claim', [
    new Address(admin.publicKey()).toScVal(),
    nativeToScVal(BigInt(registryCampaignId), { type: 'u64' }),
    new Address(recipientAddress).toScVal(),
    hashToScVal(txHash),
  ]);
}
