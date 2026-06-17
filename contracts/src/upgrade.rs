use soroban_sdk::{panic_with_error, Address, BytesN, Env};

use crate::errors::Error;

const ADMIN_KEY: &str = "upg_admin";
const VERSION_KEY: &str = "upg_ver";
const MIGRATED_V2_KEY: &str = "migrated_v2";

pub const INITIAL_VERSION: u32 = 1;

/// Set the upgrade admin. Panics if already set.
pub fn set_admin(env: &Env, admin: &Address) {
    if env.storage().instance().has(&ADMIN_KEY) {
        panic_with_error!(env, Error::AlreadyInitialized);
    }
    env.storage().instance().set(&ADMIN_KEY, admin);
    env.storage().instance().set(&VERSION_KEY, &INITIAL_VERSION);
}

/// Verify `caller` is the stored upgrade admin and require their auth.
pub fn require_admin(env: &Env, caller: &Address) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&ADMIN_KEY)
        .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
    if *caller != admin {
        panic_with_error!(env, Error::Unauthorized);
    }
    caller.require_auth();
}

/// Replace the running WASM and increment the stored version.
/// `require_admin` must be called before this.
pub fn execute_upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
    let version: u32 = env
        .storage()
        .instance()
        .get(&VERSION_KEY)
        .unwrap_or(INITIAL_VERSION);
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    env.storage().instance().set(&VERSION_KEY, &(version + 1));
}

/// v1 → v2 migration: initialise the default credential TTL (30 days).
/// Panics if migration has already run.
pub fn run_migration_v2(env: &Env) {
    if env.storage().instance().has(&MIGRATED_V2_KEY) {
        panic_with_error!(env, Error::AlreadyInitialized);
    }
    // New v2 global: default credential time-to-live in seconds
    env.storage().instance().set(&"cred_ttl", &2_592_000u64);
    env.storage().instance().set(&MIGRATED_V2_KEY, &true);
}

pub fn get_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&VERSION_KEY)
        .unwrap_or(INITIAL_VERSION)
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&ADMIN_KEY)
}

pub fn is_migrated_v2(env: &Env) -> bool {
    env.storage().instance().has(&MIGRATED_V2_KEY)
}
