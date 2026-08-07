#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

/// Most recipients one batch call may register.
///
/// Each recipient costs two write ledger entries (its record and its claim
/// token index) against a network cap of 50 per transaction, and the campaign
/// row plus instance storage take two more. That leaves room for 24; 20 keeps
/// headroom for the read footprint and for validators voting the limit down.
/// Larger payouts chunk client-side across several calls.
const MAX_BATCH_RECIPIENTS: u32 = 20;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NextCampaignId,
    Campaign(u64),
    Recipient(u64, Address),
    ClaimToken(u64, BytesN<32>),
    BalanceId(u64, Address),
    ClaimTx(u64, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Draft,
    Active,
    Completed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecipientStatus {
    Pending,
    Funded,
    Claimed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u64,
    pub organizer: Address,
    pub name: String,
    pub asset: Address,
    pub default_amount: i128,
    pub total_pool: i128,
    pub deadline: u64,
    pub status: CampaignStatus,
    pub recipient_count: u32,
    pub claimed_count: u32,
}

/// One entry of a batch registration.
///
/// Registering recipients one call at a time meant one wallet signature per
/// recipient — 50 prompts for a 50-person payout. Batching is what makes the
/// registry usable at real campaign sizes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientInput {
    pub recipient: Address,
    pub amount: i128,
    pub claim_token_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientRecord {
    pub campaign_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub claim_token_hash: BytesN<32>,
    pub status: RecipientStatus,
    pub registered_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InvalidAmount = 2,
    InvalidPool = 3,
    InvalidDeadline = 4,
    CampaignNotFound = 5,
    RecipientNotFound = 6,
    NotOrganizer = 7,
    InvalidStatus = 8,
    DuplicateRecipient = 9,
    DuplicateClaimToken = 10,
    BalanceAlreadyRecorded = 11,
    ClaimAlreadyRecorded = 12,
    DeadlineNotReached = 13,
    Overflow = 14,
    EmptyBatch = 15,
    BatchTooLarge = 16,
}

#[contractevent]
pub struct CampaignCreated {
    #[topic]
    pub campaign_id: u64,
    #[topic]
    pub organizer: Address,
}

#[contractevent]
pub struct RecipientRegistered {
    #[topic]
    pub campaign_id: u64,
    #[topic]
    pub recipient: Address,
}

#[contractevent]
pub struct BalanceRecorded {
    #[topic]
    pub campaign_id: u64,
    #[topic]
    pub recipient: Address,
    pub balance_id: BytesN<32>,
}

#[contractevent]
pub struct ClaimRecorded {
    #[topic]
    pub campaign_id: u64,
    #[topic]
    pub recipient: Address,
    pub tx_hash: BytesN<32>,
}

#[contractevent]
pub struct CampaignExpired {
    #[topic]
    pub campaign_id: u64,
}

#[contract]
pub struct ReRailRegistry;

#[contractimpl]
impl ReRailRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NextCampaignId, &0u64);
        bump_instance_ttl(&env);
    }

    pub fn admin(env: Env) -> Result<Address, Error> {
        bump_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    pub fn campaign_count(env: Env) -> u64 {
        bump_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::NextCampaignId)
            .unwrap_or(0)
    }

    pub fn create_campaign(
        env: Env,
        organizer: Address,
        name: String,
        asset: Address,
        default_amount: i128,
        total_pool: i128,
        deadline: u64,
    ) -> Result<u64, Error> {
        organizer.require_auth();

        let (campaign_id, campaign) = build_campaign(
            &env,
            &organizer,
            name,
            asset,
            default_amount,
            total_pool,
            deadline,
        )?;

        store_new_campaign(&env, campaign_id, &campaign);

        CampaignCreated {
            campaign_id,
            organizer,
        }
        .publish(&env);

        Ok(campaign_id)
    }

    /// Creates a campaign, registers every recipient, and activates it — all in
    /// one invocation, so the organizer signs exactly once no matter how many
    /// recipients the payout has.
    ///
    /// Returns the new campaign id.
    pub fn create_and_register(
        env: Env,
        organizer: Address,
        name: String,
        asset: Address,
        default_amount: i128,
        total_pool: i128,
        deadline: u64,
        recipients: Vec<RecipientInput>,
    ) -> Result<u64, Error> {
        organizer.require_auth();

        validate_batch(&recipients)?;

        let (campaign_id, mut campaign) = build_campaign(
            &env,
            &organizer,
            name,
            asset,
            default_amount,
            total_pool,
            deadline,
        )?;

        // Reserve the id before registering so a duplicate inside the batch
        // rolls the whole invocation back rather than burning an id.
        store_new_campaign(&env, campaign_id, &campaign);

        CampaignCreated {
            campaign_id,
            organizer,
        }
        .publish(&env);

        for input in recipients.iter() {
            register_one(&env, &mut campaign, campaign_id, input)?;
        }

        campaign.status = CampaignStatus::Active;
        store_campaign(&env, campaign_id, &campaign);

        Ok(campaign_id)
    }

    /// Registers many recipients against an existing Draft campaign in one call.
    ///
    /// Returns the campaign's recipient count after the batch, so a client
    /// chunking a large payout can confirm nothing was silently dropped.
    pub fn register_recipients(
        env: Env,
        organizer: Address,
        campaign_id: u64,
        recipients: Vec<RecipientInput>,
    ) -> Result<u32, Error> {
        organizer.require_auth();
        bump_instance_ttl(&env);

        validate_batch(&recipients)?;

        let mut campaign = load_campaign(&env, campaign_id)?;
        require_organizer(&campaign, &organizer)?;
        if campaign.status != CampaignStatus::Draft {
            return Err(Error::InvalidStatus);
        }

        for input in recipients.iter() {
            register_one(&env, &mut campaign, campaign_id, input)?;
        }

        let recipient_count = campaign.recipient_count;
        store_campaign(&env, campaign_id, &campaign);

        Ok(recipient_count)
    }

    pub fn get_campaign(env: Env, campaign_id: u64) -> Result<Campaign, Error> {
        let key = DataKey::Campaign(campaign_id);
        let campaign = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::CampaignNotFound)?;
        bump_persistent_ttl(&env, &key);
        Ok(campaign)
    }

    pub fn register_recipient(
        env: Env,
        organizer: Address,
        campaign_id: u64,
        recipient: Address,
        amount: i128,
        claim_token_hash: BytesN<32>,
    ) -> Result<(), Error> {
        organizer.require_auth();
        bump_instance_ttl(&env);

        let mut campaign = load_campaign(&env, campaign_id)?;
        require_organizer(&campaign, &organizer)?;
        if campaign.status != CampaignStatus::Draft {
            return Err(Error::InvalidStatus);
        }

        register_one(
            &env,
            &mut campaign,
            campaign_id,
            RecipientInput {
                recipient,
                amount,
                claim_token_hash,
            },
        )?;

        store_campaign(&env, campaign_id, &campaign);

        Ok(())
    }

    pub fn activate_campaign(env: Env, organizer: Address, campaign_id: u64) -> Result<(), Error> {
        organizer.require_auth();
        bump_instance_ttl(&env);
        let mut campaign = load_campaign(&env, campaign_id)?;
        require_organizer(&campaign, &organizer)?;
        if campaign.status != CampaignStatus::Draft {
            return Err(Error::InvalidStatus);
        }
        campaign.status = CampaignStatus::Active;
        store_campaign(&env, campaign_id, &campaign);
        Ok(())
    }

    /// Records the claimable balance created for a recipient.
    ///
    /// Callable by the organizer or the registry admin — ReRail's backend
    /// resolves balance IDs from Horizon effects after the organizer has
    /// already signed and submitted the funding transaction.
    pub fn mark_balance_created(
        env: Env,
        caller: Address,
        campaign_id: u64,
        recipient: Address,
        balance_id: BytesN<32>,
    ) -> Result<(), Error> {
        let campaign = load_campaign(&env, campaign_id)?;
        require_organizer_or_admin(&env, &campaign, &caller)?;
        if campaign.status != CampaignStatus::Active {
            return Err(Error::InvalidStatus);
        }

        let balance_key = DataKey::BalanceId(campaign_id, recipient.clone());
        if env.storage().persistent().has(&balance_key) {
            return Err(Error::BalanceAlreadyRecorded);
        }

        let mut record = load_recipient(&env, campaign_id, &recipient)?;
        if record.status != RecipientStatus::Pending {
            return Err(Error::InvalidStatus);
        }
        record.status = RecipientStatus::Funded;

        let recipient_key = DataKey::Recipient(campaign_id, recipient.clone());
        env.storage().persistent().set(&recipient_key, &record);
        env.storage().persistent().set(&balance_key, &balance_id);
        bump_persistent_ttl(&env, &recipient_key);
        bump_persistent_ttl(&env, &balance_key);

        BalanceRecorded {
            campaign_id,
            recipient,
            balance_id,
        }
        .publish(&env);

        Ok(())
    }

    /// Records that a recipient claimed their balance.
    ///
    /// Callable by the organizer or the registry admin — the claim is executed
    /// server-side inside the fee-bump route, where the organizer cannot sign.
    pub fn record_claim(
        env: Env,
        caller: Address,
        campaign_id: u64,
        recipient: Address,
        tx_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let mut campaign = load_campaign(&env, campaign_id)?;
        require_organizer_or_admin(&env, &campaign, &caller)?;
        if campaign.status != CampaignStatus::Active {
            return Err(Error::InvalidStatus);
        }

        let mut record = load_recipient(&env, campaign_id, &recipient)?;
        if record.status != RecipientStatus::Funded {
            return Err(Error::InvalidStatus);
        }

        let claim_key = DataKey::ClaimTx(campaign_id, recipient.clone());
        if env.storage().persistent().has(&claim_key) {
            return Err(Error::ClaimAlreadyRecorded);
        }

        record.status = RecipientStatus::Claimed;
        campaign.claimed_count = campaign.claimed_count.checked_add(1).ok_or(Error::Overflow)?;
        if campaign.claimed_count == campaign.recipient_count {
            campaign.status = CampaignStatus::Completed;
        }

        let recipient_key = DataKey::Recipient(campaign_id, recipient.clone());
        let campaign_key = DataKey::Campaign(campaign_id);
        env.storage().persistent().set(&recipient_key, &record);
        env.storage().persistent().set(&campaign_key, &campaign);
        env.storage().persistent().set(&claim_key, &tx_hash);
        bump_persistent_ttl(&env, &recipient_key);
        bump_persistent_ttl(&env, &campaign_key);
        bump_persistent_ttl(&env, &claim_key);

        ClaimRecorded {
            campaign_id,
            recipient,
            tx_hash,
        }
        .publish(&env);

        Ok(())
    }

    pub fn expire_campaign(env: Env, organizer: Address, campaign_id: u64) -> Result<(), Error> {
        organizer.require_auth();
        bump_instance_ttl(&env);
        let mut campaign = load_campaign(&env, campaign_id)?;
        require_organizer(&campaign, &organizer)?;
        if campaign.status != CampaignStatus::Active {
            return Err(Error::InvalidStatus);
        }
        if campaign.deadline == 0 || env.ledger().timestamp() <= campaign.deadline {
            return Err(Error::DeadlineNotReached);
        }
        campaign.status = CampaignStatus::Expired;
        store_campaign(&env, campaign_id, &campaign);
        CampaignExpired { campaign_id }.publish(&env);
        Ok(())
    }

    pub fn get_recipient(
        env: Env,
        campaign_id: u64,
        recipient: Address,
    ) -> Result<RecipientRecord, Error> {
        load_recipient(&env, campaign_id, &recipient)
    }

    pub fn get_balance_id(
        env: Env,
        campaign_id: u64,
        recipient: Address,
    ) -> Result<BytesN<32>, Error> {
        let key = DataKey::BalanceId(campaign_id, recipient);
        let balance_id = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::RecipientNotFound)?;
        bump_persistent_ttl(&env, &key);
        Ok(balance_id)
    }

    pub fn has_claim_token(env: Env, campaign_id: u64, claim_token_hash: BytesN<32>) -> bool {
        let key = DataKey::ClaimToken(campaign_id, claim_token_hash);
        let exists = env.storage().persistent().has(&key);
        if exists {
            bump_persistent_ttl(&env, &key);
        }
        exists
    }
}

/// Validates the campaign inputs and allocates the next id.
///
/// Split out of `create_campaign` so `create_and_register` can reuse it without
/// requiring a second authorization from the organizer.
fn build_campaign(
    env: &Env,
    organizer: &Address,
    name: String,
    asset: Address,
    default_amount: i128,
    total_pool: i128,
    deadline: u64,
) -> Result<(u64, Campaign), Error> {
    validate_amount(default_amount)?;
    if total_pool < default_amount {
        return Err(Error::InvalidPool);
    }
    validate_deadline(env, deadline)?;

    let next_id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextCampaignId)
        .unwrap_or(0);
    let campaign_id = next_id.checked_add(1).ok_or(Error::Overflow)?;

    Ok((
        campaign_id,
        Campaign {
            id: campaign_id,
            organizer: organizer.clone(),
            name,
            asset,
            default_amount,
            total_pool,
            deadline,
            status: CampaignStatus::Draft,
            recipient_count: 0,
            claimed_count: 0,
        },
    ))
}

fn store_new_campaign(env: &Env, campaign_id: u64, campaign: &Campaign) {
    env.storage()
        .instance()
        .set(&DataKey::NextCampaignId, &campaign_id);
    bump_instance_ttl(env);
    store_campaign(env, campaign_id, campaign);
}

/// Registers a single recipient against an in-memory campaign.
///
/// The caller owns persisting `campaign` — a batch writes it once at the end
/// rather than once per recipient.
fn register_one(
    env: &Env,
    campaign: &mut Campaign,
    campaign_id: u64,
    input: RecipientInput,
) -> Result<(), Error> {
    validate_amount(input.amount)?;

    let recipient_key = DataKey::Recipient(campaign_id, input.recipient.clone());
    if env.storage().persistent().has(&recipient_key) {
        return Err(Error::DuplicateRecipient);
    }

    let token_key = DataKey::ClaimToken(campaign_id, input.claim_token_hash.clone());
    if env.storage().persistent().has(&token_key) {
        return Err(Error::DuplicateClaimToken);
    }

    campaign.recipient_count = campaign
        .recipient_count
        .checked_add(1)
        .ok_or(Error::Overflow)?;

    let record = RecipientRecord {
        campaign_id,
        recipient: input.recipient.clone(),
        amount: input.amount,
        claim_token_hash: input.claim_token_hash,
        status: RecipientStatus::Pending,
        registered_at: env.ledger().timestamp(),
    };

    env.storage().persistent().set(&recipient_key, &record);
    env.storage()
        .persistent()
        .set(&token_key, &input.recipient);
    bump_persistent_ttl(env, &recipient_key);
    bump_persistent_ttl(env, &token_key);

    RecipientRegistered {
        campaign_id,
        recipient: input.recipient,
    }
    .publish(env);

    Ok(())
}

/// Rejects a batch that is empty or larger than one transaction can write.
///
/// Without the upper bound an oversized batch fails deep inside the host with
/// `Budget, ExceededLimit`, which tells the organizer nothing.
fn validate_batch(recipients: &Vec<RecipientInput>) -> Result<(), Error> {
    if recipients.is_empty() {
        return Err(Error::EmptyBatch);
    }
    if recipients.len() > MAX_BATCH_RECIPIENTS {
        return Err(Error::BatchTooLarge);
    }
    Ok(())
}

fn validate_amount(amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

fn validate_deadline(env: &Env, deadline: u64) -> Result<(), Error> {
    if deadline != 0 && deadline <= env.ledger().timestamp() {
        return Err(Error::InvalidDeadline);
    }
    Ok(())
}

fn require_organizer(campaign: &Campaign, organizer: &Address) -> Result<(), Error> {
    if &campaign.organizer != organizer {
        return Err(Error::NotOrganizer);
    }
    Ok(())
}

/// Authorises a bookkeeping call from either the campaign's organizer or the
/// registry admin.
///
/// Balance creation and claim execution are observed by ReRail's backend, not
/// by the organizer's browser — the organizer is not present to sign at that
/// moment. Both functions only record what already happened on the Stellar
/// ledger, so admin recording cannot move funds or alter who may claim.
fn require_organizer_or_admin(
    env: &Env,
    campaign: &Campaign,
    caller: &Address,
) -> Result<(), Error> {
    caller.require_auth();

    // The admin lives in instance storage. Every authorised write keeps that
    // entry alive — if instance storage archives, the admin is unrecoverable
    // and the backend can never record a balance or a claim again.
    bump_instance_ttl(env);

    if &campaign.organizer == caller {
        return Ok(());
    }

    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;

    if &admin == caller {
        return Ok(());
    }

    Err(Error::NotOrganizer)
}

fn load_campaign(env: &Env, campaign_id: u64) -> Result<Campaign, Error> {
    let key = DataKey::Campaign(campaign_id);
    let campaign = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::CampaignNotFound)?;
    bump_persistent_ttl(env, &key);
    Ok(campaign)
}

fn store_campaign(env: &Env, campaign_id: u64, campaign: &Campaign) {
    let key = DataKey::Campaign(campaign_id);
    env.storage().persistent().set(&key, campaign);
    bump_persistent_ttl(env, &key);
}

fn load_recipient(
    env: &Env,
    campaign_id: u64,
    recipient: &Address,
) -> Result<RecipientRecord, Error> {
    let key = DataKey::Recipient(campaign_id, recipient.clone());
    let record = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::RecipientNotFound)?;
    bump_persistent_ttl(env, &key);
    Ok(record)
}

fn bump_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn bump_persistent_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

mod test;
