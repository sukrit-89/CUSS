import {
  Address,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { BASE_FEE, NETWORK_PASSPHRASE, TX_TIMEOUT_SECONDS } from '@/config/constants';
import { RERAIL_REGISTRY_CONTRACT_ID } from '@/config/contracts';
import { getHorizonServer } from '@/lib/stellar/client';

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

export interface RegistryRecipientBalanceInput {
  organizer: string;
  campaignId: bigint;
  recipient: string;
  balanceIdHash: string;
}

export interface RegistryClaimInput {
  organizer: string;
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

async function buildRegistryCallTx(
  sourcePublicKey: string,
  functionName: string,
  args: xdr.ScVal[],
  contractId?: string,
): Promise<string> {
  const server = getHorizonServer();
  const sourceAccount = await server.loadAccount(sourcePublicKey);
  const contract = new Contract(requireRegistryContractId(contractId));

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  return tx.toXDR();
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
      new Address(input.organizer).toScVal(),
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
      new Address(input.organizer).toScVal(),
      nativeToScVal(input.campaignId, { type: 'u64' }),
      new Address(input.recipient).toScVal(),
      hashToScVal(input.txHash),
    ],
    contractId,
  );
}
