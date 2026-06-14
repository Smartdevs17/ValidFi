use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String};

use crate::errors::Error;

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
            .get::<_, u64>(&(&owner, &document_hash))
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
            .set(&(&owner, &document_hash), &identity_id);
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
}
