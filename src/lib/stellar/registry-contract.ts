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

export interface RegistryRecipientInput {
  organizer: string;
  campaignId: bigint;
  recipient: string;
  amount: bigint;
  claimTokenHash: string;
}

/** `caller` may be the organizer or the registry admin — see the contract's
 *  `require_organizer_or_admin`. */
export interface RegistryRecipientBalanceInput {
  caller: string;
  campaignId: bigint;
  recipient: string;
  balanceIdHash: string;
}

/** `caller` may be the organizer or the registry admin. */
export interface RegistryClaimInput {
  caller: string;
  campaignId: bigint;
  recipient: string;
  txHash: string;
}

function requireRegistryContractId(contractId = RERAIL_REGISTRY_CONTRACT_ID): string {
  if (!contractId) {
    throw new Error('VITE_RERAIL_REGISTRY_CONTRACT_ID is not configured.');
  }
  return contractId;
}

function hashToScVal(hex: string): xdr.ScVal {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('Expected a 32-byte hex hash.');
  }
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
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

export async function buildRegisterRegistryRecipientTx(
  sourcePublicKey: string,
  input: RegistryRecipientInput,
  contractId?: string,
): Promise<string> {
  return buildRegistryCallTx(
    sourcePublicKey,
    'register_recipient',
    [
      new Address(input.organizer).toScVal(),
      nativeToScVal(input.campaignId, { type: 'u64' }),
      new Address(input.recipient).toScVal(),
      nativeToScVal(input.amount, { type: 'i128' }),
      hashToScVal(input.claimTokenHash),
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

export async function buildMarkRegistryBalanceCreatedTx(
  sourcePublicKey: string,
  input: RegistryRecipientBalanceInput,
  contractId?: string,
): Promise<string> {
  return buildRegistryCallTx(
    sourcePublicKey,
    'mark_balance_created',
    [
      new Address(input.caller).toScVal(),
      nativeToScVal(input.campaignId, { type: 'u64' }),
      new Address(input.recipient).toScVal(),
      hashToScVal(input.balanceIdHash),
    ],
    contractId,
  );
}

export async function buildRecordRegistryClaimTx(
  sourcePublicKey: string,
  input: RegistryClaimInput,
  contractId?: string,
): Promise<string> {
  return buildRegistryCallTx(
    sourcePublicKey,
    'record_claim',
    [
      new Address(input.caller).toScVal(),
      nativeToScVal(input.campaignId, { type: 'u64' }),
      new Address(input.recipient).toScVal(),
      hashToScVal(input.txHash),
    ],
    contractId,
  );
}
