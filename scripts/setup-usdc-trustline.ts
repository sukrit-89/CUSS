import { Keypair, Asset, TransactionBuilder, Operation, Networks, Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const USDC_ASSET = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUUB3MACJUJWSBWPPEUBIGMACUWUPP6');

async function main() {
  const feePayerSecret = process.env.FEE_PAYER_SECRET;
  const testOrganizerSecret = process.env.TEST_ORGANIZER_SECRET;

  if (!feePayerSecret || !testOrganizerSecret) {
    throw new Error('Missing FEE_PAYER_SECRET or TEST_ORGANIZER_SECRET in environment');
  }

  const server = new Horizon.Server(HORIZON_URL);
  const feePayer = Keypair.fromSecret(feePayerSecret);
  const testOrganizer = Keypair.fromSecret(testOrganizerSecret);

  console.log('Setting up USDC trustlines...');

  for (const keypair of [feePayer, testOrganizer]) {
    const account = await server.loadAccount(keypair.publicKey());
    
    const builder = new TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(30);

    builder.addOperation(
      Operation.changeTrust({
        asset: USDC_ASSET,
      })
    );

    const tx = builder.build();
    tx.sign(keypair);

    try {
      console.log(`Submitting trustline for ${keypair.publicKey()}...`);
      await server.submitTransaction(tx);
      console.log(`Success for ${keypair.publicKey()}`);
    } catch (error: any) {
      console.error(`Error for ${keypair.publicKey()}:`, error?.response?.data || error.message);
    }
  }
}

main().catch(console.error);
