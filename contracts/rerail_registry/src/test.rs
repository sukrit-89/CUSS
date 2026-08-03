#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    IntoVal,
};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    ReRailRegistryClient<'static>,
) {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = Address::generate(&env);
    let contract_id = env.register(ReRailRegistry, (admin.clone(),));
    let client = ReRailRegistryClient::new(&env, &contract_id);

    (env, admin, organizer, recipient, asset, client)
}

fn bytes(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn create_default_campaign(
    env: &Env,
    client: &ReRailRegistryClient,
    organizer: &Address,
    asset: &Address,
) -> u64 {
    env.mock_all_auths();
    client.create_campaign(
        organizer,
        &String::from_str(env, "Hackathon"),
        asset,
        &100,
        &1_000,
        &2_000,
    )
}

#[test]
fn constructor_sets_admin_and_zero_count() {
    let (_env, admin, _organizer, _recipient, _asset, client) = setup();

    assert_eq!(client.admin(), admin);
    assert_eq!(client.campaign_count(), 0);
}

#[test]
fn create_campaign_requires_organizer_auth_and_stores_data() {
    let (env, _admin, organizer, _recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);

    assert_eq!(campaign_id, 1);
    assert_eq!(env.auths().len(), 1);

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.organizer, organizer);
    assert_eq!(campaign.asset, asset);
    assert_eq!(campaign.default_amount, 100);
    assert_eq!(campaign.total_pool, 1_000);
    assert_eq!(campaign.deadline, 2_000);
    assert_eq!(campaign.status, CampaignStatus::Draft);
}

#[test]
fn create_campaign_rejects_invalid_amount_pool_and_deadline() {
    let (env, _admin, organizer, _recipient, asset, client) = setup();
    env.mock_all_auths();

    assert!(client
        .try_create_campaign(
            &organizer,
            &String::from_str(&env, "Bad"),
            &asset,
            &0,
            &1_000,
            &2_000,
        )
        .is_err());

    assert!(client
        .try_create_campaign(
            &organizer,
            &String::from_str(&env, "Bad"),
            &asset,
            &100,
            &99,
            &2_000,
        )
        .is_err());

    assert!(client
        .try_create_campaign(
            &organizer,
            &String::from_str(&env, "Bad"),
            &asset,
            &100,
            &1_000,
            &999,
        )
        .is_err());
}

#[test]
fn register_recipient_stores_pending_record_and_token_hash() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    let token_hash = bytes(&env, 1);

    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &token_hash);

    let record = client.get_recipient(&campaign_id, &recipient);
    assert_eq!(record.campaign_id, campaign_id);
    assert_eq!(record.recipient, recipient);
    assert_eq!(record.amount, 100);
    assert_eq!(record.claim_token_hash, token_hash.clone());
    assert_eq!(record.status, RecipientStatus::Pending);
    assert!(client.has_claim_token(&campaign_id, &token_hash));

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.recipient_count, 1);
}

#[test]
fn register_recipient_rejects_duplicates_and_non_organizer() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let other = Address::generate(&env);
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    let token_hash = bytes(&env, 2);

    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &token_hash);

    assert!(client
        .try_register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 3))
        .is_err());
    assert!(client
        .try_register_recipient(&organizer, &campaign_id, &other, &100, &token_hash)
        .is_err());
    assert!(client
        .try_register_recipient(&other, &campaign_id, &other, &100, &bytes(&env, 4))
        .is_err());
}

#[test]
fn activation_and_balance_recording_transition_recipient_to_funded() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 5));

    client.activate_campaign(&organizer, &campaign_id);
    client.mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 6));

    let record = client.get_recipient(&campaign_id, &recipient);
    assert_eq!(record.status, RecipientStatus::Funded);
    assert_eq!(
        client.get_balance_id(&campaign_id, &recipient),
        bytes(&env, 6)
    );
    assert_eq!(
        client.get_campaign(&campaign_id).status,
        CampaignStatus::Active
    );
}

#[test]
fn balance_recording_requires_active_campaign_and_is_idempotent() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 7));

    assert!(client
        .try_mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 8))
        .is_err());

    client.activate_campaign(&organizer, &campaign_id);
    client.mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 8));

    assert!(client
        .try_mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 9))
        .is_err());
}

#[test]
fn record_claim_marks_recipient_and_completes_campaign_when_all_claimed() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 10));
    client.activate_campaign(&organizer, &campaign_id);
    client.mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 11));

    client.record_claim(&organizer, &campaign_id, &recipient, &bytes(&env, 12));

    assert_eq!(
        client.get_recipient(&campaign_id, &recipient).status,
        RecipientStatus::Claimed
    );
    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.claimed_count, 1);
    assert_eq!(campaign.status, CampaignStatus::Completed);
}

#[test]
fn record_claim_rejects_unfunded_and_duplicate_claims() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 13));
    client.activate_campaign(&organizer, &campaign_id);

    assert!(client
        .try_record_claim(&organizer, &campaign_id, &recipient, &bytes(&env, 14))
        .is_err());

    client.mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 15));
    client.record_claim(&organizer, &campaign_id, &recipient, &bytes(&env, 16));

    assert!(client
        .try_record_claim(&organizer, &campaign_id, &recipient, &bytes(&env, 17))
        .is_err());
}

#[test]
fn admin_can_record_balances_and_claims_on_behalf_of_organizer() {
    // ReRail's backend observes balance creation and claim execution, so the
    // admin key must be able to record both without the organizer present.
    let (env, admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 40));
    client.activate_campaign(&organizer, &campaign_id);

    client.mark_balance_created(&admin, &campaign_id, &recipient, &bytes(&env, 41));
    assert_eq!(
        client.get_recipient(&campaign_id, &recipient).status,
        RecipientStatus::Funded
    );

    client.record_claim(&admin, &campaign_id, &recipient, &bytes(&env, 42));
    assert_eq!(
        client.get_recipient(&campaign_id, &recipient).status,
        RecipientStatus::Claimed
    );
}

#[test]
fn third_party_cannot_record_balances_or_claims() {
    // Authorisation is not the same as authentication: mock_all_auths lets the
    // stranger sign, but they are neither the organizer nor the admin.
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let stranger = Address::generate(&env);
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 43));
    client.activate_campaign(&organizer, &campaign_id);

    assert!(client
        .try_mark_balance_created(&stranger, &campaign_id, &recipient, &bytes(&env, 44))
        .is_err());

    client.mark_balance_created(&organizer, &campaign_id, &recipient, &bytes(&env, 45));

    assert!(client
        .try_record_claim(&stranger, &campaign_id, &recipient, &bytes(&env, 46))
        .is_err());
}

#[test]
#[should_panic]
fn admin_recording_still_requires_a_signature() {
    // The admin path relaxes who may call, never whether they must sign.
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = Address::generate(&env);
    let contract_id = env.register(ReRailRegistry, (admin.clone(),));
    let client = ReRailRegistryClient::new(&env, &contract_id);

    env.mock_all_auths();
    let campaign_id = client.create_campaign(
        &organizer,
        &String::from_str(&env, "Hackathon"),
        &asset,
        &100,
        &1_000,
        &2_000,
    );
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 47));
    client.activate_campaign(&organizer, &campaign_id);

    env.set_auths(&[]);
    client.mark_balance_created(&admin, &campaign_id, &recipient, &bytes(&env, 48));
}

#[test]
fn expire_campaign_requires_deadline_to_pass() {
    let (env, _admin, organizer, recipient, asset, client) = setup();
    let campaign_id = create_default_campaign(&env, &client, &organizer, &asset);
    client.register_recipient(&organizer, &campaign_id, &recipient, &100, &bytes(&env, 18));
    client.activate_campaign(&organizer, &campaign_id);

    assert!(client
        .try_expire_campaign(&organizer, &campaign_id)
        .is_err());

    env.ledger().set_timestamp(2_001);
    client.expire_campaign(&organizer, &campaign_id);

    assert_eq!(
        client.get_campaign(&campaign_id).status,
        CampaignStatus::Expired
    );
}

#[test]
#[should_panic]
fn create_campaign_without_auth_panics() {
    let (env, _admin, organizer, _recipient, asset, client) = setup();

    client.create_campaign(
        &organizer,
        &String::from_str(&env, "NoAuth"),
        &asset,
        &100,
        &1_000,
        &2_000,
    );
}

#[test]
fn exact_auth_can_create_campaign() {
    let (env, _admin, organizer, _recipient, asset, client) = setup();
    let contract_id = client.address.clone();

    env.mock_auths(&[MockAuth {
        address: &organizer,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "create_campaign",
            args: (
                organizer.clone(),
                String::from_str(&env, "Exact"),
                asset.clone(),
                100i128,
                1_000i128,
                2_000u64,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let campaign_id = client.create_campaign(
        &organizer,
        &String::from_str(&env, "Exact"),
        &asset,
        &100,
        &1_000,
        &2_000,
    );

    assert_eq!(campaign_id, 1);
    assert_eq!(env.auths().len(), 1);
}
