extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::identity_registry::{IdentityRegistry, IdentityRegistryClient};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup() -> (Env, IdentityRegistryClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, IdentityRegistry {});
    let client = IdentityRegistryClient::new(&env, &contract_id);
    (env, client, admin)
}

// ── initialize_admin ─────────────────────────────────────────────────────────

#[test]
fn test_initialize_admin_sets_admin() {
    let (_, client, admin) = setup();

    assert_eq!(client.get_upgrade_admin(), None);

    client.initialize_admin(&admin);

    assert_eq!(client.get_upgrade_admin(), Some(admin));
}

#[test]
fn test_initialize_admin_sets_version_to_one() {
    let (_, client, admin) = setup();

    // Default before init
    assert_eq!(client.get_version(), 1u32);

    client.initialize_admin(&admin);

    assert_eq!(client.get_version(), 1u32);
}

#[test]
#[should_panic]
fn test_initialize_admin_twice_panics() {
    let (_, client, admin) = setup();
    client.initialize_admin(&admin);
    client.initialize_admin(&admin); // must panic with AlreadyInitialized
}

// ── get_version / get_upgrade_admin ──────────────────────────────────────────

#[test]
fn test_get_upgrade_admin_none_before_init() {
    let (_, client, _) = setup();
    assert_eq!(client.get_upgrade_admin(), None);
}

#[test]
fn test_get_version_default_is_one() {
    let (_, client, _) = setup();
    assert_eq!(client.get_version(), 1u32);
}

// ── upgrade auth guards (no valid WASM hash needed — errors before deployer) ──

#[test]
#[should_panic]
fn test_upgrade_panics_before_admin_initialized() {
    let (env, client, _) = setup();
    let dummy_hash: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);
    let random = Address::generate(&env);
    // No admin set → must panic with Unauthorized
    client.upgrade(&random, &dummy_hash);
}

#[test]
#[should_panic]
fn test_upgrade_panics_for_non_admin() {
    let (env, client, admin) = setup();
    let attacker = Address::generate(&env);
    client.initialize_admin(&admin);
    let dummy_hash: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);
    // Wrong caller → must panic with Unauthorized
    client.upgrade(&attacker, &dummy_hash);
}

// ── migrate_v1_to_v2 ─────────────────────────────────────────────────────────

#[test]
fn test_migrate_v1_to_v2_runs_successfully() {
    let (_, client, admin) = setup();
    client.initialize_admin(&admin);
    // Must complete without panic
    client.migrate_v1_to_v2(&admin);
}

#[test]
#[should_panic]
fn test_migrate_v1_to_v2_twice_panics() {
    let (_, client, admin) = setup();
    client.initialize_admin(&admin);
    client.migrate_v1_to_v2(&admin);
    client.migrate_v1_to_v2(&admin); // must panic with AlreadyInitialized
}

#[test]
#[should_panic]
fn test_migrate_requires_admin() {
    let (env, client, admin) = setup();
    let attacker = Address::generate(&env);
    client.initialize_admin(&admin);
    client.migrate_v1_to_v2(&attacker); // must panic with Unauthorized
}

#[test]
#[should_panic]
fn test_migrate_panics_before_admin_initialized() {
    let (_, client, admin) = setup();
    // No initialize_admin call → must panic
    client.migrate_v1_to_v2(&admin);
}

// ── upgrade + identity data coexistence ──────────────────────────────────────

#[test]
fn test_existing_identities_preserved_after_admin_init() {
    use soroban_sdk::{BytesN as BN, String};

    let (env, client, admin) = setup();

    // Register identity before setting upgrade admin
    let owner = Address::generate(&env);
    let doc_hash: BN<32> = BN::from_array(&env, &[1u8; 32]);
    let cid = String::from_str(&env, "QmTest");

    let id = client.register_identity(&owner, &doc_hash, &cid);
    let identity = client.get_identity(&id);
    assert_eq!(identity.owner, owner);
    assert!(!identity.revoked);

    // Init upgrade admin — must not disturb identity records
    client.initialize_admin(&admin);

    let identity_after = client.get_identity(&id);
    assert_eq!(identity_after.owner, owner);
    assert!(!identity_after.revoked);
    assert!(!identity_after.verification_status);
}

#[test]
fn test_migration_does_not_corrupt_identity_records() {
    use soroban_sdk::{BytesN as BN, String};

    let (env, client, admin) = setup();

    let owner = Address::generate(&env);
    let doc_hash: BN<32> = BN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmMigTest");

    let id = client.register_identity(&owner, &doc_hash, &cid);

    client.initialize_admin(&admin);
    client.migrate_v1_to_v2(&admin);

    // Identity record is intact
    let identity = client.get_identity(&id);
    assert_eq!(identity.ipfs_cid, cid);
    assert!(!identity.verification_status);

    // Version remains 1 (upgrade() was not called — only migration)
    assert_eq!(client.get_version(), 1u32);
}

#[test]
fn test_verified_identity_survives_migration() {
    use soroban_sdk::{BytesN as BN, String};

    let (env, client, admin) = setup();

    let owner = Address::generate(&env);
    let doc_hash: BN<32> = BN::from_array(&env, &[3u8; 32]);
    let cid = String::from_str(&env, "QmVerTest");

    let id = client.register_identity(&owner, &doc_hash, &cid);
    client.mark_verified(&id);

    assert!(client.is_verified(&id));

    client.initialize_admin(&admin);
    client.migrate_v1_to_v2(&admin);

    // Verified flag must survive migration
    assert!(client.is_verified(&id));
}
