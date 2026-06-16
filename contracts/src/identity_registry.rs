use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String};

use crate::errors::Error;
use crate::upgrade;

#[contracttype]
#[derive(Clone)]
pub struct Identity {
    pub owner: Address,
    pub document_hash: BytesN<32>,
    pub ipfs_cid: String,
    pub verification_status: bool,
    pub created_at: u64,
    pub revoked: bool,
}

#[contract]
pub struct IdentityRegistry;

#[contractimpl]
impl IdentityRegistry {
    pub fn register_identity(
        env: &Env,
        owner: Address,
        document_hash: BytesN<32>,
        ipfs_cid: String,
    ) -> u64 {
        owner.require_auth();

        let identity_id = env
            .storage()
            .instance()
            .get::<_, u64>(&(owner.clone(), document_hash.clone()))
            .unwrap_or(0u64)
            + 1;

        let identity = Identity {
            owner: owner.clone(),
            document_hash: document_hash.clone(),
            ipfs_cid,
            verification_status: false,
            created_at: env.ledger().timestamp(),
            revoked: false,
        };

        env.storage()
            .instance()
            .set(&(owner.clone(), document_hash.clone()), &identity_id);
        env.storage()
            .instance()
            .set(&(identity_id, "identity"), &identity);
        env.storage()
            .instance()
            .set(&(identity_id, "owner"), &owner);

        identity_id
    }

    pub fn update_identity(
        env: &Env,
        identity_id: u64,
        document_hash: BytesN<32>,
        ipfs_cid: String,
    ) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&(identity_id, "owner"))
            .ok_or(Error::IdentityNotFound)?;

        owner.require_auth();

        let mut identity: Identity = env
            .storage()
            .instance()
            .get(&(identity_id, "identity"))
            .ok_or(Error::IdentityNotFound)?;

        identity.document_hash = document_hash;
        identity.ipfs_cid = ipfs_cid;

        env.storage()
            .instance()
            .set(&(identity_id, "identity"), &identity);
        Ok(())
    }

    pub fn revoke_identity(env: &Env, identity_id: u64) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&(identity_id, "owner"))
            .ok_or(Error::IdentityNotFound)?;

        owner.require_auth();

        let mut identity: Identity = env
            .storage()
            .instance()
            .get(&(identity_id, "identity"))
            .ok_or(Error::IdentityNotFound)?;

        identity.revoked = true;

        env.storage()
            .instance()
            .set(&(identity_id, "identity"), &identity);
        Ok(())
    }

    pub fn get_identity(env: &Env, identity_id: u64) -> Result<Identity, Error> {
        env.storage()
            .instance()
            .get(&(identity_id, "identity"))
            .ok_or(Error::IdentityNotFound)
    }

    pub fn mark_verified(env: &Env, identity_id: u64) -> Result<(), Error> {
        let mut identity: Identity = env
            .storage()
            .instance()
            .get(&(identity_id, "identity"))
            .ok_or(Error::IdentityNotFound)?;

        identity.verification_status = true;

        env.storage()
            .instance()
            .set(&(identity_id, "identity"), &identity);
        Ok(())
    }

    pub fn is_verified(env: &Env, identity_id: u64) -> Result<bool, Error> {
        let identity: Identity = env
            .storage()
            .instance()
            .get(&(identity_id, "identity"))
            .ok_or(Error::IdentityNotFound)?;

        Ok(identity.verification_status && !identity.revoked)
    }

    // ── Upgradeability ────────────────────────────────────────────────────────

    /// One-time setup: designate the upgrade admin and record schema version 1.
    /// Must be called immediately after deployment; reverts if called again.
    pub fn initialize_admin(env: &Env, admin: Address) {
        admin.require_auth();
        upgrade::set_admin(env, &admin);
    }

    /// Upgrade the running contract WASM to `new_wasm_hash`.
    /// Only the upgrade admin may call this.
    ///
    /// After this call the next ledger-round executes the new code; all
    /// instance storage (identity records, permissions, …) is preserved.
    /// Run `migrate_v1_to_v2` afterwards if the new WASM introduces new
    /// storage keys.
    pub fn upgrade(env: &Env, admin: Address, new_wasm_hash: BytesN<32>) {
        upgrade::require_admin(env, &admin);
        upgrade::execute_upgrade(env, new_wasm_hash);
    }

    /// Data migration: v1 → v2.
    /// Initialises storage keys introduced in the v2 WASM that have no
    /// default value in existing instance storage.
    /// Reverts if called more than once.
    pub fn migrate_v1_to_v2(env: &Env, admin: Address) {
        upgrade::require_admin(env, &admin);
        upgrade::run_migration_v2(env);
    }

    /// Return the current schema version recorded in instance storage.
    /// Returns 1 if `initialize_admin` has not yet been called.
    pub fn get_version(env: &Env) -> u32 {
        upgrade::get_version(env)
    }

    /// Return the upgrade admin, or `None` before `initialize_admin` is called.
    pub fn get_upgrade_admin(env: &Env) -> Option<Address> {
        upgrade::get_admin(env)
    }
}
