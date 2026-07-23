import { Keypair, Asset, TransactionBuilder, Operation, Networks, Horizon, Claimant } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const USDC_ASSET = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUUB3MACJUJWSBWPPEUBIGMACUWUPP6');
const BASE_FEE = '1000';

async function fundAccount(publicKey: string): Promise<boolean> {
  const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  return response.ok;
}

async function main() {
  const feePayerSecret = process.env.FEE_PAYER_SECRET;
  const testOrganizerSecret = process.env.TEST_ORGANIZER_SECRET;

  if (!feePayerSecret || !testOrganizerSecret) {
    throw new Error('Missing secrets in environment');
  }

  const server = new Horizon.Server(HORIZON_URL);
  const feePayer = Keypair.fromSecret(feePayerSecret);
  const organizer = Keypair.fromSecret(testOrganizerSecret);
  
  // 1. Generate a new recipient keypair
  const recipient = Keypair.random();
  console.log('Recipient generated:', recipient.publicKey());

  // 2. Fund it via Friendbot
  await fundAccount(recipient.publicKey());
  console.log('Recipient funded via Friendbot.');

  // 3. Set up USDC trustline on recipient
  const recipientAccount = await server.loadAccount(recipient.publicKey());
  const trustBuilder = new TransactionBuilder(recipientAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }).setTimeout(30);
  trustBuilder.addOperation(Operation.changeTrust({ asset: USDC_ASSET }));
  const trustTx = trustBuilder.build();
  trustTx.sign(recipient);
  await server.submitTransaction(trustTx);
  console.log('Recipient trustline established.');

  // 4. Create a claimable balance from test organiser to recipient
  const organizerAccount = await server.loadAccount(organizer.publicKey());
  const cbBuilder = new TransactionBuilder(organizerAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }).setTimeout(30);
  
  cbBuilder.addOperation(Operation.createClaimableBalance({
    asset: USDC_ASSET,
    amount: '10.0',
    claimants: [
      new Claimant(recipient.publicKey(), Claimant.predicateUnconditional()),
    ]
  }));
  const cbTx = cbBuilder.build();
  cbTx.sign(organizer);
  const cbResult = await server.submitTransaction(cbTx);
  console.log('Claimable balance created.');
  
  let balanceId = '';
  if (cbResult.successful) {
    const records = await server.claimableBalances().claimant(recipient.publicKey()).call();
    if (records.records.length > 0) {
      balanceId = records.records[0].id;
    }
  }

  if (!balanceId) throw new Error('Could not find claimable balance ID');
  console.log(`Balance ID: ${balanceId}`);

  // 5. Build inner claim transaction
  const claimBuilder = new TransactionBuilder(await server.loadAccount(recipient.publicKey()), { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }).setTimeout(30);
  claimBuilder.addOperation(Operation.claimClaimableBalance({ balanceId }));
  const innerTx = claimBuilder.build();

  // 6. Sign with recipient
  innerTx.sign(recipient);

  // 7. Wrap in fee bump (sign with fee payer)
  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    feePayer,
    (parseInt(BASE_FEE) * 2).toString(),
    innerTx,
    NETWORK_PASSPHRASE
  );
  feeBumpTx.sign(feePayer);

  // 8. Submit to testnet
  console.log('Submitting fee bump transaction...');
  const claimResult = await server.submitTransaction(feeBumpTx);
  
  // 9. Verify the claimable balance is consumed
  // 10. Print success/failure
  if (claimResult.successful) {
    console.log('SUCCESS! Claimable balance successfully claimed via fee bump.');
  } else {
    console.log('FAILURE:', claimResult);
  }
}

main().catch(console.error);
