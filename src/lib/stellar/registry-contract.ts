import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import {
  NETWORK_PASSPHRASE,
  SOROBAN_INCLUSION_FEE,
  SOROBAN_RPC_URL,
  TX_TIMEOUT_SECONDS,
} from '@/config/constants';
import { RERAIL_REGISTRY_CONTRACT_ID } from '@/config/contracts';

let sorobanServer: rpc.Server | null = null;

/**
 * Soroban RPC client.
 *
 * Contract invocations must be simulated to acquire their footprint and
 * resource fee, and submitted here rather than to Horizon — Horizon has no
 * endpoint that can do either.
 */
export function getSorobanServer(): rpc.Server {
  if (!sorobanServer) {
    sorobanServer = new rpc.Server(SOROBAN_RPC_URL);
  }
  return sorobanServer;
}

/**
 * Converts a Horizon claimable balance ID to the 32-byte hash the registry
 * stores.
 *
 * Horizon returns 72 hex characters: a 4-byte type discriminant followed by
 * the 32-byte hash. The discriminant is constant and carries no information,
 * so the registry keeps only the hash. Supabase keeps the full form, which is
 * what `claimClaimableBalance` needs.
 */
export function balanceIdToHash(balanceId: string): string {
  const hash = balanceId.length === 72 ? balanceId.slice(8) : balanceId;

  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new Error(`Unexpected claimable balance ID format: ${balanceId}`);
  }

  return hash;
}

export interface RegistryCampaignInput {
  organizer: string;
  name: string;
  assetContractId: string;
  defaultAmount: bigint;
  totalPool: bigint;
  deadline: bigint;
}

/** One entry of a batch registration — mirrors the contract's `RecipientInput`. */
export interface RegistryBatchRecipient {
  recipient: string;
  amount: bigint;
  claimTokenHash: string;
}

/**
 * Most recipients one registry call can take.
 *
 * Must stay in sync with `MAX_BATCH_RECIPIENTS` in the contract. Each recipient
 * costs two write ledger entries against a network cap of 50 per transaction.
 */
export const MAX_REGISTRY_BATCH = 20;

function requireRegistryContractId(contractId = RERAIL_REGISTRY_CONTRACT_ID): string {
  if (!contractId) {
    throw new Error('VITE_RERAIL_REGISTRY_CONTRACT_ID is not configured.');
  }
  return contractId;
}

/**
 * Decodes a hex string to bytes.
 *
 * `Buffer` is a Node global. Vite does not polyfill it, so using it here would
 * throw `Buffer is not defined` in the browser the first time a registry call
 * is made.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function hashToScVal(hex: string): xdr.ScVal {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('Expected a 32-byte hex hash.');
  }
  // `scvBytes` is typed against Node's Buffer; `nativeToScVal` takes a plain
  // Uint8Array and produces the same ScVal.
  return nativeToScVal(hexToBytes(hex), { type: 'bytes' });
}

/**
 * Builds and simulates a registry invocation, returning an XDR that is ready
 * to sign. Simulation is not optional — an unprepared Soroban transaction has
 * no footprint or resource fee and will be rejected.
 */
async function buildRegistryCallTx(
  sourcePublicKey: string,
  functionName: string,
  args: xdr.ScVal[],
  contractId?: string,
): Promise<string> {
  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(sourcePublicKey);
  const contract = new Contract(requireRegistryContractId(contractId));

  const tx = new TransactionBuilder(sourceAccount, {
    fee: SOROBAN_INCLUSION_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const prepared = await server.prepareTransaction(tx);

  return prepared.toXDR();
}

/**
 * Submits a signed registry invocation and waits for the ledger to close.
 *
 * @returns the transaction hash and the contract's decoded return value.
 */
export async function submitRegistryTx(
  signedXdr: string,
): Promise<{ hash: string; returnValue: unknown }> {
  const server = getSorobanServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sendResponse = await server.sendTransaction(tx);

  if (sendResponse.status === 'ERROR' || sendResponse.status === 'DUPLICATE') {
    throw new Error(`Registry transaction rejected: ${sendResponse.status}`);
  }

  let result = await server.getTransaction(sendResponse.hash);

  // Soroban RPC reports NOT_FOUND until the transaction's ledger closes.
  const deadline = Date.now() + TX_TIMEOUT_SECONDS * 1000;
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for the registry transaction to close.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await server.getTransaction(sendResponse.hash);
  }

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Registry transaction failed: ${result.status}`);
  }

  return {
    hash: sendResponse.hash,
    returnValue: result.returnValue ? scValToNative(result.returnValue) : null,
  };
}

export async function buildCreateRegistryCampaignTx(
  sourcePublicKey: string,
  input: RegistryCampaignInput,
  contractId?: string,
): Promise<string> {
  return buildRegistryCallTx(
    sourcePublicKey,
    'create_campaign',
    [
      new Address(input.organizer).toScVal(),
      nativeToScVal(input.name, { type: 'string' }),
      new Address(input.assetContractId).toScVal(),
      nativeToScVal(input.defaultAmount, { type: 'i128' }),
      nativeToScVal(input.totalPool, { type: 'i128' }),
      nativeToScVal(input.deadline, { type: 'u64' }),
    ],
    contractId,
  );
}

export async function buildActivateRegistryCampaignTx(
  sourcePublicKey: string,
  organizer: string,
  campaignId: bigint,
  contractId?: string,
): Promise<string> {
  return buildRegistryCallTx(
    sourcePublicKey,
    'activate_campaign',
    [
      new Address(organizer).toScVal(),
      nativeToScVal(campaignId, { type: 'u64' }),
    ],
    contractId,
  );
}

/** Encodes a batch entry as the contract's `RecipientInput` struct. */
function recipientInputScVal(entry: RegistryBatchRecipient): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: nativeToScVal('amount', { type: 'symbol' }),
      val: nativeToScVal(entry.amount, { type: 'i128' }),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('claim_token_hash', { type: 'symbol' }),
      val: hashToScVal(entry.claimTokenHash),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('recipient', { type: 'symbol' }),
      val: new Address(entry.recipient).toScVal(),
    }),
  ]);
}

function assertBatchSize(recipients: RegistryBatchRecipient[]): void {
  if (recipients.length === 0) {
    throw new Error('A registry batch needs at least one recipient.');
  }
  if (recipients.length > MAX_REGISTRY_BATCH) {
    throw new Error(
      `A registry batch holds at most ${MAX_REGISTRY_BATCH} recipients; split larger payouts.`,
    );
  }
}

/**
 * Creates the campaign, registers up to `MAX_REGISTRY_BATCH` recipients, and
 * activates it — one organizer signature for the whole mirror.
 */
export async function buildCreateAndRegisterTx(
  sourcePublicKey: string,
  input: RegistryCampaignInput,
  recipients: RegistryBatchRecipient[],
  contractId?: string,
): Promise<string> {
  assertBatchSize(recipients);

  return buildRegistryCallTx(
    sourcePublicKey,
    'create_and_register',
    [
      new Address(input.organizer).toScVal(),
      nativeToScVal(input.name, { type: 'string' }),
      new Address(input.assetContractId).toScVal(),
      nativeToScVal(input.defaultAmount, { type: 'i128' }),
      nativeToScVal(input.totalPool, { type: 'i128' }),
      nativeToScVal(input.deadline, { type: 'u64' }),
      xdr.ScVal.scvVec(recipients.map(recipientInputScVal)),
    ],
    contractId,
  );
}

/** Appends a chunk of recipients to a campaign that is still Draft. */
export async function buildRegisterRecipientsTx(
  sourcePublicKey: string,
  organizer: string,
  campaignId: bigint,
  recipients: RegistryBatchRecipient[],
  contractId?: string,
): Promise<string> {
  assertBatchSize(recipients);

  return buildRegistryCallTx(
    sourcePublicKey,
    'register_recipients',
    [
      new Address(organizer).toScVal(),
      nativeToScVal(campaignId, { type: 'u64' }),
      xdr.ScVal.scvVec(recipients.map(recipientInputScVal)),
    ],
    contractId,
  );
}
