import { Keypair } from '@stellar/stellar-sdk';

async function fundAccount(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    return response.ok;
  } catch (error) {
    console.error(`Failed to fund account ${publicKey}`, error);
    return false;
  }
}

async function main() {
  console.log('Generating Testnet Accounts...\n');

  const feePayer = Keypair.random();
  const testOrganizer = Keypair.random();

  console.log('Funding Fee Payer account...');
  const feePayerFunded = await fundAccount(feePayer.publicKey());
  console.log(`Fee Payer funded: ${feePayerFunded}`);

  console.log('Funding Test Organizer account...');
  const testOrganizerFunded = await fundAccount(testOrganizer.publicKey());
  console.log(`Test Organizer funded: ${testOrganizerFunded}\n`);

  console.log('====================================');
  console.log('FEE_PAYER_PUBLIC_KEY', feePayer.publicKey());
  console.log('FEE_PAYER_SECRET', feePayer.secret());
  console.log('------------------------------------');
  console.log('TEST_ORGANIZER_PUBLIC_KEY', testOrganizer.publicKey());
  console.log('TEST_ORGANIZER_SECRET', testOrganizer.secret());
  console.log('====================================\n');

  console.log('Please add these to your .env.local file.');
}

main().catch(console.error);
